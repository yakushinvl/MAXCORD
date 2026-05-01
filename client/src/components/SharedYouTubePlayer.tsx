import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { VolumeHighIcon, VolumeLowIcon, FullscreenIcon, PlayIcon, PauseIcon, MinimizeIcon } from './Icons';
import './SharedYouTubePlayer.css';

interface SharedYouTubePlayerProps {
  channelId: string;
  youtubeId: string;
  isHost: boolean;
  onStop: () => void;
  initialTime?: number;
  initialPlaying?: boolean;
  isFocused?: boolean;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  placeholderRect?: DOMRect | null;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const SharedYouTubePlayer: React.FC<SharedYouTubePlayerProps> = ({ 
  channelId, youtubeId, isHost, onStop, initialTime, initialPlaying, 
  isFocused, onToggleExpand, isExpanded, placeholderRect 
}) => {
  const { socket } = useSocket();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoTitle, setVideoTitle] = useState('Синхронизация с YouTube...');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const syncInterval = useRef<any>(null);
  const isInternalChange = useRef(false);
  const controlsTimeout = useRef<any>(null);

  useEffect(() => {
    // Load YouTube API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (playerRef.current) return; // Already initialized

      playerRef.current = new window.YT.Player(`yt-player-${channelId}`, {
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: (e: any) => console.error('YouTube Player Error:', e.data)
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    const handleStateSync = (state: any) => {
      if (!state) return;
      if (!isHost && playerRef.current && playerRef.current.seekTo) {
        const localTime = playerRef.current.getCurrentTime();
        const remoteTime = state.currentTime;
        
        if (Math.abs(localTime - remoteTime) > 2) {
          isInternalChange.current = true;
          playerRef.current.seekTo(remoteTime, true);
        }

        if (state.playing) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      }
    };

    // Socket listeners for sync
    if (socket) {
      socket.on('yt-watch-state', handleStateSync);
    }

    return () => {
      if (syncInterval.current) clearInterval(syncInterval.current);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try { playerRef.current.destroy(); } catch (e) {}
      }
      if (socket) socket.off('yt-watch-state', handleStateSync);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, [youtubeId, channelId, isHost, socket]);

  const onPlayerReady = (event: any) => {
    setDuration(event.target.getDuration());
    event.target.setVolume(volume);
    
    try {
      const data = event.target.getVideoData();
      if (data && data.title) setVideoTitle(data.title);
      
      const qualities = event.target.getAvailableQualityLevels();
      setAvailableQualities(qualities);
      const q = event.target.getPlaybackQuality();
      setCurrentQuality(q && q !== 'unknown' ? q : 'auto');
    } catch (e) {}

    // Handle initial sync
    if (!isHost) {
      if (initialTime !== undefined) {
        event.target.seekTo(initialTime, true);
      }
      if (initialPlaying === false) {
        event.target.pauseVideo();
      } else {
        event.target.playVideo();
      }
    }
    
    if (isHost) {
      syncInterval.current = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const time = playerRef.current.getCurrentTime();
          const pState = playerRef.current.getPlayerState();
          const playing = pState === 1 || pState === 3; // 1: playing, 3: buffering
          setCurrentTime(time);
          setIsPlaying(pState === 1);
          
          socket?.emit('yt-watch-sync', {
            channelId,
            state: { currentTime: time, playing: pState === 1 }
          });
        }
      }, 2000);
    }
  };

  const onPlayerStateChange = (event: any) => {
    const state = event.data;
    setIsPlaying(state === 1);
    
    // Refresh available qualities as they might populate after buffering starts
    if (state === 1 || state === 3) {
      try {
        const qualities = playerRef.current.getAvailableQualityLevels();
        if (qualities.length > 0) setAvailableQualities(qualities);
        setCurrentQuality(playerRef.current.getPlaybackQuality());
      } catch (e) {}
    }
    
    if (isHost && !isInternalChange.current) {
      socket?.emit('yt-watch-sync', {
        channelId,
        state: { 
          currentTime: playerRef.current.getCurrentTime(), 
          playing: state === 1 
        }
      });
    }
    isInternalChange.current = false;
  };

