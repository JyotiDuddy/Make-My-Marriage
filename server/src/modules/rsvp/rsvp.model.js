const mongoose = require('mongoose');

const { Schema } = mongoose;

const rsvpSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, ref: 'Wedding', required: true },
  guestId: { type: Schema.Types.ObjectId, ref: 'Guest', required: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  response: { type: String, enum: ['YES', 'NO'], required: true },
  respondedAt: { type: Date, required: true },
}, { timestamps: true });

rsvpSchema.index({ weddingId: 1, guestId: 1, eventId: 1 }, { unique: true });
rsvpSchema.index({ weddingId: 1, eventId: 1, response: 1 });

module.exports = mongoose.models.RSVP || mongoose.model('RSVP', rsvpSchema);
