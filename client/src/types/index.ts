export interface UserActivity {
  type: 'playing' | 'streaming' | 'listening' | 'watching' | 'competing';
  name: string;
  details?: string;
  state?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    largeImage?: string;
    largeText?: string;
    smallImage?: string;
    smallText?: string;
  };
}

export interface User {
  _id: string;
  username: string;
  email: string;
  avatar: string | null;
  banner: string | null;
  bio: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  activity?: UserActivity | null;
  servers?: string[];
  blockedUsers?: string[];
  notes?: Record<string, string>;
  isBot?: boolean;
  isPublished?: boolean;
  badges?: string[];
  is2FAEnabled?: boolean;
  role?: 'user' | 'moderator' | 'admin';
  isBanned?: boolean;
  banExpires?: string;
  banReason?: string;
  settings?: {
    showActivityStatus: boolean;
    activityVisibility: 'everyone' | 'friends' | 'none';
    hiddenActivities: string[];
  };
  createdAt: string;
}

export interface MiniApp {
  _id: string;
  name: string;
  url: string;
  owner: string | User;
  isPublished: boolean;
  avatar?: string;
  banner?: string;
  description?: string;
  createdAt: string;
}


export interface Role {
  _id: string;
  name: string;
  color: string;
  hoist: boolean;
  position: number;
  permissions: string;
  mentionable: boolean;
}

export interface PermissionOverwrite {
  _id?: string;
  id: string;
  type: 'role' | 'member';
  allow: string;
  deny: string;
}

export interface Emoji {
  name: string;
  url: string;
  id: string;
  animated: boolean;
  author?: string;
}

export interface Server {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  banner?: string;
  bannerColor?: string;
  owner?: User | string;
  roles: Role[];
  members: Array<{
    user: User;
    nickname?: string;
    roles: string[]; // Role IDs
    joinedAt: string;
    communicationDisabledUntil?: string;
    bio?: string;
    avatar?: string;
    banner?: string;
  }>;
  channels: Channel[];
  emojis?: Emoji[];
  createdAt: string;
}

export interface Channel {
  _id: string;
  name: string;
  type: 'text' | 'voice' | 'category';
  server: string | Server;
  category?: string | Channel;
  position: number;
  topic?: string;
  permissionOverwrites?: PermissionOverwrite[];
  createdAt: string;
}

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  image?: {
    url: string;
  };
  thumbnail?: {
    url: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

export interface Message {
  _id: string;
  content: string;
  author: User;
  channel: string | null;
  directMessage?: string | null;
  attachments: Array<{
    url: string;
    filename: string;
    size: number;
    type: string;
  }>;
  embeds?: Embed[];
  buttons?: Array<{
    label: string;
    url?: string;
    actionId?: string;
    style?: 'primary' | 'secondary' | 'danger' | 'success';
    row?: number;
  }>;
  edited: boolean;
  editedAt?: string;
  reactions?: Array<{
    emoji: string;
    users: string[];
  }>;
  mentions?: User[];
  replyTo?: Message;
  type?: 'default' | 'missed-call' | 'call-ended';
  pinned?: boolean;
  pinnedAt?: string;
  createdAt: string;
}

export interface Friendship {
  _id: string;
  requester: User;
  recipient: User;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
}

export interface DirectMessage {
  _id: string;
  participants: User[];
  name?: string | null;
  icon?: string | null;
  messages?: Message[];
  createdAt: string;
  updatedAt: string;
}
