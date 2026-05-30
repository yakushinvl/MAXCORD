import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useVoice } from '../contexts/VoiceContext';
import {
  MicIcon, MicMutedIcon, DeafenedIcon, SpeakerIcon,
  PhoneIcon, ScreenShareIcon, StopScreenShareIcon,
  VideoIcon, CameraIcon,
} from './Icons';
import ScreenSourceSelector from './ScreenSourceSelector';
import { ConnectionState } from 'livekit-client';
import { iosSpringSnappy } from '../animations/transitions';
import './VoiceControlPanel.css';

const VoiceControlPanel: React.FC = () => {
  const {
    activeChannelId,
    isMuted, toggleMute,
    isDeafened, toggleDeafen,
    leaveChannel,
    isScreenSharing, startScreenShare, stopScreenShare,
    ping, connectionQuality, roomConnectionState,
    isVideoOn, toggleVideo,
    connectedUsers,
    userStates,
    noiseSuppressionMode,
  } = useVoice();

  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Track elapsed time in the current call. Reset whenever the connection
  // re-establishes (Connected → Disconnected → Connected counts as a new call).
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (roomConnectionState === ConnectionState.Connected) {
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
    } else if (roomConnectionState === ConnectionState.Disconnected) {
      startedAtRef.current = null;
      setElapsed(0);
    }
  }, [roomConnectionState]);
  useEffect(() => {
    if (!showTooltip) return;
    const tick = () => {
      if (startedAtRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [showTooltip]);

  if (!activeChannelId) return null;

  // === Effective connection state ===
  // Combines LiveKit room state + reported quality + measured ping into one
  // "tone" we drive the whole panel/tooltip from. This is the single source of
  // truth so the panel doesn't sit at "Активное соединение" while ping is
  // tanking or the room is silently reconnecting.
  type Tone = 'excellent' | 'good' | 'poor' | 'lost' | 'connecting' | 'unknown';

  const getEffectiveState = (): { tone: Tone; label: string; line: string } => {
    if (roomConnectionState === ConnectionState.Connecting) {
      return { tone: 'connecting', label: 'Установка связи', line: 'Подключаемся к каналу…' };
    }
    if (roomConnectionState === ConnectionState.Reconnecting) {
      return { tone: 'connecting', label: 'Восстановление связи', line: 'Связь прервалась, ждём…' };
    }
    if (roomConnectionState === ConnectionState.Disconnected) {
      return { tone: 'lost', label: 'Связь потеряна', line: 'Нет соединения с сервером' };
    }
    // Connected
    if (connectionQuality === 'lost') {
      return { tone: 'lost', label: 'Связь потеряна', line: 'Сервер не отвечает' };
    }
    if (connectionQuality === 'poor' || (ping > 0 && ping >= 250)) {
      return { tone: 'poor', label: 'Слабое соединение', line: 'Возможны прерывания звука' };
    }
    if (connectionQuality === 'good' || (ping > 0 && ping >= 120)) {
      return { tone: 'good', label: 'Стабильное соединение', line: 'Звонок идёт штатно' };
    }
    if (connectionQuality === 'excellent' || (ping > 0 && ping < 120)) {
      return { tone: 'excellent', label: 'Активное соединение', line: 'Подключено' };
    }
    return { tone: 'unknown', label: 'Соединение', line: 'Подключено' };
  };

  const effective = getEffectiveState();
  const isConnecting = effective.tone === 'connecting';
  const isLost = effective.tone === 'lost';

  const statusEyebrow = isLost
    ? 'Связь потеряна'
    : isConnecting
    ? (roomConnectionState === ConnectionState.Reconnecting ? 'Восстановление' : 'Подключение')
    : 'Голосовая связь';
  const statusLine = effective.line;

  // === Ping-aware quality label ===
  // Maps ping bucket → text. More granular than the 4 livekit buckets so the
  // user sees "Превосходное" vs "Слабое" instead of a binary good/poor flip.
  const getQualityReading = (): { text: string; tone: Tone } => {
    if (isLost) return { text: 'Связь потеряна', tone: 'lost' };
    if (isConnecting) return { text: 'Установка…', tone: 'connecting' };
    if (ping <= 0) return { text: 'Измерение…', tone: 'unknown' };
    if (ping < 40)  return { text: 'Превосходное', tone: 'excellent' };
    if (ping < 80)  return { text: 'Отличное',    tone: 'excellent' };
    if (ping < 130) return { text: 'Хорошее',     tone: 'good' };
    if (ping < 200) return { text: 'Среднее',     tone: 'good' };
    if (ping < 320) return { text: 'Слабое',      tone: 'poor' };
    return { text: 'Очень слабое', tone: 'poor' };
  };
  const quality = getQualityReading();

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };
  const noiseLabel: Record<string, string> = {
    none: 'Выкл.', standard: 'Стандарт', rnnoise: 'RNNoise',
  };

  // Counts derived from voice context — surfaced in the rich tooltip.
  const memberCount = connectedUsers.length;
  let activeStreamers = isScreenSharing ? 1 : 0;
  let activeCameras = isVideoOn ? 1 : 0;
  userStates.forEach((state) => {
    if (state.isScreenSharing) activeStreamers += 1;
    if (state.isVideoOn) activeCameras += 1;
  });

  // Pretty ping bars (4 segments, filled by quality bucket) — visual ping meter
  // in tooltip header so you don't have to read the number to gauge health.
  const qBars =
    quality.tone === 'excellent' ? 4 :
    quality.tone === 'good' ? 3 :
    quality.tone === 'poor' ? 1 :
    quality.tone === 'connecting' ? 2 : 0;

  const handleShareClick = () => {
    if (isScreenSharing) stopScreenShare();
    else setShowSourceSelector(true);
  };

  const handleSourceSelect = (
    sourceId: string,
    options: { resolution: string; frameRate: string; videoCodec: 'av1' | 'vp9' | 'h264' },
  ) => {
    startScreenShare(sourceId, options);
    setShowSourceSelector(false);
  };

  type ActionVariant = 'default' | 'danger' | 'accent';
  const actionPress = {
    whileTap: { scale: 0.92 },
    whileHover: { scale: 1.06 },
    transition: iosSpringSnappy,
  };

  return (
    <div className={`vcp vcp--tone-${effective.tone}`}>
      <header className="vcp__header">
        <button
          type="button"
          className={`vcp__status tone-${effective.tone}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="Статус соединения"
        >
          <span className="vcp__status-ring" />
          <span className="vcp__status-dot" />
        </button>

        <div className="vcp__labels">
          <span className="vcp__eyebrow">{statusEyebrow}</span>
          <span className="vcp__line">{statusLine}</span>
        </div>

        <motion.button
          type="button"
          className="vcp__hangup"
          onClick={leaveChannel}
          title="Отключиться"
          {...actionPress}
          whileHover={{ scale: 1.06, rotate: -8 }}
        >
          <PhoneIcon size={18} />
        </motion.button>

        {showTooltip && (
          <div className="vcp__tooltip" role="tooltip">
            <div className={`vcp__tooltip-head tone-${effective.tone}`}>
              <span className={`vcp__tooltip-dot tone-${effective.tone}`} />
              <span>{effective.label}</span>
              <span className="vcp__tooltip-bars" aria-label="Качество сигнала">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className={`bar ${i < qBars ? 'filled' : ''} tone-${quality.tone}`} />
                ))}
              </span>
            </div>

            <div className="vcp__tooltip-section">
              <div className="vcp__tooltip-row">
                <span>Время в звонке</span>
                <span className="vcp__tooltip-value">
                  {startedAtRef.current !== null ? formatElapsed(elapsed) : '—'}
                </span>
              </div>
              <div className="vcp__tooltip-row">
                <span>Задержка</span>
                <span className={`vcp__tooltip-value tone-${quality.tone}`}>
                  {ping > 0 ? `${ping} мс` : (isLost ? '—' : 'измерение…')}
                </span>
              </div>
              <div className="vcp__tooltip-row">
                <span>Качество</span>
                <span className={`vcp__tooltip-value tone-${quality.tone}`}>
                  {quality.text}
                </span>
              </div>
            </div>

            <div className="vcp__tooltip-section vcp__tooltip-section--alt">
              <div className="vcp__tooltip-row">
                <span>В канале</span>
                <span className="vcp__tooltip-value">{memberCount}</span>
              </div>
              {activeCameras > 0 && (
                <div className="vcp__tooltip-row">
                  <span>Камер</span>
                  <span className="vcp__tooltip-value tone-good">{activeCameras}</span>
                </div>
              )}
              {activeStreamers > 0 && (
                <div className="vcp__tooltip-row">
                  <span>Трансляций</span>
                  <span className="vcp__tooltip-value tone-excellent">{activeStreamers}</span>
                </div>
              )}
            </div>

            <div className="vcp__tooltip-section vcp__tooltip-section--alt">
              <div className="vcp__tooltip-row">
                <span>Шумоподавление</span>
                <span className={`vcp__tooltip-value ${noiseSuppressionMode !== 'none' ? 'tone-excellent' : ''}`}>
                  {noiseLabel[noiseSuppressionMode] || '—'}
                </span>
              </div>
              <div className="vcp__tooltip-row">
                <span>Микрофон</span>
                <span className={`vcp__tooltip-value ${isMuted ? 'tone-poor' : 'tone-excellent'}`}>
                  {isMuted ? 'Выключен' : 'Включён'}
                </span>
              </div>
              <div className="vcp__tooltip-row">
                <span>Звук</span>
                <span className={`vcp__tooltip-value ${isDeafened ? 'tone-poor' : 'tone-excellent'}`}>
                  {isDeafened ? 'Выключен' : 'Включён'}
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="vcp__actions">
        <ActionButton
          active={isMuted}
          variant="danger"
          onClick={toggleMute}
          label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          actionPress={actionPress}
        >
          {isMuted ? <MicMutedIcon size={18} /> : <MicIcon size={18} />}
        </ActionButton>

        <ActionButton
          active={isDeafened}
          variant="danger"
          onClick={toggleDeafen}
          label={isDeafened ? 'Включить звук' : 'Выключить звук'}
          actionPress={actionPress}
        >
          {isDeafened ? <DeafenedIcon size={18} /> : <SpeakerIcon size={18} />}
        </ActionButton>

        <ActionButton
          active={isVideoOn}
          variant="accent"
          onClick={toggleVideo}
          label={isVideoOn ? 'Выключить камеру' : 'Включить камеру'}
          actionPress={actionPress}
        >
          {isVideoOn ? <VideoIcon size={18} /> : <CameraIcon size={18} />}
        </ActionButton>

        <ActionButton
          active={isScreenSharing}
          variant="accent"
          onClick={handleShareClick}
          label={isScreenSharing ? 'Остановить трансляцию' : 'Начать трансляцию'}
          actionPress={actionPress}
        >
          {isScreenSharing ? <StopScreenShareIcon size={18} /> : <ScreenShareIcon size={18} />}
        </ActionButton>
      </div>

      {showSourceSelector && createPortal(
        <ScreenSourceSelector
          onSelect={handleSourceSelect}
          onClose={() => setShowSourceSelector(false)}
        />,
        document.body,
      )}
    </div>
  );
};

// Small inner component so all action buttons share consistent motion props
// and the variant→class wiring stays out of the parent's JSX noise.
interface ActionButtonProps {
  active: boolean;
  variant: 'default' | 'danger' | 'accent';
  onClick: () => void;
  label: string;
  actionPress: any;
  children: React.ReactNode;
}
const ActionButton: React.FC<ActionButtonProps> = ({
  active, variant, onClick, label, actionPress, children,
}) => (
  <motion.button
    type="button"
    className={`vcp__btn vcp__btn--${variant} ${active ? 'is-active' : ''}`}
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-pressed={active}
    {...actionPress}
  >
    {children}
  </motion.button>
);

export default VoiceControlPanel;
