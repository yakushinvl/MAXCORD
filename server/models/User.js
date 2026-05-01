const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationCode: String,
  verificationCodeExpires: Date,
  resetPasswordCode: String,
  resetPasswordExpires: Date,
  tempEmail: String,
  emailChangeCode: String,
  emailChangeCodeExpires: Date,
  avatar: {
    type: String,
    default: null
  },
  banner: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: 300,
    default: ''
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away', 'busy'],
    default: 'offline'
  },
  statusPreference: {
    type: String,
    enum: ['online', 'away', 'busy', 'offline'],
    default: 'online'
  },
  servers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notes: {
    type: Map,
    of: String, // Key is target ID (user, etc.), value is the note
    default: {}
  },
  activity: {
    name: { type: String, default: null },
    type: {
      type: String,
      enum: ['playing', 'streaming', 'listening', 'watching', 'competing', null],
      default: 'playing'
    },
    details: String,
    state: String,
    timestamps: {
      start: Number,
      end: Number
    },
    assets: {
      largeImage: String,
      largeText: String,
      smallImage: String,
      smallText: String
    }
  },
  isBot: {
    type: Boolean,
    default: false
  },
  botToken: {
    type: String,
    unique: true,
    sparse: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  badges: {
    type: [String],
    default: []
  },
  is2FAEnabled: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banExpires: Date,
  banReason: String,
  settings: {
    showActivityStatus: {
      type: Boolean,
      default: true
    },
    activityVisibility: {
      type: String,
      enum: ['everyone', 'friends', 'none'],
      default: 'everyone'
    },
    hiddenActivities: {
      type: [String],
      default: []
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);










