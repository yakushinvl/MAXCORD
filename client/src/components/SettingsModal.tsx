import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { getAvatarUrl, getFullUrl } from '../utils/avatar';
import { useVoice, useVoiceLevels } from '../contexts/VoiceContext';
import { useAppearance, ThemeType } from '../contexts/AppearanceContext';
import { useChatSettings } from '../contexts/ChatSettingsContext';
import { useWindowSettings } from '../contexts/WindowSettingsContext';
import { useDialog } from '../contexts/DialogContext';
import {
  CloseIcon,
  UsersIcon,
  ShieldIcon,
  MonitorIcon,
  PaletteIcon,
  SpeakerIcon,
  ChatIcon,
  KeyboardIcon,
  VideoIcon,
  SettingsIcon,
  LogOutIcon,
  SmartphoneIcon,
  EllipsisIcon,
  CameraIcon,
  BotIcon
} from './Icons';
import ImageCropper from './ImageCropper';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab =
  | 'account'
  | 'privacy'
  | 'devices'
  | 'appearance'
  | 'voice'
  | 'chat'
  | 'keybinds'
  | 'windows'
  | 'streamer'
  | 'advanced'
  | 'activity'
  | 'bots';

const CameraPreview: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startPreview = async () => {
      try {
        setError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId === 'default' ? true : { deviceId: { exact: deviceId } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Camera preview error:", err);
        setError("Не удалось получить доступ к камере или устройство занято");
      }
    };

    startPreview();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [deviceId]);

  return (
    <div className="camera-preview-container">
      {error ? (
        <div className="camera-preview-error">
          <CameraIcon size={48} />
          <span>{error}</span>
        </div>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="camera-preview-video" />
      )}
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const { confirm, prompt, alert } = useDialog();
  const {
    isNoiseSuppressionEnabled, toggleNoiseSuppression,
    inputDevices, outputDevices, videoDevices,
    selectedInputDeviceId, setSelectedInputDeviceId,
    selectedOutputDeviceId, setSelectedOutputDeviceId,
    selectedVideoDeviceId, setSelectedVideoDeviceId,
    inputVolume, setInputVolume,
    outputVolume, setOutputVolume,
    refreshDevices,
    inputSensitivity, setInputSensitivity,
    isAutomaticSensitivity, setIsAutomaticSensitivity,
    startTestStream, stopTestStream
  } = useVoice();
  const { currentInputLevel = -100 } = useVoiceLevels() || {};
  const {
    theme, setTheme,
    density, setDensity,
    messageSpacing, setMessageSpacing,
    groupSpacing, setGroupSpacing,
    fontScale, setFontScale,
    appIcon, setAppIcon,
    performanceMode, setPerformanceMode
  } = useAppearance();

  const {
    displayEmbeds, setDisplayEmbeds,
    previewLinks, setPreviewLinks,
    autoPlayGifs, setAutoPlayGifs,
    showStickers, setShowStickers,
    enableTTS, setEnableTTS,
    mentionHighlight, setMentionHighlight,
    autocompleteEmoji, setAutocompleteEmoji,
    showHoverActions, setShowHoverActions
  } = useChatSettings();

  const {
    autoStart, setAutoStart,
    minimizeToTray, setMinimizeToTray,
    closeToTray, setCloseToTray,
    startMinimized, setStartMinimized,
    hardwareAcceleration, setHardwareAcceleration,
    appVersion
  } = useWindowSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  // Account Form State
  const [username, setUsername] = useState(user?.username || '');
  const [status, setStatus] = useState(user?.status || 'offline');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(getAvatarUrl(user?.avatar) || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(getAvatarUrl(user?.banner) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cropper State
  const [cropModal, setCropModal] = useState<{
    isOpen: boolean;
    image: string;
    type: 'avatar' | 'banner';
  }>({
    isOpen: false,
    image: '',
    type: 'avatar'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setStatus(user.status);
      setBio(user.bio || '');
      setAvatarPreview(getAvatarUrl(user.avatar));
      setBannerPreview(getAvatarUrl(user.banner));
    }
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'image/gif') {
      const formData = new FormData();
      formData.append('avatar', file);
      try {
        setLoading(true);
        const response = await axios.post('/api/users/avatar', formData);
        await refreshUser();
        setAvatarPreview(getAvatarUrl(response.data.avatar));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Ошибка загрузки аватара');
      } finally {
        setLoading(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropModal({
        isOpen: true,
        image: reader.result as string,
        type: 'avatar'
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'image/gif') {
      const formData = new FormData();
      formData.append('banner', file);
      try {
        setLoading(true);
        const response = await axios.post('/api/users/banner', formData);
        await refreshUser();
        setBannerPreview(getFullUrl(response.data.banner));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Ошибка загрузки баннера');
      } finally {
        setLoading(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropModal({
        isOpen: true,
        image: reader.result as string,
        type: 'banner'
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const type = cropModal.type;
    setCropModal(prev => ({ ...prev, isOpen: false }));

    const formData = new FormData();
    formData.append(type, croppedBlob, `${type}.jpg`);

    try {
      setLoading(true);
      if (type === 'avatar') {
        const response = await axios.post('/api/users/avatar', formData);
        await refreshUser();
        setAvatarPreview(getAvatarUrl(response.data.avatar));
      } else {
        const response = await axios.post('/api/users/banner', formData);
        await refreshUser();
        setBannerPreview(getFullUrl(response.data.banner));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || `Ошибка загрузки ${type === 'avatar' ? 'аватара' : 'баннера'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.put('/api/users/profile', { username, bio, status });
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка сохранения профиля');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderAccountSettings = () => (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Моя учётная запись</h2>

      <div className="user-settings-account-card">
        <div
          className="account-banner"
          style={{ background: bannerPreview ? `url(${getFullUrl(user?.banner || '')}) center/cover` : '#5865f2' }}
        >
          <button className="change-banner-button" onClick={() => bannerInputRef.current?.click()}>
            Изменить баннер
          </button>
          <div className="account-avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
            <img src={avatarPreview || ''} alt="" />
          </div>
        </div>

        <div className="account-info-banner">
          <div className="account-details">
            <h3>{user?.username}</h3>
            <div className="account-status-wrapper">
              <div className={`status-dot ${status}`} />
              <p>
                {status === 'online' && 'В сети'}
                {status === 'away' && 'Отошёл'}
                {status === 'busy' && 'Занят'}
                {status === 'offline' && 'Невидимый'}
              </p>
            </div>
          </div>
          <button className="edit-profile-button" onClick={() => fileInputRef.current?.click()}>
            Изменить профиль
          </button>
        </div>
      </div>

      <div className="settings-form-group">
        <label>Имя пользователя</label>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </div>

      <div className="settings-form-group">
        <label>О себе</label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Расскажите о себе..."
          rows={3}
        />
      </div>

      <div className="settings-form-group">
        <label>Статус</label>
        <div className="status-selector-grid">
          {[
            { id: 'online', label: 'В сети', color: 'online' },
            { id: 'away', label: 'Отошёл', color: 'away' },
            { id: 'busy', label: 'Занят', color: 'busy' },
            { id: 'offline', label: 'Невидимый', color: 'offline' }
          ].map(opt => (
            <div
              key={opt.id}
              className={`status-option ${status === opt.id ? 'active' : ''}`}
              onClick={() => setStatus(opt.id as any)}
            >
              <div className={`status-dot ${opt.color}`} />
              <span className="status-text">{opt.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="save-button"
        onClick={handleSaveAccount}
        disabled={loading}
      >
        {loading ? 'Сохранение...' : 'Сохранить изменения'}
      </button>

      <input type="file" ref={fileInputRef} hidden onChange={handleAvatarChange} accept="image/*" />
      <input type="file" ref={bannerInputRef} hidden onChange={handleBannerChange} accept="image/*" />

      {cropModal.isOpen && (
        <ImageCropper
          image={cropModal.image}
          cropShape={cropModal.type === 'avatar' ? 'round' : 'rect'}
          aspect={cropModal.type === 'avatar' ? 1 : 2.5}
          title={cropModal.type === 'avatar' ? 'Обрезка аватара' : 'Обрезка баннера'}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );


  const renderAppearanceSettings = () => (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Внешний вид</h2>

      <div className="settings-section-block">
        <h3>Тема</h3>
        <div className="theme-selection-grid">
          <div
            className={`theme-card dark ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <div className="theme-preview">
              <div className="preview-sidebar" />
              <div className="preview-content">
                <div className="preview-bubble" />
                <div className="preview-bubble short" />
              </div>
            </div>
            <span>Тёмная</span>
          </div>
          <div
            className={`theme-card amoled ${theme === 'amoled' ? 'active' : ''}`}
            onClick={() => setTheme('amoled')}
          >
            <div className="theme-preview">
              <div className="preview-sidebar" />
              <div className="preview-content">
                <div className="preview-bubble" />
                <div className="preview-bubble short" />
              </div>
            </div>
            <span>AMOLED</span>
          </div>
          <div
            className={`theme-card light ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <div className="theme-preview">
              <div className="preview-sidebar" />
              <div className="preview-content">
                <div className="preview-bubble" />
                <div className="preview-bubble short" />
              </div>
            </div>
            <span>Светлая</span>
          </div>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Плотность интерфейса</h3>
        <div className="density-selection">
          <button
            className={`density-btn ${density === 'cozy' ? 'active' : ''}`}
            onClick={() => setDensity('cozy')}
          >
            Уютная
          </button>
          <button
            className={`density-btn ${density === 'compact' ? 'active' : ''}`}
            onClick={() => setDensity('compact')}
          >
            Компактная
          </button>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Размер шрифта ({Math.round(fontScale * 100)}%)</h3>
        <input
          type="range"
          min="0.8"
          max="1.5"
          step="0.05"
          value={fontScale}
          onChange={(e) => setFontScale(parseFloat(e.target.value))}
          className="settings-slider"
        />
        <div className="slider-labels">
          <span>80%</span>
          <span>100%</span>
          <span>150%</span>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Расстояние между сообщениями ({messageSpacing}px)</h3>
        <input
          type="range"
          min="0"
          max="24"
          step="1"
          value={messageSpacing}
          onChange={(e) => setMessageSpacing(parseInt(e.target.value))}
          className="settings-slider"
        />
      </div>

      <div className="settings-section-block">
        <h3>Расстояние между группами ({groupSpacing}px)</h3>
        <input
          type="range"
          min="0"
          max="48"
          step="2"
          value={groupSpacing}
          onChange={(e) => setGroupSpacing(parseInt(e.target.value))}
          className="settings-slider"
        />
      </div>

      <div className="settings-section-block">
        <h3>Производительность</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Режим производительности</span>
            <span className="checkbox-description">Отключает размытие (blur) и упрощает анимации для экономии ресурсов GPU.</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={performanceMode}
              onChange={(e) => setPerformanceMode(e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (activeTab === 'voice') {
      refreshDevices();
      startTestStream();
    } else {
      stopTestStream();
    }
    return () => stopTestStream();
  }, [activeTab, refreshDevices, startTestStream, stopTestStream]);

  const renderVoiceSettings = () => (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Голос и видео</h2>

      <div className="settings-section-block">
        <h3>Устройства ввода и вывода</h3>

        <div className="voice-settings-grid">
          <div className="settings-form-group">
            <label>Устройство ввода (Микрофон)</label>
            <select
              value={selectedInputDeviceId}
              onChange={(e) => setSelectedInputDeviceId(e.target.value)}
              className="settings-select"
            >
              {inputDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
              {inputDevices.length === 0 && <option value="default">По умолчанию</option>}
            </select>
          </div>

          <div className="settings-form-group">
            <label>Устройство вывода (Динамики)</label>
            <select
              value={selectedOutputDeviceId}
              onChange={(e) => setSelectedOutputDeviceId(e.target.value)}
              className="settings-select"
            >
              {outputDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
              {outputDevices.length === 0 && <option value="default">По умолчанию</option>}
            </select>
          </div>
        </div>

        <div className="voice-volume-controls">
          <div className="settings-form-group">
            <div className="slider-header-row">
              <label>Громкость микрофона</label>
              <span className="slider-value">{Math.round(inputVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={inputVolume}
              onChange={(e) => setInputVolume(parseFloat(e.target.value))}
              className="settings-slider"
            />
          </div>

          <div className="settings-form-group">
            <div className="slider-header-row">
              <label>Громкость звука</label>
              <span className="slider-value">{Math.round(outputVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={outputVolume}
              onChange={(e) => setOutputVolume(parseFloat(e.target.value))}
              className="settings-slider"
            />
          </div>
        </div>

        <div className="voice-sensitivity-controls">
          <h3>Чувствительность микрофона</h3>

          <div className="settings-form-group-checkbox">
            <div className="checkbox-label">
              <span className="checkbox-title">Автоматически определять чувствительность</span>
              <span className="checkbox-description">Позволить maxcord автоматически настраивать чувствительность нажатия.</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={isAutomaticSensitivity}
                onChange={(e) => setIsAutomaticSensitivity(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className={`sensitivity-slider-container ${isAutomaticSensitivity ? 'disabled' : ''}`}>
            <div className="slider-header-row" style={{ marginBottom: '40px' }}>
              <label>Порог срабатывания</label>
              <span className="slider-value" style={{ color: 'var(--primary-neon)', fontWeight: 900 }}>{Math.round(inputSensitivity)} dB</span>
            </div>

            <div className="sensitivity-visualizer-wrapper">
              {/* Threshold Marker */}
              {!isAutomaticSensitivity && (
                <div
                  className="sensitivity-threshold-marker"
                  style={{
                    left: `${Math.max(0, Math.min(100, inputSensitivity + 100))}%`
                  }}
                />
              )}

              {/* Current Level Bar */}
              <div
                className="sensitivity-bar-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, currentInputLevel + 100))}%`,
                  color: (currentInputLevel > (isAutomaticSensitivity ? -60 : inputSensitivity)) ? '#00ffa3' : '#ff3b30',
                  backgroundColor: 'currentColor'
                }}
              />
            </div>

            <input
              type="range"
              min="-100"
              max="0"
              step="1"
              value={inputSensitivity}
              onChange={(e) => setInputSensitivity(parseFloat(e.target.value))}
              disabled={isAutomaticSensitivity}
              className="settings-slider sensitivity-slider"
            />
            <div className="sensitivity-labels">
              <span>-100dB</span>
              <span>-50dB</span>
              <span>0dB</span>
            </div>
          </div>
          <p className="sensitivity-help-text">
            Если ваш микрофон слишком чувствителен и улавливает фоновые шумы, отключите автоматическое определение и сдвиньте ползунок вправо (к 0dB).
          </p>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Настройки видео</h3>
        <div className="settings-form-group">
          <label>Камера</label>
          <select
            value={selectedVideoDeviceId}
            onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
            className="settings-select"
          >
            {videoDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
              </option>
            ))}
            {videoDevices.length === 0 && <option value="default">Не найдено</option>}
          </select>
        </div>
        {videoDevices.length > 0 && (
          <CameraPreview deviceId={selectedVideoDeviceId} />
        )}
      </div>


      <div className="settings-section-block">
        <h3>Расширенные настройки</h3>

        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Шумоподавление (RNNoise)</span>
            <span className="checkbox-description">Убирает фоновый шум из вашего микрофона с помощью нейросети.</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={isNoiseSuppressionEnabled}
              onChange={toggleNoiseSuppression}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="settings-form-group-checkbox disabled">
          <div className="checkbox-label">
            <span className="checkbox-title">Эхоподавление</span>
            <span className="checkbox-description">Предотвращает попадание звука из динамиков обратно в микрофон. (Всегда включено)</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={true}
              disabled
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="settings-form-group-checkbox disabled">
          <div className="checkbox-label">
            <span className="checkbox-title">Автоматическая регулировка усиления</span>
            <span className="checkbox-description">Автоматически выравнивает громкость вашего голоса. (Всегда включено)</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={true}
              disabled
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderChatSettings = () => (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Настройки чата</h2>

      <div className="settings-section-block">
        <h3>Отображение контента</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Отображать предпросмотр контента</span>
            <span className="checkbox-description">Отображать изображения и видео, прикрепленные к сообщениям.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={displayEmbeds} onChange={(e) => setDisplayEmbeds(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Предпросмотр ссылок</span>
            <span className="checkbox-description">Показывать информацию о ссылках в сообщениях.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={previewLinks} onChange={(e) => setPreviewLinks(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Автоматическое воспроизведение GIF</span>
            <span className="checkbox-description">Автоматически проигрывать GIF-анимации при появлении в чате.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={autoPlayGifs} onChange={(e) => setAutoPlayGifs(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Сообщения</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Подсветка упоминаний</span>
            <span className="checkbox-description">Выделять сообщения, в которых вас упомянули.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={mentionHighlight} onChange={(e) => setMentionHighlight(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Автозаполнение эмодзи</span>
            <span className="checkbox-description">Показывать подсказки при вводе : или @.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={autocompleteEmoji} onChange={(e) => setAutocompleteEmoji(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Панель действий при наведении</span>
            <span className="checkbox-description">Показывать кнопки удаления, изменения и ответа при наведении на сообщение.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={showHoverActions} onChange={(e) => setShowHoverActions(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Дополнительно</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Преобразование текста в речь (TTS)</span>
            <span className="checkbox-description">Позволяет прослушивать входящие сообщения (требуется поддержка системы).</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={enableTTS} onChange={(e) => setEnableTTS(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderWindowsSettings = () => (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Настройки Windows</h2>

      <div className="settings-section-block">
        <h3>Запуск приложения</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Запускать maxcord при старте системы</span>
            <span className="checkbox-description">Автоматически открывать приложение при входе в Windows.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Запускать свернутым</span>
            <span className="checkbox-description">Приложение будет открываться сразу в системном трее.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={startMinimized} onChange={(e) => setStartMinimized(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Поведение окна</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Сворачивать в трей при нажатии «Закрыть»</span>
            <span className="checkbox-description">Приложение продолжит работать в фоновом режиме в системном трее.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={closeToTray} onChange={(e) => setCloseToTray(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Сворачивать в системный трей</span>
            <span className="checkbox-description">При минимизации окна оно будет скрываться с панели задач.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={minimizeToTray} onChange={(e) => setMinimizeToTray(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Расширенные системные настройки</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Аппаратное ускорение</span>
            <span className="checkbox-description">Использует GPU для плавности интерфейса (требуется перезапуск).</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={hardwareAcceleration} onChange={(e) => setHardwareAcceleration(e.target.checked)} />
            <span className="slider round"></span>
          </label>
        </div>
        {hardwareAcceleration !== JSON.parse(localStorage.getItem('window-settings') || '{}').hardwareAcceleration && (
          <div className="restart-notice" style={{ marginTop: '10px', color: 'var(--primary-neon)', fontSize: '13px' }}>
            Требуется перезапуск приложения для применения этой настройки.
            <button
              className="save-button"
              style={{ marginLeft: '10px', padding: '4px 12px', fontSize: '12px' }}
              onClick={() => (window as any).electron?.ipc?.send('restart-app')}
            >
              Перезапустить
            </button>
          </div>
        )}
      </div>

      <div className="settings-section-block">
        <h3>Информация о приложении</h3>
        <div className="app-info-row" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '14px' }}>
          <span>Версия:</span>
          <span>{appVersion} Stable</span>
        </div>
        <div className="app-info-row" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '14px', marginTop: '8px' }}>
          <span>Среда выполнения:</span>
          <span>Electron {window.navigator.userAgent.includes('Electron') ? 'Stable' : 'Web Fallback'}</span>
        </div>
      </div>
    </div>
  );

  const renderPlaceholder = (title: string, icon: React.ReactNode) => (
    <div className="settings-section-content">
      <h2 className="settings-section-title">{title}</h2>
      <div className="placeholder-settings">
        {icon}
        <p>Этот раздел настроек находится в разработке и будет доступен в ближайшем обновлении.</p>
      </div>
    </div>
  );


  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-container" onClick={e => e.stopPropagation()}>

        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-content">

            <div className="sidebar-header">Настройки пользователя</div>
            <div
              className={`sidebar-item ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <UsersIcon size={18} /> Моя учётная запись
            </div>
            <div
              className={`sidebar-item ${activeTab === 'privacy' ? 'active' : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              <ShieldIcon size={18} /> Данные и конфиденциальность
            </div>
            <div
              className={`sidebar-item ${activeTab === 'devices' ? 'active' : ''}`}
              onClick={() => setActiveTab('devices')}
            >
              <SmartphoneIcon size={18} /> Устройства
            </div>
            <div
              className={`sidebar-item ${activeTab === 'bots' ? 'active' : ''}`}
              onClick={() => setActiveTab('bots')}
            >
              <BotIcon size={18} /> Мои боты
            </div>

            <div className="sidebar-separator" />

            <div className="sidebar-header">Настройки приложения</div>
            <div
              className={`sidebar-item ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              <PaletteIcon size={18} /> Внешний вид
            </div>
            <div
              className={`sidebar-item ${activeTab === 'voice' ? 'active' : ''}`}
              onClick={() => setActiveTab('voice')}
            >
              <SpeakerIcon size={18} /> Голос и видео
            </div>
            <div
              className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <ChatIcon size={18} /> Чат
            </div>
            <div
              className={`sidebar-item ${activeTab === 'keybinds' ? 'active' : ''}`}
              onClick={() => setActiveTab('keybinds')}
            >
              <KeyboardIcon size={18} /> Горячие клавиши
            </div>
            <div
              className={`sidebar-item ${activeTab === 'windows' ? 'active' : ''}`}
              onClick={() => setActiveTab('windows')}
            >
              <MonitorIcon size={18} /> Настройки Windows
            </div>
            <div
              className={`sidebar-item ${activeTab === 'streamer' ? 'active' : ''}`}
              onClick={() => setActiveTab('streamer')}
            >
              <CameraIcon size={18} /> Режим стримера
            </div>
            <div
              className={`sidebar-item ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              <EllipsisIcon size={18} /> Расширенные
            </div>

            <div className="sidebar-separator" />

            <div className="sidebar-header">Настройки активности</div>
            <div
              className={`sidebar-item ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              <ShieldIcon size={18} /> Конфиденциальность активности
            </div>


            <div className="sidebar-separator" style={{ marginTop: 'auto' }} />

            <div className="sidebar-item logout" onClick={() => { logout(); onClose(); navigate('/login'); }}>
              <LogOutIcon size={18} /> Выйти из аккаунта
            </div>

            <div className="settings-sidebar-footer" style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
              <a
                href="https://t.me/vless_outline_channel"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary-neon)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
              >
              </a>
            </div>

          </div>
        </div>

        {/* Main Content */}
        <div className="settings-main">
          <div className="settings-content-wrapper">
            <div className="settings-content-inner">
              {activeTab === 'account' && renderAccountSettings()}
              {activeTab === 'privacy' && renderPlaceholder('Данные и конфиденциальность', <ShieldIcon size={80} />)}
              {activeTab === 'devices' && renderPlaceholder('Устройства', <SmartphoneIcon size={80} />)}
              {activeTab === 'appearance' && renderAppearanceSettings()}
              {activeTab === 'voice' && renderVoiceSettings()}
              {activeTab === 'chat' && renderChatSettings()}
              {activeTab === 'bots' && <BotsSettings />}

              {activeTab === 'keybinds' && renderPlaceholder('Горячие клавиши', <KeyboardIcon size={80} />)}
              {activeTab === 'windows' && renderWindowsSettings()}
              {activeTab === 'streamer' && renderPlaceholder('Режим стримера', <CameraIcon size={80} />)}
              {activeTab === 'advanced' && renderPlaceholder('Расширенные', <EllipsisIcon size={80} />)}
              {activeTab === 'activity' && renderPlaceholder('Конфиденциальность активности', <ShieldIcon size={80} />)}
            </div>
          </div>

          <div className="close-settings-button" onClick={onClose}>
            <div className="close-circle"><CloseIcon size={20} /></div>
            <div className="close-text">Esc</div>
          </div>
        </div>

      </div>
    </div>
  );
};

const BotsSettings = () => {
  const [bots, setBots] = useState<any[]>([]);
  const [userServers, setUserServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [botName, setBotName] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showServerSelect, setShowServerSelect] = useState<string | null>(null);
  const [revealedTokenId, setRevealedTokenId] = useState<string | null>(null);
  const [editingBot, setEditingBot] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  const [editBanner, setEditBanner] = useState<File | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [previewBanner, setPreviewBanner] = useState<string | null>(null);

  const startEdit = (bot: any) => {
    setEditingBot(bot);
    setEditName(bot.username);
    setEditBio(bot.bio || '');
    setEditAvatar(null);
    setEditBanner(null);
    setPreviewAvatar(bot.avatar ? getFullUrl(bot.avatar) : null);
    setPreviewBanner(bot.banner ? getFullUrl(bot.banner) : null);
  };

  const saveEdit = async () => {
    if (!editingBot) return;
    setLoading(true);
    try {
      await axios.patch(`/api/bots/${editingBot._id}`, { username: editName, bio: editBio });
      if (editAvatar) {
        const fd = new FormData();
        fd.append('avatar', editAvatar);
        await axios.post(`/api/bots/${editingBot._id}/avatar`, fd);
      }
      if (editBanner) {
        const fd = new FormData();
        fd.append('banner', editBanner);
        await axios.post(`/api/bots/${editingBot._id}/banner`, fd);
      }
      setEditingBot(null);
      fetchBots();
    } catch (e) {
      await alert('Ошибка при сохранении профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditAvatar(file);
      setPreviewAvatar(URL.createObjectURL(file));
    }
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditBanner(file);
      setPreviewBanner(URL.createObjectURL(file));
    }
  };

  const fetchBots = async () => {
    try {
      const response = await axios.get('/api/bots/my');
      setBots(response.data);
    } catch (e) { }
  };

  const fetchUserServers = async () => {
    try {
      const response = await axios.get('/api/servers/me');
      setUserServers(response.data);
    } catch (e) { }
  };

  useEffect(() => {
    fetchBots();
    fetchUserServers();
  }, []);

  const createBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botName.trim()) return;
    setLoading(true);
    try {
      await axios.post('/api/bots/create', { name: botName });
      setBotName('');
      fetchBots();
    } catch (e) {
      await alert('Ошибка создания бота');
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (id: string) => {
    if (!(await confirm('Вы уверены, что хотите удалить этого бота?'))) return;
    try {
      await axios.delete(`/api/bots/${id}`);
      fetchBots();
    } catch (e) { }
  };

  const copyToken = async (token: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(token)
        .then(() => {
          setCopiedToken(token);
          setTimeout(() => setCopiedToken(null), 2000);
        })
        .catch(async err => {
          console.error('Clipboard error:', err);
          // Fallback if Write permission denied or other error
          await prompt("Копирование не удалось автоматически. Скопируйте токен вручную:", token);
        });
    } else {
      // Very old browsers or insecure contexts
      await prompt("Скопируйте токен вручную:", token);
    }
  };

  const regenerateToken = async (id: string) => {
    if (!(await confirm('Вы уверены? Старый токен перестанет работать.'))) return;
    try {
      await axios.post(`/api/bots/${id}/regenerate-token`);
      fetchBots();
    } catch (e) { }
  };

  const addBotToServer = async (botId: string, serverId: string) => {
    try {
      await axios.post(`/api/bots/${botId}/add-to-server`, { serverId });
      await alert('Бот успешно добавлен на сервер!');
      setShowServerSelect(null);
    } catch (e: any) {
      await alert(e.response?.data?.message || 'Ошибка при добавлении бота');
    }
  };

  return (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Мои боты</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '20px' }}>
        Создавайте ботов для автоматизации или интеграций. Боты работают через WebSocket.
      </p>

      <form onSubmit={createBot} className="bot-create-form" style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="Имя бота"
          value={botName}
          onChange={e => setBotName(e.target.value)}
          className="settings-input"
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px', color: 'white' }}
        />
        <button type="submit" className="save-button" style={{ margin: 0, padding: '10px 20px' }} disabled={loading}>
          Создать
        </button>
      </form>

      <div className="bots-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {bots.length === 0 && <div className="placeholder-settings" style={{ padding: '40px' }}>У вас пока нет ботов.</div>}
        {bots.map(bot => (
          <div key={bot._id} className="bot-item glass-panel-base" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--primary-neon)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black', fontWeight: 800, overflow: 'hidden' }}>
                  {bot.avatar ? <img src={getFullUrl(bot.avatar) || undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BotIcon size={24} color="black" />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{bot.username}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>ID: {bot._id}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="msg-action-btn"
                  onClick={() => startEdit(bot)}
                >
                  Настроить
                </button>
                <button
                  className="save-button"
                  style={{ margin: 0, padding: '5px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}
                  onClick={() => setShowServerSelect(showServerSelect === bot._id ? null : bot._id)}
                >
                  Добавить на сервер
                </button>
                <button className="msg-action-btn danger" onClick={() => deleteBot(bot._id)}>Удалить</button>
              </div>
            </div>

            {showServerSelect === bot._id && (
              <div className="server-selector" style={{ marginBottom: '15px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--primary-neon)' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Выберите сервер:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {userServers.map(server => (
                    <div
                      key={server._id}
                      onClick={() => addBotToServer(bot._id, server._id)}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                      <span>{server.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Нажмите, чтобы добавить</span>
                    </div>
                  ))}
                  {userServers.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>У вас нет доступных серверов.</p>}
                </div>
              </div>
            )}

            <div className="bot-token-area" style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <code style={{ flex: 1, fontSize: '13px', color: 'var(--primary-neon)', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: revealedTokenId === bot._id ? 'all' : 'none' }}>
                {revealedTokenId === bot._id ? bot.botToken : '••••••••••••••••••••••••••••••••'}
              </code>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  className="msg-action-btn"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  onClick={() => setRevealedTokenId(revealedTokenId === bot._id ? null : bot._id)}
                >
                  {revealedTokenId === bot._id ? 'Скрыть' : 'Показать'}
                </button>
                <button
                  className="msg-action-btn"
                  style={{ padding: '4px 8px', fontSize: '11px', background: copiedToken === bot.botToken ? 'var(--success-color)' : '' }}
                  onClick={() => copyToken(bot.botToken)}
                >
                  {copiedToken === bot.botToken ? 'Готово!' : 'Копировать'}
                </button>
                <button
                  className="msg-action-btn"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                  onClick={() => regenerateToken(bot._id)}
                >
                  Обновить
                </button>
              </div>
            </div>

            {editingBot?._id === bot._id && (
              <div className="bot-edit-area" style={{ marginTop: '25px', padding: '25px', background: 'rgba(0,0,0,0.15)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: 'white' }}>Редактирование бота</h3>

                <div className="user-settings-account-card" style={{ marginBottom: '25px' }}>
                  <div
                    className="account-banner"
                    style={{ background: previewBanner ? `url(${previewBanner}) center/cover` : 'var(--primary-neon)' }}
                  >
                    <label className="change-banner-button" style={{ cursor: 'pointer', display: 'inline-block' }}>
                      Изменить баннер
                      <input type="file" accept="image/*" onChange={handleBannerSelect} hidden />
                    </label>
                    <label className="account-avatar-wrapper" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {previewAvatar ? <img src={previewAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BotIcon size={60} color="black" />}
                      <input type="file" accept="image/*" onChange={handleAvatarSelect} hidden />
                    </label>
                  </div>

                  <div className="account-info-banner" style={{ padding: '60px 40px 30px' }}>
                    <div className="account-details">
                      <h3 style={{ color: 'white' }}>{editName || 'Имя бота'}</h3>
                    </div>
                  </div>
                </div>

                <div className="settings-form-group">
                  <label>Имя бота</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Название бота"
                  />
                </div>

                <div className="settings-form-group" style={{ marginTop: '15px' }}>
                  <label>О боте</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Описание возможностей и предназначения бота..."
                    rows={3}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px' }}>
                  <button className="msg-action-btn" onClick={() => setEditingBot(null)} style={{ padding: '10px 20px', borderRadius: '12px' }}>Отмена</button>
                  <button className="save-button" onClick={saveEdit} disabled={loading} style={{ margin: 0 }}>
                    {loading ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsModal;
