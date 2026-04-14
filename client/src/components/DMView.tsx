import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { DirectMessage, Message, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import axios from 'axios';
import { getAvatarUrl, getFullUrl } from '../utils/avatar';
import { MenuIcon, SmileIcon, PinIcon, ReplyIcon, TrashIcon, DownloadIcon, DocumentIcon, PlusIcon, PhoneIcon, ArrowDownIcon } from './Icons';
import VoiceCall from './VoiceCall';
import CustomVideoPlayer from './CustomVideoPlayer';
import CustomAudioPlayer from './CustomAudioPlayer';
import MediaLightbox from './MediaLightbox';
import MentionAutocomplete from './MentionAutocomplete';
import { useChatSettings } from '../contexts/ChatSettingsContext';
import { createPortal } from 'react-dom';
import UserAvatar from './UserAvatar';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import Reactions from './Reactions';
import StickyPins from './StickyPins';
import './DMView.css';
import './Attachments.css';

interface DMViewProps {
  dm: DirectMessage;
  messages: Message[];
  socket: Socket | null;
  onClose: () => void;
  onStartCall: (user: User, dmId: string) => void;
  onStartGroupCall: () => void;
  onUserClick: (userId: string, event?: React.MouseEvent) => void;
  initialUnreadCount?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => Promise<void>;
  pinnedMessages?: Message[];
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  onMobileMenuClick?: () => void;
}

const DMView: React.FC<DMViewProps> = ({
  dm, messages, socket, onClose, onStartCall, onStartGroupCall, onUserClick, initialUnreadCount = 0,
  hasMore = false, isLoadingMore = false, onLoadMore, pinnedMessages = [], setMessages,
  onMobileMenuClick
}) => {
  const { user } = useAuth();
  const { alert } = useDialog();
  const {
    displayEmbeds,
    showHoverActions,
    mentionHighlight,
    autocompleteEmoji,
    enableTTS
  } = useChatSettings();
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMedia, setLightboxMedia] = useState<any[]>([]);
  const [hasScrolledToNew, setHasScrolledToNew] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [friends, setFriends] = useState<User[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPins, setShowPins] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ x: number, y: number, msgId: string } | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showGifPicker, setShowGifPicker] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    if (!socket) return;
    const handleReactionsUpdate = (data: { messageId: string, reactions: any[] }) => {
      if (setMessages) {
        setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
      }
    };
    socket.on('message-reactions-update', handleReactionsUpdate);
    return () => {
      socket.off('message-reactions-update', handleReactionsUpdate);
    };
  }, [socket, setMessages]);

  const handleReact = (messageId: string, emoji: string) => {
    axios.post(`/api/messages/${messageId}/reactions`, { emoji });
  };

  const otherUser = dm.participants.find(p => p._id !== user?._id);
  const isGroup = dm.participants.length > 2 || !!dm.name;
  const otherParticipants = dm.participants.filter(p => p._id !== user?._id);
  const displayName = dm.name || (isGroup ? otherParticipants.map(p => p.username).join(', ') : otherUser?.username);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Сегодня в ${timeStr}`;
    if (isYesterday) return `Вчера в ${timeStr}`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  };

  const shouldShowDate = (current: Message, previous: Message | undefined) => {
    if (!previous) return true;
    return new Date(current.createdAt).getDate() !== new Date(previous.createdAt).getDate();
  };

  const isGrouped = (current: Message, previous: Message | undefined) => {
    if (!previous) return false;
    if (current.author._id !== previous.author._id) return false;
    if (shouldShowDate(current, previous)) return false;

    // Group if within 5 minutes
    const timeDiff = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
    return timeDiff < 5 * 60 * 1000;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && attachments.length === 0) || !socket) return;
    socket.emit('send-message', {
      content: message.trim(),
      dmId: dm._id,
      attachments,
      replyToId: replyToMessage?._id
    });
    setMessage('');
    setAttachments([]);
    setReplyToMessage(null);
    // ...
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing-stop', { dmId: dm._id });
  };

  const handleGifSelect = (url: string) => {
    if (!socket) return;
    const attachment = { url, filename: 'tenor.gif', type: 'image/gif', size: 0 };
    socket.emit('send-message', {
      content: '',
      dmId: dm._id,
      attachments: [attachment],
      replyToId: replyToMessage?._id
    });
    setShowGifPicker(null);
    setReplyToMessage(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing-stop', { dmId: dm._id });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) formData.append('files', e.target.files[i]);
      try {
        const response = await axios.post('/api/upload-files', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setAttachments(prev => [...prev, ...response.data]);
      } catch (error) { await alert('Ошибка загрузки файла'); }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const items = Array.from(e.clipboardData.items);
      const isFile = items.some(item => item.kind === 'file');

      if (isFile) {
        e.preventDefault();
        const files = Array.from(e.clipboardData.files);
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        try {
          const response = await axios.post('/api/upload-files', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          setAttachments(prev => [...prev, ...response.data]);
        } catch (error) {
          await alert('Ошибка загрузки файла');
        }
      }
    }
  };

  const handleDownload = async (e: React.MouseEvent, url: string, filename: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(url, { mode: 'cors' });
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
      console.warn('Fetch download failed, falling back to direct link:', error);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      link.click();
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      try {
        const response = await axios.post('/api/upload-files', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setAttachments(prev => [...prev, ...response.data]);
      } catch (error) {
        await alert('Ошибка загрузки файла');
      }
    }
  };
  useEffect(() => {
    setHasScrolledToNew(false);
    fetchFriends();
  }, [dm._id]);

  const fetchFriends = async () => {
    try {
      const response = await axios.get('/api/friends');
      setFriends(response.data);
    } catch (e) { }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSignIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtSignIndex !== -1 && autocompleteEmoji) {
      const query = textBeforeCursor.substring(lastAtSignIndex + 1);
      if (!query.includes(' ')) {
        setShowMentions(true);
        setMentionQuery(query);
        setMentionStartIndex(lastAtSignIndex);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    if (!socket) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing-start', { dmId: dm._id });
    typingTimeoutRef.current = setTimeout(() => { socket.emit('typing-stop', { dmId: dm._id }); }, 3000);
  };

  const handleMentionSelect = (item: any) => {
    const name = item.username;
    const before = message.substring(0, mentionStartIndex);
    const after = message.substring(mentionStartIndex + mentionQuery.length + 1);

    const newMessage = `${before}@${name} ${after}`;
    setMessage(newMessage);
    setShowMentions(false);

    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const renderMessageContent = (content: string, mentions: User[] = []) => {
    if (!content) return null;
    const parts = content.split(/(@\w+)|(```[\s\S]*?```)/g);

    return (
      <>
        {parts.map((part, i) => {
          if (!part) return null;

          if (typeof part !== 'string') return null;

          if (part.startsWith('```') && part.endsWith('```')) {
            const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
            if (match) {
              const lang = match[1] || 'text';
              const code = match[2];
              return (
                <div
                  key={`code-${i}`}
                  className="code-block-wrapper"
                  onClick={e => e.stopPropagation()}
                  style={{
                    margin: '8px 0',
                    borderRadius: '6px',
                    background: '#1e1e1e',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '12px',
                    overflowX: 'auto',
                    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                    fontSize: '13px',
                    color: '#d4d4d4'
                  }}
                >
                  {lang && <div style={{ color: '#569cd6', marginBottom: '8px', fontSize: '11px', textTransform: 'uppercase', userSelect: 'none' }}>{lang}</div>}
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    <code>{code.replace(/^\n/, '').replace(/\n$/, '')}</code>
                  </pre>
                </div>
              );
            }
          }

          if (part.startsWith('@')) {
            const name = part.substring(1);
            const isUserMention = mentions.some(m => m.username === name);
            if (isUserMention) {
              const userMention = mentions.find(m => m.username === name);
              return (
                <span
                  key={`mention-${i}`}
                  className="mention-tag user-mention"
                  onClick={(e) => {
                    if (userMention) {
                      e.stopPropagation();
                      onUserClick(userMention._id, e);
                    }
                  }}
                >
                  {part}
                </span>
              );
            }
          }
          return <span key={`text-${i}`} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
        })}
      </>
    );
  };

  useEffect(() => {
    // Initial jump to bottom or unread
    if (messages.length > 0 && !hasScrolledToNew) {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const performScroll = () => {
        if (initialUnreadCount > 0 && unreadRef.current) {
          scrollContainer.scrollTop = unreadRef.current.offsetTop - 100;
        } else {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      };

      // Execute immediately and then after a short delay for late-rendering elements
      performScroll();
      const t1 = setTimeout(performScroll, 50);
      const t2 = setTimeout(performScroll, 200);
      const t3 = setTimeout(performScroll, 500);

      setHasScrolledToNew(true);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (messages.length === 0 && hasScrolledToNew) {
      setHasScrolledToNew(false);
    }
  }, [messages.length, initialUnreadCount, hasScrolledToNew, dm._id]);

  useEffect(() => {
    if (hasScrolledToNew) {
      const container = scrollContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          setShowScrollBottom(true);
        }
      }
    }
  }, [messages, hasScrolledToNew]);

  // TTS Effect
  useEffect(() => {
    if (!enableTTS || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.author._id !== user?._id && hasScrolledToNew) {
      const utterance = new SpeechSynthesisUtterance(`${lastMsg.author.username} сказал: ${lastMsg.content}`);
      utterance.lang = 'ru-RU';
      window.speechSynthesis.speak(utterance);
    }
  }, [messages.length, enableTTS]);

  const handleScroll = async () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollBottom(!isAtBottom);

    if (container.scrollTop < 50 && hasMore && !isLoadingMore && onLoadMore) {
      const oldScrollHeight = container.scrollHeight;
      await onLoadMore();
      if (container) {
        container.scrollTop = container.scrollHeight - oldScrollHeight;
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setShowScrollBottom(false);
  };

  const handleTogglePin = (messageId: string) => {
    axios.patch(`/api/messages/${messageId}/pin`);
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
    }
  };

  return (
    <div
      className={`dm-view ${isDragging ? 'dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drag-drop-overlay">
          <div className="drag-drop-content">
            <div className="drag-drop-icon"><PlusIcon size={48} /></div>
            <div className="drag-drop-text">Перетащите файлы сюда для загрузки</div>
          </div>
        </div>
      )}
      <div className="dm-container">
        <div className="dm-header">
          <button className="mobile-nav-toggle" onClick={onMobileMenuClick}>
            <MenuIcon size={24} />
          </button>
          <button className="back-button" onClick={onClose} title="Назад">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>

          <div className="dm-header-info" onClick={(e) => !isGroup && otherUser && onUserClick(otherUser._id, e)} style={{ cursor: isGroup ? 'default' : 'pointer' }}>
            <UserAvatar
              user={isGroup ? null : otherUser}
              size={40}
              className="dm-avatar"
              onClick={(e) => {
                if (isGroup) return;
                e.stopPropagation();
                otherUser && onUserClick(otherUser._id, e);
              }}
            />
            <div className="dm-header-text-info">
              <h3 className="dm-display-name">{displayName}</h3>
              {!isGroup && (
                <div style={{ fontSize: '12px', color: 'var(--primary-neon)', fontWeight: 600, opacity: 0.8 }}>
                  {otherUser?.status === 'online' ? 'В сети' : otherUser?.status === 'away' ? 'Нет на месте' : otherUser?.status === 'busy' ? 'Занят' : 'Не в сети'}
                </div>
              )}
              {isGroup && (
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, opacity: 0.8 }}>
                  {dm.participants.length} участников
                </div>
              )}
            </div>
          </div>

          <button
            className="voice-call-button"
            onClick={() => isGroup ? onStartGroupCall() : (otherUser && onStartCall(otherUser, dm._id))}
            title={isGroup ? "Начать групповой звонок" : "Начать голосовой звонок"}
          >
            <PhoneIcon />
          </button>
          <button className="voice-call-button" onClick={() => setShowPins(!showPins)} title="Закрепленные сообщения">
            <PinIcon size={20} fill={showPins ? "var(--primary-neon)" : "none"} color={showPins ? "var(--primary-neon)" : "var(--text-dim)"} />
          </button>
        </div>

        {showPins && (
          <div className="pins-overlay" onClick={() => setShowPins(false)}>
            <div className="pins-modal glass-panel-base" onClick={e => e.stopPropagation()}>
              <div className="pins-header">
                <h3>Закрепленные сообщения</h3>
                <button className="close-pins" onClick={() => setShowPins(false)}>×</button>
              </div>
              <div className="pins-list">
                {pinnedMessages.length === 0 ? (
                  <div className="empty-pins">Нет закрепленных сообщений</div>
                ) : (
                  pinnedMessages.map(msg => (
                    <div key={msg._id} className="pin-item">
                      <div className="pin-author">
                        <UserAvatar user={msg.author} size={24} className="pin-avatar-comp" />
                        <span className="pin-name">{msg.author.username}</span>
                        <span className="pin-date">{formatDate(msg.createdAt)}</span>
                      </div>
                      <div className="pin-content">{msg.content}</div>
                      <button className="unpin-btn" onClick={() => handleTogglePin(msg._id)}>Открепить</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <StickyPins pinnedMessages={pinnedMessages} onOpenPins={() => setShowPins(true)} />

        <div className="messages-container" ref={scrollContainerRef} onScroll={handleScroll}>
          {isLoadingMore && <div className="loading-more">Загрузка...</div>}
          <div className="messages-list">
            {messages.map((msg, idx) => {
              const prev = messages[idx - 1];
              const showDate = shouldShowDate(msg, prev);
              const grouped = isGrouped(msg, prev);

              return (
                <React.Fragment key={msg._id}>
                  {showDate && (
                    <div className="message-date-divider">
                      <span>{formatDate(msg.createdAt)}</span>
                    </div>
                  )}

                  {initialUnreadCount > 0 && idx === messages.length - initialUnreadCount && (
                    <div className="new-messages-marker" ref={unreadRef}>
                      <div className="new-messages-line" />
                      <span>Новые сообщения</span>
                      <div className="new-messages-line" />
                    </div>
                  )}

                  {msg.type === 'missed-call' ? (
                    <div className="message system-message missed-call">
                      <div className="system-message-icon">
                        <PhoneIcon color="#ff4d4d" />
                      </div>
                      <div className="system-message-content" style={{ marginLeft: '15px' }}>
                        <div className="system-message-header">
                          <span className="message-author" onClick={(e) => onUserClick(msg.author._id, e)} style={{ cursor: 'pointer' }}>{msg.author.username}</span>
                          <span className="message-time">{formatDate(msg.createdAt)}</span>
                        </div>
                        <div className="system-message-text">Пропущенный звонок</div>
                      </div>
                    </div>
                  ) : (
                    <div id={`msg-${msg._id}`} className={`message ${grouped ? 'grouped' : 'with-author'} ${mentionHighlight && msg.mentions?.some(m => m._id === user?._id) ? 'mention-highlight' : ''} ${msg.replyTo ? 'has-reply' : ''}`}>
                      {msg.replyTo && (
                        <div className="message-reply-preview" onClick={() => scrollToMessage(msg.replyTo!._id)}>
                          <div className="reply-line" />
                          <ReplyIcon size={12} className="reply-icon-mini" />
                          <UserAvatar user={msg.replyTo.author} size={16} className="reply-avatar" />
                          <span className="reply-author">{msg.replyTo.author.username}</span>
                          <span className="reply-content">{msg.replyTo.content || (msg.replyTo.attachments?.length ? 'Вложение' : '')}</span>
                        </div>
                      )}
                      {!grouped && (
                        <div className="message-author-avatar-wrap">
                          <UserAvatar
                            user={msg.author}
                            size={40}
                            className="message-author-avatar"
                            onClick={(e) => onUserClick(msg.author._id, e)}
                          />
                        </div>
                      )}
                      {grouped && <div className="message-time-mini">{new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>}
                      <div className="message-content">
                        {!grouped && (
                          <div className="message-header">
                            <span className="message-author" onClick={(e) => onUserClick(msg.author._id, e)} style={{ cursor: 'pointer' }}>{msg.author.username}</span>
                            {msg.author.isBot && <span className="bot-badge">БOТ</span>}
                            <span className="message-time">{formatDate(msg.createdAt)}</span>
                            {showHoverActions && (
                              <div className="message-actions-hover">
                                <button
                                  className="msg-action-btn"
                                  onClick={() => handleTogglePin(msg._id)}
                                  title={msg.pinned ? "Открепить" : "Закрепить"}
                                >
                                  <PinIcon size={16} fill={msg.pinned ? "var(--primary-neon)" : "none"} color={msg.pinned ? "var(--primary-neon)" : "currentColor"} />
                                </button>
                                <button
                                  className="msg-action-btn"
                                  onClick={(e) => {
                                    setReplyToMessage(msg);
                                    inputRef.current?.focus();
                                  }}
                                  title="Ответить"
                                >
                                  <ReplyIcon size={16} />
                                </button>
                                <button
                                  className="msg-action-btn"
                                  onClick={(e) => setShowEmojiPicker({ x: e.clientX, y: e.clientY, msgId: msg._id })}
                                  title="Добавить реакцию"
                                >
                                  <SmileIcon size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {grouped && showHoverActions && (
                          <div className="message-actions-hover mini">
                            <button
                              className="msg-action-btn mini"
                              onClick={() => {
                                setReplyToMessage(msg);
                                inputRef.current?.focus();
                              }}
                              title="Ответить"
                            >
                              <ReplyIcon size={14} />
                            </button>
                            <button
                              className="msg-action-btn mini"
                              onClick={() => handleTogglePin(msg._id)}
                            >
                              <PinIcon size={14} fill={msg.pinned ? "var(--primary-neon)" : "none"} color={msg.pinned ? "var(--primary-neon)" : "currentColor"} />
                            </button>
                            <button
                              className="msg-action-btn mini"
                              onClick={(e) => setShowEmojiPicker({ x: e.clientX, y: e.clientY, msgId: msg._id })}
                            >
                              <SmileIcon size={14} />
                            </button>
                          </div>
                        )}
                        {msg.pinned && !grouped && <div className="pinned-indicator"><PinIcon size={12} fill="var(--primary-neon)" color="var(--primary-neon)" /> Закреплено</div>}

                        <div className="message-text">{renderMessageContent(msg.content, msg.mentions)}</div>

                        {msg.buttons && msg.buttons.length > 0 && (
                          <div className="message-interactive-buttons">
                            {msg.buttons.map((btn, idx) => (
                              <a key={idx} href={btn.url} target="_blank" rel="noopener noreferrer" className={`msg-button ${btn.style || 'primary'}`}>
                                {btn.label}
                              </a>
                            ))}
                          </div>
                        )}

                        <Reactions
                          reactions={msg.reactions || []}
                          currentUserId={user?._id || ''}
                          onReact={(emoji) => handleReact(msg._id, emoji)}
                        />

                        {displayEmbeds && msg.attachments && msg.attachments.length > 0 && (
                          <div className="message-attachments">
                            {msg.attachments.map((att, i) => (
                              <div key={i} className="attachment-item">
                                {att.type.startsWith('image/') ? (
                                  <div className="attachment-image-container">
                                    <img
                                      src={getFullUrl(att.url)!}
                                      alt=""
                                      className="attachment-image"
                                      onClick={() => {
                                        const allMedia = messages.flatMap(m => m.attachments || []).filter(a => a.type.startsWith('image/') || a.type.startsWith('video/'));
                                        setLightboxMedia(allMedia);
                                        setLightboxIndex(allMedia.findIndex(a => a.url === att.url));
                                        setLightboxOpen(true);
                                      }}
                                    />
                                    <button onClick={(e) => handleDownload(e, getFullUrl(att.url)!, att.filename)} className="attachment-download-btn" title="Скачать">
                                      <DownloadIcon size={16} />
                                    </button>
                                  </div>
                                ) : att.type.startsWith('video/') ? (
                                  <div className="attachment-video-wrapper">
                                    <CustomVideoPlayer src={getFullUrl(att.url)!} onExpand={(currentTime) => {
                                      const allMedia = messages.flatMap(m => m.attachments || []).filter(a => a.type.startsWith('image/') || a.type.startsWith('video/')).map(a => ({ ...a }));
                                      const idx = allMedia.findIndex(a => a.url === att.url);
                                      if (idx !== -1) (allMedia[idx] as any).startTime = currentTime;
                                      setLightboxMedia(allMedia);
                                      setLightboxIndex(idx);
                                      setLightboxOpen(true);
                                    }} />
                                    <button onClick={(e) => handleDownload(e, getFullUrl(att.url)!, att.filename)} className="attachment-download-btn video" title="Скачать">
                                      <DownloadIcon size={16} />
                                    </button>
                                  </div>
                                ) : (att.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(att.filename || '')) ? (
                                  <div className="attachment-audio-container">
                                    <CustomAudioPlayer src={getFullUrl(att.url)!} filename={att.filename} />
                                    <button onClick={(e) => handleDownload(e, getFullUrl(att.url)!, att.filename)} className="attachment-download-btn audio" title="Скачать">
                                      <DownloadIcon size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="attachment-file-container">
                                    <a href={getFullUrl(att.url)!} target="_blank" rel="noopener noreferrer" className="attachment-file">
                                      <DocumentIcon size={18} />
                                      <span>{att.filename}</span>
                                    </a>
                                    <button onClick={(e) => handleDownload(e, getFullUrl(att.url)!, att.filename)} className="attachment-download-btn file" title="Скачать">
                                      <DownloadIcon size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="message-input-container">
          {replyToMessage && (
            <div className="reply-input-preview">
              <div className="reply-input-content">
                <ReplyIcon size={16} color="var(--primary-neon)" />
                <div className="reply-input-text">
                  <span>Ответ пользователю <strong>{replyToMessage.author.username}</strong></span>
                  <div className="reply-input-snippet">{replyToMessage.content || (replyToMessage.attachments?.length ? 'Вложение' : '')}</div>
                </div>
              </div>
              <button className="cancel-reply-btn" onClick={() => setReplyToMessage(null)}>×</button>
            </div>
          )}
          {attachments.length > 0 && (
            <div className="attachments-preview">
              <div className="attachments-preview-list">
                {attachments.map((att, i) => (
                  <div key={i} className="input-attachment-preview">
                    {att.type.startsWith('image/') ? (
                      <img src={getFullUrl(att.url)!} alt="" />
                    ) : (
                      <div className="file-icon"><DocumentIcon size={24} /></div>
                    )}
                    <button type="button" className="remove-attachment-btn" onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="message-form">
            <button type="button" className="attachment-button" onClick={() => fileInputRef.current?.click()} title="Прикрепить файл">
              <PlusIcon />
            </button>
            <button type="button" className="attachment-button" onClick={(e) => setShowGifPicker(showGifPicker ? null : { x: e.clientX, y: e.clientY - 400 })} title="Отправить GIF">
              <div style={{ fontWeight: 800, fontSize: '10px', border: '2px solid currentColor', borderRadius: '4px', padding: '1px 3px', display: 'flex' }}>GIF</div>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} multiple />
            <div style={{ flex: 1, position: 'relative' }}>
              {showScrollBottom && (
                <button className="scroll-bottom-btn" onClick={scrollToBottom}>
                  <ArrowDownIcon size={20} />
                  <span>Новые сообщения</span>
                </button>
              )}
              {showMentions && (
                <MentionAutocomplete
                  query={mentionQuery}
                  items={friends}
                  onSelect={handleMentionSelect}
                  onClose={() => setShowMentions(false)}
                />
              )}
              <input
                ref={inputRef}
                type="text"
                placeholder={`Написать ${otherUser?.username}...`}
                value={message}
                onChange={handleTyping}
                onPaste={handlePaste}
                className="message-input"
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" className="send-button" disabled={!message.trim() && attachments.length === 0}>
              Отправить
            </button>
          </form>
        </div>
        <MediaLightbox isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} media={lightboxMedia} initialIndex={lightboxIndex} />
      </div >
      {showEmojiPicker && createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
          onClick={() => setShowEmojiPicker(null)}
        >
          <div
            style={{
              position: 'fixed',
              top: Math.min(showEmojiPicker.y, window.innerHeight - 420),
              left: Math.min(showEmojiPicker.x, window.innerWidth - 340),
              zIndex: 10000
            }}
            onClick={e => e.stopPropagation()}
          >
            <EmojiPicker
              onSelect={(emoji) => {
                handleReact(showEmojiPicker.msgId, emoji);
                setShowEmojiPicker(null);
              }}
            />
          </div>
        </div>,
        document.body
      )}
      {showGifPicker && createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
          onClick={() => setShowGifPicker(null)}
        >
          <div
            style={{
              position: 'fixed',
              top: Math.max(10, showGifPicker.y),
              left: Math.max(10, showGifPicker.x),
              zIndex: 10000
            }}
            onClick={e => e.stopPropagation()}
          >
            <GifPicker
              onSelect={handleGifSelect}
              onClose={() => setShowGifPicker(null)}
            />
          </div>
        </div>,
        document.body
      )}
    </div >
  );
};

export default DMView;
