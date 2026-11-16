const mongoose = require('mongoose');

const { Schema } = mongoose;

const coverImageSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const ourStoryImageSchema = new Schema({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  altText: {
    type: String,
    required: true,
  },
});

const ourStorySchema = new Schema(
  {
    description: {
      type: String,
      default: '',
    },
    images: {
      type: [ourStoryImageSchema],
      default: [],
      validate: {
        validator(images) {
          return images.length <= 2;
        },
        message: 'Our Story supports a maximum of two images.',
      },
    },
  },
  { _id: false },
);

function isIanaTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const weddingSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
    },
    partnerOneName: {
      type: String,
      required: true,
    },
    partnerTwoName: {
      type: String,
      required: true,
    },
    weddingDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    timeZone: {
      type: String,
      required: true,
      validate: {
        validator: isIanaTimeZone,
        message: 'timeZone must be a valid IANA timezone.',
      },
    },
    introduction: String,
    coverImage: {
      type: coverImageSchema,
      default: undefined,
    },
    ourStory: {
      type: ourStorySchema,
      default: undefined,
    },
    slug: {
      type: String,
      required: true,
    },
    websitePublished: {
      type: Boolean,
      required: true,
      default: false,
    },
    publishedAt: Date,
  },
  {
    timestamps: true,
  },
);

weddingSchema.index({ adminId: 1 }, { unique: true });
weddingSchema.index({ managerId: 1 });
weddingSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.models.Wedding || mongoose.model('Wedding', weddingSchema);
