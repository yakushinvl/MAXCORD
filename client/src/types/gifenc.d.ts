declare module 'gifenc' {
    export interface GIFEncoderInstance {
        writeFrame(
            index: Uint8Array | number[],
            width: number,
            height: number,
            opts?: { palette?: number[][]; delay?: number; transparent?: boolean; transparentIndex?: number; first?: boolean; repeat?: number }
        ): void;
        finish(): void;
        bytes(): Uint8Array;
        readonly stream: { writeByte(b: number): void; writeBytes(b: ArrayLike<number>, offset?: number, byteLength?: number): void };
    }

    export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance;

    export function quantize(
        rgba: Uint8ClampedArray | Uint8Array,
        maxColors: number,
        opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number }
    ): number[][];

    export function applyPalette(
        rgba: Uint8ClampedArray | Uint8Array,
        palette: number[][],
        format?: 'rgb565' | 'rgb444' | 'rgba4444'
    ): Uint8Array;
}
