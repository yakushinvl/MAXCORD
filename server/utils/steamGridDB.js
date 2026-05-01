const axios = require('axios');
const GameCache = require('../models/GameCache');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API_KEY = process.env.STEAMGRIDDB_API_KEY;
const BASE_URL = 'https://www.steamgriddb.com/api/v2';

const getGameIcon = async (gameName) => {
  if (!API_KEY) {
    console.warn('STEAMGRIDDB_API_KEY is not set');
    return null;
  }

  // 1. Check cache (and ensure it's a local URL)
  const cached = await GameCache.findOne({ name: gameName });
  if (cached && cached.iconUrl && !cached.iconUrl.startsWith('http') && (Date.now() - cached.updatedAt < 1000 * 60 * 60 * 24 * 7)) { // 1 week cache
    return cached.iconUrl;
  }

  try {
    // 2. Search for the game
    const searchRes = await axios.get(`${BASE_URL}/search/autocomplete/${encodeURIComponent(gameName)}`, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    if (!searchRes.data.success || searchRes.data.data.length === 0) {
      return null;
    }

    const gameId = searchRes.data.data[0].id;

    // 3. Get icons
    const iconsRes = await axios.get(`${BASE_URL}/icons/game/${gameId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    if (!iconsRes.data.success || iconsRes.data.data.length === 0) {
        // Even if no icon found, cache the empty result to avoid re-searching
        await GameCache.findOneAndUpdate(
            { name: gameName },
            { gameId, updatedAt: Date.now() },
            { upsid: true, new: true, upsert: true }
          );
      return null;
    }

    // Sort icons by rating or just take the first one
    const remoteIconUrl = iconsRes.data.data[0].url;

    // 4. Download icon locally
    let iconUrl = remoteIconUrl;
    try {
      const uploadsDir = path.join(__dirname, '..', 'uploads', 'game-icons');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileExtension = path.extname(new URL(remoteIconUrl).pathname) || '.png';
      const fileName = crypto.createHash('md5').update(gameName).digest('hex') + fileExtension;
      const localPath = path.join(uploadsDir, fileName);
      const relativeUrl = `/api/uploads/game-icons/${fileName}`;

      const imageRes = await axios.get(remoteIconUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(localPath);
      imageRes.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      iconUrl = relativeUrl;
    } catch (downloadErr) {
      console.error('Failed to download icon locally, falling back to remote URL:', downloadErr.message);
    }

    // 5. Update cache
    await GameCache.findOneAndUpdate(
      { name: gameName },
      { gameId, iconUrl, updatedAt: Date.now() },
      { upsert: true, new: true }
    );

    return iconUrl;
  } catch (error) {
    console.error('Error fetching from SteamGridDB:', error.response?.data || error.message);
    return null;
  }
};

module.exports = { getGameIcon };
