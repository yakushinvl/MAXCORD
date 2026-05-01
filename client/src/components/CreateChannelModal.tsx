import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { CloseIcon, HashtagIcon, SpeakerIcon } from './Icons';
import './CreateChannelModal.css';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  onChannelCreated: () => void;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  serverId,
  onChannelCreated
}) => {
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>('text');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) {
      setError('Введите название канала');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('/api/channels', {
        name: channelName.trim(),
        type: channelType,
        serverId: serverId
      });

      setChannelName('');
      setChannelType('text');
      onChannelCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка создания канала');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="create-channel-modal-overlay" onClick={onClose}>
      <div className="create-channel-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="create-channel-modal-header">
          <h2>Создать канал</h2>
          <button className="close-button" onClick={onClose}><CloseIcon /></button>
        </div>

        <form onSubmit={handleSubmit} className="create-channel-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <label htmlFor="channel-type">Тип канала</label>
            <div className="channel-type-selector">
              <button
                type="button"
                className={`type-button ${channelType === 'text' ? 'active' : ''}`}
                onClick={() => setChannelType('text')}
              >
                <span className="type-icon"><HashtagIcon size={24} /></span>
                <span>Текстовый</span>
              </button>
              <button
                type="button"
                className={`type-button ${channelType === 'voice' ? 'active' : ''}`}
                onClick={() => setChannelType('voice')}
              >
                <span className="type-icon"><SpeakerIcon size={24} /></span>
                <span>Голосовой</span>
              </button>
            </div>
          </div>

          <div className="form-section">
            <label htmlFor="channel-name">
              {channelType === 'text' ? 'Название текстового канала' : 'Название голосового канала'}
            </label>
            <div className="input-wrapper">
              {channelType === 'text' && <span className="input-prefix"><HashtagIcon size={20} /></span>}
              {channelType === 'voice' && <span className="input-prefix"><SpeakerIcon size={20} /></span>}
              <input
                type="text"
                id="channel-name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder={channelType === 'text' ? 'например: общий' : 'например: общий голосовой'}
                maxLength={100}
                required
                autoFocus
              />
            </div>
            <p className="input-hint">
              {channelType === 'text'
                ? 'Текстовые каналы используются для обмена сообщениями, файлами и изображениями.'
                : 'Голосовые каналы используются для общения в реальном времени.'}
            </p>
          </div>

          <div className="modal-buttons">
            <button type="button" onClick={onClose} className="cancel-button">
              Отмена
            </button>
            <button type="submit" className="create-button" disabled={loading || !channelName.trim()}>
              {loading ? 'Создание...' : 'Создать канал'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CreateChannelModal;










