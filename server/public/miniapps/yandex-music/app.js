// Yandex Music mini-app for MAXCORD — reference implementation of the MAXCORD Mini-App SDK.
// All Yandex API calls go through maxcord.fetch (server proxy, bypasses CORS).
// Audio is played via an <audio> element, captured with captureStream() and
// published into the user's voice channel via maxcord.publishAudioTrack().

(async function () {
  // The mini-app developer registers an OAuth client at https://oauth.yandex.ru/
  // with redirect URI = the absolute URL of oauth-callback.html in this folder.
  // The client_id is public; replace with yours.
  const YANDEX_CLIENT_ID = window.YM_CLIENT_ID || 'f714685f466146d983e91542ee0267d3';

  const YA_API = 'https://api.music.yandex.net';
  const HEADERS_BASE = {
    'X-Yandex-Music-Client': 'Android/14562',
    'User-Agent': 'YandexMusic/2024.03.1 (ru.yandex.music; build:14562; Android 13; Pixel 6)',
  };

  await new Promise(r => window.maxcord ? r() : window.addEventListener('maxcord-sdk-ready', r, { once: true }));
  const sdk = window.maxcord;

  const $ = (sel) => document.querySelector(sel);
  const main = $('#main');
  const account = $('#account');
  const player = $('#player');

  let init;
  try { init = await sdk.init(); }
  catch (e) { return showFatal('Не удалось инициализировать SDK: ' + e.message); }

  let token = await sdk.storage.get('access_token').catch(() => null);
  let ymAccount = await sdk.storage.get('account').catch(() => null);

  // Player state
  let queue = [];
  let currentIndex = -1;
  let shuffleMode = false;
  let _libraryCache = null;
  const _libraryExpanded = new Set();

  // Voice channel presence (the mini-app's tile inside the user's voice channel).
  let presence = null;
  let progressTimer = null;

  // --- Audio element (recreated per track) ---
  // Chrome's audio.captureStream() returns the SAME MediaStream across src
  // changes, and the captured track often stops carrying audio after a src
  // swap. The reliable fix is to use a fresh <audio> per track and capture
  // its stream once — the track stays live for the duration of that blob.
  let audio = null;
  let _captureStream = null;
  let _userVolume = 0.8;
  function recreateAudio() {
    // Tear down old element if any.
    if (audio) {
      try { audio.pause(); } catch {}
      audio.src = '';
      try { audio.load(); } catch {}
    }
    if (_captureStream) {
      _captureStream.getTracks().forEach(t => { try { t.stop(); } catch {} });
    }
    _captureStream = null;
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = _userVolume;
    audio.addEventListener('ended', () => { if (currentIndex < queue.length - 1) playIndex(currentIndex + 1); else stopPlayback(); });
    audio.addEventListener('timeupdate', () => { updateLocalProgress(); pushPresenceProgress(); });
    audio.addEventListener('play',  () => { setPlayIcon(true);  updatePresenceControls(); });
    audio.addEventListener('pause', () => { setPlayIcon(false); updatePresenceControls(); });
  }
  function getCaptureTrack() {
    if (!audio || typeof audio.captureStream !== 'function') {
      console.error('[YM] audio.captureStream not supported / no audio element');
      return null;
    }
    if (!_captureStream) _captureStream = audio.captureStream();
    return _captureStream.getAudioTracks()[0] || null;
  }
  recreateAudio();

  // SVG icons for play/pause toggle.
  const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
  const ICON_PAUSE = '<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>';
  function setPlayIcon(playing) {
    const el = $('#play-icon');
    if (el) el.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  }
  function setVolIcon(v) {
    const el = $('#vol-icon');
    if (!el) return;
    if (v === 0) el.innerHTML = '<path d="M3.63 3.63a1 1 0 0 0 0 1.41L7.29 8.7 7 9H3v6h4l5 5v-6.59l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a1 1 0 0 0 1.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0 0 14 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>';
    else if (v < 0.5) el.innerHTML = '<path d="M7 9v6h4l5 5V4l-5 5H7z"/>';
    else el.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/>';
  }

  // Persisted volume — restored from storage, saved on change.
  const savedVol = await sdk.storage.get('volume').catch(() => null);
  _userVolume = (typeof savedVol === 'number') ? Math.max(0, Math.min(1, savedVol)) : 0.8;
  audio.volume = _userVolume;
  $('#vol').value = String(Math.round(_userVolume * 100));
  setVolIcon(_userVolume);
  let _volSaveTimer = null;
  $('#vol').addEventListener('input', (e) => {
    _userVolume = Number(e.target.value) / 100;
    if (audio) audio.volume = _userVolume;
    setVolIcon(_userVolume);
    clearTimeout(_volSaveTimer);
    _volSaveTimer = setTimeout(() => sdk.storage.set('volume', _userVolume).catch(() => {}), 300);
  });

  $('#btn-play').addEventListener('click', () => { if (audio) audio.paused ? audio.play() : audio.pause(); });
  $('#btn-prev').addEventListener('click', () => { if (currentIndex > 0) playIndex(currentIndex - 1); });
  $('#btn-next').addEventListener('click', () => { if (currentIndex < queue.length - 1) playIndex(currentIndex + 1); });
  $('#btn-stop').addEventListener('click', stopPlayback);
  $('#btn-shuffle').addEventListener('click', toggleShuffle);

  function toggleShuffle() {
    shuffleMode = !shuffleMode;
    const btn = $('#btn-shuffle');
    if (btn) btn.classList.toggle('active', shuffleMode);
    // When turning on, shuffle the queue (keeping current track in place).
    if (shuffleMode && queue.length > currentIndex + 2) {
      const head = queue.slice(0, currentIndex + 1);
      const tail = queue.slice(currentIndex + 1);
      for (let i = tail.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tail[i], tail[j]] = [tail[j], tail[i]];
      }
      queue = head.concat(tail);
      renderQueue();
      if ($('#queue-page-tracks')) renderQueuePageTracks();
    }
    updatePresenceControls();
  }

  // Click on player progress bar to seek.
  $('#player-bar')?.addEventListener('click', (e) => {
    if (!audio || !isFinite(audio.duration) || audio.duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = Math.max(0, Math.min(audio.duration, pct * audio.duration));
  });

  sdk.on('voiceChannelChanged', async (p) => {
    if (!p.channelId && presence) {
      try { await presence.destroy(); } catch {}
      presence = null;
      renderVoiceJoinButton();
    }
  });

  renderAccount();
  if (!token) renderConnectScreen();
  else renderSearchScreen();

  // ---------- UI screens ----------

  function showFatal(text) {
    main.innerHTML = `<div class="banner error">${escape(text)}</div>`;
  }

  function renderAccount() {
    if (token && ymAccount) {
      account.innerHTML = `<span class="login">${escape(ymAccount.login || '')}</span>` +
        (ymAccount.hasPlus ? '<span class="plus-badge">PLUS</span>' : '') +
        '<button id="logout">Выйти</button>';
      $('#logout').addEventListener('click', async () => {
        await sdk.storage.delete('access_token');
        await sdk.storage.delete('account');
        token = null; ymAccount = null;
        _libraryCache = null;
        renderAccount();
        renderConnectScreen();
      });
    } else {
      account.innerHTML = '';
    }
  }

  function renderConnectScreen() {
    $('#search-bar-host').innerHTML = '';
    main.innerHTML = `
      <div class="connect-screen">
        <h2>Подключи аккаунт Яндекс Музыки</h2>
        <p>Чтобы слушать музыку вместе с друзьями в голосовом канале, нужен токен Яндекса с доступом к Музыке.</p>
        <button class="connect-btn" id="connect-btn">Войти через OAuth (для базового профиля)</button>
        <details open style="margin-top:14px;max-width:520px;text-align:left">
          <summary style="cursor:pointer;color:#ffcc00;font-size:13px;font-weight:700">⚡ Рекомендуемый способ — вставить токен вручную</summary>
          <p style="font-size:12px;color:#aaa;line-height:1.5;margin-top:10px">
            OAuth-приложения, регистрируемые публично, <strong>не получают scope <code>music:content</code></strong> —
            Яндекс отдаёт только 30-секундные превью. Но если ты уже залогинен в Яндекс Музыку с подпиской Plus,
            ты можешь забрать готовый токен прямо из браузера.
          </p>
          <ol style="font-size:12px;color:#ccc;line-height:1.7;padding-left:18px">
            <li>Открой <a href="https://music.yandex.ru" target="_blank" style="color:#ffcc00">music.yandex.ru</a> и убедись, что залогинен (тот аккаунт с Plus).</li>
            <li>Открой DevTools (F12) → вкладка <strong>Network</strong>.</li>
            <li>Обнови страницу (F5). В фильтре набери <code>api.music.yandex.net</code>.</li>
            <li>Кликни любой запрос → раздел <strong>Request Headers</strong> → найди <code>Authorization: OAuth y0_…</code> (или <code>Authorization: OAuth AQA…</code>).</li>
            <li>Скопируй ТОЛЬКО токен (без слова <code>OAuth</code>) и вставь ниже.</li>
          </ol>
          <input id="manual-token" type="password" placeholder="y0_AgAAA…" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:white;font-size:13px;font-family:monospace;outline:none;margin-top:8px" />
          <button class="connect-btn" id="manual-token-btn" style="margin-top:10px">Сохранить токен</button>
        </details>
      </div>`;
    $('#connect-btn').addEventListener('click', connectYandex);
    $('#manual-token-btn').addEventListener('click', connectManual);
    $('#manual-token').addEventListener('keydown', (e) => { if (e.key === 'Enter') connectManual(); });
  }

  async function connectManual() {
    const inp = $('#manual-token');
    const raw = (inp.value || '').trim().replace(/^OAuth\s+/i, '');
    if (!raw) { inp.focus(); return; }
    token = raw;
    try {
      const acc = await yaCall('/account/status');
      const accInfo = {
        login: acc.result?.account?.login || '(токен)',
        uid: String(acc.result?.account?.uid || ''),
        hasPlus: !!(acc.result?.plus?.hasPlus || acc.result?.permissions?.values?.includes('landing-play')),
      };
      await sdk.storage.set('access_token', token);
      await sdk.storage.set('account', accInfo);
      ymAccount = accInfo;
      renderAccount();
      renderSearchScreen();
    } catch (e) {
      token = null;
      alert('Токен не работает: ' + e.message);
    }
  }

  async function connectYandex() {
    const redirectUri = new URL('./oauth-callback.html', window.location.href).toString();
    const url = `https://oauth.yandex.ru/authorize?response_type=token&client_id=${encodeURIComponent(YANDEX_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&force_confirm=yes`;
    console.log('[YM OAuth] redirect_uri =', redirectUri);
    console.log('[YM OAuth] open URL    =', url);
    try {
      const r = await sdk.oauthPopup(url, { width: 600, height: 720 });
      console.log('[YM OAuth] popup returned:', r);

      // Implicit flow returns token in hash. Errors may come back in search.
      const hashParams = new URLSearchParams((r.hash || '').replace(/^#/, ''));
      const queryParams = new URLSearchParams((r.search || '').replace(/^\?/, ''));

      const oauthError = hashParams.get('error') || queryParams.get('error');
      const errorDesc = hashParams.get('error_description') || queryParams.get('error_description');
      if (oauthError) throw new Error(`Яндекс: ${oauthError}${errorDesc ? ' — ' + decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : ''}`);

      const accessToken = hashParams.get('access_token');
      if (!accessToken) {
        throw new Error(
          'access_token не пришёл. Вероятная причина: в настройках OAuth-приложения Яндекса не включён Implicit Grant. ' +
          'Полный URL возврата: ' + (r.href || '(пусто)')
        );
      }

      await sdk.storage.set('access_token', accessToken);
      token = accessToken;
      const acc = await yaCall('/account/status');
      const accInfo = {
        login: acc.result?.account?.login,
        uid: String(acc.result?.account?.uid || ''),
        hasPlus: !!(acc.result?.plus?.hasPlus || acc.result?.permissions?.values?.includes('landing-play')),
      };
      await sdk.storage.set('account', accInfo);
      ymAccount = accInfo;
      renderAccount();
      renderSearchScreen();
    } catch (e) {
      console.error('[YM OAuth]', e);
      alert('Ошибка авторизации: ' + e.message);
    }
  }

  function renderSearchScreen() {
    // Search box lives OUTSIDE the scrollable .main so it stays put.
    const host = $('#search-bar-host');
    host.innerHTML = `
      <div class="search-box">
        <input id="q" placeholder="Поиск или вставь ссылку на трек / альбом / плейлист…" autocomplete="off" />
        <button id="search-btn">Найти</button>
        <button id="queue-btn" class="queue-btn" title="Очередь воспроизведения">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
          <span>Очередь</span>
          <span id="queue-badge" class="queue-badge"></span>
        </button>
      </div>
    `;
    main.innerHTML = `
      <div id="voice-banner"></div>
      <div id="results-section" hidden>
        <div class="section-title">Результаты</div>
        <div id="results" class="track-list"></div>
      </div>
      <div class="section-title">Моя медиатека <span id="library-status" style="color:#666;font-weight:normal"></span></div>
      <div id="library" class="library-grid"></div>
    `;
    renderVoiceJoinButton();
    renderLibrary();
    updateQueueBadge();
    const q = $('#q');
    q.focus();
    let searchTimer = null;
    q.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => doSearch(q.value), 400); });
    $('#search-btn').addEventListener('click', () => doSearch(q.value));
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(q.value); });
    $('#queue-btn').addEventListener('click', openQueuePage);
  }

  function updateQueueBadge() {
    const b = $('#queue-badge');
    if (!b) return;
    if (queue.length) { b.textContent = String(queue.length); b.style.display = ''; }
    else b.style.display = 'none';
  }

  // ---------- My Library ----------

  async function renderLibrary() {
    const wrap = $('#library');
    const status = $('#library-status');
    if (!wrap) return;
    if (!ymAccount?.uid) {
      wrap.innerHTML = '<div class="empty">Авторизуйся, чтобы увидеть свои плейлисты.</div>';
      return;
    }
    if (!_libraryCache) {
      wrap.innerHTML = '<div class="loading">Загружаю медиатеку…</div>';
      try {
        _libraryCache = await loadLibrary(ymAccount.uid);
      } catch (e) {
        wrap.innerHTML = `<div class="banner error">Не удалось загрузить медиатеку: ${escape(e.message)}</div>`;
        return;
      }
    }
    const { ownPlaylists, likedPlaylists, likedAlbums } = _libraryCache;
    const total = ownPlaylists.length + likedPlaylists.length + likedAlbums.length;
    if (status) status.textContent = total ? `· ${total}` : '';
    if (!total) { wrap.innerHTML = '<div class="empty">У тебя пока пустая медиатека.</div>'; return; }

    wrap.innerHTML = '';
    const renderSection = (title, items, sectionKey) => {
      if (!items.length) return;
      const head = document.createElement('div');
      head.className = 'library-section-title';
      head.innerHTML = `<span>${escape(title)}</span>`;
      wrap.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'library-row';
      wrap.appendChild(grid);

      const SHOW_LIMIT = 4;
      const expanded = _libraryExpanded.has(sectionKey);
      const visible = expanded ? items : items.slice(0, SHOW_LIMIT);
      visible.forEach(p => grid.appendChild(renderLibraryCard(p)));

      if (items.length > SHOW_LIMIT) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'library-show-more';
        toggleBtn.textContent = expanded ? 'Скрыть' : `Показать все (${items.length})`;
        toggleBtn.onclick = () => {
          if (expanded) _libraryExpanded.delete(sectionKey);
          else _libraryExpanded.add(sectionKey);
          renderLibrary();
        };
        head.appendChild(toggleBtn);
      }
    };
    renderSection('Мои плейлисты', ownPlaylists, 'own');
    renderSection('Любимые плейлисты', likedPlaylists, 'likedPl');
    renderSection('Любимые альбомы', likedAlbums, 'likedAl');
  }

  async function loadLibrary(uid) {
    const sections = { ownPlaylists: [], likedPlaylists: [], likedAlbums: [] };

    // 1. "Мне нравится" — virtual playlist of liked tracks → first own item
    try {
      const likes = await yaCall(`/users/${encodeURIComponent(uid)}/likes/tracks`);
      const likedIds = (likes.result?.library?.tracks || []).map(t => String(t.id));
      if (likedIds.length) {
        sections.ownPlaylists.push({
          kind: 'likes',
          uid,
          title: 'Мне нравится',
          subtitle: ymAccount?.login || '',
          trackCount: likedIds.length,
          cover: null,
          accent: '#ff3b6b',
          icon: '♥',
          trackIds: likedIds,
          loader: () => materializeTracks({ tracks: likedIds.map(id => ({ id })) }),
        });
      }
    } catch (e) { console.warn('[YM] likes failed:', e.message); }

    // 2. User's own playlists
    try {
      const lst = await yaCall(`/users/${encodeURIComponent(uid)}/playlists/list`);
      (lst.result || []).forEach(p => {
        sections.ownPlaylists.push({
          kind: 'playlist',
          uid,
          playlistKind: p.kind,
          title: p.title,
          subtitle: p.owner?.login || ymAccount?.login || '',
          trackCount: p.trackCount,
          cover: p.cover?.uri || p.ogImage,
          loader: async () => {
            const r = await yaCall(`/users/${encodeURIComponent(uid)}/playlists/${encodeURIComponent(p.kind)}`);
            return materializeTracks(r.result);
          },
        });
      });
    } catch (e) { console.warn('[YM] playlists list failed:', e.message); }

    // 3. Liked playlists (other people's playlists user liked)
    try {
      const lp = await yaCall(`/users/${encodeURIComponent(uid)}/likes/playlists`);
      (lp.result || []).forEach(entry => {
        const p = entry.playlist || entry;
        if (!p?.title) return;
        sections.likedPlaylists.push({
          kind: 'playlist',
          uid: p.owner?.uid || p.uid,
          playlistKind: p.kind,
          title: p.title,
          subtitle: p.owner?.name || p.owner?.login || '',
          trackCount: p.trackCount,
          cover: p.cover?.uri || p.ogImage,
          loader: async () => {
            const r = await yaCall(`/users/${encodeURIComponent(p.owner?.uid || p.uid)}/playlists/${encodeURIComponent(p.kind)}`);
            return materializeTracks(r.result);
          },
        });
      });
    } catch (e) { console.warn('[YM] liked playlists failed:', e.message); }

    // 4. Liked albums — response shape varies: top-level array OR { library: { albums: [...] } }
    //    Each item may be a bare album, { album: {...} }, or an id-only ref.
    try {
      const la = await yaCall(`/users/${encodeURIComponent(uid)}/likes/albums`);
      console.log('[YM] liked albums raw:', la);
      const rawAlbums = la.result?.library?.albums || la.result?.albums || la.result || [];
      // If items are id-only refs, fetch full albums in one batch.
      const albums = [];
      const needsFetch = [];
      for (const entry of rawAlbums) {
        const a = entry.album || entry;
        if (a?.title) {
          albums.push(a);
        } else if (a?.id || entry.id) {
          needsFetch.push(String(a?.id || entry.id));
        }
      }
      if (needsFetch.length) {
        try {
          const r = await sdk.fetch(YA_API + '/albums', {
            method: 'POST',
            headers: { ...HEADERS_BASE, Authorization: 'OAuth ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'album-ids=' + needsFetch.join(','),
            responseType: 'json',
          });
          if (r.status < 400) (r.data?.result || []).forEach(a => albums.push(a));
        } catch (e) { console.warn('[YM] bulk albums fetch failed:', e.message); }
      }
      albums.forEach(a => {
        if (!a?.title) return;
        sections.likedAlbums.push({
          kind: 'album',
          albumId: a.id,
          title: a.title,
          subtitle: (a.artists || []).map(ar => ar.name).join(', '),
          trackCount: a.trackCount,
          cover: a.coverUri,
          loader: async () => {
            const r = await yaCall(`/albums/${a.id}/with-tracks`);
            return (r.result?.volumes || []).flat().map(normalizeTrack);
          },
        });
      });
    } catch (e) { console.warn('[YM] liked albums failed:', e.message); }

    return sections;
  }

  function renderLibraryCard(p) {
    const div = document.createElement('div');
    div.className = 'library-card';
    const cover = p.cover ? `https://${p.cover.replace('%%', '200x200')}` : '';
    div.innerHTML = `
      <div class="library-cover" style="${cover ? `background-image:url('${cover}')` : `background:linear-gradient(135deg, ${p.accent || '#3a3a44'}, #1a1a22)`}">
        ${p.icon ? `<span class="library-cover-icon">${p.icon}</span>` : ''}
      </div>
      <div class="library-meta">
        <div class="library-title">${escape(p.title)}</div>
        <div class="library-count">${p.subtitle ? escape(p.subtitle) + ' · ' : ''}${p.trackCount || 0} трек.</div>
      </div>
    `;
    div.addEventListener('click', () => openItemPage(p));
    return div;
  }

  /** Full-screen view of the current playback queue. */
  function openQueuePage() {
    $('#search-bar-host').innerHTML = '';
    main.innerHTML = `
      <div class="page-header">
        <button id="page-back" class="page-back-btn" title="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Назад
        </button>
      </div>
      <div class="page-hero">
        <div class="page-hero-cover" id="page-cover" style="background:linear-gradient(135deg, #ffcc00, #b38b00)">
          <span class="page-cover-icon">♬</span>
        </div>
        <div class="page-hero-body">
          <div class="page-hero-kind">Сейчас в очереди</div>
          <h1 class="page-hero-title">Очередь</h1>
          <div class="page-hero-subtitle" id="page-queue-count">${queue.length} треков</div>
          <div class="page-hero-actions">
            <button id="page-clear" class="page-secondary-btn">Очистить</button>
          </div>
        </div>
      </div>
      <div id="queue-page-tracks" class="track-list"></div>
    `;
    $('#page-back').addEventListener('click', renderSearchScreen);
    $('#page-clear').addEventListener('click', () => {
      // Don't stop the current track — let it finish. Just drop everything else
      // from the queue. If nothing is playing, clear entirely.
      if (currentIndex >= 0 && currentIndex < queue.length) {
        queue = [queue[currentIndex]];
        currentIndex = 0;
      } else {
        queue = [];
        currentIndex = -1;
      }
      renderQueue();
    });
    renderQueuePageTracks();
  }

  function renderQueuePageTracks() {
    const list = $('#queue-page-tracks');
    const count = $('#page-queue-count');
    if (count) count.textContent = `${queue.length} треков`;
    if (!list) return;
    if (!queue.length) {
      list.innerHTML = '<div class="empty">Очередь пуста — добавь треки из медиатеки или поиска.</div>';
      return;
    }
    list.innerHTML = '';
    queue.forEach((t, i) => {
      const row = renderTrackRow(t, true, i);
      list.appendChild(row);
    });
  }

  /** Full-screen view of a playlist/album with hero + filter + tracks. */
  async function openItemPage(p) {
    $('#search-bar-host').innerHTML = ''; // hide global search on item page
    main.innerHTML = `
      <div class="page-header">
        <button id="page-back" class="page-back-btn" title="Назад в медиатеку">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Назад
        </button>
      </div>
      <div class="page-hero">
        <div class="page-hero-cover" id="page-cover"></div>
        <div class="page-hero-body">
          <div class="page-hero-kind">${p.kind === 'album' ? 'Альбом' : 'Плейлист'}</div>
          <h1 class="page-hero-title">${escape(p.title)}</h1>
          ${p.subtitle ? `<div class="page-hero-subtitle">${escape(p.subtitle)}</div>` : ''}
          <div class="page-hero-actions">
            <button id="page-play-all" class="page-play-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Слушать
            </button>
            <button id="page-add-all" class="page-secondary-btn">+ В очередь</button>
          </div>
        </div>
      </div>
      <div class="page-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="page-filter" type="text" placeholder="Поиск трека в плейлисте…" autocomplete="off" />
      </div>
      <div id="page-tracks" class="track-list">
        <div class="loading">Загружаю треки…</div>
      </div>
    `;

    const cover = p.cover ? `https://${p.cover.replace('%%', '400x400')}` : '';
    if (cover) {
      $('#page-cover').style.backgroundImage = `url('${cover}')`;
    } else {
      $('#page-cover').style.background = `linear-gradient(135deg, ${p.accent || '#3a3a44'}, #1a1a22)`;
      if (p.icon) $('#page-cover').innerHTML = `<span class="page-cover-icon">${p.icon}</span>`;
    }

    $('#page-back').addEventListener('click', renderSearchScreen);

    let tracks = [];
    try {
      tracks = await p.loader();
    } catch (e) {
      $('#page-tracks').innerHTML = `<div class="banner error">Не удалось загрузить: ${escape(e.message)}</div>`;
      return;
    }
    if (!tracks.length) {
      $('#page-tracks').innerHTML = '<div class="empty">Пусто.</div>';
      return;
    }

    const renderTracks = (filter) => {
      const list = $('#page-tracks');
      list.innerHTML = '';
      const filtered = filter
        ? tracks.filter(t =>
            t.title?.toLowerCase().includes(filter) ||
            t.artists?.some(a => a.toLowerCase().includes(filter)))
        : tracks;
      if (!filtered.length) { list.innerHTML = '<div class="empty">Ничего не найдено.</div>'; return; }
      filtered.forEach((t, i) => {
        const row = renderTrackRow(t, false);
        // Click row → play this single track immediately
        row.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          const idx = tracks.indexOf(t);
          const startIdx = queue.length;
          tracks.slice(idx).forEach(tr => queue.push(tr));
          renderQueue();
          playIndex(startIdx);
        });
        list.appendChild(row);
      });
    };
    renderTracks('');

    $('#page-filter').addEventListener('input', (e) => {
      renderTracks(e.target.value.trim().toLowerCase());
    });

    $('#page-play-all').addEventListener('click', () => {
      const startIdx = queue.length;
      tracks.forEach(t => queue.push(t));
      renderQueue();
      playIndex(startIdx);
    });
    $('#page-add-all').addEventListener('click', () => {
      tracks.forEach(t => queue.push(t));
      renderQueue();
    });
  }

  function renderVoiceJoinButton() {
    const b = $('#voice-banner');
    if (!b) return;
    if (!init.voiceChannelId) {
      b.innerHTML = '<div class="banner warn"><span>Зайди в голосовой канал в MAXCORD, чтобы транслировать музыку.</span></div>';
      return;
    }
    if (presence) {
      b.innerHTML = `
        <div class="banner info">
          <span>🎵 Активна в голосовом канале — другие участники слышат и могут управлять плеером.</span>
          <button id="leave-voice-btn">Отключиться</button>
        </div>`;
      $('#leave-voice-btn').addEventListener('click', leaveVoicePresence);
    } else {
      b.innerHTML = `
        <div class="banner info">
          <span>Готов выйти в эфир — другие участники увидят плеер с обложкой и кнопками.</span>
          <button id="join-voice-btn" class="primary">Включиться в голосовой канал</button>
        </div>`;
      $('#join-voice-btn').addEventListener('click', joinVoicePresence);
    }
  }

  async function joinVoicePresence() {
    if (presence) return;
    try {
      presence = await sdk.voicePresence.create({
        displayName: 'Яндекс Музыка',
        avatar: 'https://music.yandex.ru/favicon.ico',
      });
      presence.on('control', onPresenceControl);
      await presence.setAccentColor('#ffcc00');
      await presence.setControls(getControlSchema());
      // If we are already playing a track, immediately publish audio + cover + subtitle.
      if (audio && !audio.paused && audio.src) await reattachPresenceMedia();
    } catch (e) {
      alert('Не получилось встать в голосовой канал: ' + e.message);
      presence = null;
    }
    renderVoiceJoinButton();
  }

  async function leaveVoicePresence() {
    if (!presence) return;
    try { await presence.destroy(); } catch {}
    presence = null;
    renderVoiceJoinButton();
  }

  function getControlSchema() {
    const t = queue[currentIndex];
    const isPaused = !audio || audio.paused;
    return [
      { id: 'prev', kind: 'button', label: '⏮', tooltip: 'Предыдущий', style: '' },
      { id: 'play-pause', kind: 'button', label: isPaused ? '▶' : '⏸', tooltip: 'Пауза', style: 'primary' },
      { id: 'next', kind: 'button', label: '⏭', tooltip: 'Следующий', style: '' },
      { id: 'seek', kind: 'slider', label: 'Прогресс',
        min: 0, max: 100,
        value: t && audio && isFinite(audio.duration) ? Math.round((audio.currentTime / audio.duration) * 100) : 0,
      },
    ];
  }

  function onPresenceControl({ controlId, value }) {
    if (controlId === 'play-pause') audio && (audio.paused ? audio.play() : audio.pause());
    else if (controlId === 'next') { if (currentIndex < queue.length - 1) playIndex(currentIndex + 1); }
    else if (controlId === 'prev') { if (currentIndex > 0) playIndex(currentIndex - 1); }
    else if (controlId === 'seek' && audio && isFinite(audio.duration)) audio.currentTime = (Number(value) / 100) * audio.duration;
  }

  async function updatePresenceControls() {
    if (!presence) return;
    try {
      // setControls replaces the whole schema — keeps shuffle/play-pause styles in sync.
      await presence.setControls(getControlSchema());
    } catch {}
  }

  function pushPresenceProgress() {
    if (!presence) return;
    if (!isFinite(audio.duration) || audio.duration === 0) return;
    const pct = Math.round((audio.currentTime / audio.duration) * 100);
    // Throttle: only push when value actually changes (1% steps).
    if (pushPresenceProgress._last === pct) return;
    pushPresenceProgress._last = pct;
    presence.updateControl('seek', { value: pct }).catch(() => {});
  }

  async function reattachPresenceMedia() {
    if (!presence) return;
    const track = queue[currentIndex];

    // Try to fetch a "video shot" (Yandex's short music-video clip for the track).
    // If found — use it as live video background. Otherwise fall back to cover.
    let videoUrl = null;
    if (track?.id) {
      try {
        const sup = await yaCall(`/tracks/${track.id}/supplement`);
        console.log('[YM] supplement response for', track.id, ':', sup);
        const candidates = [
          sup.result?.videoShot,
          ...(Array.isArray(sup.result?.videoShots) ? sup.result.videoShots : []),
          sup.result?.video,
          sup.result?.musicVideo,
        ];
        for (const c of candidates) {
          if (!c) continue;
          const u = c.uri || c.url || c.streamUri || c.player?.url;
          if (u) {
            videoUrl = u.startsWith('http') ? u : ('https://' + u);
            console.log('[YM] videoShot found:', videoUrl, 'from candidate:', c);
            break;
          }
        }
        if (!videoUrl) console.log('[YM] no video field in supplement. Available keys:', Object.keys(sup.result || {}));
      } catch (e) { console.warn('[YM] supplement failed for', track.id, e.message); }
    }

    if (videoUrl) {
      await presence.setBackground({ type: 'video', url: videoUrl });
    } else if (track?.coverUri) {
      const url = 'https://' + track.coverUri.replace('%%', '400x400');
      await presence.setBackground({ type: 'image', url });
    }

    // "Now playing" subtitle — e.g. "Lose Yourself — Eminem"
    if (track) {
      const artists = (track.artists || []).join(', ');
      const subtitle = artists ? `${track.title} — ${artists}` : track.title;
      try { await presence.setSubtitle(subtitle); } catch {}
    }

    // The capture track is stable across audio src changes (Web Audio dest),
    // so publishing once is enough. The bridge no-ops on repeat publishes of
    // the same track to avoid LiveKit republish thrashing.
    try {
      const at = getCaptureTrack();
      if (at) await presence.publishAudio(at);
    } catch (e) { console.error('[YM] presence publishAudio failed:', e); }
    await presence.setControls(getControlSchema());
  }

  async function doSearch(query) {
    query = (query || '').trim();
    const results = $('#results');
    const section = $('#results-section');
    if (!query) {
      if (results) results.innerHTML = '';
      if (section) section.hidden = true;
      return;
    }
    if (section) section.hidden = false;

    // If query is a Yandex Music URL, parse and load tracks directly.
    const parsed = parseYandexUrl(query);
    if (parsed) {
      results.innerHTML = '<div class="loading">Загружаю…</div>';
      try {
        const tracks = await loadByUrl(parsed);
        if (!tracks.length) { results.innerHTML = '<div class="empty">Ничего не загрузилось</div>'; return; }
        results.innerHTML = `<div class="banner info"><span>Загружено ${tracks.length} треков из ${labelKind(parsed.kind)}</span></div>`;
        const actions = document.createElement('div');
        actions.className = 'bulk-actions';
        const playAllBtn = document.createElement('button');
        playAllBtn.className = 'primary';
        playAllBtn.textContent = `▶ Играть всё`;
        playAllBtn.onclick = async () => {
          const startIdx = queue.length;
          tracks.forEach(t => queue.push(t));
          renderQueue();
          await playIndex(startIdx);
        };
        const addAllBtn = document.createElement('button');
        addAllBtn.textContent = `+ В очередь`;
        addAllBtn.onclick = () => { tracks.forEach(t => queue.push(t)); renderQueue(); };
        actions.appendChild(playAllBtn);
        actions.appendChild(addAllBtn);
        results.appendChild(actions);
        tracks.forEach(t => results.appendChild(renderTrackRow(t, false)));
      } catch (e) {
        results.innerHTML = `<div class="banner error">Не получилось загрузить: ${escape(e.message)}</div>`;
      }
      return;
    }

    results.innerHTML = '<div class="loading">Поиск…</div>';
    try {
      const r = await yaCall('/search?type=track&page=0&text=' + encodeURIComponent(query));
      const tracks = (r.result?.tracks?.results || []).slice(0, 25);
      if (!tracks.length) { results.innerHTML = '<div class="empty">Ничего не найдено</div>'; return; }
      results.innerHTML = '';
      tracks.forEach(t => results.appendChild(renderTrackRow(normalizeTrack(t), false)));
    } catch (e) {
      results.innerHTML = `<div class="banner error">Ошибка: ${escape(e.message)}</div>`;
    }
  }

  function parseYandexUrl(s) {
    if (!/music\.yandex\.[a-z]+/i.test(s)) return null;
    const clean = s.split('?')[0].split('#')[0];
    let m;
    if ((m = clean.match(/\/album\/(\d+)\/track\/(\d+)/))) return { kind: 'track', id: m[2] };
    if ((m = clean.match(/\/track\/(\d+)/))) return { kind: 'track', id: m[1] };
    if ((m = clean.match(/\/users\/([^/]+)\/playlists\/([^/]+)/))) return { kind: 'playlist', owner: m[1], pid: m[2] };
    if ((m = clean.match(/\/playlists\/([^/]+)/))) return { kind: 'playlist', owner: null, pid: m[1] };
    if ((m = clean.match(/\/album\/(\d+)/))) return { kind: 'album', id: m[1] };
    return null;
  }

  function labelKind(k) { return { track: 'трека', album: 'альбома', playlist: 'плейлиста' }[k] || k; }

  async function loadByUrl(p) {
    if (p.kind === 'track') {
      const r = await yaCall(`/tracks?track-ids=${p.id}`);
      const t = r.result?.[0];
      if (!t) throw new Error('Трек не найден');
      return [normalizeTrack(t)];
    }
    if (p.kind === 'album') {
      const r = await yaCall(`/albums/${p.id}/with-tracks`);
      const vols = r.result?.volumes || [];
      return vols.flat().map(normalizeTrack);
    }
    if (p.kind === 'playlist') {
      // Share-link IDs are UUIDs (with prefix like "ps.", "lk.", etc.).
      // Personal user playlists use integer `kind`.
      const looksUuid = !p.owner || /[a-f0-9-]{8,}/i.test(p.pid);
      const errors = [];

      if (looksUuid) {
        // Endpoint 1: path-style UUID
        try {
          const r = await yaCall(`/playlist/${encodeURIComponent(p.pid)}`);
          const tracks = await materializeTracks(r.result);
          if (tracks.length) return tracks;
        } catch (e) { errors.push('GET /playlist/{uuid}: ' + e.message); }

        // Endpoint 2: legacy query-style
        try {
          const r = await yaCall(`/playlist?playlistId=${encodeURIComponent(p.pid)}`);
          const tracks = await materializeTracks(r.result);
          if (tracks.length) return tracks;
        } catch (e) { errors.push('GET /playlist?playlistId: ' + e.message); }

        // Endpoint 3: bulk POST
        try {
          const r = await sdk.fetch(YA_API + '/playlists/list', {
            method: 'POST',
            headers: { ...HEADERS_BASE, Authorization: 'OAuth ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'playlistIds=' + encodeURIComponent(p.pid),
            responseType: 'json',
          });
          if (r.status < 400) {
            const pl = (r.data?.result || [])[0];
            const tracks = await materializeTracks(pl);
            if (tracks.length) return tracks;
          } else {
            errors.push('POST /playlists/list: ' + r.status);
          }
        } catch (e) { errors.push('POST /playlists/list: ' + e.message); }
      }

      if (p.owner) {
        const r = await yaCall(`/users/${encodeURIComponent(p.owner)}/playlists/${encodeURIComponent(p.pid)}`);
        const tracks = await materializeTracks(r.result);
        if (tracks.length) return tracks;
        errors.push('GET /users/{owner}/playlists/{kind}: empty');
      }

      throw new Error('Не удалось загрузить плейлист. ' + errors.join('; '));
    }
    return [];
  }

  // Some endpoints return tracks as full objects, others as { id, albumId } refs.
  // Refs need a second call to /tracks to fetch full metadata.
  async function materializeTracks(playlist) {
    if (!playlist) return [];
    const raw = playlist.tracks || [];
    if (!raw.length) return [];
    // Detect ref-style (no .track field, no .title)
    const isRef = raw.every(it => !it.track && !it.title && (it.id || it.trackId));
    if (!isRef) {
      return raw.map(it => normalizeTrack(it.track || it));
    }
    const ids = raw.map(it => String(it.id || it.trackId).split(':')[0]);
    const chunks = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    const all = [];
    for (const c of chunks) {
      const r = await sdk.fetch(YA_API + '/tracks', {
        method: 'POST',
        headers: { ...HEADERS_BASE, Authorization: 'OAuth ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'track-ids=' + c.join(','),
        responseType: 'json',
      });
      if (r.status < 400) (r.data?.result || []).forEach(t => all.push(normalizeTrack(t)));
    }
    return all;
  }

  function renderQueue() {
    updateQueueBadge();
    // If queue page is currently open, refresh it too.
    if ($('#queue-page-tracks')) renderQueuePageTracks();
  }

  function renderTrackRow(track, inQueue, queueIndex) {
    const div = document.createElement('div');
    div.className = 'track' + (inQueue && queueIndex === currentIndex ? ' current' : '');
    const cover = track.coverUri ? `https://${track.coverUri.replace('%%', '100x100')}` : '';
    div.innerHTML = `
      <div class="track-cover" style="background-image:url('${cover}')"></div>
      <div class="track-meta">
        <div class="track-name">${escape(track.title)}</div>
        <div class="track-artist">${escape(track.artists.join(', '))}</div>
      </div>
      <div class="track-duration">${fmtMs(track.durationMs)}</div>
      <div class="track-actions"></div>
    `;
    const actions = div.querySelector('.track-actions');
    if (inQueue) {
      const playBtn = document.createElement('button');
      playBtn.className = 'primary';
      playBtn.textContent = '▶ Играть';
      playBtn.addEventListener('click', (e) => { e.stopPropagation(); playIndex(queueIndex); });
      const rmBtn = document.createElement('button');
      rmBtn.textContent = 'Убрать';
      rmBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFromQueue(queueIndex); });
      actions.appendChild(playBtn); actions.appendChild(rmBtn);
      div.addEventListener('click', () => playIndex(queueIndex));
    } else {
      const playNow = document.createElement('button');
      playNow.className = 'primary';
      playNow.textContent = '▶ Играть';
      playNow.addEventListener('click', (e) => { e.stopPropagation(); addAndPlay(track); });
      const addBtn = document.createElement('button');
      addBtn.textContent = '+ В очередь';
      addBtn.addEventListener('click', (e) => { e.stopPropagation(); addToQueue(track); });
      actions.appendChild(playNow); actions.appendChild(addBtn);
    }
    return div;
  }

  function normalizeTrack(t) {
    return {
      id: String(t.id).split(':')[0],
      title: t.title || '',
      artists: (t.artists || []).map(a => a.name),
      durationMs: t.durationMs || 0,
      coverUri: t.coverUri || t.albums?.[0]?.coverUri,
      albumId: t.albums?.[0]?.id,
    };
  }

  function addToQueue(track) {
    queue.push(track);
    renderQueue();
  }
  function removeFromQueue(idx) {
    if (idx === currentIndex) { stopPlayback(); queue.splice(idx, 1); }
    else {
      queue.splice(idx, 1);
      if (idx < currentIndex) currentIndex--;
    }
    renderQueue();
  }
  async function addAndPlay(track) {
    queue.push(track);
    renderQueue();
    await playIndex(queue.length - 1);
  }

  // ---------- Playback ----------

  async function playIndex(index) {
    if (index < 0 || index >= queue.length) return;
    currentIndex = index;
    renderQueue();
    const track = queue[index];
    showPlayer(track, true);

    let streamUrl;
    try { streamUrl = await resolveStreamUrl(track.id); }
    catch (e) { console.error('[YM] stream url failed:', e); showPlayer(track, false, 'Не удалось получить поток: ' + e.message); return; }

    try {
      const r = await sdk.fetch(streamUrl, { responseType: 'arraybuffer', headers: { ...HEADERS_BASE } });
      if (r.status >= 400) throw new Error('HTTP ' + r.status);
      const bytes = Uint8Array.from(atob(r.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      // Fresh audio element per track ensures captureStream gives a live track.
      recreateAudio();
      audio.src = URL.createObjectURL(blob);
      await audio.play();
      showPlayer(track, false);
      pushPresenceProgress._last = -1; // reset throttle so first update fires
      if (presence) await reattachPresenceMedia();
    } catch (e) {
      console.error('[YM] playback failed:', e);
      showPlayer(track, false, 'Ошибка проигрывания: ' + e.message);
    }
  }

  async function stopPlayback() {
    if (audio) {
      try { audio.pause(); } catch { }
      audio.removeAttribute('src');
      try { audio.load(); } catch { }
    }
    if (_captureStream) {
      _captureStream.getTracks().forEach(t => { try { t.stop(); } catch {} });
      _captureStream = null;
    }
    currentIndex = -1;
    renderQueue();
    player.classList.add('hidden');
    // When playback ends (queue exhausted or user pressed stop), leave the
    // voice channel — no point in keeping an idle presence tile around.
    if (presence) {
      try { await presence.setSubtitle(null); } catch { }
      try { await presence.destroy(); } catch { }
      presence = null;
      renderVoiceJoinButton();
    }
  }

  function showPlayer(track, loading, errorMsg) {
    player.classList.remove('hidden');
    const cover = track.coverUri ? `https://${track.coverUri.replace('%%', '200x200')}` : '';
    $('#player-cover').style.backgroundImage = `url('${cover}')`;
    $('#player-title').innerHTML = (loading ? '<span class="spinner"></span> ' : '') + escape(track.title);
    $('#player-artist').textContent = errorMsg || track.artists.join(', ');
    $('#player-duration').textContent = fmtMs(track.durationMs);
    $('#player-elapsed').textContent = '0:00';
    $('#player-bar-fill').style.width = '0%';
  }

  function updateLocalProgress() {
    if (!isFinite(audio.duration) || audio.duration === 0) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    $('#player-bar-fill').style.width = pct + '%';
    $('#player-elapsed').textContent = fmtSec(audio.currentTime);
  }

  // ---------- Yandex API helpers ----------

  async function yaCall(path) {
    const r = await sdk.fetch(YA_API + path, {
      method: 'GET',
      headers: { ...HEADERS_BASE, Authorization: 'OAuth ' + token },
      responseType: 'json',
    });
    if (r.status >= 400) throw new Error('Yandex API ' + r.status);
    return r.data;
  }

  async function resolveStreamUrl(trackId) {
    const id = String(trackId).split(':')[0];
    const deviceId = randomHex(16);
    const headers = { ...HEADERS_BASE, Authorization: 'OAuth ' + token, 'X-Yandex-Music-Device': deviceId };

    const infoRes = await yaCall(`/tracks/${id}/download-info`);
    const infos = infoRes.result || [];
    if (!infos.length) throw new Error('No download info');
    infos.sort((a, b) => b.bitrateKbps - a.bitrateKbps);
    const fullTrack = infos.find(i => i.codec === 'mp3' && !i.preview);
    if (!fullTrack) {
      throw new Error('Доступно только превью (~30 сек). Нужна подписка Яндекс Плюс или альтернативный вход через Android-клиент.');
    }
    const info = fullTrack;
    const url = info.downloadInfoUrl + (info.downloadInfoUrl.includes('?') ? '&' : '?') + 'format=json';

    const dl = await sdk.fetch(url, { method: 'GET', headers, responseType: 'json' });
    if (dl.status >= 400 || !dl.data?.host) throw new Error('download-info failed (' + dl.status + ')');
    const { host, path, ts, s } = dl.data;
    const sign = await md5('XGRwNC9wZnduYm9n' + path.substring(1) + s);
    return `https://${host}/get-mp3/${sign}/${ts}${path}`;
  }

  // ---------- Utils ----------

  function fmtMs(ms) { return fmtSec(ms / 1000); }
  function fmtSec(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function escape(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function randomHex(n) {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  async function md5(str) {
    // Web Crypto doesn't support MD5; embed a tiny pure-JS impl.
    return md5js(str);
  }
  // -- Tiny MD5 (RFC 1321) implementation --
  function md5js(s) {
    function L(k, d) { return (k << d) | (k >>> (32 - d)) }
    function K(G, k) { var I, d, F, H, x; F = (G & 2147483648); H = (k & 2147483648); I = (G & 1073741824); d = (k & 1073741824); x = (G & 1073741823) + (k & 1073741823); if (I & d) return (x ^ 2147483648 ^ F ^ H); if (I | d) { if (x & 1073741824) return (x ^ 3221225472 ^ F ^ H); else return (x ^ 1073741824 ^ F ^ H) } else return (x ^ F ^ H) }
    function r(d, F, k) { return (d & F) | ((~d) & k) }
    function q(d, F, k) { return (d & k) | (F & (~k)) }
    function p(d, F, k) { return (d ^ F ^ k) }
    function n(d, F, k) { return (F ^ (d | (~k))) }
    function u(G, F, aa, Z, k, H, I) { G = K(G, K(K(r(F, aa, Z), k), I)); return K(L(G, H), F) }
    function f(G, F, aa, Z, k, H, I) { G = K(G, K(K(q(F, aa, Z), k), I)); return K(L(G, H), F) }
    function D(G, F, aa, Z, k, H, I) { G = K(G, K(K(p(F, aa, Z), k), I)); return K(L(G, H), F) }
    function t(G, F, aa, Z, k, H, I) { G = K(G, K(K(n(F, aa, Z), k), I)); return K(L(G, H), F) }
    function e(G) { var Z, F = G.length, x = F + 8, k = (x - (x % 64)) / 64, I = (k + 1) * 16, aa = Array(I - 1), d = 0, H = 0; while (H < F) { Z = (H - (H % 4)) / 4; d = (H % 4) * 8; aa[Z] = (aa[Z] | (G.charCodeAt(H) << d)); H++ } Z = (H - (H % 4)) / 4; d = (H % 4) * 8; aa[Z] = aa[Z] | (128 << d); aa[I - 2] = F << 3; aa[I - 1] = F >>> 29; return aa }
    function B(x) { var k = "", F = "", G, d; for (d = 0; d <= 3; d++) { G = (x >>> (d * 8)) & 255; F = "0" + G.toString(16); k = k + F.substr(F.length - 2, 2) } return k }
    function J(k) { k = k.replace(/\r\n/g, "\n"); var d = ""; for (var F = 0; F < k.length; F++) { var x = k.charCodeAt(F); if (x < 128) { d += String.fromCharCode(x) } else if ((x > 127) && (x < 2048)) { d += String.fromCharCode((x >> 6) | 192); d += String.fromCharCode((x & 63) | 128) } else { d += String.fromCharCode((x >> 12) | 224); d += String.fromCharCode(((x >> 6) & 63) | 128); d += String.fromCharCode((x & 63) | 128) } } return d }
    var C = Array(), P, h, E, v, g, Y, M, X, W, o = 7, T = 12, R = 17, O = 22, A = 5, z = 9, y = 14, w = 20, N = 4, U = 11, S = 16, Q = 23, V = 6, b = 10, a = 15, c = 21; s = J(s); C = e(s); Y = 1732584193; M = 4023233417; X = 2562383102; W = 271733878;
    for (P = 0; P < C.length; P += 16) {
      h = Y; E = M; v = X; g = W; Y = u(Y, M, X, W, C[P + 0], o, 3614090360); W = u(W, Y, M, X, C[P + 1], T, 3905402710); X = u(X, W, Y, M, C[P + 2], R, 606105819); M = u(M, X, W, Y, C[P + 3], O, 3250441966); Y = u(Y, M, X, W, C[P + 4], o, 4118548399); W = u(W, Y, M, X, C[P + 5], T, 1200080426); X = u(X, W, Y, M, C[P + 6], R, 2821735955); M = u(M, X, W, Y, C[P + 7], O, 4249261313); Y = u(Y, M, X, W, C[P + 8], o, 1770035416); W = u(W, Y, M, X, C[P + 9], T, 2336552879); X = u(X, W, Y, M, C[P + 10], R, 4294925233); M = u(M, X, W, Y, C[P + 11], O, 2304563134); Y = u(Y, M, X, W, C[P + 12], o, 1804603682); W = u(W, Y, M, X, C[P + 13], T, 4254626195); X = u(X, W, Y, M, C[P + 14], R, 2792965006); M = u(M, X, W, Y, C[P + 15], O, 1236535329);
      Y = f(Y, M, X, W, C[P + 1], A, 4129170786); W = f(W, Y, M, X, C[P + 6], z, 3225465664); X = f(X, W, Y, M, C[P + 11], y, 643717713); M = f(M, X, W, Y, C[P + 0], w, 3921069994); Y = f(Y, M, X, W, C[P + 5], A, 3593408605); W = f(W, Y, M, X, C[P + 10], z, 38016083); X = f(X, W, Y, M, C[P + 15], y, 3634488961); M = f(M, X, W, Y, C[P + 4], w, 3889429448); Y = f(Y, M, X, W, C[P + 9], A, 568446438); W = f(W, Y, M, X, C[P + 14], z, 3275163606); X = f(X, W, Y, M, C[P + 3], y, 4107603335); M = f(M, X, W, Y, C[P + 8], w, 1163531501); Y = f(Y, M, X, W, C[P + 13], A, 2850285829); W = f(W, Y, M, X, C[P + 2], z, 4243563512); X = f(X, W, Y, M, C[P + 7], y, 1735328473); M = f(M, X, W, Y, C[P + 12], w, 2368359562);
      Y = D(Y, M, X, W, C[P + 5], N, 4294588738); W = D(W, Y, M, X, C[P + 8], U, 2272392833); X = D(X, W, Y, M, C[P + 11], S, 1839030562); M = D(M, X, W, Y, C[P + 14], Q, 4259657740); Y = D(Y, M, X, W, C[P + 1], N, 2763975236); W = D(W, Y, M, X, C[P + 4], U, 1272893353); X = D(X, W, Y, M, C[P + 7], S, 4139469664); M = D(M, X, W, Y, C[P + 10], Q, 3200236656); Y = D(Y, M, X, W, C[P + 13], N, 681279174); W = D(W, Y, M, X, C[P + 0], U, 3936430074); X = D(X, W, Y, M, C[P + 3], S, 3572445317); M = D(M, X, W, Y, C[P + 6], Q, 76029189); Y = D(Y, M, X, W, C[P + 9], N, 3654602809); W = D(W, Y, M, X, C[P + 12], U, 3873151461); X = D(X, W, Y, M, C[P + 15], S, 530742520); M = D(M, X, W, Y, C[P + 2], Q, 3299628645);
      Y = t(Y, M, X, W, C[P + 0], V, 4096336452); W = t(W, Y, M, X, C[P + 7], b, 1126891415); X = t(X, W, Y, M, C[P + 14], a, 2878612391); M = t(M, X, W, Y, C[P + 5], c, 4237533241); Y = t(Y, M, X, W, C[P + 12], V, 1700485571); W = t(W, Y, M, X, C[P + 3], b, 2399980690); X = t(X, W, Y, M, C[P + 10], a, 4293915773); M = t(M, X, W, Y, C[P + 1], c, 2240044497); Y = t(Y, M, X, W, C[P + 8], V, 1873313359); W = t(W, Y, M, X, C[P + 15], b, 4264355552); X = t(X, W, Y, M, C[P + 6], a, 2734768916); M = t(M, X, W, Y, C[P + 13], c, 1309151649); Y = t(Y, M, X, W, C[P + 4], V, 4149444226); W = t(W, Y, M, X, C[P + 11], b, 3174756917); X = t(X, W, Y, M, C[P + 2], a, 718787259); M = t(M, X, W, Y, C[P + 9], c, 3951481745);
      Y = K(Y, h); M = K(M, E); X = K(X, v); W = K(W, g)
    }
    return (B(Y) + B(M) + B(X) + B(W)).toLowerCase()
  }
})();
