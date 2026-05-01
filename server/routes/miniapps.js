const express = require('express');
const router = express.Router();
const MiniApp = require('../models/MiniApp');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Create a new mini-app
router.post('/create', auth, async (req, res) => {
    try {
        const { name, url } = req.body;
        if (!name || !url) return res.status(400).json({ message: 'Name and URL are required' });

        const miniApp = new MiniApp({
            name,
            url,
            owner: req.user._id
        });

        await miniApp.save();

        res.status(201).json({
            message: 'Мини-приложение успешно создано',
            miniApp
        });
    } catch (error) {
        console.error('MiniApp creation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's mini-apps
router.get('/my', auth, async (req, res) => {
    try {
        const miniApps = await MiniApp.find({ owner: req.user._id });
        res.json(miniApps);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update mini-app
router.patch('/:id', auth, async (req, res) => {
    try {
        const { name, url, description } = req.body;
        const miniApp = await MiniApp.findOne({ _id: req.params.id, owner: req.user._id });
        if (!miniApp) return res.status(404).json({ message: 'MiniApp not found' });

        if (name) miniApp.name = name;
        if (url) miniApp.url = url;
        if (description !== undefined) miniApp.description = description;

        await miniApp.save();
        res.json({ message: 'Мини-приложение обновлено', miniApp });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Toggle mini-app publish status
router.patch('/:id/publish', auth, async (req, res) => {
    try {
        const miniApp = await MiniApp.findOne({ _id: req.params.id, owner: req.user._id });
        if (!miniApp) return res.status(404).json({ message: 'MiniApp not found' });

        miniApp.isPublished = !miniApp.isPublished;
        await miniApp.save();

        res.json({ message: miniApp.isPublished ? 'Опубликовано на витрине' : 'Снято с витрины', isPublished: miniApp.isPublished });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete mini-app
router.delete('/:id', auth, async (req, res) => {
    try {
        const result = await MiniApp.deleteOne({ _id: req.params.id, owner: req.user._id });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'MiniApp not found' });

        res.json({ message: 'Мини-приложение успешно удалено' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update mini-app avatar
router.post('/:id/avatar', auth, (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message || 'File upload failed' });
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const miniApp = await MiniApp.findOne({ _id: req.params.id, owner: req.user._id });
        if (!miniApp) return res.status(404).json({ message: 'MiniApp not found' });

        const avatarUrl = `/api/uploads/${req.file.filename}`;
        miniApp.avatar = avatarUrl;
        await miniApp.save();

        res.json({ message: 'Аватар обновлен', avatar: avatarUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update mini-app banner
router.post('/:id/banner', auth, (req, res, next) => {
    upload.single('banner')(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message || 'File upload failed' });
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const miniApp = await MiniApp.findOne({ _id: req.params.id, owner: req.user._id });
        if (!miniApp) return res.status(404).json({ message: 'MiniApp not found' });

        const bannerUrl = `/api/uploads/${req.file.filename}`;
        miniApp.banner = bannerUrl;
        await miniApp.save();

        res.json({ message: 'Баннер обновлен', banner: bannerUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
