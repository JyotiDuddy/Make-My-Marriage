const mongoose = require('mongoose');

const { Schema } = mongoose;

const expenseSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, ref: 'Wedding', required: true },
  title: { type: String, required: true },
  category: {
    type: String,
    enum: ['CATERING', 'DECORATION', 'PHOTOGRAPHY', 'VENUE', 'CLOTHING', 'TRANSPORTATION', 'ENTERTAINMENT', 'MISCELLANEOUS'],
    required: true,
  },
  amountPaise: { type: Number, required: true, min: 1, validate: Number.isInteger },
  paymentDate: { type: Date, required: true },
  paymentMethod: String,
  eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
  notes: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

expenseSchema.index({ weddingId: 1, paymentDate: -1 });
expenseSchema.index({ weddingId: 1, category: 1 });
expenseSchema.index({ weddingId: 1, eventId: 1 });

module.exports = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);
