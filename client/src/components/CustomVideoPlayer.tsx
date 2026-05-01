import React, { useRef, useState, useEffect } from 'react';
import './CustomVideoPlayer.css';
import { PlayIcon, PauseIcon, VolumeHighIcon, VolumeLowIcon, SpeakerMutedIcon, FullscreenIcon, MaximizeIcon } from './Icons';

interface CustomVideoPlayerProps {
    src: string;
    // Modified: pass current time when expanding to sync playback
    onExpand?: (currentTime: number) => void;
    autoPlay?: boolean;
    style?: React.CSSProperties;
    className?: string;
    startTime?: number; // New: start playback from specific time
    isExpandedView?: boolean; // New: is this the expanded ligthbox player?
}

const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({ src, onExpand, autoPlay, style, className, startTime = 0, isExpandedView }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (videoRef.current) {
            // Set initial time if provided
            if (startTime > 0) {
                videoRef.current.currentTime = startTime;
                setCurrentTime(startTime);
            }

            if (autoPlay) {
                videoRef.current.play().catch(() => { });
                setIsPlaying(true);
            }
        }
    }, [autoPlay, startTime]);

    const handlePlayPause = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                videoRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current && !isDragging) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        setCurrentTime(time);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    };

    const handleSeekStart = () => setIsDragging(true);
    const handleSeekEnd = () => setIsDragging(false);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = Number(e.target.value);
        setVolume(vol);
        if (videoRef.current) {
            videoRef.current.volume = vol;
            setIsMuted(vol === 0);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (isMuted) {
                videoRef.current.volume = volume || 0.5;
                setIsMuted(false);
                if (volume === 0) setVolume(0.5);
            } else {
                videoRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    const toggleFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            playerRef.current?.requestFullscreen();
        }
    };

    return (
        <div
            className={`custom-video-player ${className || ''}`}
            ref={playerRef}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            style={style}
            onClick={handlePlayPause}
        >
            <video
                ref={videoRef}
                src={src}
                className="video-element"
                onClick={(e) => {
                    // Prevent propagation if needed, but we want click on video to play/pause
                    // e.stopPropagation();
                }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
            />

            {/* Play/Pause Center Overlay */}
            {!isPlaying && (
                <div className="play-overlay">
                    <PlayIcon size={48} color="white" />
                </div>
            )}

            {/* Controls Bar */}
            <div className={`video-controls ${isHovering || !isPlaying ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="seek-bar-container">
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        onMouseDown={handleSeekStart}
                        onMouseUp={handleSeekEnd}
                        className="seek-bar"
                        style={{ backgroundSize: `${(currentTime / duration) * 100}% 100%` }}
                    />
                </div>

                <div className="controls-bottom">
                    <div className="controls-left">
                        <button className="control-btn" onClick={handlePlayPause}>
                            {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
                        </button>

                        <div className="time-display">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </div>

                        <div className="volume-control">
                            <button className="control-btn" onClick={toggleMute}>
                                {isMuted ? <SpeakerMutedIcon size={20} /> : (volume > 0.5 ? <VolumeHighIcon size={20} /> : <VolumeLowIcon size={20} />)}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="volume-slider"
                                style={{ backgroundSize: `${(isMuted ? 0 : volume) * 100}% 100%` }}
                            />
                        </div>
                    </div>

                    <div className="controls-right">
                        {onExpand && !isExpandedView && (
                            <button className="control-btn" onClick={(e) => {
                                e.stopPropagation();
                                // Pause local playback
                                if (videoRef.current) {
                                    videoRef.current.pause();
                                    setIsPlaying(false);
                                }
                                // Pass current time to expand handler
                                onExpand(videoRef.current?.currentTime || 0);
                            }} title="Развернуть">
                                <MaximizeIcon size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomVideoPlayer;
