import { RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';

export const setupNoiseSuppression = async (
    context: AudioContext,
    sourceStream: MediaStream
): Promise<MediaStream> => {
    try {
        await context.audioWorklet.addModule(rnnoiseWorkletPath);
        const sourceNode = context.createMediaStreamSource(sourceStream);
        const destinationNode = context.createMediaStreamDestination();
        const response = await fetch(new URL(rnnoiseWasmPath, import.meta.url).href);
        const wasmBuffer = await response.arrayBuffer();
        const rnnoiseNode = new RnnoiseWorkletNode(context, { wasmBinary: wasmBuffer, maxChannels: 2 });
        sourceNode.connect(rnnoiseNode);
        rnnoiseNode.connect(destinationNode);
        return destinationNode.stream;
    } catch (error) {
        return sourceStream;
    }
};
