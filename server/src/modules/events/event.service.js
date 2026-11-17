const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');
const Wedding = require('../wedding/wedding.model');
const Event = require('./event.model');
const {
  validateEventInput,
  validateEventQuery,
  validateStatus,
} = require('./event.validation');

function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'The Event was not found.');
}

function conflict() {
  return new ApiError(409, 'CONFLICT', 'This Event has dependent records and cannot be deleted. Cancel it to preserve its history.');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeEvent(event) {
  return {
    id: event._id.toString(),
    name: event.name,
    eventDate: event.eventDate,
    startTime: event.startTime,
    ...(event.endTime !== undefined ? { endTime: event.endTime } : {}),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    ...(event.googleMapsUrl !== undefined ? { googleMapsUrl: event.googleMapsUrl } : {}),
    ...(event.description !== undefined ? { description: event.description } : {}),
    ...(event.foodMenu !== undefined ? { foodMenu: event.foodMenu.map((entry) => ({
      category: entry.category,
      items: [...entry.items],
    })) } : {}),
    status: event.status,
    isPublished: event.isPublished,
    video: event.video ? {
      videoType: event.video.videoType,
      provider: event.video.provider,
      url: event.video.url,
      videoId: event.video.videoId,
    } : null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function createEventService({
  WeddingModel = Wedding,
  EventModel = Event,
  eventDependencyChecks = [],
  now = () => new Date(),
} = {}) {
  async function resolveWedding(user) {
    const ownership = user.role === 'ADMIN' ? { adminId: user._id } : { managerId: user._id };
    const wedding = await WeddingModel.findOne(ownership).select('_id');
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return wedding;
  }

  function scopedEventFilter(weddingId, eventId) {
    if (!mongoose.isValidObjectId(eventId)) throw notFound();
    return { _id: eventId, weddingId, deletedAt: { $exists: false } };
  }

  async function createEvent(user, body) {
    const fields = validateEventInput(body);
    const wedding = await resolveWedding(user);
    const event = await EventModel.create({
      ...fields,
      weddingId: wedding._id,
      createdBy: user._id,
    });
    return serializeEvent(event);
  }

  async function listEvents(user, query) {
    const filters = validateEventQuery(query);
    const wedding = await resolveWedding(user);
    const filter = { weddingId: wedding._id, deletedAt: { $exists: false } };
    if (filters.status) filter.status = filters.status;
    if (filters.eventDate) filter.eventDate = filters.eventDate;
    if (filters.search) filter.name = { $regex: escapeRegExp(filters.search), $options: 'i' };

    const skip = (filters.page - 1) * filters.limit;
    const [events, totalRecords] = await Promise.all([
      EventModel.find(filter).sort({ eventDate: 1, startTime: 1, _id: 1 }).skip(skip).limit(filters.limit),
      EventModel.countDocuments(filter),
    ]);
    return {
      events: events.map(serializeEvent),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / filters.limit),
      },
    };
  }

  async function getEvent(user, eventId) {
    const wedding = await resolveWedding(user);
    const event = await EventModel.findOne(scopedEventFilter(wedding._id, eventId));
    if (!event) throw notFound();
    return serializeEvent(event);
  }

  async function updateEvent(user, eventId, body) {
    const fields = validateEventInput(body, { partial: true });
    const wedding = await resolveWedding(user);
    const event = await EventModel.findOneAndUpdate(
      scopedEventFilter(wedding._id, eventId),
      { $set: { ...fields, updatedBy: user._id } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!event) throw notFound();
    return serializeEvent(event);
  }

  async function updateEventStatus(user, eventId, body) {
    const status = validateStatus(body);
    const wedding = await resolveWedding(user);
    const event = await EventModel.findOneAndUpdate(
      scopedEventFilter(wedding._id, eventId),
      { $set: { status, updatedBy: user._id } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!event) throw notFound();
    return serializeEvent(event);
  }

  async function deleteEvent(user, eventId) {
    const wedding = await resolveWedding(user);
    const filter = scopedEventFilter(wedding._id, eventId);
    const event = await EventModel.findOne(filter);
    if (!event) throw notFound();

    for (const checkDependency of eventDependencyChecks) {
      if (await checkDependency(event)) throw conflict();
    }

    const deletedAt = now();
    const deleted = await EventModel.findOneAndUpdate(
      { ...filter, updatedAt: event.updatedAt },
      { $set: { deletedAt, updatedBy: user._id } },
      { returnDocument: 'after', runValidators: true },
    );
    if (!deleted) throw conflict();
    return { id: deleted._id.toString(), deletedAt: deleted.deletedAt };
  }

  return { createEvent, listEvents, getEvent, updateEvent, updateEventStatus, deleteEvent };
}

module.exports = { createEventService, serializeEvent };
