const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  color: {
    type: String,
    default: '#99aab5'
  },
  hoist: {
    type: Boolean,
    default: false
  },
  position: {
    type: Number,
    default: 0
  },
  permissions: {
    type: String, // Stored as BigInt string
    default: '0'
  },
  mentionable: {
    type: Boolean,
    default: false
  }
});

const serverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  icon: {
    type: String,
    default: null
  },
  banner: {
    type: String,
    default: null
  },
  bannerColor: {
    type: String,
    default: '#5865f2'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roles: [roleSchema],
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    nickname: {
      type: String,
      maxlength: 100,
      default: null
    },
    roles: [{
      type: mongoose.Schema.Types.ObjectId,
      // No ref here because we store role as a subdocument in the server
    }],
    joinedAt: {
      type: Date,
      default: Date.now
    },
    communicationDisabledUntil: {
      type: Date,
      default: null
    },
    bio: {
      type: String,
      maxlength: 300,
      default: null
    },
    avatar: {
      type: String,
      default: null
    },
    banner: {
      type: String,
      default: null
    }
  }],
  channels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  }],
  bans: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      maxlength: 500,
      default: null
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  emojis: [{
    name: String,
    url: String,
    id: String, // Unique ID for the emoji within the server
    animated: Boolean,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
});

module.exports = mongoose.model('Server', serverSchema);
