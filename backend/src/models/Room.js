import mongoose from 'mongoose';
import { USER_ROLES, REQUEST_STATUS, PROGRAMMING_LANGUAGES } from '../utils/constants.js';

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    language: {
      type: String,
      enum: PROGRAMMING_LANGUAGES,
      default: 'javascript',
    },
    code: {
      type: String,
      default: '',
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: [USER_ROLES.OWNER, USER_ROLES.EDITOR, USER_ROLES.VIEWER],
          required: true,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        lastSeen: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    joinRequests: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        requestedRole: {
          type: String,
          enum: [USER_ROLES.EDITOR, USER_ROLES.VIEWER],
          required: true,
        },
        status: {
          type: String,
          enum: [REQUEST_STATUS.PENDING, REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED],
          default: REQUEST_STATUS.PENDING,
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastModified: {
      type: Date,
      default: Date.now,
    },
    maxVersions: {
      type: Number,
      default: 50,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
roomSchema.index({ owner: 1 });
roomSchema.index({ 'participants.userId': 1 });
roomSchema.index({ 'joinRequests.userId': 1 });

export default mongoose.model('Room', roomSchema);
