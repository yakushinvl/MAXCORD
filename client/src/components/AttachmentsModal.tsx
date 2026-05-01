import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Message, User } from '../types';
import { getAvatarUrl, getFullUrl } from '../utils/avatar';
import { 
  DownloadIcon, 
  DocumentIcon, 
  SpeakerIcon, 
  VideoIcon, 
  CameraIcon, 
  CloseIcon,
  EllipsisIcon
} from './Icons';
import './AttachmentsModal.css';

interface AttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId?: string;
  dmId?: string;
  title: string;
}

interface AttachmentItem {
  url: string;
  filename: string;
  size: number;
  type: string;
  createdAt: string;
  author: User;
  messageId: string;
}

const AttachmentsModal: React.FC<AttachmentsModalProps> = ({ isOpen, onClose, channelId, dmId, title }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'audio' | 'files'>('all');

  useEffect(() => {
    if (isOpen) {
      fetchAttachments();
    }
  }, [isOpen, channelId, dmId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchAttachments = async () => {
    setIsLoading(true);
    try {
      const endpoint = channelId 
        ? `/api/messages/channel/${channelId}/attachments` 
        : `/api/messages/dm/${dmId}/attachments`;
      const response = await axios.get(endpoint);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch attachments', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAttachmentType = (filename: string, contentType: string): 'images' | 'videos' | 'audio' | 'files' => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic'].includes(ext || '') || contentType.startsWith('image/')) return 'images';
    if (['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv'].includes(ext || '') || contentType.startsWith('video/')) return 'videos';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext || '') || contentType.startsWith('audio/')) return 'audio';
    return 'files';
  };

  const allAttachments = useMemo(() => {
    const list: AttachmentItem[] = [];
    messages.forEach(msg => {
      msg.attachments.forEach(att => {
        list.push({
          ...att,
          createdAt: msg.createdAt,
          author: msg.author,
          messageId: msg._id
        });
      });
    });
    return list;
  }, [messages]);

  const filteredAttachments = useMemo(() => {
    if (activeTab === 'all') return allAttachments;
    return allAttachments.filter(att => getAttachmentType(att.filename, att.type) === activeTab);
  }, [allAttachments, activeTab]);

  const groupedByDate = useMemo(() => {
    const groups: { [date: string]: { [type: string]: AttachmentItem[] } } = {};
    
    filteredAttachments.forEach(att => {
      const date = new Date(att.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      const type = getAttachmentType(att.filename, att.type);
      
      if (!groups[date]) groups[date] = {};
      if (!groups[date][type]) groups[date][type] = [];
      groups[date][type].push(att);
    });

    return groups;
  }, [filteredAttachments]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = async (url: string, filename: string) => {
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
       window.open(url, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="attachments-modal-overlay" onClick={onClose}>
      <div className="attachments-modal-container glass-panel-base" onClick={e => e.stopPropagation()}>
        <div className="attachments-sidebar">
          <div className="sidebar-title">
             <span>ВЛОЖЕНИЯ</span>
             <h2>{title}</h2>
          </div>

          <div className="sidebar-header">КАТЕГОРИИ</div>
          <div className={`sidebar-item ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            <EllipsisIcon size={20} />
            <span>Все вложения</span>
          </div>
          <div className={`sidebar-item ${activeTab === 'images' ? 'active' : ''}`} onClick={() => setActiveTab('images')}>
            <CameraIcon size={20} />
            <span>Фотографии</span>
          </div>
          <div className={`sidebar-item ${activeTab === 'videos' ? 'active' : ''}`} onClick={() => setActiveTab('videos')}>
            <VideoIcon size={20} />
            <span>Видеофайлы</span>
          </div>
          <div className={`sidebar-item ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => setActiveTab('audio')}>
            <SpeakerIcon size={20} />
            <span>Аудиозаписи</span>
          </div>
          <div className={`sidebar-item ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
            <DocumentIcon size={20} />
            <span>Документы</span>
          </div>


        </div>

        <div className="attachments-main-content">
           <div className="attachments-content-header">
              <div className="header-info">
                 <h2>{activeTab === 'all' ? 'Все вложения' : activeTab === 'images' ? 'Фотографии' : activeTab === 'videos' ? 'Видеофайлы' : activeTab === 'audio' ? 'Аудиозаписи' : 'Документы'}</h2>
                 <p>{filteredAttachments.length} объектов найдено</p>
              </div>
              <div className="close-x-btn" onClick={onClose}>
                <div className="close-circle"><CloseIcon size={20} /></div>
                <span className="close-text">ESC</span>
              </div>
           </div>

           <div className="attachments-scroll-area">
              {isLoading ? (
                <div className="loading-state">
                   <div className="spinner"></div>
                   <span>Загрузка медиаархива...</span>
                </div>
              ) : filteredAttachments.length === 0 ? (
                <div className="empty-state">
                   <DocumentIcon size={48} color="rgba(255, 255, 255, 0.2)" />
                   <h3>Здесь ничего нет</h3>
                   <p>В этом чате пока не делились такими вложениями</p>
                </div>
              ) : (
                Object.entries(groupedByDate).map(([date, typeGroups]) => (
                  <div key={date} className="date-group">
                    <div className="date-header">{date}</div>
                    {Object.entries(typeGroups).map(([type, items]) => (
                      <div key={type} className="type-group">
                        <div className="attachments-grid">
                          {items.map((att, idx) => (
                            <div key={`${att.messageId}-${idx}`} className="attachment-card">
                              <div className="card-preview">
                                {type === 'images' ? (
                                  <img src={getFullUrl(att.url) || ''} alt={att.filename} loading="lazy" />
                                ) : type === 'videos' ? (
                                  <video src={getFullUrl(att.url) || ''} />
                                ) : type === 'audio' ? (
                                  <div className="audio-icon"><SpeakerIcon size={40} /></div>
                                ) : (
                                  <div className="file-icon"><DocumentIcon size={40} /></div>
                                )}
                                <div className="card-overlay">
                                  <button className="download-btn" onClick={() => handleDownload(getFullUrl(att.url) || '', att.filename)} title="Скачать">
                                    <DownloadIcon size={22} />
                                  </button>
                                </div>
                              </div>
                              <div className="card-info">
                                <span className="file-name" title={att.filename}>{att.filename}</span>
                                <div className="file-footer">
                                   <span className="file-size">{formatSize(att.size)}</span>
                                   <span className="file-author">от {att.author.username}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default AttachmentsModal;
