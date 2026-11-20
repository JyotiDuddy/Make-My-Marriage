const { sendSuccess } = require('../../shared/http/responses');

function createExpenseController(service) {
  return {
    async create(req, res) {
      return sendSuccess(res, await service.createExpense(req.authenticatedUser, req.body), {
        message: 'Expense created successfully.', statusCode: 201,
      });
    },
    async list(req, res) {
      const result = await service.listExpenses(req.authenticatedUser, req.query);
      return sendSuccess(res, result.expenses, { message: 'Expenses retrieved successfully.', pagination: result.pagination });
    },
    async get(req, res) {
      return sendSuccess(res, await service.getExpense(req.authenticatedUser, req.params.expenseId));
    },
    async update(req, res) {
      return sendSuccess(res, await service.updateExpense(req.authenticatedUser, req.params.expenseId, req.body), {
        message: 'Expense updated successfully.',
      });
    },
    async remove(req, res) {
      return sendSuccess(res, await service.deleteExpense(req.authenticatedUser, req.params.expenseId), {
        message: 'Expense deleted successfully.',
      });
    },
  };
}

module.exports = { createExpenseController };
