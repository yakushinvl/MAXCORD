import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../utils/avatar';
import './InvitePage.css';

const InvitePage: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { user: authUser, loading: authLoading } = useAuth();
    const [invite, setInvite] = useState<any>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (code) fetchInvite();
    }, [code]);

    const fetchInvite = async () => {
        try {
            const response = await axios.get(`/api/invites/${code}`);
            setInvite(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Приглашение недействительно или срок его действия истек');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (authLoading) return;

        if (!authUser) {
            // Redirect to login but keep the invite code to return back
            navigate(`/login?returnTo=/invite/${code}`);
            return;
        }

        setJoining(true);
        try {
            await axios.post(`/api/invites/${code}/join`);
            navigate('/');
        } catch (err: any) {
            if (err.response?.data?.message === 'Already a member') {
                navigate('/');
            } else {
                setError(err.response?.data?.message || 'Не удалось присоединиться к серверу');
            }
        } finally {
            setJoining(false);
        }
    };

    // Auto-join if already in Electron and authenticated
    useEffect(() => {
        const isElectron = (window as any).electron;
        if (invite && isElectron && authUser && !joining && !error) {
            handleJoin();
        }
    }, [invite, authUser]);

    if (loading || authLoading) {
        return (
            <div className="preview-container">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px', zIndex: 10 }}>
                    <div className="loading-spinner-rings" style={{ borderColor: 'var(--primary-neon) transparent' }}>
                        <div></div><div></div><div></div><div></div>
                    </div>
                    <span style={{ color: 'white', fontWeight: 600, letterSpacing: '1px' }}>ПОДГОТОВКА ПРИГЛАШЕНИЯ...</span>
                </div>
            </div>
        );
    }

    const isElectron = (window as any).electron;

    return (
        <div className="preview-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', position: 'relative', zIndex: 5, padding: '20px' }}>
                <div className="glass-panel-base" style={{ width: '100%', maxWidth: '500px', padding: '60px 40px 40px', textAlign: 'center', marginTop: '40px' }}>

                    {error ? (
                        <div style={{ padding: '20px 0' }}>
                            <div style={{
                                margin: '0 auto 30px', width: '80px', height: '80px',
                                background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.3)',
                                borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#ff3b30', fontSize: '32px', fontWeight: 'bold'
                            }}>✕</div>
                            <h2 style={{ color: 'white', marginBottom: '15px', fontSize: '24px' }}>Упс! Что-то не так</h2>
                            <p style={{ color: 'var(--text-dim)', marginBottom: '30px' }}>{error}</p>
                            <button className="neon-btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'white !important', border: '1px solid var(--glass-border)', boxShadow: 'none' }} onClick={() => navigate('/')}>На главную</button>
                        </div>
                    ) : (
                        <div>
                            {/* Server Icon Overlay */}
                            <div style={{
                                position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)',
                                width: '100px', height: '100px', background: 'var(--bg-dark)',
                                borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px solid var(--primary-neon)', overflow: 'hidden',
                                boxShadow: '0 20px 40px rgba(0, 229, 255, 0.3)'
                            }}>
                                {invite.server.icon ? (
                                    <img src={getAvatarUrl(invite.server.icon)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary-neon)' }}>
                                        {invite.server.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <div style={{ fontSize: '11px', color: 'var(--primary-neon)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
                                {invite.inviter.username} приглашает вас
                            </div>
                            <h1 style={{ color: 'white', fontSize: '32px', fontWeight: 800, marginBottom: '15px', letterSpacing: '-1px' }}>{invite.server.name}</h1>

                            {invite.server.description && (
                                <p style={{ color: 'var(--text-dim)', fontSize: '14px', lineHeight: '1.5', marginBottom: '25px' }}>{invite.server.description}</p>
                            )}

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)', marginBottom: '35px' }}>
                                <span style={{ width: '8px', height: '8px', background: 'var(--primary-neon)', borderRadius: '50%', boxShadow: '0 0 10px var(--primary-neon)' }}></span>
                                <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{invite.server.memberCount} участников</span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {!isElectron ? (
                                    <>
                                        <button className="neon-btn" onClick={handleJoin} disabled={joining}>
                                            {joining ? 'Выполняется вход...' : 'Продолжить в браузере'}
                                        </button>
                                        <button 
                                            style={{ 
                                                background: 'rgba(255,255,255,0.05)', 
                                                border: '1px solid var(--glass-border)', 
                                                color: 'white', 
                                                padding: '12px 20px', 
                                                borderRadius: '12px', 
                                                fontSize: '14px', 
                                                fontWeight: 700, 
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease'
                                            }} 
                                            onClick={() => { window.location.href = `maxcord://invite/${code}`; }}
                                        >
                                            Открыть в приложении
                                        </button>
                                    </>
                                ) : (
                                    <button className="neon-btn" onClick={handleJoin} disabled={joining}>
                                        {joining ? 'Выполняется вход...' : 'Принять приглашение'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ position: 'absolute', bottom: '30px', left: '0', width: '100%', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>
                MAXCORD
            </div>
        </div>
    );
};

export default InvitePage;
