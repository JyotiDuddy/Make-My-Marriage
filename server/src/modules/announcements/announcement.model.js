const mongoose = require('mongoose');

const { Schema } = mongoose;

const announcementSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, ref: 'Wedding', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], required: true },
  publishedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

announcementSchema.index({ weddingId: 1, status: 1, publishedAt: -1 });

module.exports = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
