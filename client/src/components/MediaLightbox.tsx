import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import CustomVideoPlayer from './CustomVideoPlayer';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, DownloadIcon } from './Icons';
import { getFullUrl } from '../utils/avatar';
import './MediaLightbox.css';

interface MediaItem {
    url: string;
    type: string; // 'image/*' or 'video/*'
    filename?: string;
    startTime?: number; // Optional start time for video
}

interface MediaLightboxProps {
    isOpen: boolean;
    onClose: () => void;
    media: MediaItem[]; // All media in the current context (message or channel)
    initialIndex: number;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({ isOpen, onClose, media, initialIndex }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen, initialIndex]);

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % media.length);
    }, [media.length]);

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
    }, [media.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, handleNext, handlePrev]);

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const item = media[currentIndex];
        const url = getFullUrl(item.url)!;
        const filename = item.filename || (item.type.startsWith('video/') ? 'video.mp4' : 'image.jpg');

        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.target = "_blank";
            link.click();
        }
    };

    if (!isOpen) return null;

    const currentItem = media[currentIndex];
    const isVideo = currentItem.type.startsWith('video/');

    return createPortal(
        <div className="media-lightbox-overlay" onClick={onClose}>
            <div className="media-lightbox-content" onClick={(e) => e.stopPropagation()}>
                {/* Image or Video */}
                <div className="media-display-area">
                    {isVideo ? (
                        <CustomVideoPlayer
                            src={getFullUrl(currentItem.url)!}
                            autoPlay
                            className="lightbox-video"
                            style={{ maxWidth: '90vw', maxHeight: '80vh', aspectRatio: 'auto' }}
                            startTime={currentItem.startTime || 0}
                            isExpandedView={true}
                        />
                    ) : (
                        <img
                            src={getFullUrl(currentItem.url)!}
                            alt={currentItem.filename}
                            className="lightbox-image"
                        />
                    )}
                </div>

                {/* Footer Info */}
                <div className="media-lightbox-footer">
                    <div className="media-info-left">
                        {currentItem.filename && <div className="media-filename">{currentItem.filename}</div>}
                        <div className="media-counter">
                            {currentIndex + 1} из {media.length}
                        </div>
                    </div>
                    <button className="lightbox-download-btn" onClick={handleDownload} title="Скачать">
                        <DownloadIcon size={20} />
                        <span>Скачать</span>
                    </button>
                </div>
            </div>

            {/* Controls */}
            <button className="lightbox-close-btn" onClick={onClose}>
                <CloseIcon size={24} />
            </button>

            {media.length > 1 && (
                <>
                    <button className="lightbox-nav-btn prev" onClick={handlePrev}>
                        <ChevronLeftIcon size={32} />
                    </button>
                    <button className="lightbox-nav-btn next" onClick={handleNext}>
                        <ChevronRightIcon size={32} />
                    </button>
                </>
            )}
        </div>,
        document.body
    );
};

export default MediaLightbox;
