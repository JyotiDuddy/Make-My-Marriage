const mongoose = require('mongoose');

const { Schema } = mongoose;

const photoSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, ref: 'Wedding', required: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
  imageUrl: { type: String, required: true },
  storagePublicId: { type: String, required: true },
  uploadedByType: { type: String, enum: ['ADMIN', 'MANAGER', 'GUEST'], required: true },
  uploadedByUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required() { return this.uploadedByType !== 'GUEST'; },
  },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], required: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true });

photoSchema.index({ weddingId: 1, status: 1, createdAt: -1 });
photoSchema.index({ weddingId: 1, eventId: 1, status: 1 });

module.exports = mongoose.models.Photo || mongoose.model('Photo', photoSchema);
