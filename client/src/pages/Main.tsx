import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useVoice } from '../contexts/VoiceContext';
import axios from 'axios';
import { Server, Channel, Message, DirectMessage, User } from '../types';
import Sidebar from '../components/Sidebar';
import ServerSidebar from '../components/ServerSidebar';
import ChannelView from '../components/ChannelView';
import VoiceChannelView from '../components/VoiceChannelView';
import ActiveVoiceOverlay from '../components/ActiveVoiceOverlay';
import FriendsPanel from '../components/FriendsPanel';
import DMView from '../components/DMView';
import DMSidebar from '../components/DMSidebar';
import VoiceCall from '../components/VoiceCall';
import UserProfileCard from '../components/UserProfileCard';
import ServerSettingsModal from '../components/ServerSettingsModal';
import ServerProfileCard from '../components/ServerProfileCard';
import UserServerProfileModal from '../components/UserServerProfileModal';
import ServerMembers from '../components/ServerMembers';
import { SOUNDS, soundManager } from '../utils/sounds';
import { useNotifications } from '../contexts/NotificationContext';
import { useInbox } from '../contexts/InboxContext';
import JoinServerModal from '../components/JoinServerModal';
import SettingsModal from '../components/SettingsModal';
import Inbox from '../components/Inbox';
import CreateGroupDMModal from '../components/CreateGroupDMModal';
import './Main.css';

