const mongoose = require('mongoose');

const { Schema } = mongoose;

const invitedEventSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  invitationStatus: { type: String, enum: ['NOT_SENT', 'SHARED'], default: 'NOT_SENT', required: true },
  sharedAt: Date,
  sharedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const rsvpAccessSchema = new Schema({
  tokenHash: String,
  createdAt: Date,
  expiresAt: Date,
  revokedAt: Date,
}, { _id: false });

const guestSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, ref: 'Wedding', required: true },
  familyName: { type: String, required: true },
  primaryContactName: String,
  mobile: { type: String, required: true },
  email: String,
  familyGroupInfo: String,
  notes: String,
  weddingInvitationStatus: { type: String, enum: ['NOT_SENT', 'SHARED'], required: true, default: 'NOT_SENT' },
  weddingInvitationSharedAt: Date,
  weddingInvitationSharedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  invitedEvents: { type: [invitedEventSchema], required: true, default: undefined },
  rsvpAccess: { type: rsvpAccessSchema, default: undefined },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: Date,
}, { timestamps: true });

guestSchema.index({ weddingId: 1, familyName: 1 });
guestSchema.index({ weddingId: 1, mobile: 1 });
guestSchema.index({ weddingId: 1, 'invitedEvents.eventId': 1 });
guestSchema.index(
  { 'rsvpAccess.tokenHash': 1 },
  { unique: true, partialFilterExpression: { 'rsvpAccess.tokenHash': { $type: 'string' } } },
);

module.exports = mongoose.models.Guest || mongoose.model('Guest', guestSchema);
