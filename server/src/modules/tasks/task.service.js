const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');
const Wedding = require('../wedding/wedding.model');
const Event = require('../events/event.model');
const Task = require('./task.model');
const { validateTaskInput, validateTaskQuery } = require('./task.validation');

function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'The Task or Event was not found.');
}

function serializeTask(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    ...(task.description !== undefined ? { description: task.description } : {}),
    ...(task.eventId ? { eventId: task.eventId.toString() } : {}),
    deadline: task.deadline,
    priority: task.priority,
    status: task.status,
    createdBy: task.createdBy.toString(),
    ...(task.updatedBy ? { updatedBy: task.updatedBy.toString() } : {}),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function createTaskService({
  WeddingModel = Wedding,
  EventModel = Event,
  TaskModel = Task,
  startSession = () => mongoose.startSession(),
  now = () => new Date(),
} = {}) {
  async function resolveWedding(user) {
    const ownership = user.role === 'ADMIN' ? { adminId: user._id } : { managerId: user._id };
    const wedding = await WeddingModel.findOne(ownership).select('_id');
    if (!wedding) throw new ApiError(404, 'NOT_FOUND', 'The Wedding was not found.');
    return wedding;
  }

  async function coordinateEventAssociation(weddingId, eventId, session) {
    const filter = { _id: eventId, weddingId, deletedAt: { $exists: false } };
    const event = await EventModel.findOne(filter).select('_id updatedAt').session(session);
    if (!event) throw notFound();

    // This transactional write shares the Event document with M6's updatedAt compare-and-set
    // deletion. The timestamp is monotonic so even same-millisecond operations conflict.
    const nextUpdatedAt = new Date(Math.max(now().getTime(), event.updatedAt.getTime() + 1));
    const result = await EventModel.updateOne(
      { ...filter, updatedAt: event.updatedAt },
      { $set: { updatedAt: nextUpdatedAt } },
      { session, timestamps: false },
    );
    if (result.modifiedCount !== 1) {
      throw new ApiError(409, 'CONFLICT', 'The Event changed while the Task was being saved. Please retry.');
    }
  }

  async function createTask(user, body) {
    const fields = validateTaskInput(body);
    const wedding = await resolveWedding(user);
    const document = {
      ...fields,
      weddingId: wedding._id,
      createdBy: user._id,
    };

    if (!fields.eventId) return serializeTask(await TaskModel.create(document));

    const session = await startSession();
    try {
      let task;
      await session.withTransaction(async () => {
        await coordinateEventAssociation(wedding._id, fields.eventId, session);
        [task] = await TaskModel.create([document], { session });
      });
      return serializeTask(task);
    } finally {
      await session.endSession();
    }
  }

  async function listTasks(user, query) {
    const filters = validateTaskQuery(query);
    const wedding = await resolveWedding(user);
    const filter = { weddingId: wedding._id };
    for (const key of ['status', 'priority', 'eventId']) {
      if (filters[key] !== undefined) filter[key] = filters[key];
    }
    const skip = (filters.page - 1) * filters.limit;
    const [tasks, totalRecords] = await Promise.all([
      TaskModel.find(filter).sort({ deadline: 1, _id: 1 }).skip(skip).limit(filters.limit),
      TaskModel.countDocuments(filter),
    ]);
    return {
      tasks: tasks.map(serializeTask),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / filters.limit),
      },
    };
  }

  async function getTask(user, taskId) {
    if (!mongoose.isValidObjectId(taskId)) throw notFound();
    const wedding = await resolveWedding(user);
    const task = await TaskModel.findOne({ _id: taskId, weddingId: wedding._id });
    if (!task) throw notFound();
    return serializeTask(task);
  }

  async function updateTask(user, taskId, body) {
    if (!mongoose.isValidObjectId(taskId)) throw notFound();
    const fields = validateTaskInput(body, { partial: true });
    const wedding = await resolveWedding(user);
    const filter = { _id: taskId, weddingId: wedding._id };
    const updateFields = { ...fields, updatedBy: user._id };
    const update = { $set: updateFields };
    if (fields.eventId === null) {
      delete updateFields.eventId;
      update.$unset = { eventId: 1 };
    }

    async function save(session) {
      return TaskModel.findOneAndUpdate(filter, update, {
        returnDocument: 'after',
        runValidators: true,
        ...(session ? { session } : {}),
      });
    }

    let task;
    if (typeof fields.eventId === 'string') {
      const session = await startSession();
      try {
        await session.withTransaction(async () => {
          await coordinateEventAssociation(wedding._id, fields.eventId, session);
          task = await save(session);
          if (!task) throw notFound();
        });
      } finally {
        await session.endSession();
      }
    } else {
      task = await save();
      if (!task) throw notFound();
    }
    return serializeTask(task);
  }

  async function deleteTask(user, taskId) {
    if (!mongoose.isValidObjectId(taskId)) throw notFound();
    const wedding = await resolveWedding(user);
    const deleted = await TaskModel.findOneAndDelete({ _id: taskId, weddingId: wedding._id });
    if (!deleted) throw notFound();
    return { id: deleted._id.toString() };
  }

  return { createTask, listTasks, getTask, updateTask, deleteTask };
}

async function hasTasksForEvent(event, TaskModel = Task) {
  return Boolean(await TaskModel.exists({ weddingId: event.weddingId, eventId: event._id }));
}

module.exports = { createTaskService, hasTasksForEvent, serializeTask };
