const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    server: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Server',
        required: true
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: null // null means never expires
    },
    maxUses: {
        type: Number,
        default: null // null means unlimited
    },
    uses: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Invite', inviteSchema);
