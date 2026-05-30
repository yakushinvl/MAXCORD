const mongoose = require('mongoose');

const miniAppStorageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  app: { type: mongoose.Schema.Types.ObjectId, ref: 'MiniApp', required: true, index: true },
  key: { type: String, required: true, maxlength: 128 },
  value: { type: mongoose.Schema.Types.Mixed, default: null },
  updatedAt: { type: Date, default: Date.now },
});

miniAppStorageSchema.index({ user: 1, app: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('MiniAppStorage', miniAppStorageSchema);
