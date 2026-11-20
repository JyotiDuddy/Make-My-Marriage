const ApiError = require('../../shared/errors/api-error');
const Wedding = require('../wedding/wedding.model');
const Announcement = require('./announcement.model');
const { validateAnnouncementId, validateAnnouncementInput, validateAnnouncementQuery } = require('./announcement.validation');

function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'The Announcement was not found.');
}

function serializeAnnouncement(announcement) {
  return {
    id: announcement._id.toString(),
    title: announcement.title,
    description: announcement.description,
    status: announcement.status,
    ...(announcement.publishedAt ? { publishedAt: announcement.publishedAt } : {}),
    createdBy: announcement.createdBy.toString(),
    ...(announcement.updatedBy ? { updatedBy: announcement.updatedBy.toString() } : {}),
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  };
}

function createAnnouncementService({
  WeddingModel = Wedding,
  AnnouncementModel = Announcement,
  now = () => new Date(),
} = {}) {
  async function resolveWedding(user) {
    const ownership = user.role === 'ADMIN' ? { adminId: user._id } : { managerId: user._id };
    const wedding = await WeddingModel.findOne(ownership).select('_id');
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return wedding;
  }

  async function createAnnouncement(user, body) {
    const fields = validateAnnouncementInput(body);
    const wedding = await resolveWedding(user);
    const announcement = await AnnouncementModel.create({
      ...fields,
      weddingId: wedding._id,
      createdBy: user._id,
      ...(fields.status === 'PUBLISHED' ? { publishedAt: now() } : {}),
    });
    return serializeAnnouncement(announcement);
  }

  async function listAnnouncements(user, query) {
    const filters = validateAnnouncementQuery(query);
    const wedding = await resolveWedding(user);
    const filter = { weddingId: wedding._id };
    if (filters.status) filter.status = filters.status;
    const skip = (filters.page - 1) * filters.limit;
    const [announcements, totalRecords] = await Promise.all([
      AnnouncementModel.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(filters.limit),
      AnnouncementModel.countDocuments(filter),
    ]);
    return {
      announcements: announcements.map(serializeAnnouncement),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / filters.limit),
      },
    };
  }

  async function getAnnouncement(user, announcementId) {
    validateAnnouncementId(announcementId);
    const wedding = await resolveWedding(user);
    const announcement = await AnnouncementModel.findOne({ _id: announcementId, weddingId: wedding._id });
    if (!announcement) throw notFound();
    return serializeAnnouncement(announcement);
  }

  async function updateAnnouncement(user, announcementId, body) {
    validateAnnouncementId(announcementId);
    const fields = validateAnnouncementInput(body, { partial: true });
    const wedding = await resolveWedding(user);
    const filter = { _id: announcementId, weddingId: wedding._id };
    const current = await AnnouncementModel.findOne(filter);
    if (!current) throw notFound();

    const update = { $set: { ...fields, updatedBy: user._id } };
    if (fields.status === 'PUBLISHED' && current.status !== 'PUBLISHED') {
      update.$set.publishedAt = now();
    } else if (fields.status === 'DRAFT' && current.status !== 'DRAFT') {
      update.$unset = { publishedAt: 1 };
    }

    const announcement = await AnnouncementModel.findOneAndUpdate(filter, update, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!announcement) throw notFound();
    return serializeAnnouncement(announcement);
  }

  async function deleteAnnouncement(user, announcementId) {
    validateAnnouncementId(announcementId);
    const wedding = await resolveWedding(user);
    const deleted = await AnnouncementModel.findOneAndDelete({ _id: announcementId, weddingId: wedding._id });
    if (!deleted) throw notFound();
    return { id: deleted._id.toString() };
  }

  return { createAnnouncement, listAnnouncements, getAnnouncement, updateAnnouncement, deleteAnnouncement };
}

module.exports = { createAnnouncementService, serializeAnnouncement };
