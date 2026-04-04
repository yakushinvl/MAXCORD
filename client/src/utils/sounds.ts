export const SOUNDS = {
    MESSAGE_NOTIFY: 'sounds/новое сообщение или упоминание.wav',
    CALL_RINGING: 'sounds/Входящий_звонок.wav',
    CALL_OUTGOING: 'sounds/Исходящий_гудок.wav',
    CALL_JOIN: 'sounds/Подключение к гч на сервере.wav',
    CALL_LEAVE: 'sounds/выход из гч сервера.wav',
    MUTE: 'sounds/микрофон вкл и выкл.wav',
    UNMUTE: 'sounds/микрофон вкл и выкл.wav',
    VOICE_JOIN: 'sounds/Подключение к гч на сервере.wav',
    VOICE_LEAVE: 'sounds/выход из гч сервера.wav',
    SCREENSHARE_ON: 'sounds/запуск стрима.wav',
    SCREENSHARE_OFF: 'sounds/выкл стрим.wav'
};

class SoundManager {
    private static instance: SoundManager;
    private audioContext: AudioContext | null = null;
    private soundBuffers: Map<string, AudioBuffer> = new Map();
    private isInitialized = false;

    private constructor() { }

    static getInstance(): SoundManager {
        if (!SoundManager.instance) SoundManager.instance = new SoundManager();
        return SoundManager.instance;
    }

    async init(existingContext?: AudioContext) {
        if (this.isInitialized) return;
        try {
            this.audioContext = existingContext || new ((window as any).AudioContext || (window as any).webkitAudioContext)();
            this.isInitialized = true;
        } catch (e) { }
    }

    setAudioContext(ctx: AudioContext) {
        this.audioContext = ctx;
        this.isInitialized = true;
    }

    async playSound(soundPath: string, volume: number = 0.5) {
        // Fallback to simple Audio element if Web Audio is not initialized
        if (!this.isInitialized || !this.audioContext) {
            try {
                const audio = new Audio(soundPath);
                audio.volume = volume;
                return await audio.play();
            } catch (err) {
                return;
            }
        }

        try {
            let buffer = this.soundBuffers.get(soundPath);
            if (!buffer) {
                // Remove query param for production file:// protocol support
                const url = window.location.protocol === 'file:' ? soundPath : `${soundPath}?v=${Date.now()}`;
                const resp = await fetch(url, { cache: 'no-store' });
                if (!resp.ok) return;

                // Crucial Check: Ensure we didn't get an HTML/JSON 404 page
                const contentType = resp.headers.get('Content-Type');
                if (contentType && !contentType.startsWith('audio/') && !contentType.startsWith('application/octet-stream')) {
                    console.warn(`[SoundManager] Skipping ${soundPath}: Invalid content type ${contentType}`);
                    return;
                }

                const arrayBuf = await resp.arrayBuffer();
                if (arrayBuf.byteLength === 0) return;

                try {
                    buffer = await this.audioContext.decodeAudioData(arrayBuf);
                    this.soundBuffers.set(soundPath, buffer);
                } catch (decodeErr) {
                    console.warn(`[SoundManager] Failed to decode ${soundPath}. File might be corrupted or missing.`);
                    return;
                }
            }

            if (!buffer) return;

            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            source.buffer = buffer;
            gainNode.gain.value = volume;
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            source.start(0);
        } catch (err) {
            // Final fallback
            try {
                const audio = new Audio(soundPath);
                audio.volume = volume;
                await audio.play();
            } catch (fallbackErr) { }
        }
    }

    play(soundPath: string, volume: number = 0.5) {
        this.playSound(soundPath, volume).catch(() => { });
    }

    playLoop(soundPath: string, volume: number = 0.5): HTMLAudioElement {
        // Remove query param for production file:// protocol support
        const url = window.location.protocol === 'file:' ? soundPath : `${soundPath}?v=${Date.now()}`;
        const audio = new Audio(url);
        audio.loop = true;
        audio.volume = volume;
        audio.play().catch((err) => {
            console.warn('[SoundManager] playLoop failed:', err);
        });
        return audio;
    }
}

export const soundManager = SoundManager.getInstance();
