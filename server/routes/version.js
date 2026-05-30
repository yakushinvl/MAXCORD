const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const resolveLatestVersion = () => {
    if (process.env.APP_LATEST_VERSION) return process.env.APP_LATEST_VERSION;
    const candidates = [
        path.join(__dirname, '..', '..', 'client', 'package.json'),
        path.join(__dirname, '..', 'package.json'),
    ];
    for (const file of candidates) {
        try {
            const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (pkg && typeof pkg.version === 'string') return pkg.version;
        } catch (e) { }
    }
    return '0.0.0';
};

let cachedVersion = null;
let cachedAt = 0;
const TTL = 60_000;

router.get('/', (req, res) => {
    const now = Date.now();
    if (!cachedVersion || now - cachedAt > TTL) {
        cachedVersion = resolveLatestVersion();
        cachedAt = now;
    }
    res.json({ version: cachedVersion });
});

module.exports = router;
