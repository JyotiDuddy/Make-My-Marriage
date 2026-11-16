const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required() {
        return this.role === 'ADMIN' || (this.role === 'MANAGER' && this.status === 'ACTIVE');
      },
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MANAGER'],
      required: true,
    },
    status: {
      type: String,
      enum: ['INVITED', 'ACTIVE', 'DISABLED'],
      required: true,
    },
    activationTokenHash: String,
    activationExpiresAt: Date,
    activatedAt: Date,
    passwordResetTokenHash: String,
    passwordResetExpiresAt: Date,
  },
  {
    timestamps: true,
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index(
  { activationTokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { activationTokenHash: { $type: 'string' } },
  },
);
userSchema.index(
  { passwordResetTokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { passwordResetTokenHash: { $type: 'string' } },
  },
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
