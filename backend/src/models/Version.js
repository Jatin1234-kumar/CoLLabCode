import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    code: {
      type: String,
      default: '',
    },
    label: {
      type: String,
      default: null,
    },
    snapshot: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups by room
versionSchema.index({ room: 1, createdAt: -1 });

export default mongoose.model('Version', versionSchema);