  const togglePlay = () => {
    if (!isHost || !playerRef.current || !playerRef.current.pauseVideo) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || !playerRef.current || !playerRef.current.seekTo) return;
    const time = parseFloat(e.target.value);
    playerRef.current.seekTo(time, true);
    setCurrentTime(time);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(val);
    }
    if (val > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (!playerRef.current || !playerRef.current.mute) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleQualityChange = (q: string) => {
    if (playerRef.current && playerRef.current.setPlaybackQuality) {
      playerRef.current.setPlaybackQuality(q);
      // Small trick: seek to current time can force re-buffer with new quality
      const currentTime = playerRef.current.getCurrentTime();
      playerRef.current.seekTo(currentTime, true);
      setCurrentQuality(q);
      setShowQualityMenu(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).filter((v, i) => v !== '00' || i > 0).join(':');
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const VOICE_CONTROLS_HEIGHT = 80; // voice-ctrls-anchor height (70px) + gap
  const portalStyles: React.CSSProperties = isExpanded ? {} : {
    top: placeholderRect?.top ?? 0,
    left: placeholderRect?.left ?? 0,
    width: placeholderRect?.width ?? 400,
    height: Math.max(120, (placeholderRect?.height ?? 225) - VOICE_CONTROLS_HEIGHT),
    opacity: (placeholderRect || isExpanded) ? 1 : 0,
    pointerEvents: (placeholderRect || isExpanded) ? 'auto' : 'none',
  };

  return (
    <div 
      className={`yt-shared-container ${!showControls ? 'hide-controls' : ''} ${isFocused ? 'is-focused' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      style={portalStyles}
    >
      <iframe 
        id={`yt-player-${channelId}`}
        className="yt-player-iframe"
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&autoplay=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&showinfo=0&playsinline=1&origin=*&widget_referrer=https://www.youtube-nocookie.com`}
        frameBorder="0"
        allow="autoplay; encrypted-media; gyroscope; accelerometer; picture-in-picture; clipboard-write; display-capture"
      />
      
      <div className="yt-controls-overlay">
        <div className="yt-top-bar" onClick={e => e.stopPropagation()}>
          <div className="yt-video-title">{videoTitle}</div>
          <div className="yt-status-tag">{isHost ? 'Вы управляете' : 'Синхронизация'}</div>
        </div>

        <div className="yt-bottom-bar" onClick={e => e.stopPropagation()}>
          <div className="yt-progress-container">
            <input 
              type="range" 
              className="yt-progress-bar"
              min="0" 
              max={duration || 100} 
              value={currentTime} 
              onChange={handleSeek}
              disabled={!isHost}
            />
          </div>
          
          <div className="yt-controls-row">
            <div className="yt-controls-left">
              <button className="yt-btn" onClick={togglePlay} disabled={!isHost}>
                {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
              </button>
              <div className="yt-time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              <div className="yt-volume-control">
                <button className="yt-btn" onClick={toggleMute} style={{ width: 24, height: 24, background: 'none', border: 'none' }}>
                  {isMuted || volume === 0 ? <VolumeLowIcon size={18} /> : <VolumeHighIcon size={18} />}
                </button>
                <input 
                  type="range" 
                  className="yt-volume-slider"
                  min="0" 
                  max="100" 
                  value={isMuted ? 0 : volume} 
                  onChange={handleVolume}
                />
              </div>
            </div>
            
            <div className="yt-controls-right">
              <div className="yt-quality-wrap">
                <button className="yt-btn" onClick={() => {
                  if (playerRef.current && playerRef.current.getAvailableQualityLevels) {
                    const qualities = playerRef.current.getAvailableQualityLevels();
                    if (qualities.length > 0) setAvailableQualities(qualities);
                  }
                  setShowQualityMenu(!showQualityMenu);
                }} title="Качество">
                  <span style={{ fontSize: '10px', fontWeight: 800 }}>{currentQuality.toUpperCase()}</span>
                </button>
                {showQualityMenu && (
                  <div className="yt-quality-menu" onMouseLeave={() => setShowQualityMenu(false)}>
                    {availableQualities.map(q => (
                      <div 
                        key={q} 
                        className={`yt-quality-item ${currentQuality === q ? 'active' : ''}`}
                        onClick={() => handleQualityChange(q)}
                      >
                        {q.toUpperCase()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {isHost && (
                <button className="yt-btn stop-btn" onClick={onStop} title="Остановить просмотр">
                  &times;
                </button>
              )}
              <button className="yt-btn" onClick={onToggleExpand} title={isExpanded ? "Свернуть" : "Полный экран"}>
                {isExpanded ? <MinimizeIcon size={20} /> : <FullscreenIcon size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default SharedYouTubePlayer;
