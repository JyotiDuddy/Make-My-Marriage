const ApiError = require('../../shared/errors/api-error');
const Wedding = require('../wedding/wedding.model');
const Event = require('../events/event.model');
const Expense = require('../expenses/expense.model');
const Guest = require('../guests/guest.model');
const RSVP = require('../rsvp/rsvp.model');
const Task = require('../tasks/task.model');

function countFrom(result) {
  return result[0]?.count ?? 0;
}

function createDashboardService({
  WeddingModel = Wedding,
  EventModel = Event,
  ExpenseModel = Expense,
  GuestModel = Guest,
  RsvpModel = RSVP,
  TaskModel = Task,
  now = () => new Date(),
} = {}) {
  async function resolveWedding(user) {
    const owner = user.role === 'ADMIN' ? { adminId: user._id } : { managerId: user._id };
    const wedding = await WeddingModel.findOne(owner).select('_id timeZone');
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return wedding;
  }

  async function getSummary(user) {
    const wedding = await resolveWedding(user);
    const at = now();
    const weddingId = wedding._id;

    const upcomingEventPipeline = [
      { $match: { weddingId, status: 'UPCOMING', deletedAt: { $exists: false } } },
      {
        $addFields: {
          dashboardEventInstant: {
            $dateFromString: {
              dateString: { $concat: ['$eventDate', 'T', '$startTime', ':00'] },
              format: '%Y-%m-%dT%H:%M:%S',
              timezone: wedding.timeZone,
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { $expr: { $gte: ['$dashboardEventInstant', at] } } },
      { $count: 'count' },
    ];

    const familyRsvpPipeline = [
      { $match: { weddingId, deletedAt: { $exists: false } } },
      { $unwind: '$invitedEvents' },
      {
        $lookup: {
          from: EventModel.collection.name,
          let: { invitedEventId: '$invitedEvents.eventId' },
          pipeline: [
            { $match: { weddingId, deletedAt: { $exists: false }, status: { $ne: 'CANCELLED' } } },
            { $match: { $expr: { $eq: ['$_id', '$$invitedEventId'] } } },
            { $project: { _id: 1 } },
          ],
          as: 'eligibleEvent',
        },
      },
      { $match: { $expr: { $gt: [{ $size: '$eligibleEvent' }, 0] } } },
      {
        $group: {
          _id: {
            weddingId: '$weddingId',
            guestId: '$_id',
            eventId: '$invitedEvents.eventId',
          },
        },
      },
      {
        $lookup: {
          from: RsvpModel.collection.name,
          let: { familyId: '$_id.guestId', invitedEventId: '$_id.eventId' },
          pipeline: [
            {
              $match: {
                weddingId,
                $expr: {
                  $and: [
                    { $eq: ['$guestId', '$$familyId'] },
                    { $eq: ['$eventId', '$$invitedEventId'] },
                  ],
                },
              },
            },
            { $project: { _id: 0, response: 1 } },
          ],
          as: 'existingRsvp',
        },
      },
      { $unwind: { path: '$existingRsvp', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          acceptedRsvps: { $sum: { $cond: [{ $eq: ['$existingRsvp.response', 'YES'] }, 1, 0] } },
          pendingRsvps: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$existingRsvp.response', null] }, null] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, acceptedRsvps: 1, pendingRsvps: 1 } },
    ];

    const upcomingTaskPipeline = [
      {
        $match: {
          weddingId,
          status: { $in: ['TODO', 'IN_PROGRESS'] },
          deadline: { $gte: at },
        },
      },
      {
        $lookup: {
          from: EventModel.collection.name,
          let: { taskEventId: '$eventId' },
          pipeline: [
            { $match: { weddingId, deletedAt: { $exists: false }, status: { $ne: 'CANCELLED' } } },
            { $match: { $expr: { $eq: ['$_id', '$$taskEventId'] } } },
            { $project: { _id: 1 } },
          ],
          as: 'eligibleEvent',
        },
      },
      {
        $match: {
          $expr: {
            $or: [
              { $eq: [{ $ifNull: ['$eventId', null] }, null] },
              { $gt: [{ $size: '$eligibleEvent' }, 0] },
            ],
          },
        },
      },
      { $count: 'count' },
    ];

    const [
      totalEvents,
      upcomingEvents,
      expenseTotals,
      totalFamilies,
      rsvpTotals,
      upcomingTaskTotals,
    ] = await Promise.all([
      EventModel.countDocuments({ weddingId, deletedAt: { $exists: false } }),
      EventModel.aggregate(upcomingEventPipeline),
      ExpenseModel.aggregate([
        { $match: { weddingId } },
        { $group: { _id: null, total: { $sum: { $toLong: '$amountPaise' } } } },
        { $project: { _id: 0, total: 1 } },
      ]),
      GuestModel.countDocuments({ weddingId, deletedAt: { $exists: false } }),
      GuestModel.aggregate(familyRsvpPipeline),
      TaskModel.aggregate(upcomingTaskPipeline),
    ]);

    return {
      totalEvents,
      upcomingEvents: countFrom(upcomingEvents),
      totalExpensesPaise: expenseTotals[0]?.total ?? 0,
      totalFamilies,
      acceptedRsvps: rsvpTotals[0]?.acceptedRsvps ?? 0,
      pendingRsvps: rsvpTotals[0]?.pendingRsvps ?? 0,
      upcomingTasks: countFrom(upcomingTaskTotals),
    };
  }

  return { getSummary };
}

module.exports = { createDashboardService };
