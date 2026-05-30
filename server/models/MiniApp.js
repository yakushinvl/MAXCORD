const mongoose = require('mongoose');

const miniAppSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: null
  },
  banner: {
    type: String,
    default: null
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  moderationStatus: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft'
  },
  moderationReason: { type: String, default: null },
  moderatedAt: { type: Date, default: null },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isBlocked: { type: Boolean, default: false },
  blockReason: { type: String, default: null },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MiniApp', miniAppSchema);
