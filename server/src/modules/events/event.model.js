const mongoose = require('mongoose');

const { Schema } = mongoose;

const foodMenuSchema = new Schema({
  category: { type: String, required: true },
  items: {
    type: [{ type: String, required: true }],
    required: true,
  },
}, { _id: false });

const videoSchema = new Schema({
  videoType: { type: String, enum: ['LIVE', 'RECORDED'], required: true },
  provider: { type: String, enum: ['YOUTUBE'], default: 'YOUTUBE', required: true },
  url: { type: String, required: true },
  videoId: { type: String, required: true },
}, { _id: false });

const eventSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, ref: 'Wedding', required: true },
  name: { type: String, required: true },
  eventDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  startTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  venueName: { type: String, required: true },
  venueAddress: { type: String, required: true },
  googleMapsUrl: String,
  description: String,
  foodMenu: { type: [foodMenuSchema], default: undefined },
  status: { type: String, enum: ['UPCOMING', 'COMPLETED', 'CANCELLED'], required: true },
  isPublished: { type: Boolean, required: true },
  video: { type: videoSchema, default: undefined },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: Date,
}, { timestamps: true });

eventSchema.index({ weddingId: 1, eventDate: 1, startTime: 1 });
eventSchema.index({ weddingId: 1, isPublished: 1, eventDate: 1 });
eventSchema.index({ weddingId: 1, status: 1 });

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
