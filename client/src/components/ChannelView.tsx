import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { Channel, Message, Server, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import axios from 'axios';
import { getAvatarUrl, getFullUrl } from '../utils/avatar';
import { HashtagIcon, DocumentIcon, PlusIcon, TrashIcon, DownloadIcon, PinIcon, ArrowDownIcon, ReplyIcon, CopyIcon, CameraIcon } from './Icons';
import './ChannelView.css';
import './Attachments.css';
import MemberContextMenu from './MemberContextMenu';
import CustomVideoPlayer from './CustomVideoPlayer';
import CustomAudioPlayer from './CustomAudioPlayer';
import MediaLightbox from './MediaLightbox';
import MentionAutocomplete from './MentionAutocomplete';
import { Role } from '../types';
import { computePermissions, hasPermission, Permissions } from '../utils/permissions';
import { useChatSettings } from '../contexts/ChatSettingsContext';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import Reactions from './Reactions';
import { createPortal } from 'react-dom';
import UserAvatar from './UserAvatar';
import StickyPins from './StickyPins';
import UserBadges from './UserBadges';
import AttachmentsModal from './AttachmentsModal';
import { SmileIcon } from './Icons';

// Helper for inline markdown shared across components
const renderInlineMarkdown = (
  text: string, 
  customConfirm: (msg: string, title?: string, confirmText?: string, cancelText?: string) => Promise<boolean>,
  openLink: (url: string) => void
) => {
  if (!text) return null;
  
  // Split by markdown patterns: **bold**, *italic*, __underline__, `code`
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|__.*?__|`.*?`|https?:\/\/[^\s]+)/g);
  
  return parts.map((part, i) => {
    if (!part) return null;
    
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <u key={i}>{part.slice(2, -2)}</u>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.match(/^https?:\/\//)) {
      return (
        <a
          key={i}
          href={part}
          className="message-link"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            customConfirm(
              `Вы собираетесь перейти на внешний ресурс: ${part}. Продолжить?`,
              'Внешняя ссылка',
              'Перейти',
              'Отмена'
            ).then((ok: boolean) => {
              if (ok) openLink(part);
            });
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

interface ChannelViewProps {
  channel: Channel;
  server: Server;
  messages: Message[];
  socket: Socket | null;
  onUserClick: (userId: string, event?: React.MouseEvent) => void;
  initialUnreadCount?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => Promise<void>;
  pinnedMessages?: Message[];
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  onBack?: () => void;
  onToggleMembers?: () => void;
  isMobile?: boolean;
}

const MessageItem = React.memo<{
  msg: Message;
  prev: Message | undefined;
  user: User | null;
  server: Server;
  displayEmbeds: boolean;
  showHoverActions: boolean;
  mentionHighlight: boolean;
  canPin: boolean;
  canReact: boolean;
  onUserClick: (userId: string, event?: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, user: User) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  formatDate: (d: string) => string;
  renderMessageContent: (c: string, m?: User[]) => any;
  handleDownload: (e: React.MouseEvent, url: string, filename: string) => void;
  setLightboxMedia: (m: any[]) => void;
  setLightboxIndex: (i: number) => void;
  setLightboxOpen: (o: boolean) => void;
  allMessages: Message[];
  onReact: (messageId: string, emoji: string) => void;
  onReply: (msg: Message) => void;
  scrollToMessage: (msgId: string) => void;
  onInteractiveButtonClick: (messageId: string, actionId: string) => void;
}>(({
  msg, prev, user, server, displayEmbeds, showHoverActions, mentionHighlight, canPin, canReact,
  onUserClick, onContextMenu, onTogglePin, onDelete, formatDate, renderMessageContent,
  handleDownload, setLightboxMedia, setLightboxIndex, setLightboxOpen, allMessages,
  onReact, onReply, scrollToMessage, onInteractiveButtonClick
}) => {
  const { confirm: customConfirm } = useDialog();

  const openLink = (url: string) => {
    if ((window as any).electron?.util?.openExternal) {
      (window as any).electron.util.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderEmbed = (embed: any, key: number) => {
    return (
      <div key={key} className="message-embed" style={{ borderLeftColor: embed.color || 'var(--primary-neon)' }}>
        <div className="embed-content-wrap">
          {embed.author && (
            <div className="embed-author">
              {embed.author.icon_url && (
                <img 
                  src={embed.author.icon_url} 
                  className="embed-author-icon" 
                  alt="" 
                  onError={(e) => (e.target as any).style.display = 'none'} 
                />
              )}
              {embed.author.url ? (
                <a
                  href={embed.author.url}
                  className="embed-author-name"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    customConfirm(
                      `Вы собираетесь перейти на внешний ресурс: ${embed.author.url}. Продолжить?`,
                      'Внешняя ссылка',
                      'Перейти',
                      'Отмена'
                    ).then((ok: boolean) => {
                      if (ok) openLink(embed.author.url);
                    });
                  }}
                >{renderInlineMarkdown(embed.author.name, customConfirm, openLink)}</a>
              ) : (
                <span className="embed-author-name">{renderInlineMarkdown(embed.author.name, customConfirm, openLink)}</span>
              )}
            </div>
          )}

          {embed.title && (
            embed.url ? (
              <a
                href={embed.url}
                className="embed-title"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  customConfirm(
                    `Вы собираетесь перейти на внешний ресурс: ${embed.url}. Продолжить?`,
                    'Внешняя ссылка',
                    'Перейти',
                    'Отмена'
                  ).then((ok: boolean) => {
                    if (ok) openLink(embed.url);
                  });
                }}
              >{renderInlineMarkdown(embed.title, customConfirm, openLink)}</a>
            ) : (
              <div className="embed-title">{renderInlineMarkdown(embed.title, customConfirm, openLink)}</div>
            )
          )}

          {embed.description && <div className="embed-description">{renderInlineMarkdown(embed.description, customConfirm, openLink)}</div>}

          {embed.fields && embed.fields.length > 0 && (
            <div className="embed-fields">
              {embed.fields.map((f: any, i: number) => (
                <div key={i} className="embed-field" style={{ gridColumn: f.inline ? 'auto' : '1 / -1' }}>
                  <div className="embed-field-name">{f.name}</div>
                  <div className="embed-field-value">{renderInlineMarkdown(f.value, customConfirm, openLink)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar special for music bot */}
          {(embed.footer?.text?.includes(' - ') || embed.footer?.text?.includes('00:00') || embed.footer?.text?.includes(' • ')) && (
             <div className="embed-progress-bar">
                <div className="progress-track-wrap">
                   <span>{(() => {
                      const parts = embed.footer?.text?.split(' • ');
                      if (parts.length > 1) {
                         const timeMatch = parts[1].match(/(\d+):(\d+)\s-\s(\d+):(\d+)/);
                         return timeMatch ? timeMatch[1] + ':' + timeMatch[2] : '0:00';
                      }
                      return '0:00';
                   })()}</span>
                   <div className="progress-track">
                      <div className="progress-fill" style={{ width: (() => {
                         const match = (embed.footer?.text || '').match(/(\d+):(\d+)\s-\s(\d+):(\d+)/);
                         if (!match) return '0%';
                         const cur = parseInt(match[1]) * 60 + parseInt(match[2]);
                         const total = parseInt(match[3]) * 60 + parseInt(match[4]);
                         return total > 0 ? `${Math.min(100, (cur / total) * 100)}%` : '0%';
                      })() }} />
                   </div>
                   <span>{(() => {
                      const match = (embed.footer?.text || '').match(/(\d+):(\d+)\s-\s(\d+):(\d+)/);
                      return match ? match[3] + ':' + match[4] : '';
                   })()}</span>
                </div>
             </div>
          )}

          {embed.image && embed.image.url && (
            <img 
              src={embed.image.url} 
              className="embed-image" 
              alt="" 
              onError={(e) => (e.target as any).style.display = 'none'}
              onClick={() => {
                setLightboxMedia([{ url: embed.image.url, type: 'image/png' }]);
                setLightboxIndex(0);
                setLightboxOpen(true);
              }} 
            />
          )}

          {embed.footer && (
            <div className="embed-footer">
              {embed.footer.icon_url && <img src={embed.footer.icon_url} className="embed-footer-icon" alt="" />}
              <span className="embed-footer-text">{embed.footer.text}</span>
            </div>
          )}
        </div>
        {embed.thumbnail && embed.thumbnail.url && (
          <img src={embed.thumbnail.url} className="embed-thumbnail" alt="" />
        )}
      </div>
    );
  };


  const renderButtons = () => {
    if (!msg.buttons || msg.buttons.length === 0) return null;

    // Group buttons by row
    const rows: { [key: number]: any[] } = {};
    msg.buttons.forEach(btn => {
      const r = btn.row || 0;
      if (!rows[r]) rows[r] = [];
      rows[r].push(btn);
    });

    const rowKeys = Object.keys(rows).map(Number).sort((a, b) => a - b);

    return (
      <div className="message-interactive-buttons">
        {rowKeys.map(rk => (
          <div key={rk} className="button-row">
            {rows[rk].map((btn, i) => (
              btn.actionId ? (
                <button
                  key={i}
                  onClick={() => onInteractiveButtonClick(msg._id, btn.actionId!)}
                  className={`msg-button ${btn.style || 'primary'}`}
                >
                  {btn.label}
                </button>
              ) : (
                <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer" className={`msg-button ${btn.style || 'primary'}`}>
                  {btn.label}
                </a>
              )
            ))}
          </div>
        ))}
      </div>
    );
  };
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ x: number, y: number, msgId: string } | null>(null);

  useEffect(() => {
  }, []);

  const shouldShowDate = (current: Message, previous: Message | undefined) => {
    if (!previous) return true;
    return new Date(current.createdAt).getDate() !== new Date(previous.createdAt).getDate();
  };

  const isGrouped = (current: Message, previous: Message | undefined) => {
    if (!previous) return false;
    if (current.author._id !== previous.author._id) return false;
    if (shouldShowDate(current, previous)) return false;
    const timeDiff = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
    return timeDiff < 5 * 60 * 1000;
  };

  const showDate = shouldShowDate(msg, prev);
  const grouped = isGrouped(msg, prev);

  const member = useMemo(() =>
    server.members.find(m => String((m.user as any)._id || m.user) === String(msg.author._id)),
    [server.members, msg.author._id]
  );

  return (
    <>
      {showDate && <div className="message-date-divider"><span>{formatDate(msg.createdAt)}</span></div>}
      <div id={`msg-${msg._id}`} className={`message ${grouped ? 'grouped' : 'with-author'} ${mentionHighlight && msg.mentions?.some(m => m._id === user?._id) ? 'mention-highlight' : ''} ${msg.replyTo ? 'has-reply' : ''}`}>
        {msg.replyTo && (
          <div className="message-reply-preview" onClick={() => scrollToMessage(msg.replyTo!._id)}>
            <div className="reply-line" />
            <ReplyIcon size={12} className="reply-icon-mini" />
            <UserAvatar user={msg.replyTo.author} size={16} className="reply-avatar" />
            <span className="reply-author">{msg.replyTo.author.username}</span>
            <UserBadges badges={msg.replyTo.author.badges} size={10} />
            <span className="reply-content">{msg.replyTo.content || (msg.replyTo.attachments?.length ? 'Вложение' : '')}</span>
          </div>
        )}
        {!grouped && (
          <div className="message-author-avatar-wrap">
            <UserAvatar
              user={msg.author}
              size={42}
              className="message-author-avatar"
              onClick={(e) => onUserClick(msg.author._id, e)}
              onContextMenu={(e) => onContextMenu(e, msg.author)}
            />
          </div>
        )}
        {grouped && <div className="message-time-mini">{new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>}

        <div className="message-content">
          <div className="message-header">
            {!grouped && (
              <div className="message-author-info">
                <span
                  className="message-author"
                  onClick={(e) => onUserClick(msg.author._id, e)}
                  onContextMenu={(e) => onContextMenu(e, msg.author)}
                  style={{
                    cursor: 'pointer',
                    color: (() => {
                      if (!member) return 'inherit';
                      const roleIds = member.roles || [];
                      const roles = (server.roles || []).filter(r => roleIds.includes(r._id));
                      roles.sort((a, b) => (b.position || 0) - (a.position || 0));
                      const colorRole = roles.find(r => r.color && r.color !== '#99AAB5' && r.color !== '#99aab5');
                      return colorRole ? colorRole.color : 'inherit';
                    })()
                  }}
                >
                  {member?.nickname || msg.author.username}
                </span>
                <UserBadges badges={msg.author.badges} size={14} />
                {msg.author.isBot && <span className="bot-badge">БOТ</span>}
                <span className="message-time">{formatDate(msg.createdAt)}</span>
              </div>
            )}

            {showHoverActions && (
              <div className={`message-actions-hover ${grouped ? 'mini' : ''}`}>
                {canPin && (
                  <button
                    className={`msg-action-btn ${grouped ? 'mini' : ''}`}
                    onClick={() => onTogglePin(msg._id)}
                    title={msg.pinned ? "Открепить" : "Закрепить"}
                  >
                    <PinIcon size={grouped ? 14 : 16} fill={msg.pinned ? "var(--primary-neon)" : "none"} color={msg.pinned ? "var(--primary-neon)" : "currentColor"} />
                  </button>
                )}
                {canReact && (
                  <button
                    className={`msg-action-btn ${grouped ? 'mini' : ''}`}
                    onClick={(e) => setShowEmojiPicker({ x: e.clientX, y: e.clientY, msgId: msg._id })}
                    title="Добавить реакцию"
                  >
                    <SmileIcon size={grouped ? 14 : 16} />
                  </button>
                )}
                <button
                  className={`msg-action-btn ${grouped ? 'mini' : ''}`}
                  onClick={() => onReply(msg)}
                  title="Ответить"
                >
                  <ReplyIcon size={grouped ? 14 : 16} />
                </button>
                <button
                  className={`msg-action-btn ${grouped ? 'mini' : ''}`}
                  onClick={() => {
                    const text = msg.content;
                    if ((window as any).electron?.clipboard) {
                      (window as any).electron.clipboard.writeText(text);
                    } else {
                      navigator.clipboard.writeText(text).catch(err => {
                        console.error('Failed to copy: ', err);
                      });
                    }
                  }}
                  title="Копировать текст"
                >
                  <CopyIcon size={grouped ? 14 : 16} />
                </button>
                {(msg.author._id === user?._id || (typeof server.owner === 'object' ? (server.owner as any)._id : server.owner) === user?._id) && (
                  <button className={`msg-action-btn danger ${grouped ? 'mini' : ''}`} onClick={() => onDelete(msg._id)}>
                    <TrashIcon size={grouped ? 14 : 16} />
                  </button>
                )}
              </div>
            )}
          </div>

          {msg.pinned && !grouped && <div className="pinned-indicator"><PinIcon size={12} fill="var(--primary-neon)" color="var(--primary-neon)" /> Закреплено</div>}

          <div className="message-text">{renderMessageContent(msg.content, msg.mentions)}</div>

          {displayEmbeds && msg.attachments && msg.attachments.length > 0 && (
            <div className="message-attachments">
              {msg.attachments.map((att, i) => (
                <div key={i} className="attachment-item">
                  {att.type.startsWith('image/') ? (
                    <div className="attachment-image-container">
                      <img src={getFullUrl(att.url)!} alt="" className="attachment-image" onClick={() => {
                        const allMedia = allMessages.flatMap((m: any) => m.attachments || []).filter((a: any) => a.type.startsWith('image/') || a.type.startsWith('video/'));
                        setLightboxMedia(allMedia);
                        setLightboxIndex(allMedia.findIndex((a: any) => a.url === att.url));
                        setLightboxOpen(true);
                      }} />
                      <button onClick={(e) => handleDownload(e, getFullUrl(att.url)!, att.filename)} className="attachment-download-btn" title="Скачать">
                        <DownloadIcon size={16} />
                      </button>
                    </div>
                  ) : att.type.startsWith('video/') ? (
                    <div className="attachment-video-wrapper" style={{ width: '100%', maxWidth: '500px' }}>
                      <CustomVideoPlayer src={getFullUrl(att.url)!} onExpand={(currentTime) => {
                        const allMedia = allMessages.flatMap((m: any) => m.attachments || []).filter((a: any) => a.type.startsWith('image/') || a.type.startsWith('video/')).map((a: any) => ({ ...a }));
                        const idx = allMedia.findIndex((a: any) => a.url === att.url);
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
                        <DocumentIcon size={18} /><span>{att.filename}</span>
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

          {displayEmbeds && msg.embeds && msg.embeds.length > 0 && (
            <div className="message-embeds">
              {msg.embeds.map((emb, i) => renderEmbed(emb, i))}
            </div>
          )}

          {renderButtons()}

          {msg.edited && <span className="message-edited">(изменено)</span>}

          <Reactions
            reactions={msg.reactions || []}
            currentUserId={user?._id || ''}
            onReact={(emoji) => onReact(msg._id, emoji)}
          />
        </div>
      </div>

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
              server={server}
              onSelect={(emoji) => {
                onReact(msg._id, emoji);
                setShowEmojiPicker(null);
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

const ChannelView: React.FC<ChannelViewProps> = ({
  channel, server, messages, socket, onUserClick, initialUnreadCount = 0,
  hasMore = false, isLoadingMore = false, onLoadMore, pinnedMessages = [], setMessages,
  onBack, onToggleMembers, isMobile
}) => {
  const { user } = useAuth();
  const { confirm: customConfirm, alert } = useDialog();

  const openLink = (url: string) => {
    if ((window as any).electron?.util?.openExternal) {
      (window as any).electron.util.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  const {
    displayEmbeds,
    showHoverActions,
    mentionHighlight,
    autocompleteEmoji,
    enableTTS
  } = useChatSettings();
  const [message, setMessage] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState<{ x: number, y: number } | null>(null);

  const userPermissions = useMemo(() => {
    if (!user) return 0n;
    return computePermissions(user._id, server, channel);
  }, [user, server, channel]);

  const canPin = hasPermission(userPermissions, Permissions.PIN_MESSAGES);
  const canReact = hasPermission(userPermissions, Permissions.ADD_REACTIONS);
  const canMentionEveryone = hasPermission(userPermissions, Permissions.MENTION_EVERYONE);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, user: User } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMedia, setLightboxMedia] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToNew, setHasScrolledToNew] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPins, setShowPins] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const lastScrollTopRef = useRef(0);

  const handleContextMenu = (e: React.MouseEvent, user: User) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, user });
  };

  const handleMention = (username: string) => {
    setMessage((prev) => `${prev}@${username} `);
  };

  useEffect(() => {
    setHasScrolledToNew(false);
  }, [channel._id]);

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
  }, [messages.length, initialUnreadCount, hasScrolledToNew, channel._id]);

  useEffect(() => {
    // New messages - smooth scroll only if already near bottom
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

    // Check for "scroll to bottom" button visibility
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollBottom(!isAtBottom);

    // Load more when reaching top
    if (container.scrollTop < 50 && hasMore && !isLoadingMore && onLoadMore) {
      const oldScrollHeight = container.scrollHeight;
      await onLoadMore();
      // Restore scroll position after loading
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

  useEffect(() => {
    if (!socket) return;
    const handleTyping = (data: { userId: string; channelId: string }) => {
      if (data.channelId === channel._id && data.userId !== user?._id) {
        setTypingUsers((prev) => new Set(prev).add(data.userId));
      }
    };
    const handleStoppedTyping = (data: { userId: string; channelId: string }) => {
      if (data.channelId === channel._id) {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
      }
    };
    socket.on('user-typing', handleTyping);
    socket.on('user-stopped-typing', handleStoppedTyping);

    const handleMessageUpdated = (updatedMsg: Message) => {
      if (setMessages) {
        setMessages(prev => prev.map(m => m._id === updatedMsg._id ? updatedMsg : m));
      }
    };
    socket.on('message-updated', handleMessageUpdated);

    const handleReactionsUpdate = (data: { messageId: string, reactions: any[] }) => {
      if (setMessages) {
        setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
      }
    };
    socket.on('message-reactions-update', handleReactionsUpdate);

    return () => {
      socket.off('user-typing', handleTyping);
      socket.off('user-stopped-typing', handleStoppedTyping);
      socket.off('message-updated', handleMessageUpdated);
      socket.off('message-reactions-update', handleReactionsUpdate);
    };
  }, [socket, channel._id, user?._id, setMessages]);

  const handleReact = (messageId: string, emoji: string) => {
    axios.post(`/api/messages/${messageId}/reactions`, { emoji });
  };

  const [attachments, setAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && attachments.length === 0) || !socket) return;
    socket.emit('send-message', {
      content: message.trim(),
      channelId: channel._id,
      attachments,
      replyToId: replyToMessage?._id
    });
    setMessage('');
    setAttachments([]);
    setReplyToMessage(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing-stop', { channelId: channel._id });
  };

  const handleGifSelect = (url: string) => {
    if (!socket) return;
    const attachment = { url, filename: 'tenor.gif', type: 'image/gif', size: 0 };
    socket.emit('send-message', {
      content: '',
      channelId: channel._id,
      attachments: [attachment],
      replyToId: replyToMessage?._id
    });
    setShowGifPicker(null);
    setReplyToMessage(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing-stop', { channelId: channel._id });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const formData = new FormData();
      for (let i = 0; i < e.target.files.length; i++) formData.append('files', e.target.files[i]);
      try {
        const response = await axios.post('/api/upload-files', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setAttachments(prev => [...prev, ...response.data]);
      } catch (error) {
        await alert('Ошибка загрузки файла');
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      // Allow default paste if it's just text, prevent default if it's a file to avoid text pasting of filename
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

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSignIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtSignIndex !== -1 && autocompleteEmoji) {
      const query = textBeforeCursor.substring(lastAtSignIndex + 1);
      // Valid query: no spaces between @ and cursor
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
    socket.emit('typing-start', { channelId: channel._id });
    typingTimeoutRef.current = setTimeout(() => { socket.emit('typing-stop', { channelId: channel._id }); }, 3000);
  };

  const handleMentionSelect = (item: User | Role) => {
    const isUser = 'username' in item;
    const name = isUser ? item.username : item.name;
    const before = message.substring(0, mentionStartIndex);

    // Find where the mention query ends (at cursor or next space)
    const after = message.substring(mentionStartIndex + mentionQuery.length + 1);

    const newMessage = `${before}@${name} ${after}`;
    setMessage(newMessage);
    setShowMentions(false);

    // Return focus to input
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const renderMessageContent = (content: string, mentions: User[] = []) => {
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
            const role = server.roles?.find(r => r.name === name);
            const isSpecialMention = name === 'everyone' || name === 'here';

            if (isUserMention || role || isSpecialMention) {
              const userMention = mentions.find(m => m.username === name);
              const color = role ? role.color : (isSpecialMention ? 'var(--primary-neon)' : 'inherit');

              return (
                <span
                  key={`mention-${i}`}
                  className={`mention-tag ${role ? 'role-mention' : (isSpecialMention ? 'special-mention' : 'user-mention')}`}
                  style={color !== 'inherit' ? { color: color } : {}}
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

          return (
            <span key={`text-${i}`} style={{ whiteSpace: 'pre-wrap' }}>
              {renderInlineMarkdown(part, customConfirm, openLink)}
            </span>
          );
        })}
      </>
    );
  };


  const removeAttachment = (index: number) => setAttachments(prev => prev.filter((_, i) => i !== index));

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

  const handleDeleteMessage = async (messageId: string) => {
    if (await customConfirm('Удалить это сообщение?')) {
      socket?.emit('delete-message', { messageId, channelId: channel._id });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
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

  return (
    <div
      className={`channel-view ${isDragging ? 'dragging' : ''}`}
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
      <div className="channel-header">
        {isMobile && onBack && (
          <button className="mobile-close-btn" onClick={onBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
        )}
        <div className="channel-header-info" onClick={() => setShowAttachments(true)} style={{ cursor: 'pointer' }}>
          <span className="channel-icon"><HashtagIcon size={24} color="#8e9297" /></span>
          <h3>{channel.name}</h3>
        </div>
        {channel.topic && !isMobile && <div className="channel-topic">{channel.topic}</div>}
        <div style={{ flex: 1 }} />
        {isMobile && onToggleMembers && (
          <button className="header-action-btn" onClick={onToggleMembers} title="Участники">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </button>
        )}
        <button
          className="header-action-btn"
          onClick={() => setShowPins(!showPins)}
          title="Закрепленные сообщения"
        >
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
                      <UserBadges badges={msg.author.badges} size={12} />
                      <span className="pin-date">{formatDate(msg.createdAt)}</span>
                    </div>
                    <div className="pin-content">
                      {msg.content}
                      {msg.attachments?.some(a => a.type?.startsWith('image/') || a.type?.startsWith('video/')) && (
                        <div className="pin-media-preview" style={{ marginTop: '8px', display: 'flex', gap: '5px', overflowX: 'auto' }}>
                          {msg.attachments.filter(a => a.type?.startsWith('image/') || a.type?.startsWith('video/')).map((a, i) => (
                            <div key={i} className="pin-media-item" style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--glass-border)' }}>
                              {a.type?.startsWith('image/') ? (
                                <img 
                                  src={getFullUrl(a.url)!} 
                                  alt="" 
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                  onClick={() => {
                                    setLightboxMedia(msg.attachments!.filter(att => att.type?.startsWith('image/') || att.type?.startsWith('video/')).map(att => ({ 
                                      url: getFullUrl(att.url)!, 
                                      type: att.type?.startsWith('video/') ? 'video' : 'image', 
                                      filename: att.filename 
                                    })));
                                    setLightboxIndex(i);
                                    setLightboxOpen(true);
                                  }}
                                />
                              ) : (
                                <div className="pin-video-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                                  <CameraIcon size={20} color="var(--primary-neon)" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
          {messages.map((msg, index) => (
            <React.Fragment key={msg._id}>
              {initialUnreadCount > 0 && index === messages.length - initialUnreadCount && (
                <div className="new-messages-marker" ref={unreadRef}>
                  <div className="new-messages-line" />
                  <span>Новые сообщения</span>
                  <div className="new-messages-line" />
                </div>
              )}
              <MessageItem
                msg={msg}
                prev={messages[index - 1]}
                user={user}
                server={server}
                displayEmbeds={displayEmbeds}
                showHoverActions={showHoverActions}
                mentionHighlight={mentionHighlight}
                canPin={canPin}
                canReact={canReact}
                onUserClick={onUserClick}
                onContextMenu={handleContextMenu}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteMessage}
                formatDate={formatDate}
                renderMessageContent={renderMessageContent}
                handleDownload={handleDownload}
                setLightboxMedia={setLightboxMedia}
                setLightboxIndex={setLightboxIndex}
                setLightboxOpen={setLightboxOpen}
                allMessages={messages}
                onReact={handleReact}
                onReply={(m) => {
                  setReplyToMessage(m);
                  inputRef.current?.focus();
                }}
                scrollToMessage={scrollToMessage}
                onInteractiveButtonClick={(messageId, actionId) => socket?.emit('interactive-button-click', { messageId, actionId, channelId: channel._id })}
              />
            </React.Fragment>
          ))}
          {(() => {
            const typingNames = Array.from(typingUsers)
              .map(id => server.members.find(m => String((m.user as any)._id || m.user) === id))
              .filter(Boolean)
              .map(m => m?.nickname || (m?.user as any)?.username)
              .filter(Boolean);

            if (typingNames.length === 0) return null;

            return (
              <div className="typing-indicator-new">
                <div className="typing-dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
                <span className="typing-text">
                  {typingNames.length === 1 ? (
                    <><strong>{typingNames[0]}</strong> печатает...</>
                  ) : typingNames.length === 2 ? (
                    <><strong>{typingNames[0]}</strong> и <strong>{typingNames[1]}</strong> печатают...</>
                  ) : (
                    <><strong>Несколько человек</strong> печатают...</>
                  )}
                </span>
              </div>
            );
          })()}
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
                <UserBadges badges={replyToMessage.author.badges} size={12} />
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
                  {att.type.startsWith('image/') ? <img src={getFullUrl(att.url)!} alt="" /> : <div className="file-icon"><DocumentIcon size={24} /></div>}
                  <button type="button" className="remove-attachment-btn" onClick={() => removeAttachment(i)}>×</button>
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
                items={[
                  ...server.members.map(m => m.user),
                  ...(server.roles || []).filter(r => canMentionEveryone || r.mentionable),
                  ...(canMentionEveryone ? [
                    { _id: 'everyone', name: 'everyone', color: 'var(--primary-neon)' } as any,
                    { _id: 'here', name: 'here', color: 'var(--primary-neon)' } as any
                  ] : [])
                ]}
                onSelect={handleMentionSelect}
                onClose={() => setShowMentions(false)}
              />
            )}
            <input
              ref={inputRef}
              type="text"
              placeholder={`Написать в #${channel.name}`}
              value={message}
              onChange={handleTyping}
              onPaste={handlePaste}
              className="message-input"
              style={{ width: '100%' }}
            />
          </div>
          <button type="submit" className="send-button" disabled={!message.trim() && attachments.length === 0}>Отправить</button>
        </form>
      </div>
      {contextMenu && (
        <MemberContextMenu user={contextMenu.user} server={server} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} onMention={handleMention} onOpenProfile={onUserClick} />
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
      <MediaLightbox isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} media={lightboxMedia} initialIndex={lightboxIndex} />
      {createPortal(
        <AttachmentsModal 
          isOpen={showAttachments} 
          onClose={() => setShowAttachments(false)} 
          channelId={channel._id} 
          title={`#${channel.name}`} 
        />,
        document.body
      )}
    </div>
  );
};

export default ChannelView;
