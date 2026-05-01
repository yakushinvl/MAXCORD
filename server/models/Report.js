const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['harassment', 'spam', 'inappropriate_content', 'scam', 'other']
  },
  description: {
    type: String,
    maxlength: 1000
  },
  messageContext: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending'
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolutionNote: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.materializedModel ? mongoose.model('Report', reportSchema) : mongoose.model('Report', reportSchema);