const Main: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const { socket } = useSocket();
  const { activeChannelId, leaveChannel } = useVoice();
  const { addNotification } = useNotifications();
  const { unreadCount: inboxUnreadCount } = useInbox();

  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [initialUnreadCount, setInitialUnreadCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showFriends, setShowFriends] = useState(false);
  const [selectedDM, setSelectedDM] = useState<DirectMessage | null>(null);
  const [dmMessages, setDmMessages] = useState<Message[]>([]);
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInbox, setShowInbox] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  const userRef = useRef(user);
  const selectedServerRef = useRef(selectedServer);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { selectedServerRef.current = selectedServer; }, [selectedServer]);

  const [activeCall, setActiveCall] = useState<{
    user: User;
    isIncoming: boolean;
    dmId: string;
    offer?: any;
    isGroup?: boolean;
    dmName?: string;
  } | null>(null);
  const [showProfileUserId, setShowProfileUserId] = useState<string | null>(null);
  const [profilePosition, setProfilePosition] = useState<{ x: number, y: number } | null>(null);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showServerProfile, setShowServerProfile] = useState(false);
  const [serverProfilePosition, setServerProfilePosition] = useState<{ x: number, y: number } | null>(null);
  const [showUserServerProfile, setShowUserServerProfile] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [serverProfileServerId, setServerProfileServerId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const isResizingRef = useRef(false);
  const hasViewInitializedRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (selectedServer) {
      localStorage.setItem('lastServerId', selectedServer._id);
    }
  }, [selectedServer]);

  useEffect(() => {
    if (selectedChannel) {
      localStorage.setItem('lastChannelId', selectedChannel._id);
    }
  }, [selectedChannel]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = e.clientX - 72;
      if (newWidth > 200 && newWidth < 500) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
    };
    const handleStartDMEvent = (e: any) => {
      setSelectedDM(e.detail.dm);
      setSelectedChannel(null);
      setSelectedServer(null);
      setShowFriends(false);
    };
    const handleStartCallEvent = (e: any) => { handleStartDirectCall(e.detail.user, e.detail.dmId); };
    const handleOpenServerProfileSettings = (e: any) => {
      setServerProfileServerId(e.detail.serverId);
      setShowUserServerProfile(true);
    };
    const handleStartDMById = async (e: any) => {
      try {
        const response = await axios.get(`/api/direct-messages/${e.detail.dmId}`);
        setSelectedDM(response.data);
        setSelectedChannel(null);
        setSelectedServer(null);
        setShowFriends(false);
      } catch (err) { }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('start-dm', handleStartDMEvent);
    window.addEventListener('start-call', handleStartCallEvent);
    window.addEventListener('open-server-profile-settings', handleOpenServerProfileSettings);
    window.addEventListener('start-dm-by-id', handleStartDMById);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('start-dm', handleStartDMEvent);
      window.removeEventListener('start-call', handleStartCallEvent);
      window.removeEventListener('open-server-profile-settings', handleOpenServerProfileSettings);
      window.removeEventListener('start-dm-by-id', handleStartDMById);
    };
  }, []);

  useEffect(() => {
    // @ts-ignore
    const electron = window.electron;
    if (electron && socket && user) {
      electron.getCurrentActivity?.().then((activity: any) => {
        if (activity) {
          socket.emit('activity-update', {
            name: activity.name,
            type: 'playing',
            assets: { largeImage: activity.icon },
            timestamps: { start: activity.startTime }
          });
        }
      });
      const removeActivityListener = electron.onActivityChanged?.((activity: any) => {
        if (activity) {
          socket.emit('activity-update', {
            name: activity.name,
            type: 'playing',
            assets: { largeImage: activity.icon },
            timestamps: { start: activity.startTime }
          });
        } else {
          socket.emit('activity-update', null);
        }
      });
      return () => { if (removeActivityListener) removeActivityListener(); };
    }
  }, [socket, user?._id]);

  const startResizing = () => {
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    if (selectedChannel) {
      setUnreadCounts(prev => {
        if (!prev[selectedChannel._id]) return prev;
        const next = { ...prev };
        delete next[selectedChannel._id];
        return next;
      });
    }
  }, [selectedChannel]);

  useEffect(() => {
    if (selectedDM) {
      setUnreadCounts(prev => {
        if (!prev[selectedDM._id]) return prev;
        const next = { ...prev };
        delete next[selectedDM._id];
        return next;
      });
    }
  }, [selectedDM]);

  const fetchServers = useCallback(async () => {
    try {
      const response = await axios.get('/api/servers/me');
      const serversData = response.data;
      setServers(serversData);

      if (!hasViewInitializedRef.current && serversData.length > 0 && !selectedServerRef.current) {
        hasViewInitializedRef.current = true;

        const lastServerId = localStorage.getItem('lastServerId');
        const savedServer = lastServerId ? serversData.find((s: any) => s._id === lastServerId) : null;
        const targetServer = savedServer || serversData[0];

        setSelectedServer(targetServer);

        const lastChannelId = localStorage.getItem('lastChannelId');
        const savedChannel = lastChannelId ? targetServer.channels.find((c: any) => c._id === lastChannelId) : null;

        if (savedChannel) {
          setSelectedChannel(savedChannel);
        } else {
          const firstTextChannel = targetServer.channels.find((c: any) => c.type === 'text');
          if (firstTextChannel) setSelectedChannel(firstTextChannel);
          else if (targetServer.channels.length > 0) setSelectedChannel(targetServer.channels[0]);
        }
      } else if (!hasViewInitializedRef.current) {
        hasViewInitializedRef.current = true;
      }
    } catch (error) { } finally { setLoading(false); }
  }, []);

  const fetchDMs = useCallback(async () => {
    try {
      const response = await axios.get('/api/direct-messages');
      setDms(response.data);
    } catch (error) { }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const response = await axios.get('/api/friends');
      setFriends(response.data);
    } catch (error) { }
  }, []);

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const response = await axios.get(`/api/messages/channel/${channelId}`);
      setMessages(response.data);
      setHasMore(response.data.length === 50);

      const pinsRes = await axios.get(`/api/messages/channel/${channelId}/pins`);
      setPinnedMessages(pinsRes.data);
    } catch (error) { }
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!selectedChannel || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const lastMessage = messages[0];
      const response = await axios.get(`/api/messages/channel/${selectedChannel._id}`, {
        params: { before: lastMessage.createdAt }
      });
      if (response.data.length > 0) {
        setMessages(prev => [...response.data, ...prev]);
        setHasMore(response.data.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (error) { } finally { setIsLoadingMore(false); }
  }, [selectedChannel, messages, isLoadingMore, hasMore]);

  const fetchDMMessages = useCallback(async (dmId: string) => {
    try {
      const response = await axios.get(`/api/direct-messages/${dmId}/messages`);
      setDmMessages(response.data);
      setHasMore(response.data.length === 50);

      const pinsRes = await axios.get(`/api/direct-messages/${dmId}/pins`);
      setPinnedMessages(pinsRes.data);
    } catch (error) { }
  }, []);

  const loadMoreDMMessages = useCallback(async () => {
    if (!selectedDM || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const lastMessage = dmMessages[0];
      const response = await axios.get(`/api/direct-messages/${selectedDM._id}/messages`, {
        params: { before: lastMessage.createdAt }
      });
      if (response.data.length > 0) {
        setDmMessages(prev => [...response.data, ...prev]);
        setHasMore(response.data.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (error) { } finally { setIsLoadingMore(false); }
  }, [selectedDM, dmMessages, isLoadingMore, hasMore]);

  useEffect(() => {
    fetchServers();
    fetchDMs();
    fetchFriends();
  }, [fetchServers, fetchDMs, fetchFriends]);

  useEffect(() => {
    if (socket && servers.length > 0) {
      servers.forEach(server => socket.emit('join-server', server._id));
    }
  }, [socket, servers.length]);

  const handleServerUpdate = useCallback((updatedServer: Server) => {
    setServers(prev => prev.map(s => s._id === updatedServer._id ? updatedServer : s));
    setSelectedServer(prev => (prev && prev._id === updatedServer._id) ? updatedServer : prev);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleCallOffer = async (data: any) => {
      if (!activeCall) {
        try {
          const response = await axios.get<User>(`/api/users/${data.fromUserId}`);
          let dmName = '';
          if (data.isGroup && data.dmId) {
            try {
              const dmRes = await axios.get(`/api/direct-messages/${data.dmId}`);
              const dm = dmRes.data;
              dmName = dm.name || dm.participants.filter((p: any) => p._id !== user?._id).map((p: any) => p.username).join(', ');
            } catch (e) { }
          }

          setActiveCall({
            user: response.data,
            isIncoming: true,
            dmId: data.dmId || '',
            offer: data,
            isGroup: !!data.isGroup,
            dmName
          });

          // Send Native Notification
          // @ts-ignore
          if (window.electron && window.electron.ipc) {
            // @ts-ignore
            window.electron.ipc.send('show-native-notification', {
              title: data.isGroup ? 'Групповой звонок' : 'Входящий звонок',
              body: data.isGroup ? `${response.data.username} начал звонок в группе` : `Вам звонит ${response.data.username}`,
              silent: false
            });
          }
        } catch (err) { }
      }
    };
    const handleServerMemberUpdate = (data: { serverId: string; member: any }) => {
      const targetUserId = String(data.member.user?._id || data.member.user);
      setServers(prev => prev.map(s => s._id === data.serverId ? { ...s, members: s.members.map(m => String(m.user?._id || m.user) === targetUserId ? data.member : m) } : s));
      setSelectedServer(prev => (prev && prev._id === data.serverId) ? { ...prev, members: prev.members.map(m => String(m.user?._id || m.user) === targetUserId ? data.member : m) } : prev);
    };
    const handleUserUpdate = (updatedUser: Partial<User> & { _id: string }) => {
      const targetUserId = String(updatedUser._id);
      setServers(prev => prev.map(server => ({
        ...server,
        members: server.members.map(member => String(member.user?._id || member.user) === targetUserId ? { ...member, user: { ...member.user, ...updatedUser } } : member)
      })));
      setSelectedServer(prev => prev ? {
        ...prev,
        members: prev.members.map(member => String(member.user?._id || member.user) === targetUserId ? { ...member, user: { ...member.user, ...updatedUser } } : member)
      } : prev);
      setSelectedDM(prev => prev ? {
        ...prev,
        participants: prev.participants.map(p => p._id === updatedUser._id ? { ...p, ...updatedUser } : p)
      } : prev);
      if (updatedUser._id === user?._id) updateUser(updatedUser);
    };
    const handleServerMemberJoined = (data: { serverId: string; member: any; server?: Server }) => {
      if (data.server) { handleServerUpdate(data.server); return; }
      const newUserId = String(data.member.user?._id || data.member.user);
      setServers(prev => prev.map(s => (s._id === data.serverId && !s.members.some(m => String(m.user?._id || m.user) === newUserId)) ? { ...s, members: [...s.members, data.member] } : s));
      setSelectedServer(prev => (prev && prev._id === data.serverId && !prev.members.some(m => String(m.user?._id || m.user) === newUserId)) ? { ...prev, members: [...prev.members, data.member] } : prev);
    };
    const handleServerMemberLeft = (data: { serverId: string; userId: string }) => {
      const targetUserId = String(data.userId);
      setServers(prev => prev.map(s => s._id === data.serverId ? { ...s, members: s.members.filter(m => String(m.user?._id || m.user) !== targetUserId) } : s));
      setSelectedServer(prev => (prev && prev._id === data.serverId) ? { ...prev, members: prev.members.filter(m => String(m.user?._id || m.user) !== targetUserId) } : prev);
      if (userRef.current?._id && targetUserId === String(userRef.current._id)) {
        leaveChannel();
        setServers(prev => prev.filter(s => s._id !== data.serverId));
        setSelectedServer(prev => prev && prev._id === data.serverId ? null : prev);
        setSelectedChannel(prev => (prev && String((prev.server as any)?._id || prev.server) === data.serverId) ? null : prev);
      }
    };
    const handleServerKicked = (data: { serverId: string }) => {
      leaveChannel();
      setServers(prev => prev.filter(s => s._id !== data.serverId));
      setSelectedServer(prev => prev && prev._id === data.serverId ? null : prev);
      setSelectedChannel(prev => (prev && String((prev.server as any)?._id || prev.server) === data.serverId) ? null : prev);
    };
    const handleServerDeletedSocket = (data: { serverId: string }) => { handleServerDelete(data.serverId); };

    socket.on('call-offer', handleCallOffer);
    socket.on('server-member-updated', handleServerMemberUpdate);
    socket.on('server-updated', handleServerUpdate);
    socket.on('user-updated', handleUserUpdate);
    socket.on('server-member-joined', handleServerMemberJoined);
    socket.on('server-member-left', handleServerMemberLeft);
    socket.on('server-kicked', handleServerKicked);
    socket.on('server-deleted', handleServerDeletedSocket);
    return () => {
      socket.off('call-offer', handleCallOffer);
      socket.off('server-member-updated', handleServerMemberUpdate);
      socket.off('server-updated', handleServerUpdate);
      socket.off('user-updated', handleUserUpdate);
      socket.off('server-member-joined', handleServerMemberJoined);
      socket.off('server-member-left', handleServerMemberLeft);
      socket.off('server-kicked', handleServerKicked);
      socket.off('server-deleted', handleServerDeletedSocket);
    };
  }, [socket, activeCall, user, updateUser, handleServerUpdate]);

  useEffect(() => {
    if (!socket || !user) return;
    const s = socket;
    const handleGlobalMessage = (message: Message) => {
      if (message.author._id !== user._id) {
        const isSelected = (selectedChannel && message.channel === selectedChannel._id) || (selectedDM && message.directMessage === selectedDM._id);

        if (!isSelected) {
          const id = message.directMessage || message.channel;
          if (id) setUnreadCounts(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));

          // Only show old toast for channel messages WITHOUT mentions of current user. 
          // DMs and Mentions are now handled by InboxContext (persistent + new toast).
          const isMentioned = message.mentions?.some(m => m._id === user._id);

          if (!message.directMessage && !isMentioned) {
            soundManager.play(SOUNDS.MESSAGE_NOTIFY, 0.5);
            addNotification({
              title: message.author.username, content: message.content, type: 'message', avatar: message.author.avatar || undefined,
              onClick: () => {
                const server = servers.find(s => s.channels.some(c => c._id === message.channel));
                if (server) {
                  setSelectedServer(server);
                  const channel = server.channels.find(c => c._id === message.channel);
                  if (channel) setSelectedChannel(channel);
                  setShowFriends(false); setSelectedDM(null);
                }
              }
            });
          }
        }
      }
    };
    s.on('new-message', handleGlobalMessage);

    const handleMessagePinnedUpdate = (message: Message) => {
      setMessages(prev => prev.map(m => m._id === message._id ? { ...m, pinned: message.pinned, pinnedAt: message.pinnedAt } : m));
      setDmMessages(prev => prev.map(m => m._id === message._id ? { ...m, pinned: message.pinned, pinnedAt: message.pinnedAt } : m));

      if (message.pinned) {
        setPinnedMessages(prev => {
          if (prev.some(p => p._id === message._id)) return prev;
          return [message, ...prev].sort((a, b) => new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime());
        });
      } else {
        setPinnedMessages(prev => prev.filter(p => p._id !== message._id));
      }
    };

    s.on('message-pinned-update', handleMessagePinnedUpdate);

    return () => {
      s.off('new-message', handleGlobalMessage);
      s.off('message-pinned-update', handleMessagePinnedUpdate);
    };
  }, [socket, user, selectedChannel?._id, selectedDM?._id, servers, addNotification]);

  useEffect(() => {
    if (!selectedChannel || !socket) return;
    const s = socket;
    if (selectedChannel.type === 'text') {
      setMessages([]); setSelectedDM(null);
      s.emit('join-channel', selectedChannel._id);
      fetchMessages(selectedChannel._id);
      const handleNewMessage = (message: Message) => { if (message.channel === selectedChannel._id) setMessages((prev) => [...prev, message]); };
      const handleMessageDeleted = (messageId: string) => setMessages((prev) => prev.filter(m => m._id !== messageId));
      s.on('new-message', handleNewMessage);
      s.on('message-deleted', handleMessageDeleted);
      return () => {
        s.emit('leave-channel', selectedChannel._id);
        s.off('new-message', handleNewMessage);
        s.off('message-deleted', handleMessageDeleted);
      };
    } else { setMessages([]); setSelectedDM(null); }
  }, [selectedChannel, socket, fetchMessages]);

  useEffect(() => {
    if (!selectedDM || !socket) return;
    const s = socket;
    setDmMessages([]); setSelectedChannel(null);
    fetchDMMessages(selectedDM._id);
    const handleNewMessage = (message: Message) => { if (message.directMessage === selectedDM._id) setDmMessages((prev) => [...prev, message]); };
    const handleMessageDeleted = (messageId: string) => setDmMessages((prev) => prev.filter(m => m._id !== messageId));
    s.on('new-message', handleNewMessage);
    s.on('message-deleted', handleMessageDeleted);
    return () => { s.off('new-message', handleNewMessage); s.off('message-deleted', handleMessageDeleted); };
  }, [selectedDM, socket, fetchDMMessages]);

  const handleCreateServer = async (name: string) => {
    try {
      const response = await axios.post('/api/servers', { name });
      setServers((prev) => [...prev, response.data]);
      setSelectedServer(response.data);
      if (socket) socket.emit('join-server', response.data._id);
      if (response.data.channels.length > 0) setSelectedChannel(response.data.channels[0]);
    } catch (error) { }
  };

  const handleChannelSelect = (channel: Channel) => {
    setInitialUnreadCount(unreadCounts[channel._id] || 0);
    setMessages([]);
    setSelectedChannel(channel);
    setSelectedDM(null);
    setShowFriends(false);
    if (channel.type === 'voice') setMessages([]);
  };
  const handleStartDM = async (userId: string) => {
    try {
      const response = await axios.get(`/api/direct-messages/user/${userId}`);
      setInitialUnreadCount(unreadCounts[response.data._id] || 0);
      setDmMessages([]);
      setSelectedDM(response.data);
      setSelectedChannel(null);
      setSelectedServer(null);
      setShowFriends(false);
    } catch (error) { }
  };
  const handleStartDirectCall = (user: User, dmId: string) => { setActiveCall({ user, isIncoming: false, dmId, isGroup: false }); };
  const handleStartGroupCall = () => {
    if (!selectedDM || !user) return;
    const dmName = selectedDM.name || selectedDM.participants.filter(p => p._id !== user._id).map(p => p.username).join(', ');
    setActiveCall({
      user: user, // Current user is the one starting, but in group calls this simplifies things
      isIncoming: false,
      dmId: selectedDM._id,
      isGroup: true,
      dmName
    });
  };
  const handleServerDelete = (serverId: string) => {
    setServers(prev => prev.filter(s => s._id !== serverId));
    if (selectedServer?._id === serverId) { setSelectedServer(null); setSelectedChannel(null); }
  };
  const handleServerLeave = (serverId: string) => {
    setServers(prev => prev.filter(s => s._id !== serverId));
    if (selectedServer?._id === serverId) { setSelectedServer(null); setSelectedChannel(null); }
  };

  const handleUserClick = (userId: string, event?: React.MouseEvent | CustomEvent) => {
    setShowProfileUserId(userId);
    if (event) {
      if ('clientX' in event) {
        setProfilePosition({ x: event.clientX, y: event.clientY });
      } else if (event.detail && typeof event.detail.x === 'number') {
        setProfilePosition({ x: event.detail.x, y: event.detail.y });
      }
    } else {
      setProfilePosition(null);
    }
  };

  const handleServerProfileClick = (event?: React.MouseEvent) => {
    setShowServerProfile(true);
    if (event) {
      setServerProfilePosition({ x: event.clientX, y: event.clientY });
    } else {
      setServerProfilePosition(null);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="main-container">
      <Sidebar
        user={user!} servers={servers} unreadCounts={unreadCounts} selectedServer={selectedServer}
        onServerSelect={(server) => {
          setSelectedServer(server); setShowFriends(false); setSelectedDM(null);
          const firstTextChannel = server.channels.find(c => c.type === 'text');
          if (firstTextChannel) {
            setMessages([]);
            setSelectedChannel(firstTextChannel);
            fetchMessages(firstTextChannel._id);
          }
          else if (server.channels.length > 0) setSelectedChannel(server.channels[0]);
        }}
        onCreateServer={handleCreateServer}
        onServerJoined={(server) => { setServers((prev) => [...prev, server]); setSelectedServer(server); if (socket) socket.emit('join-server', server._id); if (server.channels.length > 0) setSelectedChannel(server.channels[0]); }}
        onLogout={logout} onShowFriends={() => { setShowFriends(true); setSelectedServer(null); setSelectedChannel(null); setSelectedDM(null); }}
        onServerLeave={handleServerLeave}
        onOpenJoinModal={() => setShowJoinModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenProfile={handleUserClick}
        onToggleInbox={() => setShowInbox(!showInbox)}
        inboxUnreadCount={inboxUnreadCount}
      />

      {/* --- SECOND SIDEBAR AREA --- */}
      {selectedServer && !showFriends ? (
        <div className="secondary-sidebar-container" style={{ width: sidebarWidth + 1 }}>
          <ServerSidebar
            server={selectedServer}
            selectedChannel={selectedChannel}
            unreadCounts={unreadCounts}
            onChannelSelect={handleChannelSelect}
            onChannelCreated={fetchServers}
            onUserClick={handleUserClick}
            onOpenSettings={() => setShowServerSettings(true)}
            onServerClick={handleServerProfileClick}
            style={{ width: sidebarWidth }}
          />
          <div className="sidebar-resizer" onMouseDown={startResizing} />
        </div>
      ) : !selectedServer ? (
        <div className="secondary-sidebar-container" style={{ width: sidebarWidth + 1 }}>
          <DMSidebar
            dms={dms}
            selectedDM={selectedDM}
            onDMSelect={(dm) => {
              setSelectedDM(dm);
              setShowFriends(false);
              setSelectedServer(null);
            }}
            onShowFriends={() => {
              setShowFriends(true);
              setSelectedDM(null);
            }}
            onAddDM={() => setShowCreateGroupModal(true)}
            showFriends={showFriends}
            currentUser={user!}
            unreadCounts={unreadCounts}
            style={{ width: sidebarWidth }}
          />
          <div className="sidebar-resizer" onMouseDown={startResizing} />
        </div>
      ) : null}

      {/* --- CONTENT AREA --- */}
      <div className="main-content-area">
        {showFriends && <FriendsPanel onStartDM={handleStartDM} onUserClick={handleUserClick} unreadCounts={unreadCounts} />}

        {selectedChannel && !showFriends && (
          selectedChannel.type === 'text' ? (
            <ChannelView
              key={selectedChannel._id}
              channel={selectedChannel}
              server={selectedServer!}
              messages={messages}
              socket={socket}
              onUserClick={handleUserClick}
              initialUnreadCount={unreadCounts[selectedChannel._id]}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMoreMessages}
              pinnedMessages={pinnedMessages}
              setMessages={setMessages}
            />
          ) : (
            <VoiceChannelView
              channel={selectedChannel} server={selectedServer!} onUserClick={handleUserClick} onMessageClick={handleStartDM}
              onCallClick={async (userId) => {
                try {
                  const response = await axios.get(`/api/direct-messages/user/${userId}`);
                  const other = response.data.participants.find((p: User) => p._id !== user?._id);
                  if (other) handleStartDirectCall(other, response.data._id);
                } catch (e) { }
              }}
            />
          )
        )}

        {selectedDM && !showFriends && (
          <DMView
            key={selectedDM._id}
            dm={selectedDM}
            messages={dmMessages}
            socket={socket}
            onClose={() => { setSelectedDM(null); setShowFriends(true); }}
            onStartCall={handleStartDirectCall}
            onStartGroupCall={handleStartGroupCall}
            onUserClick={handleUserClick}
            initialUnreadCount={unreadCounts[selectedDM._id]}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreDMMessages}
            pinnedMessages={pinnedMessages.filter(m => m.directMessage === selectedDM._id)}
            setMessages={setDmMessages}
          />
        )}

        {selectedServer && !showFriends && <ServerMembers server={selectedServer} onUserClick={handleUserClick} />}

        {!selectedChannel && !selectedDM && !showFriends && !selectedServer && (
          <div className="empty-view">
            <h2>Добро пожаловать в MAXcord!</h2>
            <p>Выберите друга или сервер, чтобы начать общение</p>
          </div>
        )}
      </div>

      {activeCall && (
        <VoiceCall
          socket={socket}
          otherUser={activeCall.user}
          dmId={activeCall.dmId}
          isGroup={activeCall.isGroup}
          dmName={activeCall.dmName}
          initialIncomingCall={activeCall.isIncoming}
          onEndCall={() => setActiveCall(null)}
        />
      )}

      {showProfileUserId && (
        <UserProfileCard
          userId={showProfileUserId}
          onClose={() => { setShowProfileUserId(null); setProfilePosition(null); }}
          serverId={selectedServer?._id}
          position={profilePosition}
          onUserClick={handleUserClick}
        />
      )}

      {showServerSettings && selectedServer && <ServerSettingsModal isOpen={showServerSettings} onClose={() => setShowServerSettings(false)} server={selectedServer} onServerUpdate={handleServerUpdate} onServerDelete={handleServerDelete} />}

      {showServerProfile && selectedServer && (
        <ServerProfileCard
          server={selectedServer}
          onClose={() => { setShowServerProfile(false); setServerProfilePosition(null); }}
          onLeave={handleServerLeave}
          position={serverProfilePosition}
          onUserClick={handleUserClick}
        />
      )}

      {showUserServerProfile && serverProfileServerId && <UserServerProfileModal isOpen={showUserServerProfile} onClose={() => setShowUserServerProfile(false)} serverId={serverProfileServerId} onUpdate={handleServerUpdate} />}

      {showJoinModal && (
        <JoinServerModal
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
          onJoin={(server) => {
            setServers((prev) => [...prev, server]);
            setSelectedServer(server);
            if (socket) socket.emit('join-server', server._id);
            if (server.channels.length > 0) setSelectedChannel(server.channels[0]);
          }}
          onCreate={handleCreateServer}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showCreateGroupModal && (
        <CreateGroupDMModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          friends={friends}
          onCreated={async (dmId) => {
            try {
              const res = await axios.get(`/api/direct-messages/${dmId}`);
              setDms(prev => [res.data, ...prev.filter(d => d._id !== dmId)]);
              setSelectedDM(res.data);
              setShowFriends(false);
            } catch (e) { }
          }}
        />
      )}

      {showInbox && (
        <>
          <div className="inbox-backdrop" onClick={() => setShowInbox(false)} />
          <Inbox
            onClose={() => setShowInbox(false)}
            onItemClick={(item) => {
              if (item.type === 'mention' || item.type === 'dm') {
                if (item.link?.dmId) {
                  window.dispatchEvent(new CustomEvent('start-dm-by-id', { detail: { dmId: item.link.dmId } }));
                } else if (item.link?.channelId) {
                  const server = servers.find(s => s.channels.some(c => c._id === item.link?.channelId));
                  if (server) {
                    setSelectedServer(server);
                    const channel = server.channels.find(c => c._id === item.link?.channelId);
                    if (channel) setSelectedChannel(channel);
                    setShowFriends(false);
                    setSelectedDM(null);
                  }
                }
              } else if (item.type === 'friend_request') {
                setShowFriends(true);
                setSelectedServer(null);
                setSelectedChannel(null);
                setSelectedDM(null);
              }
              setShowInbox(false);
            }}
          />
        </>
      )}
    </div>
  );
};

export default Main;
