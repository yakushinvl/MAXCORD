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
import { useKeybinds, Keybind } from '../contexts/KeybindsContext';
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
  BotIcon,
  LayoutGridIcon,
  PlusIcon
} from './Icons';
import ImageCropper from './ImageCropper';
import UserBadges from './UserBadges';
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
  | 'bots'
  | 'miniapps'
  | 'moderation';

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
  const { user, refreshUser, logout, toggle2FA, requestEmailChange, verifyEmailChange } = useAuth();
  const { confirm, prompt, alert } = useDialog();
  const {
    noiseSuppressionMode, setNoiseSuppressionMode,
    inputDevices, outputDevices, videoDevices,
    selectedInputDeviceId, setSelectedInputDeviceId,
    selectedOutputDeviceId, setSelectedOutputDeviceId,
    selectedVideoDeviceId, setSelectedVideoDeviceId,
    inputVolume, setInputVolume,
    outputVolume, setOutputVolume,
    refreshDevices,
    inputSensitivity, setInputSensitivity,
    isAutomaticSensitivity, setIsAutomaticSensitivity,
    startTestStream, stopTestStream,
    isOverlayEnabled, toggleOverlay,
    overlayPosition, setOverlayPosition,
    overlayOpacity, setOverlayOpacity,
    overlaySize, setOverlaySize
  } = useVoice();
  const { currentInputLevel = -100 } = useVoiceLevels() || {};
  const {
    theme, setTheme,
    density, setDensity,
    messageSpacing, setMessageSpacing,
    groupSpacing, setGroupSpacing,
    fontScale, setFontScale,
    appIcon, setAppIcon,
    performanceMode, setPerformanceMode,
    customColors, setCustomColors,
    customBackground, setCustomBackground,
    backgroundDim, setBackgroundDim,
    backgroundBlur, setBackgroundBlur,
    resetCustomTheme
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

  const { keybinds, updateKeybind, removeKeybind, addKeybind } = useKeybinds();
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [mobileViewState, setMobileViewState] = useState<'tabs' | 'content'>('tabs');
  const isMobile = window.innerWidth <= 768; // Simple check or pass from props
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Account Form State
  const [username, setUsername] = useState(user?.username || '');
  const [status, setStatus] = useState(user?.status || 'offline');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(getAvatarUrl(user?.avatar) || null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(getAvatarUrl(user?.banner) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedBadges, setSelectedBadges] = useState<string[]>(user?.badges || []);
  const [emailChangeState, setEmailChangeState] = useState<{
    isChanging: boolean;
    step: 1 | 2;
    newEmail: string;
    code: string;
    loading: boolean;
    error: string;
  }>({
    isChanging: false,
    step: 1,
    newEmail: '',
    code: '',
    loading: false,
    error: ''
  });


  useEffect(() => {
    if (activeTab === 'moderation') {
      fetchReports();
    }
  }, [activeTab]);

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await axios.get('/api/moderation/reports');
      setReports(res.data);
    } catch (err) { }
    setReportsLoading(false);
  };


  const AVAILABLE_BADGES = [
    { id: 'dev', label: 'Разработчик', icon: '🛠️' },
    { id: 'premium', label: 'Премиум', icon: '💎' },
    { id: 'moderator', label: 'Модератор', icon: '🛡️' },
    { id: 'artist', label: 'Художник', icon: '🎨' },
    { id: 'gamer', label: 'Геймер', icon: '🎮' },
    { id: 'meow', label: 'Котик', icon: '🐈' },
    { id: 'staff', label: 'Персонал', icon: '👔' },
    { id: 'bug_hunter', label: 'Охотник за багами', icon: '🐛' }
  ];

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
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setStatus(user.status);
      setBio(user.bio || '');
      setAvatarPreview(getAvatarUrl(user.avatar));
      setBannerPreview(getAvatarUrl(user.banner));
      setSelectedBadges(user.badges || []);
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
      await axios.put('/api/users/profile', { username, bio, status, badges: selectedBadges });
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка сохранения профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCustomBackground(reader.result as string);
    };
    reader.readAsDataURL(file);
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
            <div className="name-badges-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3>{user?.username}</h3>
              <UserBadges badges={selectedBadges} size={20} />
            </div>
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
            Изменить аватар
          </button>
        </div>

      </div>

      <div className="voice-settings-grid">
        <div className="settings-form-group">
          <label>Имя пользователя</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
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
        <label>Электронная почта</label>
        {!emailChangeState.isChanging ? (
          <div className="email-wizard-input-group">
            <input type="text" value={user?.email || ''} readOnly disabled style={{ opacity: 0.7 }} />
            <button
              className="settings-tab-action-btn"
              onClick={() => setEmailChangeState({ ...emailChangeState, isChanging: true, step: 1, error: '' })}
            >Изменить</button>
          </div>
        ) : (
          <div className="email-change-wizard">
            {emailChangeState.step === 1 ? (
              <>
                <p className="email-wizard-help">Введите новый адрес почты. Мы отправим на него код подтверждения.</p>
                <div className="email-wizard-input-group">
                  <input
                    type="email"
                    placeholder="new@email.com"
                    value={emailChangeState.newEmail}
                    onChange={e => setEmailChangeState({ ...emailChangeState, newEmail: e.target.value })}
                  />
                  <button
                    className="save-button"
                    style={{ marginTop: 0, minWidth: '120px' }}
                    disabled={emailChangeState.loading}
                    onClick={async () => {
                      setEmailChangeState(s => ({ ...s, loading: true, error: '' }));
                      try {
                        await requestEmailChange(emailChangeState.newEmail);
                        setEmailChangeState(s => ({ ...s, loading: false, step: 2 }));
                      } catch (err: any) {
                        setEmailChangeState(s => ({ ...s, loading: false, error: err.response?.data?.message || 'Ошибка' }));
                      }
                    }}
                  >{emailChangeState.loading ? '...' : 'Далее'}</button>
                  <button
                    className="settings-tab-action-btn"
                    onClick={() => setEmailChangeState({ ...emailChangeState, isChanging: false })}
                  >Отмена</button>
                </div>
              </>
            ) : (
              <>
                <p className="email-wizard-help">Код отправлен на <strong>{emailChangeState.newEmail}</strong>. Введите его ниже:</p>
                <div className="email-wizard-input-group">
                  <input
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={emailChangeState.code}
                    onChange={e => setEmailChangeState({ ...emailChangeState, code: e.target.value })}
                    style={{ textAlign: 'center', letterSpacing: '4px' }}
                  />
                  <button
                    className="save-button"
                    style={{ marginTop: 0, minWidth: '120px' }}
                    disabled={emailChangeState.loading}
                    onClick={async () => {
                      setEmailChangeState(s => ({ ...s, loading: true, error: '' }));
                      try {
                        await verifyEmailChange(emailChangeState.code);
                        await alert('Почта успешно изменена!');
                        setEmailChangeState({ ...emailChangeState, isChanging: false, loading: false });
                      } catch (err: any) {
                        setEmailChangeState(s => ({ ...s, loading: false, error: err.response?.data?.message || 'Неверный код' }));
                      }
                    }}
                  >{emailChangeState.loading ? '...' : 'Подтвердить'}</button>
                  <button
                    className="settings-tab-action-btn"
                    onClick={() => setEmailChangeState({ ...emailChangeState, step: 1 })}
                  >Назад</button>
                </div>
              </>
            )}
            {emailChangeState.error && (
              <p className="email-error">{emailChangeState.error}</p>
            )}
          </div>
        )}
      </div>

      <div className="settings-form-group">
        <label>Значки профиля</label>
        <div className="badges-selector-grid">
          {AVAILABLE_BADGES.map(badge => (
            <div
              key={badge.id}
              className={`badge-option ${selectedBadges.includes(badge.id) ? 'active' : ''}`}
              onClick={() => {
                setSelectedBadges(prev =>
                  prev.includes(badge.id)
                    ? []
                    : [badge.id]
                );
              }}
              title={badge.label}
            >
              <span className="badge-icon">{badge.icon}</span>
              <span className="badge-label">{badge.label}</span>
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

  const renderPrivacySettings = () => (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Данные и конфиденциальность</h2>

      <div className="settings-section-block">
        <h3>Безопасность учетной записи</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Двухфакторная аутентификация (2FA)</span>
            <span className="checkbox-description">
              Защитите свой аккаунт дополнительным кодом, который будет приходить на вашу почту при входе.
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={user?.is2FAEnabled || false}
              onChange={async () => {
                const confirmed = await confirm(
                  user?.is2FAEnabled
                    ? 'Вы уверены, что хотите ОТКЛЮЧИТЬ двухфакторную аутентификацию?'
                    : 'Вы уверены, что хотите ВКЛЮЧИТЬ двухфакторную аутентификацию?'
                );
                if (confirmed) {
                  try {
                    const enable = !user?.is2FAEnabled;
                    await toggle2FA(enable);
                    await alert(enable ? '2FA успешно включена!' : '2FA отключена');
                  } catch (err) {
                    await alert('Ошибка при изменении настроек 2FA');
                  }
                }
              }}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Приватность сообщений</h3>
        <div className="settings-form-group-checkbox disabled">
          <div className="checkbox-label">
            <span className="checkbox-title">Разрешить личные сообщения от участников сервера</span>
            <span className="checkbox-description">Эту настройку можно переопределить для каждого сервера отдельно.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={true} disabled />
            <span className="slider round"></span>
          </label>
        </div>
      </div>
    </div>
  );


  const renderAppearanceSettings = () => {
    return (
      <div className="settings-section-content">
        <h2 className="settings-section-title">Внешний вид</h2>

        <div className="appearance-layout">
          <div className="appearance-preview-top">
            <div className="live-preview-box" style={{ 
              backgroundImage: customBackground ? `url(${customBackground})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Preview Blur Layer */}
              {customBackground && (
                <div style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  backgroundImage: `url(${customBackground})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: `blur(${backgroundBlur}px)`,
                  transform: 'scale(1.1)',
                  zIndex: 0 
                }} />
              )}
              {/* Preview Dim Layer */}
              {customBackground && (
                <div style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  background: `rgba(0,0,0,${backgroundDim / 100})`, 
                  zIndex: 1 
                }} />
              )}
              {!customBackground && theme === 'dark' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 0 }} />}
              
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div className="preview-header">
                  <div className="preview-dot red"></div>
                  <div className="preview-dot yellow"></div>
                  <div className="preview-dot green"></div>
                  <span>Предпросмотр интерфейса</span>
                </div>
                
                <div className="preview-content-scrollable">
                  <div className="preview-message with-author" style={{ gap: '12px', marginTop: `${groupSpacing}px` }}>
                    <div className="preview-avatar" style={{ 
                      width: density === 'compact' ? '32px' : '42px', 
                      height: density === 'compact' ? '32px' : '42px',
                      borderRadius: density === 'compact' ? '10px' : '14px' 
                    }}>
                      <span>A</span>
                    </div>
                    <div className="preview-msg-body">
                      <div className="preview-msg-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: 'white' }}>Аркадий</span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Сегодня в 12:45</span>
                      </div>
                      <div className="preview-msg-text" style={{ fontSize: `${16 * fontScale}px`, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                        Привет! 👋 Как тебе новый улучшенный дизайн MAXCORD? Мы добавили много крутых штук!
                      </div>
                    </div>
                  </div>

                  <div className="preview-message grouped" style={{ marginTop: `${messageSpacing}px`, paddingLeft: density === 'compact' ? '44px' : '54px' }}>
                    <div className="preview-msg-text" style={{ fontSize: `${16 * fontScale}px`, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                      И теперь всё можно настроить под себя в реальном времени.
                    </div>
                  </div>

                  <div className="preview-message with-author" style={{ gap: '12px', marginTop: `${groupSpacing}px` }}>
                    <div className="preview-avatar bot" style={{ 
                      width: density === 'compact' ? '32px' : '42px', 
                      height: density === 'compact' ? '32px' : '42px',
                      borderRadius: density === 'compact' ? '10px' : '14px',
                      background: 'var(--primary-neon)'
                    }}>
                      <BotIcon size={18} color="black" />
                    </div>
                    <div className="preview-msg-body">
                      <div className="preview-msg-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary-neon)' }}>MAXCORD AI</span>
                        <span className="bot-badge">BOT</span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Сегодня в 12:46</span>
                      </div>
                      <div className="preview-msg-text" style={{ fontSize: `${16 * fontScale}px`, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                        Настройки успешно применены! Выглядит отлично! ✨
                      </div>
                    </div>
                  </div>
                </div>

                <div className="preview-footer-input">
                  <div className="preview-input-mock">Написать сообщение...</div>
                </div>
              </div>
            </div>

            <div className="preview-tip" style={{ marginTop: '15px', marginBottom: '30px' }}>
              <strong>Совет:</strong> Используйте «Компактный» режим, если хотите видеть больше сообщений на экране.
            </div>
          </div>

          <div className="appearance-controls">
            <div className="settings-section-block">
              <h3>Тема оформления</h3>
              <div className="theme-selection-grid">
                {[
                  { id: 'dark', label: 'Тёмная', style: 'dark' },
                  { id: 'amoled', label: 'AMOLED', style: 'amoled' },
                  { id: 'light', label: 'Светлая', style: 'light' }
                ].map(t => (
                  <div
                    key={t.id}
                    className={`theme-card ${t.style} ${theme === t.id ? 'active' : ''}`}
                    onClick={() => setTheme(t.id as any)}
                  >
                    <div className="theme-preview">
                      <div className="preview-sidebar" />
                      <div className="preview-content">
                        <div className="preview-bubble" />
                        <div className="preview-bubble short" />
                      </div>
                    </div>
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-section-block">
              <h3>Масштабирование и Размеры</h3>

              <div className="settings-form-group">
                <div className="slider-header-row">
                  <label>Размер шрифта</label>
                  <span className="slider-value">{Math.round(fontScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.05"
                  value={fontScale}
                  onChange={(e) => setFontScale(parseFloat(e.target.value))}
                  className="settings-slider"
                />
              </div>

              <div className="voice-settings-grid">
                <div className="settings-form-group">
                  <div className="slider-header-row">
                    <label>Межстрочный интервал</label>
                    <span className="slider-value">{messageSpacing}px</span>
                  </div>
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

                <div className="settings-form-group">
                  <div className="slider-header-row">
                    <label>Отступ групп</label>
                    <span className="slider-value">{groupSpacing}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="48"
                    step="2"
                    value={groupSpacing}
                    onChange={(e) => setGroupSpacing(parseInt(e.target.value))}
                    className="settings-slider"
                  />
                </div>
              </div>
            </div>

            <div className="settings-section-block">
              <h3>Отображение чата</h3>
              <div className="density-selection-pills">
                <button
                  className={`pill-btn ${density === 'cozy' ? 'active' : ''}`}
                  onClick={() => setDensity('cozy')}
                >
                  <UsersIcon size={16} />
                  Уютный (Cozy)
                </button>
                <button
                  className={`pill-btn ${density === 'compact' ? 'active' : ''}`}
                  onClick={() => setDensity('compact')}
                >
                  <MonitorIcon size={16} />
                  Компактный
                </button>
              </div>
            </div>

            <div className="settings-section-block">
              <h3>Кастомный стиль (Бета)</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '20px' }}>
                Настройте основные цвета и фон приложения. Эти настройки сохраняются только для вас.
              </p>
              
              <div className="voice-settings-grid">
                <div className="settings-form-group">
                  <label>Первичный неон</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="color-picker-wrapper" style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: customColors.primary,
                      border: '2px solid rgba(255,255,255,0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: `0 0 15px ${customColors.primary}44`
                    }}>
                      <input
                        type="color"
                        value={customColors.primary}
                        onChange={(e) => setCustomColors({ primary: e.target.value })}
                        style={{
                          position: 'absolute',
                          top: '-5px',
                          left: '-5px',
                          width: '50px',
                          height: '50px',
                          cursor: 'pointer',
                          opacity: 0
                        }}
                      />
                    </div>
                    <input 
                      type="text" 
                      value={customColors.primary} 
                      onChange={(e) => setCustomColors({ primary: e.target.value })}
                      className="settings-input" 
                      style={{ fontSize: '12px', padding: '8px', height: '40px', flex: 1 }}
                    />
                  </div>
                </div>

                <div className="settings-form-group">
                  <label>Вторичный неон</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="color-picker-wrapper" style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: customColors.secondary,
                      border: '2px solid rgba(255,255,255,0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: `0 0 15px ${customColors.secondary}44`
                    }}>
                      <input
                        type="color"
                        value={customColors.secondary}
                        onChange={(e) => setCustomColors({ secondary: e.target.value })}
                        style={{
                          position: 'absolute',
                          top: '-5px',
                          left: '-5px',
                          width: '50px',
                          height: '50px',
                          cursor: 'pointer',
                          opacity: 0
                        }}
                      />
                    </div>
                    <input 
                      type="text" 
                      value={customColors.secondary} 
                      onChange={(e) => setCustomColors({ secondary: e.target.value })}
                      className="settings-input" 
                      style={{ fontSize: '12px', padding: '8px', height: '40px', flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              <div className="settings-form-group" style={{ marginTop: '15px' }}>
                <label>Цвет акцента</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div className="color-picker-wrapper" style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: customColors.accent,
                    border: '2px solid rgba(255,255,255,0.1)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: `0 0 15px ${customColors.accent}44`
                  }}>
                    <input
                      type="color"
                      value={customColors.accent}
                      onChange={(e) => setCustomColors({ accent: e.target.value })}
                      style={{
                        position: 'absolute',
                        top: '-5px',
                        left: '-5px',
                        width: '50px',
                        height: '50px',
                        cursor: 'pointer',
                        opacity: 0
                      }}
                    />
                  </div>
                  <input 
                    type="text" 
                    value={customColors.accent} 
                    onChange={(e) => setCustomColors({ accent: e.target.value })}
                    className="settings-input" 
                    style={{ fontSize: '12px', padding: '8px', height: '40px', flex: 1 }}
                  />
                </div>
              </div>

              <div className="settings-form-group" style={{ marginTop: '20px' }}>
                <label>Фоновое изображение</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder="URL изображения..."
                    value={customBackground.startsWith('data:') ? 'Локальный файл загружен' : customBackground}
                    onChange={(e) => setCustomBackground(e.target.value)}
                    className="settings-input"
                    style={{ flex: 1 }}
                  />
                  <button 
                    className="save-button" 
                    style={{ margin: 0, padding: '0 15px', height: '40px', fontSize: '12px' }}
                    onClick={() => backgroundInputRef.current?.click()}
                  >
                    Загрузить
                  </button>
                </div>
                <input 
                  type="file" 
                  ref={backgroundInputRef} 
                  hidden 
                  accept="image/*" 
                  onChange={handleBackgroundUpload} 
                />
                
                <div className="slider-header-row" style={{ marginTop: '15px' }}>
                  <label>Затемнение фона</label>
                  <span className="slider-value">{backgroundDim}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={backgroundDim}
                  onChange={(e) => setBackgroundDim(parseInt(e.target.value))}
                  className="settings-slider"
                />

                <div className="slider-header-row" style={{ marginTop: '15px' }}>
                  <label>Размытие фона</label>
                  <span className="slider-value">{backgroundBlur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={backgroundBlur}
                  onChange={(e) => setBackgroundBlur(parseInt(e.target.value))}
                  className="settings-slider"
                />
              </div>

              <button 
                className="settings-tab-action-btn" 
                onClick={resetCustomTheme}
                style={{ marginTop: '15px', width: '100%', borderRadius: '12px' }}
              >
                Сбросить к стандартным цветам
              </button>
            </div>

            <div className="settings-section-block">
              <h3>Производительность</h3>
              <div className="settings-form-group-checkbox">
                <div className="checkbox-label">
                  <span className="checkbox-title">Режим экономии ресурсов</span>
                  <span className="checkbox-description">Отключает размытие (Blur) и сложные градиенты. Позволяет значительно снизить нагрузку на GPU.</span>
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
        </div>

      </div>
    );
  };

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
              <span className="checkbox-description">Позволить MAXCORD автоматически настраивать чувствительность нажатия.</span>
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

        <div className="settings-form-group">
          <label>Шумоподавление</label>
          <div className="checkbox-description" style={{ marginBottom: '10px' }}>
            Выберите технологию фильтрации фонового шума.
          </div>
          <select
            className="settings-select"
            value={noiseSuppressionMode}
            onChange={(e) => setNoiseSuppressionMode(e.target.value as any)}
          >
            <option value="none">Отключено (Чистый звук)</option>
            <option value="standard">Стандартное (Браузер)</option>
            <option value="rnnoise">RNNoise (Werman / Нейросеть)</option>
          </select>
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

      <div className="settings-section-block">
        <h3>Игровой оверлей</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Включить внутриигровой оверлей</span>
            <span className="checkbox-description">
              Отображает список говорящих участников поверх игры.
              Работает в большинстве игр в оконном режиме или полноэкранном режиме без полей.
            </span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={isOverlayEnabled}
              onChange={toggleOverlay}
            />
            <span className="slider round"></span>
          </label>
        </div>

        {isOverlayEnabled && (
          <div className="voice-volume-controls" style={{ marginTop: '20px' }}>
            <div className="settings-form-group">
              <label>Позиция оверлея</label>
              <select
                value={overlayPosition}
                onChange={(e) => setOverlayPosition(e.target.value)}
                className="settings-select"
              >
                <option value="top-left">Сверху слева</option>
                <option value="top-right">Сверху справа</option>
                <option value="middle-left">Посередине слева</option>
                <option value="middle-right">Посередине справа</option>
                <option value="bottom-left">Снизу слева</option>
                <option value="bottom-right">Снизу справа</option>
              </select>
            </div>

            <div className="settings-form-group">
              <div className="slider-header-row">
                <label>Прозрачность</label>
                <span className="slider-value">{Math.round(overlayOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="settings-slider"
              />
            </div>

            <div className="settings-form-group">
              <div className="slider-header-row">
                <label>Размер</label>
                <span className="slider-value">{Math.round(overlaySize * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={overlaySize}
                onChange={(e) => setOverlaySize(parseFloat(e.target.value))}
                className="settings-slider"
              />
            </div>
          </div>
        )}
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
            <span className="checkbox-title">Запускать MAXCORD при старте системы</span>
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

  const formatAccelerator = (acc: string) => {
    return acc
      .replace('CommandOrControl', 'Ctrl')
      .replace('Plus', '+')
      .split('+')
      .join(' + ');
  };

  const renderKeybindsSettings = () => (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Горячие клавиши</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '30px' }}>
        Настройте глобальные клавиши для управления приложением, даже если оно находится в фоне.
      </p>

      <div className="settings-section-block">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>Ваши комбинации</h3>
        </div>

        <div className="keybinds-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {keybinds.map(kb => (
            <div key={kb.id} className="keybind-item" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'white' }}>
                  {kb.action === 'toggle-mute' && 'Включить/выключить микрофон'}
                  {kb.action === 'toggle-deafen' && 'Включить/выключить звук'}
                  {kb.action === 'toggle-overlay' && 'Показать/скрыть оверлей'}
                  {kb.action === 'push-to-talk' && 'Режим рации (PTT)'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Глобальная клавиша
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div
                  className={`keybind-recorder-trigger ${recordingId === kb.id ? 'recording' : ''}`}
                  onClick={() => setRecordingId(kb.id)}
                  style={{
                    background: recordingId === kb.id ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${recordingId === kb.id ? 'var(--primary-neon)' : 'rgba(255,255,255,0.1)'}`,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    minWidth: '120px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: recordingId === kb.id ? 'var(--primary-neon)' : 'white',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {recordingId === kb.id ? 'Нажмите клавиши...' : formatAccelerator(kb.accelerator)}
                </div>

                <label className="switch">
                  <input
                    type="checkbox"
                    checked={kb.isEnabled}
                    onChange={(e) => updateKeybind(kb.id, { isEnabled: e.target.checked })}
                  />
                  <span className="slider round"></span>
                </label>

                <button
                  className="settings-tab-action-btn danger"
                  style={{ padding: '8px', borderRadius: '8px' }}
                  onClick={() => removeKeybind(kb.id)}
                >
                  <CloseIcon size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          className="save-button"
          style={{ marginTop: '25px', width: '100%', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
          onClick={async () => {
            const action = await prompt('Какое действие добавить? (toggle-mute, toggle-deafen, toggle-overlay)', 'toggle-mute');
            if (action) addKeybind(action, 'Ctrl+Shift+K');
          }}
        >
          Добавить горячую клавишу
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    if (!recordingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRecordingId(null);
        return;
      }
      e.preventDefault();

      const modifiers = [];
      if (e.ctrlKey || e.metaKey) modifiers.push('CommandOrControl');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');

      const isModifier = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
      if (!isModifier) {
        let key = e.key.toUpperCase();
        if (key === ' ') key = 'Space';
        if (key === 'ARROWUP') key = 'Up';
        if (key === 'ARROWDOWN') key = 'Down';
        if (key === 'ARROWLEFT') key = 'Left';
        if (key === 'ARROWRIGHT') key = 'Right';
        
        const accelerator = [...modifiers, key].join('+');
        updateKeybind(recordingId, { accelerator });
        setRecordingId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingId, updateKeybind]);


  return (
    <div className={`settings-modal-overlay ${isMobile ? 'is-mobile' : ''}`} onClick={onClose}>
      <div className={`settings-modal-container ${isMobile ? mobileViewState : ''}`} onClick={e => e.stopPropagation()}>
        {(!isMobile || mobileViewState === 'tabs') && (
          <div className="settings-sidebar">
            <div className="sidebar-header">Настройки пользователя</div>
            <div className={`sidebar-item ${activeTab === 'account' ? 'active' : ''}`} onClick={() => { setActiveTab('account'); if (isMobile) setMobileViewState('content'); }}>
              <UsersIcon size={20} />
              <span>Моя учётная запись</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => { setActiveTab('privacy'); if (isMobile) setMobileViewState('content'); }}>
              <ShieldIcon size={20} />
              <span>Конфиденциальность</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => { setActiveTab('devices'); if (isMobile) setMobileViewState('content'); }}>
              <SmartphoneIcon size={20} />
              <span>Устройства</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'bots' ? 'active' : ''}`} onClick={() => { setActiveTab('bots'); if (isMobile) setMobileViewState('content'); }}>
              <BotIcon size={20} />
              <span>Мои боты</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'miniapps' ? 'active' : ''}`} onClick={() => { setActiveTab('miniapps'); if (isMobile) setMobileViewState('content'); }}>
              <LayoutGridIcon size={20} />
              <span>Мои мини-приложения</span>
            </div>
            {(user?.role === 'moderator' || user?.role === 'admin') && (
              <div
                className={`sidebar-item ${activeTab === 'moderation' ? 'active' : ''}`}
                onClick={() => { setActiveTab('moderation'); if (isMobile) setMobileViewState('content'); }}
              >
                <ShieldIcon size={20} /> <span>Модерация</span>
              </div>
            )}

            <div className="sidebar-separator" />

            <div className="sidebar-header">Настройки приложения</div>
            <div className={`sidebar-item ${activeTab === 'appearance' ? 'active' : ''}`} onClick={() => { setActiveTab('appearance'); if (isMobile) setMobileViewState('content'); }}>
              <PaletteIcon size={20} />
              <span>Внешний вид</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => { setActiveTab('voice'); if (isMobile) setMobileViewState('content'); }}>
              <SpeakerIcon size={20} />
              <span>Голос и видео</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); if (isMobile) setMobileViewState('content'); }}>
              <ChatIcon size={20} />
              <span>Чат</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'keybinds' ? 'active' : ''}`} onClick={() => { setActiveTab('keybinds'); if (isMobile) setMobileViewState('content'); }}>
              <KeyboardIcon size={20} />
              <span>Горячие клавиши</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'windows' ? 'active' : ''}`} onClick={() => { setActiveTab('windows'); if (isMobile) setMobileViewState('content'); }}>
              <MonitorIcon size={20} />
              <span>Настройки Windows</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'streamer' ? 'active' : ''}`} onClick={() => { setActiveTab('streamer'); if (isMobile) setMobileViewState('content'); }}>
              <CameraIcon size={20} />
              <span>Режим стримера</span>
            </div>
            <div className={`sidebar-item ${activeTab === 'advanced' ? 'active' : ''}`} onClick={() => { setActiveTab('advanced'); if (isMobile) setMobileViewState('content'); }}>
              <EllipsisIcon size={20} />
              <span>Расширенные</span>
            </div>

            <div className="sidebar-separator" />

            <div className="sidebar-header">Настройки активности</div>
            <div className={`sidebar-item ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => { setActiveTab('activity'); if (isMobile) setMobileViewState('content'); }}>
              <ShieldIcon size={20} /> <span>Активность</span>
            </div>

            <div className="sidebar-item logout" onClick={() => { logout(); onClose(); navigate('/login'); }}>
              <LogOutIcon size={18} />
              <span>Выйти из аккаунта</span>
            </div>

            {isMobile && (
              <button
                className="sidebar-item"
                onClick={onClose}
                style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.05)', color: 'white' }}
              >
                Закрыть настройки
              </button>
            )}
          </div>
        )}

        {(!isMobile || mobileViewState === 'content') && (
          <main className="settings-main">
            {isMobile && (
              <div className="mobile-settings-header" style={{
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                padding: 'max(env(safe-area-inset-top), 40px) 16px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                boxSizing: 'content-box',
                background: 'rgba(0,0,0,0.2)',
                backdropFilter: 'blur(10px)'
              }}>
                <button className="back-button" onClick={() => setMobileViewState('tabs')} style={{ marginRight: '16px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <span style={{ fontWeight: 800, fontSize: '16px' }}>
                  {activeTab === 'account' && 'Профиль'}
                  {activeTab === 'privacy' && 'Конфиденциальность'}
                  {activeTab === 'appearance' && 'Внешний вид'}
                  {activeTab === 'voice' && 'Голос и видео'}
                  {activeTab === 'chat' && 'Чат'}
                  {activeTab === 'advanced' && 'Расширенные'}
                  {activeTab === 'moderation' && 'Модерация'}
                  {activeTab === 'devices' && 'Устройства'}
                  {activeTab === 'bots' && 'Мои боты'}
                  {activeTab === 'keybinds' && 'Горячие клавиши'}
                  {activeTab === 'windows' && 'Настройки Windows'}
                  {activeTab === 'streamer' && 'Режим стримера'}
                  {activeTab === 'activity' && 'Активность'}
                </span>
              </div>
            )}
            {!isMobile && (
              <div className="close-settings-button" onClick={onClose}>
                <div className="close-circle"><CloseIcon size={20} /></div>
                <span className="close-text">ESC</span>
              </div>
            )}

            <div className="settings-content-wrapper">
              <div className="settings-content-inner">
                {activeTab === 'account' && renderAccountSettings()}
                {activeTab === 'privacy' && renderPrivacySettings()}
                {activeTab === 'appearance' && renderAppearanceSettings()}
                {activeTab === 'voice' && renderVoiceSettings()}
                {activeTab === 'chat' && renderChatSettings()}
                {activeTab === 'advanced' && renderPlaceholder('Расширенные', <EllipsisIcon size={80} />)}
                {activeTab === 'moderation' && <ModerationSettings />}
                {activeTab === 'devices' && renderPlaceholder('Устройства', <SmartphoneIcon size={80} />)}
                {activeTab === 'keybinds' && renderKeybindsSettings()}
                {activeTab === 'windows' && renderWindowsSettings()}
                {activeTab === 'streamer' && renderPlaceholder('Режим стримера', <CameraIcon size={80} />)}
                {activeTab === 'activity' && <ActivitySettings />}
                {activeTab === 'bots' && <BotsSettings />}
                {activeTab === 'miniapps' && <MiniAppsSettings />}
                </div>

            </div>
          </main>
        )}
      </div>
    </div>
  );
};

function ActivitySettings() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showStatus, setShowStatus] = useState(user?.settings?.showActivityStatus ?? true);
  const [visibility, setVisibility] = useState(user?.settings?.activityVisibility ?? 'everyone');
  const [hiddenActivities, setHiddenActivities] = useState<string[]>(user?.settings?.hiddenActivities ?? []);
  const [newHiddenActivity, setNewHiddenActivity] = useState('');

  const saveSettings = async (newSettings: any) => {
    setLoading(true);
    try {
      await axios.put('/api/users/settings', { settings: newSettings });
      await refreshUser();
    } catch (e) {
      console.error('Failed to save activity settings', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = (val: boolean) => {
    setShowStatus(val);
    saveSettings({ showActivityStatus: val });
  };

  const handleVisibilityChange = (val: string) => {
    setVisibility(val as any);
    saveSettings({ activityVisibility: val });
  };

  const addHiddenActivity = () => {
    if (!newHiddenActivity.trim()) return;
    const updated = [...hiddenActivities, newHiddenActivity.trim()];
    setHiddenActivities(updated);
    saveSettings({ hiddenActivities: updated });
    setNewHiddenActivity('');
  };

  const removeHiddenActivity = (name: string) => {
    const updated = hiddenActivities.filter(a => a !== name);
    setHiddenActivities(updated);
    saveSettings({ hiddenActivities: updated });
  };

  return (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Настройки активности</h2>
      
      <div className="settings-section-block">
        <h3>Системные настройки</h3>
        <div className="settings-form-group-checkbox">
          <div className="checkbox-label">
            <span className="checkbox-title">Отображать текущую активность как статус</span>
            <span className="checkbox-description">Когда эта настройка включена, ваше текущее занятие (игры, музыка) будет отображаться в вашем профиле и списке друзей.</span>
          </div>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={showStatus} 
              onChange={(e) => handleToggleStatus(e.target.checked)} 
              disabled={loading}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Конфиденциальность активности</h3>
        <div className="settings-form-group">
          <label>Кто может видеть вашу активность?</label>
          <div className="status-selector-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            {[
              { id: 'everyone', label: 'Все', desc: 'Участники серверов и друзья' },
              { id: 'friends', label: 'Друзья', desc: 'Только ваши друзья' },
              { id: 'none', label: 'Никто', desc: 'Активность скрыта для всех' }
            ].map(opt => (
              <div
                key={opt.id}
                className={`status-option ${visibility === opt.id ? 'active' : ''}`}
                onClick={() => handleVisibilityChange(opt.id)}
                style={{ height: 'auto', padding: '15px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 700 }}>{opt.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.2 }}>{opt.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Исключения (Скрытые игры)</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '15px' }}>
          Добавьте названия приложений или игр, которые вы не хотите отображать в статусе, даже если общая настройка включена.
        </p>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Название игры (например: Solitaire)" 
            value={newHiddenActivity}
            onChange={(e) => setNewHiddenActivity(e.target.value)}
            className="settings-input"
            style={{ flex: 1 }}
          />
          <button 
            className="save-button" 
            style={{ margin: 0, padding: '0 20px' }}
            onClick={addHiddenActivity}
            disabled={loading}
          >
            Добавить
          </button>
        </div>

        <div className="hidden-activities-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hiddenActivities.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
              Список исключений пуст
            </div>
          )}
          {hiddenActivities.map(activity => (
            <div key={activity} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '12px 16px', 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '10px',
              border: '1px solid var(--glass-border)'
            }}>
              <span style={{ fontWeight: 600 }}>{activity}</span>
              <button 
                className="msg-action-btn danger" 
                onClick={() => removeHiddenActivity(activity)}
                style={{ padding: '6px 12px' }}
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section-block">
        <h3>Текущая активность</h3>
        <div style={{ padding: '20px', background: 'rgba(0, 229, 255, 0.05)', borderRadius: '16px', border: '1px solid rgba(0, 229, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: user?.activity?.assets?.largeImage ? 'transparent' : 'var(--primary-neon)', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {user?.activity?.assets?.largeImage ? (
              <img 
                src={getFullUrl(user.activity.assets.largeImage)!} 
                alt="" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : user?.activity?.assets?.smallImage ? (
              <img 
                src={getFullUrl(user.activity.assets.smallImage)!} 
                alt="" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              <MonitorIcon size={32} color="black" />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'white', fontSize: '16px' }}>{user?.activity?.name || 'Ничего не запущено'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
              {user?.activity ? (
                <>
                  {user.activity.details && <div>{user.activity.details}</div>}
                  {user.activity.state && <div>{user.activity.state}</div>}
                  <div style={{ color: 'var(--primary-neon)', marginTop: '4px', fontWeight: 600 }}>В процессе</div>
                </>
              ) : 'Запустите игру, чтобы увидеть её здесь'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BotsSettings() {
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
  const { confirm, prompt, alert } = useDialog();

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

  const togglePublishBot = async (id: string) => {
    try {
      const res = await axios.patch(`/api/bots/${id}/publish`);
      await alert(res.data.message);
      fetchBots();
    } catch (e) {
      await alert('Ошибка публикации бота');
    }
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
          await prompt("Копирование не удалось автоматически. Скопируйте токен вручную:", token);
        });
    } else {
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
          <div key={bot._id} className="bot-item glass-panel-base" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="card-banner-preview" style={{ height: '60px', background: bot.banner ? `url(${getFullUrl(bot.banner)}) center/cover` : 'var(--primary-neon)' }} />
            <div style={{ padding: '15px 20px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '-35px' }}>
                  <div style={{ width: '54px', height: '54px', background: 'var(--bg-secondary)', border: '4px solid var(--bg-secondary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    {bot.avatar ? <img src={getFullUrl(bot.avatar) || undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BotIcon size={28} color="black" />}
                  </div>
                  <div style={{ marginTop: '30px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px' }}>{bot.username}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>ID: {bot._id}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                  <button
                    className={`settings-tab-action-btn ${bot.isPublished ? 'active' : ''}`}
                    style={{ background: bot.isPublished ? 'var(--primary-neon)' : '', color: bot.isPublished ? 'black' : '' }}
                    onClick={() => togglePublishBot(bot._id)}
                  >
                    {bot.isPublished ? 'Снять' : 'Опубликовать'}
                  </button>
                  <button className="settings-tab-action-btn" onClick={() => startEdit(bot)}>Настроить</button>
                  <button
                    className="settings-tab-action-btn"
                    onClick={() => setShowServerSelect(showServerSelect === bot._id ? null : bot._id)}
                  >
                    Добавить
                  </button>
                  <button className="settings-tab-action-btn danger" onClick={() => deleteBot(bot._id)}>Удалить</button>
                </div>
              </div>

              {showServerSelect === bot._id && (
                <div className="server-selector" style={{ marginTop: '15px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--primary-neon)' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Выберите сервер:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {userServers.map(server => (
                      <div
                        key={server._id}
                        onClick={() => addBotToServer(bot._id, server._id)}
                        className="server-option-item"
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>{server.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Добавить</span>
                      </div>
                    ))}
                    {userServers.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>У вас нет доступных серверов.</p>}
                  </div>
                </div>
              )}

              <div className="bot-token-area" style={{ marginTop: '15px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code style={{ flex: 1, fontSize: '13px', color: 'var(--primary-neon)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {revealedTokenId === bot._id ? bot.botToken : '••••••••••••••••••••••••••••••••'}
                </code>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button className="settings-tab-action-btn small" onClick={() => setRevealedTokenId(revealedTokenId === bot._id ? null : bot._id)}>
                    {revealedTokenId === bot._id ? 'Скрыть' : 'Показать'}
                  </button>
                  <button className="settings-tab-action-btn small" onClick={() => copyToken(bot.botToken)}>
                    {copiedToken === bot.botToken ? 'Готово!' : 'Копировать'}
                  </button>
                </div>
              </div>

              {editingBot?._id === bot._id && (
                <div className="bot-edit-area" style={{ marginTop: '20px', padding: '20px', background: 'rgba(0,0,0,0.15)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="user-settings-account-card" style={{ marginBottom: '20px', background: 'transparent', border: 'none' }}>
                    <div
                      className="account-banner"
                      style={{ height: '100px', borderRadius: '12px', background: previewBanner ? `url(${previewBanner}) center/cover` : 'var(--primary-neon)' }}
                    >
                      <label className="change-banner-button" style={{ cursor: 'pointer' }}>
                        Изменить баннер
                        <input type="file" accept="image/*" onChange={handleBannerSelect} hidden />
                      </label>
                      <label className="account-avatar-wrapper" style={{ cursor: 'pointer', width: '70px', height: '70px', left: '20px', bottom: '-35px' }}>
                        {previewAvatar ? <img src={previewAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BotIcon size={32} color="black" />}
                        <input type="file" accept="image/*" onChange={handleAvatarSelect} hidden />
                      </label>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '45px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="settings-form-group">
                      <label>Имя бота</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Название" />
                    </div>
                    <div className="settings-form-group">
                      <label>О боте</label>
                      <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Описание" rows={3} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button className="settings-tab-action-btn" onClick={() => setEditingBot(null)}>Отмена</button>
                    <button className="save-button" style={{ margin: 0 }} onClick={saveEdit} disabled={loading}>Сохранить</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniAppsSettings() {
  const [miniapps, setMiniapps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [appName, setAppName] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [editingApp, setEditingApp] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  const [editBanner, setEditBanner] = useState<File | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [previewBanner, setPreviewBanner] = useState<string | null>(null);
  const { confirm, alert } = useDialog();

  const fetchApps = async () => {
    try {
      const response = await axios.get('/api/miniapps/my');
      setMiniapps(response.data);
    } catch (e) { }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const createApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim() || !appUrl.trim()) return;
    setLoading(true);
    try {
      await axios.post('/api/miniapps/create', { name: appName, url: appUrl });
      setAppName('');
      setAppUrl('');
      fetchApps();
    } catch (e) {
      await alert('Ошибка создания мини-приложения');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (app: any) => {
    setEditingApp(app);
    setEditName(app.name);
    setEditUrl(app.url);
    setEditDesc(app.description || '');
    setEditAvatar(null);
    setEditBanner(null);
    setPreviewAvatar(app.avatar ? getFullUrl(app.avatar) : null);
    setPreviewBanner(app.banner ? getFullUrl(app.banner) : null);
  };

  const saveEdit = async () => {
    if (!editingApp) return;
    setLoading(true);
    try {
      await axios.patch(`/api/miniapps/${editingApp._id}`, { name: editName, url: editUrl, description: editDesc });
      if (editAvatar) {
        const fd = new FormData();
        fd.append('avatar', editAvatar);
        await axios.post(`/api/miniapps/${editingApp._id}/avatar`, fd);
      }
      if (editBanner) {
        const fd = new FormData();
        fd.append('banner', editBanner);
        await axios.post(`/api/miniapps/${editingApp._id}/banner`, fd);
      }
      setEditingApp(null);
      fetchApps();
    } catch (e) {
      await alert('Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (id: string) => {
    try {
      const res = await axios.patch(`/api/miniapps/${id}/publish`);
      await alert(res.data.message);
      fetchApps();
    } catch (e) {
      await alert('Ошибка публикации');
    }
  };

  const deleteApp = async (id: string) => {
    if (!(await confirm('Вы уверены?'))) return;
    try {
      await axios.delete(`/api/miniapps/${id}`);
      fetchApps();
    } catch (e) { }
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

  return (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Мои мини-приложения</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '20px' }}>
        Мини-приложения открываются в виде плавающих окон внутри MAXCORD.
      </p>

      <form onSubmit={createApp} className="glass-panel-base" style={{ padding: '20px', borderRadius: '12px', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Название мини-приложения"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            className="settings-input"
            style={{ flex: 1 }}
          />
          <input
            type="text"
            placeholder="URL (например, https://my-game.com)"
            value={appUrl}
            onChange={e => setAppUrl(e.target.value)}
            className="settings-input"
            style={{ flex: 1 }}
          />
        </div>
        <button type="submit" className="save-button" style={{ margin: 0 }} disabled={loading}>
          Создать мини-приложение
        </button>
      </form>

      <div className="apps-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {miniapps.length === 0 && <div className="placeholder-settings" style={{ padding: '40px' }}>У вас пока нет мини-приложений.</div>}
        {miniapps.map(app => (
          <div key={app._id} className="bot-item glass-panel-base" style={{ padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="card-banner-preview" style={{ height: '60px', background: app.banner ? `url(${getFullUrl(app.banner)}) center/cover` : 'var(--secondary-neon)', opacity: app.banner ? 1 : 0.6 }} />
            <div style={{ padding: '15px 20px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '-35px' }}>
                  <div style={{ width: '54px', height: '54px', background: 'var(--bg-secondary)', border: '4px solid var(--bg-secondary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    {app.avatar ? <img src={getFullUrl(app.avatar) || undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LayoutGridIcon size={28} color="var(--secondary-neon)" />}
                  </div>
                  <div style={{ marginTop: '30px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px' }}>{app.name}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.url}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                  <button
                    className={`settings-tab-action-btn ${app.isPublished ? 'active' : ''}`}
                    style={{ background: app.isPublished ? 'var(--primary-neon)' : '', color: app.isPublished ? 'black' : '' }}
                    onClick={() => togglePublish(app._id)}
                  >
                    {app.isPublished ? 'Снять' : 'Опубликовать'}
                  </button>
                  <button className="settings-tab-action-btn" onClick={() => startEdit(app)}>Настроить</button>
                  <button className="settings-tab-action-btn danger" onClick={() => deleteApp(app._id)}>Удалить</button>
                </div>
              </div>

              {editingApp?._id === app._id && (
                <div className="bot-edit-area" style={{ marginTop: '20px', padding: '20px', background: 'rgba(0,0,0,0.15)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="user-settings-account-card" style={{ marginBottom: '20px', background: 'transparent', border: 'none' }}>
                    <div
                      className="account-banner"
                      style={{ height: '100px', borderRadius: '12px', background: previewBanner ? `url(${previewBanner}) center/cover` : 'var(--secondary-neon)' }}
                    >
                      <label className="change-banner-button" style={{ cursor: 'pointer' }}>
                        Изменить баннер
                        <input type="file" accept="image/*" onChange={handleBannerSelect} hidden />
                      </label>
                      <label className="account-avatar-wrapper" style={{ cursor: 'pointer', width: '70px', height: '70px', left: '20px', bottom: '-35px' }}>
                        {previewAvatar ? <img src={previewAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <LayoutGridIcon size={32} color="black" />}
                        <input type="file" accept="image/*" onChange={handleAvatarSelect} hidden />
                      </label>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '45px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="settings-form-group">
                      <label>Название</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Название" />
                    </div>
                    <div className="settings-form-group">
                      <label>URL</label>
                      <input type="text" value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="URL" />
                    </div>
                    <div className="settings-form-group">
                      <label>Описание</label>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Краткое описание" rows={3} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button className="settings-tab-action-btn" onClick={() => setEditingApp(null)}>Отмена</button>
                    <button className="save-button" style={{ margin: 0 }} onClick={saveEdit} disabled={loading}>Сохранить</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
;

function ModerationSettings() {
  const { user } = useAuth();
  const { confirm, prompt, alert } = useDialog();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'dismissed'>('pending');

  const fetchReports = async (status: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/moderation/reports?status=${status}`);
      setReports(res.data);
    } catch (err) { }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports(filter);
  }, [filter]);

  return (
    <div className="settings-section-content">
      <h2 className="settings-section-title">Система модерации</h2>

      <div className="moderation-header" style={{ marginBottom: '20px', display: 'flex', gap: '15px' }}>
        <div className={`filter-tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')} style={{ cursor: 'pointer', padding: '10px 20px', background: filter === 'pending' ? 'var(--primary-neon)' : 'rgba(255,255,255,0.05)', color: filter === 'pending' ? 'black' : 'white', borderRadius: '8px', fontWeight: 600 }}>
          Ожидают ({filter === 'pending' ? reports.length : '...'})
        </div>
        <div className={`filter-tab ${filter === 'resolved' ? 'active' : ''}`} onClick={() => setFilter('resolved')} style={{ cursor: 'pointer', padding: '10px 20px', background: filter === 'resolved' ? 'var(--primary-neon)' : 'rgba(255,255,255,0.05)', color: filter === 'resolved' ? 'black' : 'white', borderRadius: '8px', fontWeight: 600 }}>
          Решено
        </div>
        <div className={`filter-tab ${filter === 'dismissed' ? 'active' : ''}`} onClick={() => setFilter('dismissed')} style={{ cursor: 'pointer', padding: '10px 20px', background: filter === 'dismissed' ? 'var(--primary-neon)' : 'rgba(255,255,255,0.05)', color: filter === 'dismissed' ? 'black' : 'white', borderRadius: '8px', fontWeight: 600 }}>
          Отклонено
        </div>
      </div>

      <div className="reports-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {loading ? (
          <div className="placeholder-settings">Загрузка...</div>
        ) : reports.length === 0 ? (
          <div className="placeholder-settings" style={{ padding: '40px' }}>{filter === 'pending' ? 'Жалоб нет. Всё спокойно! 🛡️' : 'Список пока пуст.'}</div>
        ) : (
          reports.map(report => (
            <div key={report._id} className="report-card glass-panel-base" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <div>
                  <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                    <strong style={{ color: 'var(--text-dim)' }}>От:</strong> {report.reporter?.username}
                  </div>
                  <div style={{ fontSize: '14px' }}>
                    <strong style={{ color: 'var(--text-dim)' }}>На:</strong> {report.reportedUser?.username}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', textAlign: 'right' }}>
                  <div>{new Date(report.createdAt).toLocaleString()}</div>
                  {report.status !== 'pending' && <div style={{ color: 'var(--primary-neon)', fontWeight: 600, marginTop: '5px' }}>{report.status === 'resolved' ? 'РЕШЕНО' : 'ОТКЛОНЕНО'}</div>}
                </div>
              </div>
              <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, color: 'var(--primary-neon)', marginBottom: '5px' }}>
                  {report.reason === 'harassment' ? 'Домогательства' :
                    report.reason === 'spam' ? 'Спам' :
                      report.reason === 'inappropriate_content' ? 'Контент' :
                        report.reason === 'scam' ? 'Мошенничество' : 'Другое'}
                </div>
                {report.description && <div style={{ fontSize: '13px' }}>{report.description}</div>}
              </div>

              {report.status !== 'pending' && (
                <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                    <strong>Решение модератора ({report.resolvedBy?.username}):</strong> {report.resolutionNote || 'Без комментария'}
                  </div>
                  <button className="settings-tab-action-btn" style={{ fontSize: '11px', padding: '5px 10px' }} onClick={async () => {
                    if (await confirm('Вы уверены, что хотите отменить вердикт и вернуть жалобу в список ожидания?')) {
                      try {
                        await axios.post(`/api/moderation/reports/${report._id}/unresolve`);
                        if (report.status === 'resolved' && await confirm('Хотите также РАЗБАНИТЬ этого пользователя?')) {
                          await axios.post('/api/moderation/unban', { userId: report.reportedUser._id });
                          await alert('Пользователь разбанен.');
                        }
                        fetchReports(filter);
                      } catch (e) { }
                    }
                  }}>Отменить решение</button>
                </div>
              )}

              {report.status === 'pending' && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button className="settings-tab-action-btn" onClick={async () => {
                    try {
                      await axios.post(`/api/moderation/reports/${report._id}/resolve`, { status: 'dismissed', note: 'Отклонено модератором' });
                      fetchReports(filter);
                    } catch (e) { }
                  }}>Отклонить</button>
                  <button className="settings-tab-action-btn" style={{ background: 'rgba(255,165,0,0.2)', color: 'orange' }} onClick={async () => {
                    const reason = await prompt('Укажите причину временного бана:', 'Нарушение правил сообщества');
                    if (reason) {
                      try {
                        await axios.post('/api/moderation/ban', { userId: report.reportedUser._id, type: 'temporary', durationHours: 24, reason });
                        await axios.post(`/api/moderation/reports/${report._id}/resolve`, { status: 'resolved', note: 'Временный бан на 24ч' });
                        fetchReports(filter);
                        await alert('Пользователь забанен на 24 часа');
                      } catch (e) { }
                    }
                  }}>Бан 24ч</button>
                  <button className="msg-action-btn danger" onClick={async () => {
                    if (await confirm(`Вы уверены, что хотите забанить ${report.reportedUser.username} НАВСЕГДА?`)) {
                      const reason = await prompt('Укажите причину перманентного бана:', 'Грубое нарушение правил');
                      if (reason) {
                        try {
                          await axios.post('/api/moderation/ban', { userId: report.reportedUser._id, type: 'permanent', reason });
                          await axios.post(`/api/moderation/reports/${report._id}/resolve`, { status: 'resolved', note: 'Перманентный бан' });
                          fetchReports(filter);
                          await alert('Пользователь забанен навсегда');
                        } catch (e) { }
                      }
                    }
                  }}>Пермабан</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SettingsModal;

