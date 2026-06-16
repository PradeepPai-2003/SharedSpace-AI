import mongoose from 'mongoose';

const spaceMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const spaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Space name is required'],
      maxlength: [100, 'Space name cannot exceed 100 characters'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [spaceMemberSchema],
    inviteToken: {
      type: String,
      unique: true,
      sparse: true, // sparse because some spaces might not have invite token instantly
    },
    inviteExpiry: {
      type: Date,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    hasAI: {
      type: Boolean,
      default: true,
    },
    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
      },
    ],
    deletedChatByUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
spaceSchema.index({ createdBy: 1 });
spaceSchema.index({ 'members.user': 1 });

const Space = mongoose.model('Space', spaceSchema);
export default Space;
