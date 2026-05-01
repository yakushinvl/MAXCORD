import React, { useState } from 'react';
import { Server, User } from '../types';
import { getAvatarUrl, getFullUrl } from '../utils/avatar';
import MemberContextMenu from './MemberContextMenu';
import UserAvatar from './UserAvatar';
import UserBadges from './UserBadges';
import './ServerMembers.css';

interface ServerMembersProps {
    server: Server;
    onUserClick: (userId: string, event?: React.MouseEvent) => void;
    onBack?: () => void;
    isMobile?: boolean;
}

const ServerMembers: React.FC<ServerMembersProps> = ({ server, onUserClick, onBack, isMobile }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, user: User } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, user: User) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, user });
    };

    return (
        <div className="server-members">
            {isMobile && onBack && (
                <div className="members-mobile-header">
                    <button className="mobile-close-btn" onClick={onBack}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <span>Участники</span>
                </div>
            )}
            <div className="members-list">
                {(() => {
                    // Get all server roles sorted by position
                    const serverRoles = [...(server.roles || [])].sort((a, b) => (b.position || 0) - (a.position || 0));

                    const onlineMembers = server.members.filter(m => m.user.status !== 'offline');
                    const offlineMembers = server.members.filter(m => m.user.status === 'offline');

                    // Map role ID to members for HOISTED roles
                    const roleGroups: Record<string, typeof server.members> = {};
                    const noRoleMembers: typeof server.members = [];

                    onlineMembers.forEach(member => {
                        const memberRoleIds = member.roles || [];
                        const memberRoles = serverRoles.filter(r => memberRoleIds.includes(r._id));
                        memberRoles.sort((a, b) => (b.position || 0) - (a.position || 0));

                        // Find highest HOISTED role
                        const hoistedRole = memberRoles.find(r => r.hoist);

                        if (hoistedRole) {
                            if (!roleGroups[hoistedRole._id]) {
                                roleGroups[hoistedRole._id] = [];
                            }
                            roleGroups[hoistedRole._id].push(member);
                        } else {
                            noRoleMembers.push(member);
                        }
                    });

                    return (
                        <>
                            {serverRoles.map(role => {
                                const membersInRole = roleGroups[role._id];
                                if (!membersInRole || membersInRole.length === 0 || !role.hoist) return null;

                                return (
                                    <div key={role._id} className="member-group">
                                        <div className="group-header">{role.name.toUpperCase()} — {membersInRole.length}</div>
                                        {membersInRole.map(member => {
                                            const memberRoleIds = member.roles || [];
                                            const memberRoles = serverRoles.filter(r => memberRoleIds.includes(r._id));
                                            memberRoles.sort((a, b) => (b.position || 0) - (a.position || 0));

                                            const colorRole = memberRoles.find(r => r.color && r.color !== '#99AAB5' && r.color !== '#99aab5');
                                            const memberColor = colorRole ? colorRole.color : 'inherit';

                                            return (
                                                <div
                                                    key={member.user._id}
                                                    className="member-item"
                                                    onClick={(e) => onUserClick(member.user._id, e)}
                                                    onContextMenu={(e) => handleContextMenu(e, member.user)}
                                                >
                                                    <div className="member-avatar-wrap">
                                                        <UserAvatar
                                                            user={member.user}
                                                            size={32}
                                                            className="member-avatar"
                                                        />
                                                        <div className={`status-indicator ${member.user.status}`}></div>
                                                    </div>
                                                    <div className="member-info">
                                                        <div className="member-name-row">
                                                            <span className="member-name" style={{ color: memberColor }}>
                                                                {member.nickname || member.user.username}
                                                            </span>
                                                            <UserBadges badges={member.user.badges} size={14} />
                                                        </div>
                                                        {member.user.activity && (
                                                            <div className="member-activity">
                                                                {member.user.activity.assets?.largeImage && (
                                                                    <img src={getFullUrl(member.user.activity.assets.largeImage)!} alt="" className="member-activity-icon" />
                                                                )}
                                                                <span className="activity-text">
                                                                    {member.user.activity.name}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            {noRoleMembers.length > 0 && (
                                <div className="member-group">
                                    <div className="group-header">ОНЛАЙН — {noRoleMembers.length}</div>
                                    {noRoleMembers.map(member => {
                                        const memberRoleIds = member.roles || [];
                                        const memberRoles = serverRoles.filter(r => memberRoleIds.includes(r._id));
                                        memberRoles.sort((a, b) => b.position - a.position);
                                        const colorRole = memberRoles.find(r => r.color && r.color !== '#99AAB5' && r.color !== '#99aab5');
                                        const memberColor = colorRole ? colorRole.color : 'inherit';

                                        return (
                                            <div
                                                key={member.user._id}
                                                className="member-item"
                                                onClick={(e) => onUserClick(member.user._id, e)}
                                                onContextMenu={(e) => handleContextMenu(e, member.user)}
                                            >
                                                <div className="member-avatar-wrap">
                                                    <UserAvatar
                                                        user={member.user}
                                                        size={32}
                                                        className="member-avatar"
                                                    />
                                                    <div className={`status-indicator ${member.user.status}`}></div>
                                                </div>
                                                <div className="member-info">
                                                    <div className="member-name-row">
                                                        <span className="member-name" style={{ color: memberColor }}>{member.nickname || member.user.username}</span>
                                                        <UserBadges badges={member.user.badges} size={14} />
                                                    </div>
                                                    {member.user.activity && (
                                                        <div className="member-activity">
                                                            {member.user.activity.assets?.largeImage && (
                                                                <img src={getFullUrl(member.user.activity.assets.largeImage)!} alt="" className="member-activity-icon" />
                                                            )}
                                                            <span className="activity-text">
                                                                {member.user.activity.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {offlineMembers.length > 0 && (
                                <div className="member-group">
                                    <div className="group-header">ОФФЛАЙН — {offlineMembers.length}</div>
                                    {offlineMembers.map(member => {
                                        const memberRoleIds = member.roles || [];
                                        const memberRoles = serverRoles.filter(r => memberRoleIds.includes(r._id));
                                        memberRoles.sort((a, b) => b.position - a.position);
                                        const colorRole = memberRoles.find(r => r.color && r.color !== '#99AAB5' && r.color !== '#99aab5');
                                        const memberColor = colorRole ? colorRole.color : 'inherit';

                                        return (
                                            <div
                                                key={member.user._id}
                                                className="member-item offline"
                                                onClick={(e) => onUserClick(member.user._id, e)}
                                                onContextMenu={(e) => handleContextMenu(e, member.user)}
                                            >
                                                <div className="member-avatar-wrap">
                                                    <UserAvatar
                                                        user={member.user}
                                                        size={32}
                                                        className="member-avatar"
                                                    />
                                                    <div className={`status-indicator ${member.user.status}`}></div>
                                                </div>
                                                <div className="member-name-row">
                                                    <span className="member-name" style={{ color: memberColor }}>
                                                        {member.nickname || member.user.username}
                                                    </span>
                                                    <UserBadges badges={member.user.badges} size={14} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>
            {contextMenu && (
                <MemberContextMenu
                    user={contextMenu.user}
                    server={server}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onOpenProfile={onUserClick}
                />
            )}
        </div>
    );
};

export default ServerMembers;
