const mongoose = require('mongoose');
const ApiError = require('../../shared/errors/api-error');
const Wedding = require('../wedding/wedding.model');
const Event = require('../events/event.model');
const Expense = require('./expense.model');
const { validateExpenseInput, validateExpenseQuery } = require('./expense.validation');

function notFound(message = 'The Expense or Event was not found.') {
  return new ApiError(404, 'NOT_FOUND', message);
}

function serializeExpense(expense) {
  return {
    id: expense._id.toString(),
    title: expense.title,
    category: expense.category,
    amountPaise: expense.amountPaise,
    paymentDate: expense.paymentDate,
    ...(expense.paymentMethod !== undefined ? { paymentMethod: expense.paymentMethod } : {}),
    ...(expense.eventId ? { eventId: expense.eventId.toString() } : {}),
    ...(expense.notes !== undefined ? { notes: expense.notes } : {}),
    createdBy: expense.createdBy.toString(),
    ...(expense.updatedBy ? { updatedBy: expense.updatedBy.toString() } : {}),
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

function createExpenseService({
  WeddingModel = Wedding,
  EventModel = Event,
  ExpenseModel = Expense,
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
    // Share M7's Event.updatedAt compare-and-set coordination with M6 deletion.
    const nextUpdatedAt = new Date(Math.max(now().getTime(), event.updatedAt.getTime() + 1));
    const result = await EventModel.updateOne(
      { ...filter, updatedAt: event.updatedAt },
      { $set: { updatedAt: nextUpdatedAt } },
      { session, timestamps: false },
    );
    if (result.modifiedCount !== 1) {
      throw new ApiError(409, 'CONFLICT', 'The Event changed while the Expense was being saved. Please retry.');
    }
  }

  async function createExpense(user, body) {
    const fields = validateExpenseInput(body);
    const wedding = await resolveWedding(user);
    const document = { ...fields, weddingId: wedding._id, createdBy: user._id };
    if (!fields.eventId) return serializeExpense(await ExpenseModel.create(document));

    const session = await startSession();
    try {
      let expense;
      await session.withTransaction(async () => {
        await coordinateEventAssociation(wedding._id, fields.eventId, session);
        [expense] = await ExpenseModel.create([document], { session });
      });
      return serializeExpense(expense);
    } finally {
      await session.endSession();
    }
  }

  async function listExpenses(user, query) {
    const filters = validateExpenseQuery(query);
    const wedding = await resolveWedding(user);
    const filter = { weddingId: wedding._id };
    if (filters.category) filter.category = filters.category;
    if (filters.eventId) filter.eventId = filters.eventId;
    if (filters.dateFrom || filters.dateTo) {
      filter.paymentDate = {};
      if (filters.dateFrom) filter.paymentDate.$gte = filters.dateFrom;
      if (filters.dateTo) filter.paymentDate.$lte = filters.dateTo;
    }
    const skip = (filters.page - 1) * filters.limit;
    const [expenses, totalRecords] = await Promise.all([
      ExpenseModel.find(filter).sort({ paymentDate: -1, _id: -1 }).skip(skip).limit(filters.limit),
      ExpenseModel.countDocuments(filter),
    ]);
    return {
      expenses: expenses.map(serializeExpense),
      pagination: { page: filters.page, limit: filters.limit, totalRecords, totalPages: Math.ceil(totalRecords / filters.limit) },
    };
  }

  async function getExpense(user, expenseId) {
    if (!mongoose.isValidObjectId(expenseId)) throw notFound('The Expense was not found.');
    const wedding = await resolveWedding(user);
    const expense = await ExpenseModel.findOne({ _id: expenseId, weddingId: wedding._id });
    if (!expense) throw notFound('The Expense was not found.');
    return serializeExpense(expense);
  }

  async function updateExpense(user, expenseId, body) {
    if (!mongoose.isValidObjectId(expenseId)) throw notFound('The Expense was not found.');
    const fields = validateExpenseInput(body, { partial: true });
    const wedding = await resolveWedding(user);
    const filter = { _id: expenseId, weddingId: wedding._id };
    const updateFields = { ...fields, updatedBy: user._id };
    const update = { $set: updateFields };
    if (fields.eventId === null) {
      delete updateFields.eventId;
      update.$unset = { eventId: 1 };
    }
    async function save(session) {
      return ExpenseModel.findOneAndUpdate(filter, update, {
        returnDocument: 'after', runValidators: true, ...(session ? { session } : {}),
      });
    }
    let expense;
    if (typeof fields.eventId === 'string') {
      const session = await startSession();
      try {
        await session.withTransaction(async () => {
          await coordinateEventAssociation(wedding._id, fields.eventId, session);
          expense = await save(session);
          if (!expense) throw notFound('The Expense was not found.');
        });
      } finally {
        await session.endSession();
      }
    } else {
      expense = await save();
      if (!expense) throw notFound('The Expense was not found.');
    }
    return serializeExpense(expense);
  }

  async function deleteExpense(user, expenseId) {
    if (!mongoose.isValidObjectId(expenseId)) throw notFound('The Expense was not found.');
    const wedding = await resolveWedding(user);
    const deleted = await ExpenseModel.findOneAndDelete({ _id: expenseId, weddingId: wedding._id });
    if (!deleted) throw notFound('The Expense was not found.');
    return { id: deleted._id.toString() };
  }

  return { createExpense, listExpenses, getExpense, updateExpense, deleteExpense };
}

async function hasExpensesForEvent(event, ExpenseModel = Expense) {
  return Boolean(await ExpenseModel.exists({ weddingId: event.weddingId, eventId: event._id }));
}

module.exports = { createExpenseService, hasExpensesForEvent, serializeExpense };
