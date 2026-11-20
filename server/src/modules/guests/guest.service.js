const mongoose = require('mongoose');
const { randomBytes } = require('node:crypto');
const ApiError = require('../../shared/errors/api-error');
const config = require('../../config/env');
const { hashToken } = require('../auth/auth.service');
const Wedding = require('../wedding/wedding.model');
const Event = require('../events/event.model');
const Guest = require('./guest.model');
const { validateGuestInput, validateGuestQuery, validateSharingStatus } = require('./guest.validation');
const { createCsvImportService } = require('./csv-import.service');

const RSVP_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function guestNotFound() { return new ApiError(404, 'NOT_FOUND', 'The Guest was not found.'); }
function conflict(message) { return new ApiError(409, 'CONFLICT', message); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function serializeGuest(guest) {
  return {
    id: guest._id.toString(),
    familyName: guest.familyName,
    ...(guest.primaryContactName !== undefined ? { primaryContactName: guest.primaryContactName } : {}),
    mobile: guest.mobile,
    ...(guest.email !== undefined ? { email: guest.email } : {}),
    ...(guest.familyGroupInfo !== undefined ? { familyGroupInfo: guest.familyGroupInfo } : {}),
    ...(guest.notes !== undefined ? { notes: guest.notes } : {}),
    weddingInvitationStatus: guest.weddingInvitationStatus,
    ...(guest.weddingInvitationSharedAt ? { weddingInvitationSharedAt: guest.weddingInvitationSharedAt } : {}),
    ...(guest.weddingInvitationSharedBy ? { weddingInvitationSharedBy: guest.weddingInvitationSharedBy.toString() } : {}),
    invitedEvents: guest.invitedEvents.map((item) => ({
      eventId: item.eventId.toString(),
      invitationStatus: item.invitationStatus,
      ...(item.sharedAt ? { sharedAt: item.sharedAt } : {}),
      ...(item.sharedBy ? { sharedBy: item.sharedBy.toString() } : {}),
    })),
    createdBy: guest.createdBy.toString(),
    ...(guest.updatedBy ? { updatedBy: guest.updatedBy.toString() } : {}),
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt,
    ...(guest.deletedAt ? { deletedAt: guest.deletedAt } : {}),
  };
}

function createGuestService({
  WeddingModel = Wedding,
  EventModel = Event,
  GuestModel = Guest,
  csvImporter = createCsvImportService({ GuestModel }),
  startSession = () => mongoose.startSession(),
  now = () => new Date(),
  generateToken = () => randomBytes(32).toString('base64url'),
  tokenLifetimeMs = RSVP_LINK_TTL_MS,
  publicOrigin = config.frontendOrigin,
  hasRsvpHistory = async (weddingId, guestId, session) => mongoose.connection.db
    .collection('rsvps').findOne({ weddingId, guestId }, { projection: { _id: 1 }, session }),
} = {}) {
  async function resolveWedding(user) {
    const owner = user.role === 'ADMIN' ? { adminId: user._id } : { managerId: user._id };
    const wedding = await WeddingModel.findOne(owner).select('_id slug');
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return wedding;
  }

  async function coordinateEventAssociation(weddingId, eventId, session) {
    const filter = { _id: eventId, weddingId, deletedAt: { $exists: false } };
    const event = await EventModel.findOne(filter).select('_id updatedAt').session(session);
    if (!event) throw new ApiError(404, 'NOT_FOUND', 'An invited Event was not found.');
    const nextUpdatedAt = new Date(Math.max(now().getTime(), event.updatedAt.getTime() + 1));
    const result = await EventModel.updateOne(
      { ...filter, updatedAt: event.updatedAt },
      { $set: { updatedAt: nextUpdatedAt } },
      { session, timestamps: false },
    );
    if (result.modifiedCount !== 1) throw conflict('The Event changed while the Guest was being saved. Please retry.');
  }

  async function validateAndCoordinateEvents(weddingId, eventIds, session) {
    const validEvents = await EventModel.find({
      _id: { $in: eventIds }, weddingId, deletedAt: { $exists: false },
    }).select('_id').session(session);
    if (validEvents.length !== eventIds.length) throw new ApiError(404, 'NOT_FOUND', 'An invited Event was not found.');
  }

  async function createGuest(user, body) {
    const fields = validateGuestInput(body);
    const wedding = await resolveWedding(user);
    const duplicate = await GuestModel.exists({ weddingId: wedding._id, mobile: fields.mobile, deletedAt: { $exists: false } });
    const guestData = {
      ...fields,
      invitedEvents: fields.invitedEvents.map((eventId) => ({ eventId, invitationStatus: 'NOT_SENT' })),
      weddingId: wedding._id,
      createdBy: user._id,
    };
    let guest;
    if (!fields.invitedEvents.length) {
      guest = await GuestModel.create(guestData);
    } else {
      const session = await startSession();
      try {
        await session.withTransaction(async () => {
          await validateAndCoordinateEvents(wedding._id, fields.invitedEvents, session);
          for (const eventId of fields.invitedEvents) await coordinateEventAssociation(wedding._id, eventId, session);
          [guest] = await GuestModel.create([guestData], { session });
        });
      } finally { await session.endSession(); }
    }
    return { guest: serializeGuest(guest), warnings: duplicate ? ['A family with this normalized mobile number already exists.'] : [] };
  }

  async function listGuests(user, query) {
    const filters = validateGuestQuery(query);
    const wedding = await resolveWedding(user);
    const filter = { weddingId: wedding._id, deletedAt: { $exists: false } };
    if (filters.search) {
      const expression = new RegExp(escapeRegExp(filters.search.trim()), 'i');
      filter.$or = [{ familyName: expression }, { primaryContactName: expression }, { mobile: expression }];
    }
    if (filters.eventId) filter['invitedEvents.eventId'] = filters.eventId;
    if (filters.invitationStatus) filter.weddingInvitationStatus = filters.invitationStatus;
    const skip = (filters.page - 1) * filters.limit;
    const [guests, totalRecords] = await Promise.all([
      GuestModel.find(filter).sort({ familyName: 1, _id: 1 }).skip(skip).limit(filters.limit),
      GuestModel.countDocuments(filter),
    ]);
    return { guests: guests.map(serializeGuest), pagination: { page: filters.page, limit: filters.limit, totalRecords, totalPages: Math.ceil(totalRecords / filters.limit) } };
  }

  async function getGuest(user, guestId) {
    if (!mongoose.isValidObjectId(guestId)) throw guestNotFound();
    const wedding = await resolveWedding(user);
    const guest = await GuestModel.findOne({ _id: guestId, weddingId: wedding._id, deletedAt: { $exists: false } });
    if (!guest) throw guestNotFound();
    return serializeGuest(guest);
  }

  async function updateGuest(user, guestId, body) {
    if (!mongoose.isValidObjectId(guestId)) throw guestNotFound();
    const fields = validateGuestInput(body, { partial: true });
    const wedding = await resolveWedding(user);
    const filter = { _id: guestId, weddingId: wedding._id, deletedAt: { $exists: false } };
    const duplicate = fields.mobile
      ? Boolean(await GuestModel.exists({ _id: { $ne: guestId }, weddingId: wedding._id, mobile: fields.mobile, deletedAt: { $exists: false } }))
      : false;
    let guest;
    if (fields.invitedEvents) {
      const existing = await GuestModel.findOne(filter).select('invitedEvents');
      if (!existing) throw guestNotFound();
      const oldIds = new Set(existing.invitedEvents.map((item) => item.eventId.toString()));
      const toCoordinate = fields.invitedEvents.filter((id) => !oldIds.has(id));
      const oldById = new Map(existing.invitedEvents.map((item) => [item.eventId.toString(), item.toObject()]));
      const invitedEvents = fields.invitedEvents.map((eventId) => oldById.get(eventId) ?? { eventId, invitationStatus: 'NOT_SENT' });
      const session = await startSession();
      try {
        await session.withTransaction(async () => {
          await validateAndCoordinateEvents(wedding._id, fields.invitedEvents, session);
          for (const eventId of toCoordinate) await coordinateEventAssociation(wedding._id, eventId, session);
          guest = await GuestModel.findOneAndUpdate(filter, { $set: { ...fields, invitedEvents, updatedBy: user._id } }, {
            returnDocument: 'after', runValidators: true, session,
          });
          if (!guest) throw guestNotFound();
        });
      } finally { await session.endSession(); }
    } else {
      guest = await GuestModel.findOneAndUpdate(filter, { $set: { ...fields, updatedBy: user._id } }, { returnDocument: 'after', runValidators: true });
      if (!guest) throw guestNotFound();
    }
    return { guest: serializeGuest(guest), warnings: duplicate ? ['A family with this normalized mobile number already exists.'] : [] };
  }

  async function deleteGuest(user, guestId) {
    if (!mongoose.isValidObjectId(guestId)) throw guestNotFound();
    const wedding = await resolveWedding(user);
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const guest = await GuestModel.findOne({ _id: guestId, weddingId: wedding._id, deletedAt: { $exists: false } }).session(session);
        if (!guest) throw guestNotFound();
        const history = await hasRsvpHistory(wedding._id, guest._id, session);
        const at = now();
        if (history) {
          guest.deletedAt = at;
          guest.updatedBy = user._id;
          if (guest.rsvpAccess) guest.rsvpAccess.revokedAt = at;
          else guest.rsvpAccess = { revokedAt: at };
          await guest.save({ session });
          result = { id: guest._id.toString(), deletedAt: at, softDeleted: true };
          return;
        }
        const deleted = await GuestModel.deleteOne({ _id: guest._id, weddingId: wedding._id, deletedAt: { $exists: false } }, { session });
        if (deleted.deletedCount !== 1) throw guestNotFound();
        result = { id: guest._id.toString(), deletedAt: at, softDeleted: false };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async function updateCommonInvitationSharing(user, guestId, body) {
    if (!mongoose.isValidObjectId(guestId)) throw guestNotFound();
    const status = validateSharingStatus(body);
    const wedding = await resolveWedding(user);
    const set = { weddingInvitationStatus: status, updatedBy: user._id };
    const unset = {};
    if (status === 'SHARED') { set.weddingInvitationSharedAt = now(); set.weddingInvitationSharedBy = user._id; }
    else { unset.weddingInvitationSharedAt = 1; unset.weddingInvitationSharedBy = 1; }
    const guest = await GuestModel.findOneAndUpdate(
      { _id: guestId, weddingId: wedding._id, deletedAt: { $exists: false } },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { returnDocument: 'after', runValidators: true },
    );
    if (!guest) throw guestNotFound();
    return serializeGuest(guest);
  }

  async function updateEventInvitationSharing(user, guestId, eventId, body) {
    if (!mongoose.isValidObjectId(guestId) || !mongoose.isValidObjectId(eventId)) throw guestNotFound();
    const status = validateSharingStatus(body);
    const wedding = await resolveWedding(user);
    const event = await EventModel.findOne({ _id: eventId, weddingId: wedding._id, deletedAt: { $exists: false } }).select('_id');
    if (!event) throw new ApiError(404, 'NOT_FOUND', 'The invited Event was not found.');
    const guest = await GuestModel.findOne({ _id: guestId, weddingId: wedding._id, deletedAt: { $exists: false }, 'invitedEvents.eventId': event._id });
    if (!guest) throw guestNotFound();
    const set = { 'invitedEvents.$[item].invitationStatus': status, updatedBy: user._id };
    const unset = {};
    if (status === 'SHARED') {
      set['invitedEvents.$[item].sharedAt'] = now();
      set['invitedEvents.$[item].sharedBy'] = user._id;
    } else {
      unset['invitedEvents.$[item].sharedAt'] = 1;
      unset['invitedEvents.$[item].sharedBy'] = 1;
    }
    const updated = await GuestModel.findOneAndUpdate(
      { _id: guest._id, weddingId: wedding._id, deletedAt: { $exists: false }, 'invitedEvents.eventId': event._id },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { arrayFilters: [{ 'item.eventId': event._id }], returnDocument: 'after', runValidators: true },
    );
    if (!updated) throw guestNotFound();
    return serializeGuest(updated);
  }

  async function importGuests(user, file) {
    const wedding = await resolveWedding(user);
    return csvImporter.importGuests(user, file, wedding);
  }

  async function generateRsvpLink(user, guestId) {
    if (!mongoose.isValidObjectId(guestId)) throw guestNotFound();
    const wedding = await resolveWedding(user);
    const token = generateToken();
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + tokenLifetimeMs);
    const guest = await GuestModel.findOneAndUpdate(
      { _id: guestId, weddingId: wedding._id, deletedAt: { $exists: false } },
      { $set: { rsvpAccess: { tokenHash: hashToken(token), createdAt, expiresAt, revokedAt: null }, updatedBy: user._id } },
      { returnDocument: 'after', runValidators: true },
    ).select('_id');
    if (!guest) throw guestNotFound();
    const rsvpUrl = new URL(`/wedding/${encodeURIComponent(wedding.slug)}/rsvp/${token}`, publicOrigin).toString();
    return { rsvpUrl, expiresAt };
  }

  async function findActiveGuestByRsvpToken(token) {
    if (typeof token !== 'string' || !token) return null;
    return GuestModel.findOne({
      'rsvpAccess.tokenHash': hashToken(token),
      'rsvpAccess.expiresAt': { $gt: now() },
      'rsvpAccess.revokedAt': null,
      deletedAt: { $exists: false },
    });
  }

  return {
    createGuest,
    listGuests,
    getGuest,
    updateGuest,
    deleteGuest,
    updateCommonInvitationSharing,
    updateEventInvitationSharing,
    importGuests,
    generateRsvpLink,
    findActiveGuestByRsvpToken,
  };
}

async function hasGuestsForEvent(event, GuestModel = Guest) {
  return Boolean(await GuestModel.exists({ weddingId: event.weddingId, 'invitedEvents.eventId': event._id }));
}

module.exports = { createGuestService, hasGuestsForEvent, serializeGuest, RSVP_LINK_TTL_MS };
