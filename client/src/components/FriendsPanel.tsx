import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Friendship } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import { useSocket } from '../contexts/SocketContext';
import { ChatIcon, CloseIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import UserAvatar from './UserAvatar';
import UserBadges from './UserBadges';
import ActiveContacts from './ActiveContacts';
import './FriendsPanel.css';

interface FriendsPanelProps {
  friends: User[];
  setFriends: React.Dispatch<React.SetStateAction<User[]>>;
  onStartDM: (userId: string) => void;
  onUserClick: (userId: string, event?: React.MouseEvent) => void;
  unreadCounts: Record<string, number>;
  onBack?: () => void;
  isMobile?: boolean;
}

interface DMDict { [userId: string]: string; }

const FriendsPanel: React.FC<FriendsPanelProps> = ({ friends, setFriends, onStartDM, onUserClick, unreadCounts, onBack, isMobile }) => {
  const { socket } = useSocket();
  const { user: currentUser } = useAuth();
  const { confirm } = useDialog();
  const [userDMs, setUserDMs] = useState<DMDict>({});
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'add'>('friends');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [panelMessage, setPanelMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (activeTab === 'friends') { fetchFriends(); fetchDMs(); }
    else if (activeTab === 'pending') fetchPendingRequests();
    setPanelMessage(null);
  }, [activeTab]);

  const fetchDMs = async () => {
    if (!currentUser) return;
    try {
      const res = await axios.get('/api/direct-messages');
      const dict: DMDict = {};
      res.data.forEach((dm: any) => {
        const other = dm.participants.find((p: any) => p._id !== currentUser._id);
        if (other) dict[other._id] = dm._id;
      });
      setUserDMs(dict);
    } catch (e) { }
  };

  useEffect(() => {
    if (!socket) return;
    const handleFriendRequest = () => { if (activeTab === 'pending') fetchPendingRequests(); };
    const handleFriendshipAccepted = () => { fetchFriends(); if (activeTab === 'pending') fetchPendingRequests(); };
    socket.on('friend-request', handleFriendRequest);
    socket.on('friend-request-accepted', handleFriendshipAccepted);
    return () => { socket.off('friend-request', handleFriendRequest); socket.off('friend-request-accepted', handleFriendshipAccepted); };
  }, [socket, activeTab]);

  const showMessage = (text: string, type: 'success' | 'error') => { setPanelMessage({ text, type }); setTimeout(() => setPanelMessage(null), 3000); };
  const fetchFriends = async () => { try { setFriends((await axios.get('/api/friends')).data); } catch (e) { } };
  const fetchPendingRequests = async () => { try { setPendingRequests((await axios.get('/api/friends/pending')).data); } catch (e) { } };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 2) { try { setSearchResults((await axios.get(`/api/friends/search?query=${encodeURIComponent(query)}`)).data); } catch (e) { } }
    else setSearchResults([]);
  };

  const sendFriendRequest = async (userId: string) => {
    if (loadingAction) return;
    setLoadingAction(userId);
    try { await axios.post('/api/friends/request', { userId }); await handleSearch(searchQuery); showMessage('Запрос отправлен', 'success'); }
    catch (e: any) { showMessage(e.response?.data?.message || 'Ошибка', 'error'); }
    finally { setLoadingAction(null); }
  };

  const acceptRequest = async (id: string) => {
    if (loadingAction) return;
    setLoadingAction(id);
    try { await axios.post(`/api/friends/accept/${id}`); await fetchPendingRequests(); await fetchFriends(); showMessage('Заявка принята', 'success'); }
    catch (e) { showMessage('Ошибка', 'error'); }
    finally { setLoadingAction(null); }
  };

  const removeFriend = async (id: string) => {
    if (!(await confirm('Вы уверены?'))) return;
    try { await axios.delete(`/api/friends/${id}`); await fetchFriends(); await fetchPendingRequests(); showMessage('Выполнено', 'success'); }
    catch (e) { showMessage('Ошибка', 'error'); }
  };

  return (
    <div className="friends-panel">
      <div className="friends-main-container">
        <div className="friends-left-section">
          {isMobile && (
            <div className="friends-mobile-header">
              <button className="back-button" onClick={onBack} title="Назад в меню">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>
              <h3>Друзья</h3>
            </div>
          )}
          <div className="friends-tabs">
            <button className={activeTab === 'friends' ? 'active' : ''} onClick={() => setActiveTab('friends')}>Друзья</button>
            <button className={activeTab === 'pending' ? 'active' : ''} onClick={() => setActiveTab('pending')}>Запросы</button>
            <button className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>Добавить</button>
          </div>
          <div className="friends-content custom-scrollbar">
            {activeTab === 'friends' && (
              <div className="friends-list">
                {friends.length === 0 ? <div className="empty-state">У вас пока нет друзей</div> : friends.map(f => (
                  <div key={f._id} className="friend-item">
                    <div className="friend-avatar-wrap">
                      <UserAvatar
                        user={f}
                        size={38}
                        className="friend-avatar"
                        onClick={(e) => onUserClick(f._id, e)}
                      />
                      <div className={`status-indicator ${f.status}`}></div>
                    </div>
                    <div className="friend-info" onClick={(e) => onUserClick(f._id, e)} style={{ cursor: 'pointer' }}>
                      <div className="friend-name">
                        {f.username}
                        <UserBadges badges={f.badges} size={14} />
                        {userDMs[f._id] && unreadCounts[userDMs[f._id]] > 0 && <span className="unread-count-badge">{unreadCounts[userDMs[f._id]]}</span>}
                      </div>
                      <div className="friend-status">{f.activity ? <span className="activity-status">Играет в {f.activity.name}</span> : f.status}</div>
                    </div>
                    <div className="friend-actions">
                      <button className="test-action-btn" onClick={() => onStartDM(f._id)} title="Написать сообщение">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      </button>
                      <button className="test-action-btn remove" onClick={() => removeFriend((f as any).friendshipId)} title="Удалить из друзей">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'pending' && (
              <div className="pending-requests">
                {pendingRequests.length === 0 ? <div className="empty-state">Нет входящих запросов</div> : pendingRequests.map(r => (
                  <div key={r._id} className="request-item">
                    <UserAvatar
                      user={r.requester}
                      size={38}
                      className="request-avatar"
                      onClick={(e) => onUserClick(r.requester._id, e)}
                    />
                    <div className="request-info" onClick={(e) => onUserClick(r.requester._id, e)} style={{ cursor: 'pointer' }}>
                      <div className="request-name">
                        {r.requester.username}
                        <UserBadges badges={r.requester.badges} size={14} />
                      </div>
                      <div className="request-text">хочет добавить вас в друзья</div>
                    </div>
                    <div className="request-actions"><button className="accept-button" onClick={() => acceptRequest(r._id)}>Принять</button><button className="reject-button" onClick={() => removeFriend(r._id)}>Отклонить</button></div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'add' && (
              <div className="add-friend">
                <input type="text" placeholder="Поиск пользователей..." value={searchQuery} onChange={e => handleSearch(e.target.value)} className="search-input" autoFocus />
                {panelMessage && <div className={`panel-message ${panelMessage.type}`}>{panelMessage.text}</div>}
                <div className="search-results">
                  {searchResults.map(u => (
                    <div key={u._id} className="search-result-item">
                      <UserAvatar
                        user={u}
                        size={40}
                        className="result-avatar"
                        onClick={(e) => onUserClick(u._id, e)}
                      />
                      <div className="result-info" onClick={(e) => onUserClick(u._id, e)} style={{ cursor: 'pointer' }}>
                        <div className="result-name">
                          {u.username}
                          <UserBadges badges={u.badges} size={14} />
                        </div>
                        <div className="result-email">{u.email}</div>
                      </div>
                      <button className="add-button" onClick={() => sendFriendRequest(u._id)} disabled={!!loadingAction}>{loadingAction === u._id ? '...' : 'Добавить'}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {!isMobile && (
          <ActiveContacts 
            friends={currentUser ? [...friends, currentUser] : friends} 
            onUserClick={onUserClick} 
          />
        )}
      </div>
    </div>
  );
};

export default FriendsPanel;
