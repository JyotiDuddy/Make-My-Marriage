const mongoose = require('mongoose');

const { Schema } = mongoose;

const taskSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, ref: 'Wedding', required: true },
  title: { type: String, required: true },
  description: String,
  eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
  deadline: { type: Date, required: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'COMPLETED'], required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

taskSchema.index({ weddingId: 1, status: 1, deadline: 1 });
taskSchema.index({ weddingId: 1, eventId: 1 });

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
