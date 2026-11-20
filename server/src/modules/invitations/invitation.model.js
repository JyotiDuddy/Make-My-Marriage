const mongoose = require('mongoose');

const { Schema } = mongoose;

const invitationSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, ref: 'Wedding', required: true },
  type: { type: String, enum: ['COMMON', 'EVENT'], required: true },
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required() { return this.type === 'EVENT'; },
    validate: {
      validator(value) { return this.type !== 'COMMON' || value == null; },
      message: 'A COMMON invitation cannot reference an Event.',
    },
  },
  imageUrl: { type: String, required: true },
  storagePublicId: { type: String, required: true },
  fileName: String,
  format: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

invitationSchema.index(
  { weddingId: 1 },
  { unique: true, partialFilterExpression: { type: 'COMMON' } },
);
invitationSchema.index(
  { weddingId: 1, eventId: 1 },
  { unique: true, partialFilterExpression: { type: 'EVENT' } },
);

module.exports = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);
