const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');
const Guest = require('../guests/guest.model');
const Wedding = require('../wedding/wedding.model');
const Event = require('../events/event.model');
const RSVP = require('./rsvp.model');
const { hashToken } = require('../auth/auth.service');
const { validateRsvpInput, validateRsvpToken } = require('./rsvp.validation');

function invalidToken() {
  // Keep all token failures indistinguishable so the route is not a family oracle.
  return new ApiError(404, 'TOKEN_INVALID', 'The RSVP link is invalid or no longer available.');
}

function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'The requested RSVP event was not found.');
}

function createRsvpService({
  GuestModel = Guest,
  WeddingModel = Wedding,
  EventModel = Event,
  RsvpModel = RSVP,
  startSession = () => mongoose.startSession(),
  now = () => new Date(),
} = {}) {
  async function findActiveGuest(token, session) {
    if (!validateRsvpToken(token)) throw invalidToken();
    let query = GuestModel.findOne({
      'rsvpAccess.tokenHash': hashToken(token),
      'rsvpAccess.expiresAt': { $gt: now() },
      'rsvpAccess.revokedAt': null,
      deletedAt: { $exists: false },
    });
    if (session) query = query.session(session);
    const guest = await query;
    if (!guest) throw invalidToken();
    return guest;
  }

  async function getFamilyRsvp(token) {
    const guest = await findActiveGuest(token);
    const wedding = await WeddingModel.findById(guest.weddingId).select('_id title slug');
    if (!wedding) throw invalidToken();

    const invitedIds = guest.invitedEvents.map((entry) => entry.eventId);
    const events = invitedIds.length ? await EventModel.find({
      _id: { $in: invitedIds },
      weddingId: guest.weddingId,
      deletedAt: { $exists: false },
      status: { $ne: 'CANCELLED' },
    }).select('_id name eventDate status').sort({ eventDate: 1, startTime: 1, _id: 1 }) : [];
    const rsvps = events.length ? await RsvpModel.find({
      weddingId: guest.weddingId,
      guestId: guest._id,
      eventId: { $in: events.map((event) => event._id) },
    }).select('eventId response') : [];
    const responseByEventId = new Map(rsvps.map((rsvp) => [rsvp.eventId.toString(), rsvp.response]));

    return {
      familyName: guest.familyName,
      wedding: { title: wedding.title, slug: wedding.slug },
      events: events.map((event) => ({
        eventId: event._id.toString(),
        name: event.name,
        eventDate: event.eventDate,
        status: event.status,
        existingResponse: responseByEventId.get(event._id.toString()) ?? null,
        canRespond: true,
      })),
    };
  }

  async function submitRsvp(token, eventId, body) {
    const response = validateRsvpInput(body);
    if (!mongoose.isValidObjectId(eventId)) throw notFound();
    // Validate before opening a transaction, then recheck inside it to handle
    // revocation, event cancellation, and concurrent event deletion safely.
    await findActiveGuest(token);
    async function saveInTransaction(session) {
      let saved;
      await session.withTransaction(async () => {
        const guest = await findActiveGuest(token, session);
        const weddingId = guest.weddingId;
        const invited = guest.invitedEvents.some((entry) => entry.eventId.toString() === eventId);
        if (!invited) throw new ApiError(403, 'EVENT_NOT_INVITED', 'This family is not invited to the Event.');

        const eventFilter = { _id: eventId, weddingId, deletedAt: { $exists: false } };
        const event = await EventModel.findOne(eventFilter).select('_id status updatedAt').session(session);
        if (!event) throw notFound();
        if (event.status === 'CANCELLED') {
          throw new ApiError(409, 'EVENT_CANCELLED', 'A cancelled Event cannot accept RSVP responses.');
        }

        // Shared Event.updatedAt compare-and-set coordinates with M6 deletion
        // and M7–M10 Event association writes.
        const nextEventUpdatedAt = new Date(Math.max(now().getTime(), event.updatedAt.getTime() + 1));
        const eventLock = await EventModel.updateOne(
          { ...eventFilter, updatedAt: event.updatedAt },
          { $set: { updatedAt: nextEventUpdatedAt } },
          { session, timestamps: false },
        );
        if (eventLock.modifiedCount !== 1) {
          throw new ApiError(409, 'CONFLICT', 'The Event changed while the RSVP was being saved. Please retry.');
        }

        // Touch the Guest in the same transaction so concurrent token
        // regeneration/deletion cannot commit alongside a stale-token RSVP.
        const nextGuestUpdatedAt = new Date(Math.max(now().getTime(), guest.updatedAt.getTime() + 1));
        const guestLock = await GuestModel.updateOne(
          {
            _id: guest._id,
            weddingId,
            updatedAt: guest.updatedAt,
            'rsvpAccess.tokenHash': hashToken(token),
            'rsvpAccess.expiresAt': { $gt: now() },
            'rsvpAccess.revokedAt': null,
            deletedAt: { $exists: false },
          },
          { $set: { updatedAt: nextGuestUpdatedAt } },
          { session, timestamps: false },
        );
        if (guestLock.modifiedCount !== 1) throw invalidToken();

        const rsvpFilter = { weddingId, guestId: guest._id, eventId: event._id };
        const existing = await RsvpModel.findOne(rsvpFilter).session(session);
        if (existing?.response === response) {
          saved = existing;
          return;
        }
        if (existing) {
          saved = await RsvpModel.findOneAndUpdate(
            rsvpFilter,
            { $set: { response, respondedAt: now() } },
            { returnDocument: 'after', runValidators: true, session },
          );
          return;
        }
        saved = await RsvpModel.findOneAndUpdate(
          rsvpFilter,
          { $set: { response, respondedAt: now() }, $setOnInsert: rsvpFilter },
          { upsert: true, returnDocument: 'after', runValidators: true, session, setDefaultsOnInsert: true },
        );
      });
      return { eventId: saved.eventId.toString(), response: saved.response, respondedAt: saved.respondedAt };
    }

    const session = await startSession();
    let sessionEnded = false;
    try {
      try {
        return await saveInTransaction(session);
      } catch (error) {
        if (error?.code !== 11000) throw error;
        // Retry duplicate-key races through the same full validation and
        // transaction path, never as an unscoped response-only update.
        await session.endSession();
        sessionEnded = true;
        const retrySession = await startSession();
        try {
          return await saveInTransaction(retrySession);
        } finally {
          await retrySession.endSession();
        }
      }
    } finally {
      if (session.inTransaction()) await session.abortTransaction().catch(() => {});
      if (!sessionEnded) await session.endSession();
    }
  }

  return { getFamilyRsvp, submitRsvp };
}

async function hasRsvpsForEvent(event, RsvpModel = RSVP) {
  return Boolean(await RsvpModel.exists({ weddingId: event.weddingId, eventId: event._id }));
}

module.exports = { createRsvpService, hasRsvpsForEvent };
