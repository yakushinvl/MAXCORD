const MiniApp = require('../models/MiniApp');
const User = require('../models/User');

const SYSTEM_APPS = [
  {
    name: 'Яндекс Музыка',
    path: '/miniapps/yandex-music/',
    description: 'Слушайте Яндекс Музыку вместе в голосовом канале. Эта мини-аппка — пример использования MAXCORD Mini-App SDK: любой может написать свою такую же.',
  },
];

module.exports = async function registerSystemMiniApps() {
  const publicUrl = (process.env.PUBLIC_URL || process.env.CLIENT_URL || 'https://maxcord.fun').replace(/\/$/, '');
  let owner = await User.findOne({ role: 'admin' });
  if (!owner) owner = await User.findOne();
  if (!owner) { console.warn('[MiniApps] No user found yet — system apps will register on next boot.'); return; }

  for (const def of SYSTEM_APPS) {
    const targetUrl = publicUrl + def.path;
    let existing = await MiniApp.findOne({ isSystem: true, name: def.name });
    if (!existing) {
      await MiniApp.create({
        name: def.name,
        url: targetUrl,
        owner: owner._id,
        isPublished: true,
        isSystem: true,
        description: def.description,
      });
      console.log('[MiniApps] Registered system mini-app:', def.name);
    } else {
      let changed = false;
      if (existing.url !== targetUrl) { existing.url = targetUrl; changed = true; }
      if (!existing.isPublished) { existing.isPublished = true; changed = true; }
      if (existing.description !== def.description) { existing.description = def.description; changed = true; }
      if (changed) { await existing.save(); console.log('[MiniApps] Updated system mini-app:', def.name); }
    }
  }
};
