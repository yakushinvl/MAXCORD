// MAXCORD Mini-App SDK
// Available as `window.maxcord` inside a mini-app iframe loaded by the MAXCORD client.
// Communication runs over postMessage between the iframe and the host window.
(function () {
  if (window.maxcord) return;

  const HOST = window.parent;
  const callbacks = new Map();
  const eventHandlers = new Map();
  let _seq = 0;
  let _port = null;

  function nextId() { return 'm_' + (++_seq) + '_' + Date.now(); }

  function call(type, payload, extra, transfer) {
    return new Promise((resolve, reject) => {
      const id = nextId();
      callbacks.set(id, { resolve, reject });
      try {
        const target = _port || HOST;
        target.postMessage({ __maxcord: true, id, type, payload, ...(extra || {}) }, '*', transfer || []);
      } catch (e) {
        callbacks.delete(id);
        reject(e);
      }
    });
  }

  // Track handoff to parent. Tries transferable first (works for cross-origin
  // mini-apps in Chrome 116+ / Firefox 117+). Falls back to a same-origin
  // global property trick: stash the track on this window, host reaches into
  // iframe.contentWindow to grab it. Falls back gracefully if same-origin
  // access isn't possible (then transferable is the only option).
  const _trackStash = new Map(); // stashId -> MediaStreamTrack
  window.__maxcordTrackStash = _trackStash;

  const isMediaStreamTrack = (t) => t && (
    (typeof MediaStreamTrack !== 'undefined' && t instanceof MediaStreamTrack) ||
    (t.constructor && t.constructor.name === 'MediaStreamTrack') ||
    (typeof t.stop === 'function' && typeof t.clone === 'function' && 'enabled' in t)
  );

  function sendTrack(type, payload, track) {
    // VERSION 4: Port-based transfer + multiple strategies
    const stashId = nextId();
    _trackStash.set(stashId, track);
    
    // Clean payload for fallback to avoid DataCloneError
    const cleanPayload = {};
    if (payload && typeof payload === 'object') {
      for (const k in payload) {
        if (typeof payload[k] !== 'object' || payload[k] === null) {
          cleanPayload[k] = payload[k];
        }
      }
    }
    cleanPayload.__trackStashId = stashId;

    if (track.readyState === 'ended') {
      console.warn('[maxcord-sdk v4] Sending a track that is already in "ended" state.');
    }

    return new Promise((resolve, reject) => {
      const id = nextId();
      callbacks.set(id, { resolve, reject });
      
      const envelope = { __maxcord: true, id, type, payload: cleanPayload };
      const target = _port || HOST;

      const tryTransfer = (obj, label, key) => {
        try {
          console.log(`[maxcord-sdk v4] Attempting ${label} transfer via ${_port ? 'port' : 'window'}...`);
          if (_port) {
            _port.postMessage({ ...envelope, [key]: obj }, [obj]);
          } else {
            HOST.postMessage({ ...envelope, [key]: obj }, '*', [obj]);
          }
          return true;
        } catch (e) {
          console.warn(`[maxcord-sdk v4] ${label} transfer failed:`, e.message);
          return false;
        }
      };

      // Strategy 1: Original track
      if (tryTransfer(track, 'original track', 'track')) return;

      // Strategy 2: Cloned track
      try {
        const cloned = track.clone();
        if (tryTransfer(cloned, 'cloned track', 'track')) return;
      } catch (e) { console.warn('[maxcord-sdk v4] clone() failed:', e.message); }

      // Strategy 3: MediaStream wrap (note: streams are not transferable in all browsers)
      try {
        const stream = new MediaStream([track]);
        if (tryTransfer(stream, 'MediaStream', 'stream')) return;
      } catch (e) { console.warn('[maxcord-sdk v4] MediaStream wrap failed:', e.message); }

      // Total failure of transferable path -> Fallback to stash
      console.warn('[maxcord-sdk v4] All transferable paths failed, using fallback stash path');
      try {
        target.postMessage(envelope, '*');
      } catch (e2) {
        console.error('[maxcord-sdk v4] Total failure:', e2.message);
        callbacks.delete(id);
        reject(e2);
      }
    }).finally(() => {
      setTimeout(() => _trackStash.delete(stashId), 5000);
    });
  }

  const handleMsg = (msg) => {
    if (!msg || !msg.__maxcord) return;

    if (msg.type === 'setupPort' && msg.port) {
      console.log('[maxcord-sdk v4] Received MessagePort from host');
      _port = msg.port;
      _port.onmessage = (e) => handleMsg(e.data);
      return;
    }

    if (msg.id != null && callbacks.has(msg.id)) {
      const { resolve, reject } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error || 'mini-app SDK error'));
      return;
    }
    if (msg.event) {
      const handlers = eventHandlers.get(msg.event) || [];
      handlers.forEach(h => { try { h(msg.payload); } catch (err) { console.error(err); } });
    }
  };

  window.addEventListener('message', (e) => {
    if (e.source !== HOST) return;
    handleMsg(e.data);
  });

  const storage = {
    get: (key) => call('storage.get', { key }),
    set: (key, value) => call('storage.set', { key, value }),
    delete: (key) => call('storage.delete', { key }),
    getAll: () => call('storage.getAll', {}),
  };

  const maxcord = {
    version: 1,

    /** Initial handshake. Returns { user, app, voiceChannelId }. Call this first. */
    init: () => call('init', {}).then(res => {
      if (res && res.port && res.port instanceof MessagePort) {
        console.log('[maxcord-sdk v4] Captured MessagePort from init response');
        _port = res.port;
        _port.onmessage = (e) => handleMsg(e.data);
      }
      return res;
    }),

    /** Current MAXCORD user info. */
    getUser: () => call('getUser', {}),

    /** Current active voice channel of the user (null if not in voice). */
    getVoiceChannel: () => call('getVoiceChannel', {}),

    /**
     * Publish a MediaStreamTrack into the user's voice channel so other members hear it.
     * Returns the LiveKit publication sid (string) — keep it to unpublish later.
     * The user must be in a voice channel.
     */
    publishAudioTrack: async (track) => {
      if (!isMediaStreamTrack(track) || track.kind !== 'audio') {
        throw new Error('publishAudioTrack expects an audio MediaStreamTrack');
      }
      return sendTrack('publishAudioTrack', { name: 'miniapp-audio' }, track);
    },

    /** Stop publishing a previously published track by sid. */
    unpublishAudioTrack: (sid) => call('unpublishAudioTrack', { sid }),

    /**
     * Make an HTTP request via the MAXCORD server (bypasses CORS). Use this when calling
     * third-party APIs that don't allow direct browser access.
     * options: { method, headers, body, responseType: 'json'|'text'|'arraybuffer', timeout }
     */
    fetch: (url, options) => call('fetch', { url, ...(options || {}) }),

    /** Send a chat message into a MAXCORD channel as the current user. */
    sendMessage: (channelId, payload) => call('sendMessage', { channelId, ...payload }),

    /**
     * Open an OAuth popup. Resolves with { href, hash, search } once the popup
     * navigates to your `redirectUri` (substring match on origin + path).
     * Pass redirectUri explicitly so the bridge can ignore intermediate auth
     * pages (login screens, consent prompts) that occur during the flow.
     */
    oauthPopup: (url, options) => {
      let redirectUri = options && options.redirectUri;
      if (!redirectUri) {
        try {
          const u = new URL(url);
          redirectUri = u.searchParams.get('redirect_uri') || undefined;
        } catch {}
      }
      return call('oauthPopup', { url, redirectUri, ...(options || {}) });
    },

    /** Per-user, per-app key-value storage (server-backed, persists across sessions). */
    storage,

    /** Subscribe to host events. Returns an unsubscribe function. */
    on: (event, handler) => {
      const list = eventHandlers.get(event) || [];
      list.push(handler);
      eventHandlers.set(event, list);
      return () => {
        const cur = eventHandlers.get(event) || [];
        eventHandlers.set(event, cur.filter(h => h !== handler));
      };
    },

    voicePresence: {
      /**
       * Create a virtual "voice presence" — the mini-app appears as its own
       * participant tile inside the user's current voice channel, with custom
       * display name, avatar/background, and clickable controls that other
       * channel members can interact with.
       *
       * Returns a PresenceSession with methods to publish audio/video,
       * update the background, control schema, and react to control events.
       */
      create: async ({ displayName, avatar } = {}) => {
        const sessionId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        const channelId = await call('voicePresence.create', { sessionId, displayName, avatar });
        return makePresence(sessionId, channelId);
      },
    },
  };

  const presenceControlHandlers = new Map(); // sessionId -> [handler]

  function makePresence(sessionId, channelId) {
    return {
      sessionId,
      channelId,

      /** Publish an audio MediaStreamTrack so others hear it as this presence. */
      publishAudio: (track) => {
        if (!isMediaStreamTrack(track) || track.kind !== 'audio') throw new Error('audio MediaStreamTrack required');
        return sendTrack('voicePresence.publishAudio', { sessionId }, track);
      },

      /** Publish a video MediaStreamTrack as background for this presence. */
      publishVideo: (track) => {
        if (!isMediaStreamTrack(track) || track.kind !== 'video') throw new Error('video MediaStreamTrack required');
        return sendTrack('voicePresence.publishVideo', { sessionId }, track);
      },

      unpublishAudio: () => call('voicePresence.unpublishAudio', { sessionId }),
      unpublishVideo: () => call('voicePresence.unpublishVideo', { sessionId }),

      /**
       * Background of the presence tile:
       *   { type: 'image', url: '...' }       — static cover
       *   { type: 'video', url: '...' }       — auto-playing looping video
       *   { type: 'color', color: '#a155ff' } — solid color
       *   null                                 — fall back to avatar
       * For a streamed video background from a captured element, use publishVideo() instead.
       */
      setBackground: (background) => call('voicePresence.setBackground', { sessionId, background }),

      /** Secondary line under the title (e.g. "Track — Artist"). */
      setSubtitle: (subtitle) => call('voicePresence.update', { sessionId, patch: { subtitle } }),

      /** Accent color (CSS hex like '#ffcc00') used for the pulse + active controls. */
      setAccentColor: (accentColor) => call('voicePresence.update', { sessionId, patch: { accentColor } }),

      /** Rename the presence at runtime. */
      setDisplayName: (displayName) => call('voicePresence.update', { sessionId, patch: { displayName } }),

      /** Swap avatar at runtime. */
      setAvatar: (avatar) => call('voicePresence.update', { sessionId, patch: { avatar } }),

      /**
       * Define the controls rendered on the tile. Each control:
       *   { id, kind: 'button'|'slider', label, value, min, max, style, tooltip }
       */
      setControls: (controls) => call('voicePresence.setControls', { sessionId, controls }),

      /** Patch a single control (e.g. progress slider). */
      updateControl: (controlId, partial) =>
        call('voicePresence.updateControl', { sessionId, controlId, partial }),

      /** Subscribe to control interactions from any channel member. */
      on: (event, handler) => {
        if (event !== 'control') throw new Error('unknown event: ' + event);
        const list = presenceControlHandlers.get(sessionId) || [];
        list.push(handler);
        presenceControlHandlers.set(sessionId, list);
        return () => {
          const cur = presenceControlHandlers.get(sessionId) || [];
          presenceControlHandlers.set(sessionId, cur.filter(h => h !== handler));
        };
      },

      destroy: () => {
        presenceControlHandlers.delete(sessionId);
        return call('voicePresence.destroy', { sessionId });
      },
    };
  }

  // Route voicePresenceControl events into per-session handlers.
  eventHandlers.set('voicePresenceControl', [(payload) => {
    const list = presenceControlHandlers.get(payload.sessionId) || [];
    list.forEach(h => { try { h(payload); } catch (e) { console.error(e); } });
  }]);

  window.maxcord = maxcord;
  // Fire a custom event when SDK is ready
  window.dispatchEvent(new CustomEvent('maxcord-sdk-ready'));
})();
