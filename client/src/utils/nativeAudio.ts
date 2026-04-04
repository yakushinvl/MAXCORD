// Native Audio Manager handles the communication with the native Electron audio module
// Note: We avoid declaring global window interfaces here to prevent conflicts with other files.

class NativeAudioManager {
    private audioCtx!: AudioContext;
    private destination!: MediaStreamAudioDestinationNode;
    private nextStartTime: number = 0;
    private isPlaying: boolean = false;
    private removeDataListener: (() => void) | null = null;
    private removeMetaListener: (() => void) | null = null;

    // Metadata
    private sampleRate: number = 44100;
    private channels: number = 2;

    constructor() {
    }

    public async startcapture(sourceId: string): Promise<MediaStream> {
        const electron = (window as any).electron;
        if (!electron) {
            console.warn("Native audio not available (electron missing). Returning empty stream.");
            // Return dummy stream to prevent crash
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const dest = ctx.createMediaStreamDestination();
            return dest.stream;
        }

        // Re-create AudioContext to ensure fresh streams/tracks
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
        this.destination = this.audioCtx.createMediaStreamDestination();

        let pid: number = 0;
        let mode: number = 0; // 0 = Include, 1 = Exclude

        if (sourceId.startsWith('window:')) {
            // Source ID format: window:12345:0 (second part is HWND or something unique)
            // Electron desktopCapturer source.id: "window:132142:0" -> HWND is 132142
            const parts = sourceId.split(':');
            if (parts.length > 1) {
                const hwnd = parseInt(parts[1], 10);
                pid = await electron.ipc.invoke('get-pid-from-hwnd', hwnd);
            }
            mode = 0; // Capture only this process
        } else {
            // Screen share: Capture everything EXCEPT our app (anti-loopback)
            // We want to exclude "Self" (Process Loopback Mode Exclude).
            pid = await electron.ipc.invoke('get-app-pid');
            mode = 1; // Exclude target process (us) and capture everything else
        }

        console.log(`[NativeAudio] Starting capture for PID: ${pid} Mode: ${mode}`);

        // Setup listeners
        this.nextStartTime = this.audioCtx.currentTime;

        this.removeMetaListener = electron.ipc.on('audio-meta', (event: any, meta: { sampleRate: number, channels: number }) => {
            console.log('[NativeAudio] Meta received:', meta);
            this.sampleRate = meta.sampleRate;
            this.channels = meta.channels;
        });

        const removeBatched = electron.ipc.on('audio-data-batch', (event: any, buffer: Uint8Array) => {
            this.handleAudioData(buffer);
        });

        const removeLegacy = electron.ipc.on('audio-data', (event: any, buffer: Uint8Array) => {
            this.handleAudioData(buffer);
        });

        this.removeDataListener = () => {
            removeBatched();
            removeLegacy();
        };

        electron.ipc.send('start-audio-capture', { pid, mode });

        // Ensure context is running
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        return this.destination.stream;
    }

    public stopCapture() {
        const electron = (window as any).electron;
        if (!electron) return;
        electron.ipc.send('stop-audio-capture');
        if (this.removeDataListener) {
            this.removeDataListener();
            this.removeDataListener = null;
            // Also need to clear the specific IPC listeners if the above was just a wrapper
            electron.ipc.removeAllListeners('audio-data-batch');
            electron.ipc.removeAllListeners('audio-data');
        }
        if (this.removeMetaListener) {
            this.removeMetaListener();
            this.removeMetaListener = null;
            electron.ipc.removeAllListeners('audio-meta');
        }

        if (this.audioCtx) {
            this.audioCtx.close().catch(() => { });
        }
    }

    private handleAudioData(data: Uint8Array) {
        // Use the buffer directly with offset to avoid expensive slice/copy
        const float32Data = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);

        // Debug packets
        if (!this.isPlaying) {
            console.log('[NativeAudio] Received first audio packet. Samples:', float32Data.length);
            this.isPlaying = true;
            (window as any).packetCounter = 0;
        }

        (window as any).packetCounter++;
        if ((window as any).packetCounter % 100 === 0) {
            let maxAmp = 0;
            for (let i = 0; i < float32Data.length; i++) {
                const amp = Math.abs(float32Data[i]);
                if (amp > maxAmp) maxAmp = amp;
            }
            console.log(`[NativeAudio] Packets: ${(window as any).packetCounter} | Max Amp: ${maxAmp.toFixed(5)} | Context Time: ${this.audioCtx.currentTime.toFixed(2)}`);
        }

        // Create audio buffer
        const buffer = this.audioCtx.createBuffer(this.channels, float32Data.length / this.channels, this.sampleRate);

        for (let chit = 0; chit < this.channels; chit++) {
            const channelData = buffer.getChannelData(chit);
            for (let i = 0; i < buffer.length; i++) {
                channelData[i] = float32Data[i * this.channels + chit];
            }
        }

        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.destination);

        // Schedule
        const now = this.audioCtx.currentTime;
        if (this.nextStartTime < now) {
            this.nextStartTime = now;
        }

        source.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;
    }
}

export const nativeAudioManager = new NativeAudioManager();
