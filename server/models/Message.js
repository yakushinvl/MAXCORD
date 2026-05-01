const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  url: String,
  filename: String,
  size: Number,
  type: String
}, { _id: false });

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    maxlength: 2000,
    default: ''
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    default: null
  },
  directMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DirectMessage',
    default: null
  },
  attachments: [attachmentSchema],
  embeds: [{
    title: String,
    description: String,
    url: String,
    color: String,
    timestamp: Date,
    footer: {
      text: String,
      icon_url: String
    },
    image: {
      url: String
    },
    thumbnail: {
      url: String
    },
    author: {
      name: String,
      url: String,
      icon_url: String
    },
    fields: [{
      name: String,
      value: String,
      inline: Boolean
    }]
  }],
  buttons: [{
    label: String,
    url: String,
    actionId: String,
    style: { type: String, enum: ['primary', 'secondary', 'danger', 'success'], default: 'primary' },
    row: { type: Number, default: 0 }
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  reactions: [{
    emoji: String,
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  type: {
    type: String,
    enum: ['default', 'missed-call', 'call-ended'],
    default: 'default'
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pinned: {
    type: Boolean,
    default: false
  },
  pinnedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

messageSchema.pre('save', function (next) {
  if (this.type === 'default' && !this.content && (!this.attachments || this.attachments.length === 0) && (!this.embeds || this.embeds.length === 0)) {
    return next(new Error('Сообщение не может быть пустым (нужен текст, вложение или эмбед)'));
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);

