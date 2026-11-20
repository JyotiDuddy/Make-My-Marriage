const { sendSuccess } = require('../../shared/http/responses');

function createTaskController(service) {
  return {
    async create(req, res) {
      return sendSuccess(res, await service.createTask(req.authenticatedUser, req.body), {
        message: 'Task created successfully.',
        statusCode: 201,
      });
    },
    async list(req, res) {
      const result = await service.listTasks(req.authenticatedUser, req.query);
      return sendSuccess(res, result.tasks, {
        message: 'Tasks retrieved successfully.',
        pagination: result.pagination,
      });
    },
    async get(req, res) {
      return sendSuccess(res, await service.getTask(req.authenticatedUser, req.params.taskId));
    },
    async update(req, res) {
      return sendSuccess(res, await service.updateTask(req.authenticatedUser, req.params.taskId, req.body), {
        message: 'Task updated successfully.',
      });
    },
    async remove(req, res) {
      return sendSuccess(res, await service.deleteTask(req.authenticatedUser, req.params.taskId), {
        message: 'Task deleted successfully.',
      });
    },
  };
}

module.exports = { createTaskController };
