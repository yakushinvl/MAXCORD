import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion } from 'framer-motion';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { CloseIcon } from './Icons';
import {
  overlayVariants,
  overlayTransition,
  modalPopVariants,
  modalPopTransition,
} from '../animations/transitions';
import { useFreezeAppBackground } from '../animations/useFreezeAppBackground';
import './ImageCropper.css';

interface ImageCropperProps {
    image: string;
    cropShape?: 'rect' | 'round';
    aspect?: number;
    onCropComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
    title?: string;
}

const isGifSource = (src: string) => src.startsWith('data:image/gif') || /\.gif($|\?)/i.test(src);

const ImageCropper: React.FC<ImageCropperProps> = ({ image, cropShape = 'round', aspect = 1, onCropComplete, onCancel, title = 'Обрезка изображения' }) => {
    useFreezeAppBackground(true);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [processing, setProcessing] = useState(false);

    const isGif = isGifSource(image);

    const onCropAreaComplete = useCallback((_: any, cap: any) => setCroppedAreaPixels(cap), []);

    const createImage = (url: string): Promise<HTMLImageElement> => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = (e) => rej(e);
        img.setAttribute('crossOrigin', 'anonymous');
        img.src = url;
    });

    const getCroppedStaticImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
        const img = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2d context');
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
        return new Promise((res) => canvas.toBlob((blob) => { if (blob) res(blob); }, 'image/jpeg', 0.95) as any);
    };

    const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer => {
        const comma = dataUrl.indexOf(',');
        const base64 = dataUrl.slice(comma + 1);
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
    };

    const getCroppedGif = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
        // Fetching a `data:` URL trips the document's connect-src CSP, so decode it
        // ourselves. Non-data sources still go through fetch.
        let buffer: ArrayBuffer;
        if (imageSrc.startsWith('data:')) {
            buffer = dataUrlToArrayBuffer(imageSrc);
        } else {
            const resp = await fetch(imageSrc);
            buffer = await resp.arrayBuffer();
        }

        const gif = parseGIF(buffer);
        const frames = decompressFrames(gif, true);
        if (!frames.length) throw new Error('GIF has no frames');

        const fullW = gif.lsd.width;
        const fullH = gif.lsd.height;

        // Composition canvas — represents the full GIF state with disposal handling
        const composeCanvas = document.createElement('canvas');
        composeCanvas.width = fullW;
        composeCanvas.height = fullH;
        const composeCtx = composeCanvas.getContext('2d')!;

        // Crop canvas — the output frame, sized to the crop rect (clamped to image bounds)
        const cropX = Math.max(0, Math.round(pixelCrop.x));
        const cropY = Math.max(0, Math.round(pixelCrop.y));
        const cropW = Math.min(fullW - cropX, Math.round(pixelCrop.width));
        const cropH = Math.min(fullH - cropY, Math.round(pixelCrop.height));

        // Cap output dimensions so the GIF stays a reasonable size
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
        const outW = Math.max(1, Math.round(cropW * scale));
        const outH = Math.max(1, Math.round(cropH * scale));

        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d')!;

        // Patch canvas for drawing individual frame patches
        const patchCanvas = document.createElement('canvas');
        const patchCtx = patchCanvas.getContext('2d')!;

        const encoder = GIFEncoder();
        let prevFrameImageData: ImageData | null = null;

        for (const frame of frames) {
            const { dims, patch, delay, disposalType } = frame;

            // Save state for restore-to-previous disposal
            if (disposalType === 3) {
                prevFrameImageData = composeCtx.getImageData(0, 0, fullW, fullH);
            }

            // Draw this frame's patch onto the composition canvas
            patchCanvas.width = dims.width;
            patchCanvas.height = dims.height;
            const patchImageData = patchCtx.createImageData(dims.width, dims.height);
            patchImageData.data.set(patch);
            patchCtx.putImageData(patchImageData, 0, 0);
            composeCtx.drawImage(patchCanvas, dims.left, dims.top);

            // Crop + scale the composed frame into the output canvas
            outCtx.clearRect(0, 0, outW, outH);
            outCtx.drawImage(composeCanvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

            const frameData = outCtx.getImageData(0, 0, outW, outH).data;
            const palette = quantize(frameData, 256);
            const index = applyPalette(frameData, palette);
            encoder.writeFrame(index, outW, outH, {
                palette,
                delay: Math.max(20, delay || 100),
            });

            // Apply disposal for next frame
            if (disposalType === 2) {
                composeCtx.clearRect(dims.left, dims.top, dims.width, dims.height);
            } else if (disposalType === 3 && prevFrameImageData) {
                composeCtx.putImageData(prevFrameImageData, 0, 0);
            }
        }

        encoder.finish();
        const bytes = encoder.bytes();
        return new Blob([bytes as BlobPart], { type: 'image/gif' });
    };

    const handleSave = async () => {
        if (!croppedAreaPixels) return;
        setProcessing(true);
        try {
            const blob = isGif
                ? await getCroppedGif(image, croppedAreaPixels)
                : await getCroppedStaticImg(image, croppedAreaPixels);
            onCropComplete(blob);
        } catch (e) {
            setProcessing(false);
        }
    };

    return (
        <motion.div
            className="cropper-overlay"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            transition={overlayTransition}
        >
            <motion.div
                className="cropper-container"
                variants={modalPopVariants}
                initial="initial"
                animate="animate"
                transition={modalPopTransition}
            >
                <div className="cropper-header">
                    <div className="cropper-title-row">
                        <h3>{title}</h3>
                        {isGif && <span className="cropper-gif-badge">GIF</span>}
                    </div>
                    <button className="cropper-close" onClick={onCancel} disabled={processing}>
                        <CloseIcon size={18} />
                    </button>
                </div>
                <div className="cropper-content">
                    <div className="cropper-wrapper">
                        <Cropper
                            image={image}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            cropShape={cropShape}
                            showGrid={false}
                            onCropChange={setCrop}
                            onCropComplete={onCropAreaComplete}
                            onZoomChange={setZoom}
                        />
                    </div>
                    <div className="cropper-controls">
                        <div className="zoom-control">
                            <span className="zoom-label">Масштаб</span>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.05}
                                onChange={e => setZoom(Number(e.target.value))}
                                className="zoom-range"
                                disabled={processing}
                            />
                            <span className="zoom-value">{zoom.toFixed(1)}x</span>
                        </div>
                        {isGif && (
                            <div className="cropper-hint">
                                Анимация будет сохранена. Обработка может занять несколько секунд.
                            </div>
                        )}
                    </div>
                </div>
                <div className="cropper-footer">
                    <button className="cropper-btn-cancel" onClick={onCancel} disabled={processing}>
                        Отмена
                    </button>
                    <button className="cropper-btn-save" onClick={handleSave} disabled={processing || !croppedAreaPixels}>
                        {processing ? (isGif ? 'Обработка GIF…' : 'Сохранение…') : 'Сохранить'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ImageCropper;
