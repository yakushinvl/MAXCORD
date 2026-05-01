import React, { useRef, useState, useEffect } from 'react';
import './CustomAudioPlayer.css';
import { PlayIcon, PauseIcon, VolumeHighIcon, VolumeLowIcon, SpeakerMutedIcon, MusicIcon } from './Icons';

interface CustomAudioPlayerProps {
    src: string;
    filename?: string;
    style?: React.CSSProperties;
    className?: string;
}

const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({ src, filename, style, className }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current && !isDragging) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            // Check for Infinity (can happen with streamed/variable bitrate audio until fully loaded)
            const d = audioRef.current.duration;
            if (isFinite(d)) {
                setDuration(d);
            }
        }
    };

    // Explicitly handle duration change to catch it if metadata wasn't enough
    const handleDurationChange = () => {
        if (audioRef.current) {
            const d = audioRef.current.duration;
            if (isFinite(d)) {
                setDuration(d);
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        setCurrentTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    const handleSeekStart = () => setIsDragging(true);
    const handleSeekEnd = () => setIsDragging(false);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const vol = Number(e.target.value);
        setVolume(vol);
        if (audioRef.current) {
            audioRef.current.volume = vol;
            setIsMuted(vol === 0);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (isMuted) {
                audioRef.current.volume = volume || 0.5;
                setIsMuted(false);
                if (volume === 0) setVolume(0.5);
            } else {
                audioRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    return (
        <div
            className={`custom-audio-player ${className || ''}`}
            style={style}
            onClick={(e) => e.stopPropagation()} // Prevent bubbling 
        >
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={handleDurationChange}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
            />

            <div className="audio-controls-main">
                <button className="control-btn play-btn" onClick={handlePlayPause}>
                    {isPlaying ? <PauseIcon size={28} color="#fff" /> : <PlayIcon size={28} color="#fff" />}
                </button>
            </div>

            <div className="audio-info">
                <div className="audio-name">{filename || 'Audio File'}</div>
                <div className="audio-controls-row">
                    <div className="time-display current">{formatTime(currentTime)}</div>

                    <div className="seek-bar-container audio-seek">
                        <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            onMouseDown={handleSeekStart}
                            onMouseUp={handleSeekEnd}
                            className="seek-bar"
                            style={{ backgroundSize: `${(duration > 0 ? (currentTime / duration) * 100 : 0)}% 100%` }}
                        />
                    </div>

                    <div className="time-display total">{formatTime(duration)}</div>
                </div>
            </div>

            <div className="audio-actions">
                <div className="volume-control audio-vol">
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
        </div>
    );
};

export default CustomAudioPlayer;
