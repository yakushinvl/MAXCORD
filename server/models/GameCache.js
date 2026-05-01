const mongoose = require('mongoose');

const gameCacheSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  gameId: { type: Number },
  iconUrl: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameCache', gameCacheSchema);
