import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { CloseIcon } from './Icons';
import './ImageCropper.css';

interface ImageCropperProps { image: string; cropShape?: 'rect' | 'round'; aspect?: number; onCropComplete: (croppedImage: Blob) => void; onCancel: () => void; title?: string; }

const ImageCropper: React.FC<ImageCropperProps> = ({ image, cropShape = 'round', aspect = 1, onCropComplete, onCancel, title = 'Обрезка изображения' }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropAreaComplete = useCallback((_: any, cap: any) => setCroppedAreaPixels(cap), []);
    const createImage = (url: string): Promise<HTMLImageElement> => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = (e) => rej(e); img.setAttribute('crossOrigin', 'anonymous'); img.src = url; });

    const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
        const img = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2d context');
        canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
        ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
        return new Promise((res) => canvas.toBlob((blob) => { if (blob) res(blob); }, 'image/jpeg', 0.95));
    };

    const handleSave = async () => { try { onCropComplete(await getCroppedImg(image, croppedAreaPixels)); } catch (e) { } };

    return (
        <div className="cropper-overlay">
            <div className="cropper-container">
                <div className="cropper-header"><h3>{title}</h3><button className="cropper-close" onClick={onCancel}><CloseIcon size={20} /></button></div>
                <div className="cropper-content">
                    <div className="cropper-wrapper">
                        <Cropper image={image} crop={crop} zoom={zoom} aspect={aspect} cropShape={cropShape} showGrid={false} onCropChange={setCrop} onCropComplete={onCropAreaComplete} onZoomChange={setZoom} />
                    </div>
                    <div className="cropper-controls"><div className="zoom-control"><span>Масштаб</span><input type="range" value={zoom} min={1} max={3} step={0.1} onChange={e => setZoom(Number(e.target.value))} className="zoom-range" /></div></div>
                </div>
                <div className="cropper-footer"><button className="cropper-btn-cancel" onClick={onCancel}>Отмена</button><button className="cropper-btn-save" onClick={handleSave}>Сохранить</button></div>
            </div>
        </div>
    );
};

export default ImageCropper;
