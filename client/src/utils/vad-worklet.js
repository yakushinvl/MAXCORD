class VADProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._lastUpdate = 0;
        this._rms = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const samples = input[0];
            let sumOfSquares = 0;
            for (let i = 0; i < samples.length; i++) {
                sumOfSquares += samples[i] * samples[i];
            }
            this._rms = Math.sqrt(sumOfSquares / samples.length);

            const now = Date.now();
            // Send updates every 50ms to match the previous interval but without blocking the main thread for calculation
            if (now - this._lastUpdate > 40) {
                this.port.postMessage({ rms: this._rms });
                this._lastUpdate = now;
            }
        }
        return true;
    }
}

registerProcessor('vad-processor', VADProcessor);
