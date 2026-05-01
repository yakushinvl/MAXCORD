import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';
import './Landing.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'login' | 'mfa' | 'forgot' | 'reset'>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const { login, verifyLogin, forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleModeChange = (newMode: 'login' | 'mfa' | 'forgot' | 'reset') => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setCode('');
    setPassword('');
    // Start timer if going to a mode that needs a code
    if (newMode === 'mfa' || newMode === 'reset') {
      setResendTimer(60);
    } else {
      setResendTimer(0);
    }
  };

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    
    setError('');
    setSuccess('');
    
    try {
      if (mode === 'mfa') {
        await login(email, password); // This will trigger a new 2FA code
        setSuccess('Новый код подтверждения отправлен');
      } else if (mode === 'reset' || mode === 'forgot') {
        await forgotPassword(email);
        setSuccess('Новый код сброса пароля отправлен');
      }
      setResendTimer(60);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка отправки кода');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'mfa') {
      if (!code || code.length !== 6) {
        setError('Пожалуйста, введите 6-значный код');
        return;
      }
      try {
        await verifyLogin(email, code);
        const searchParams = new URLSearchParams(window.location.search);
        const returnTo = searchParams.get('returnTo');
        navigate(returnTo || '/');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Неверный код');
      }
      return;
    }

    if (mode === 'forgot') {
      if (!email) {
        setError('Пожалуйста, введите email');
        return;
      }
      try {
        await forgotPassword(email.trim());
        setSuccess('Код для сброса пароля отправлен на вашу почту');
        handleModeChange('reset');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Ошибка отправки кода');
      }
      return;
    }

    if (mode === 'reset') {
      if (!code || code.length !== 6) {
        setError('Пожалуйста, введите 6-значный код');
        return;
      }
      if (!password || password.length < 8) {
        setError('Новый пароль должен содержать минимум 8 символов');
        return;
      }
      try {
        await resetPassword(email, code, password);
        setSuccess('Пароль успешно изменен. Теперь вы можете войти.');
        handleModeChange('login');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Ошибка смены пароля');
      }
      return;
    }

    // Default Login mode
    if (!email) {
      setError('Пожалуйста, введите email или имя пользователя');
      return;
    }

    if (!password) {
      setError('Пожалуйста, введите пароль');
      return;
    }

    try {
      const data = await login(email.trim(), password);
      if (data.requires2FA) {
        handleModeChange('mfa');
        setSuccess('Код подтверждения отправлен на вашу почту');
      } else if (data.token) {
        const searchParams = new URLSearchParams(window.location.search);
        const returnTo = searchParams.get('returnTo');
        navigate(returnTo || '/');
      }
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        setError('Почта не подтверждена. Пожалуйста, проверьте ваш почтовый ящик.');
      } else if (err.response?.data?.errors) {
        const validationErrors = err.response.data.errors.map((e: any) => e.msg).join(', ');
        setError(validationErrors);
      } else {
        const detail = err.response?.data?.details || err.response?.data?.message;
        setError(detail ? `Ошибка входа: ${detail}` : 'Ошибка входа. Проверьте email и пароль.');
      }
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'mfa': return 'Подтверждение';
      case 'forgot': return 'Восстановление';
      case 'reset': return 'Новый пароль';
      default: return 'С возвращением!';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'mfa': return 'Мы отправили код на вашу почту';
      case 'forgot': return 'Введите email для получения кода';
      case 'reset': return 'Введите код из письма и новый пароль';
      default: return 'Мы так рады видеть вас снова!';
    }
  };

  return (
    <div className="preview-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', position: 'relative', zIndex: 5 }}>
        <div className="glass-panel-base" style={{ width: '100%', maxWidth: '450px', padding: '50px', textAlign: 'center', marginTop: '20px' }}>
          {/* Top floating icon */}
          <div style={{
            position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
            width: '100px', height: '100px', background: 'var(--primary-neon)',
            borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(0, 229, 255, 0.3)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>

          <h1 style={{ marginTop: '20px', fontSize: '32px', fontWeight: 800, marginBottom: '10px', color: 'white' }}>
            {getTitle()}
          </h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: '40px', fontSize: '15px' }}>
            {getSubtitle()}
          </p>

          <form onSubmit={handleSubmit} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {error && (
              <div style={{
                background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.3)',
                color: '#ff3b30', padding: '12px', borderRadius: '12px', fontSize: '13px', textAlign: 'center'
              }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{
                background: 'rgba(0, 255, 127, 0.1)', border: '1px solid rgba(0, 255, 127, 0.3)',
                color: '#00ff7f', padding: '12px', borderRadius: '12px', fontSize: '13px', textAlign: 'center'
              }}>
                {success}
              </div>
            )}

            {mode === 'login' && (
              <>
                <div>
                  <label className="auth-label-neon">EMAIL ИЛИ ИМЯ ПОЛЬЗОВАТЕЛЯ</label>
                  <input
                    type="text"
                    className="auth-input-glass"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com или username"
                    required
                  />
                </div>

                <div>
                  <label className="auth-label-neon">ПАРОЛЬ</label>
                  <input
                    type="password"
                    className="auth-input-glass"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <span
                      onClick={() => handleModeChange('forgot')}
                      style={{ fontSize: '12px', color: '#ffffff', cursor: 'pointer', fontWeight: 600, display: 'inline-block', padding: '4px' }}
                    >
                      Забыли пароль?
                    </span>
                  </div>
                </div>
              </>
            )}

            {mode === 'forgot' && (
              <div>
                <label className="auth-label-neon">EMAIL</label>
                <input
                  type="email"
                  className="auth-input-glass"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                  <span
                    onClick={() => handleModeChange('login')}
                    style={{ fontSize: '12px', color: '#ffffff', cursor: 'pointer', fontWeight: 600, display: 'inline-block', padding: '4px' }}
                  >
                    Вернуться к входу
                  </span>
                </div>
              </div>
            )}

            {(mode === 'mfa' || mode === 'reset') && (
              <div>
                <label className="auth-label-neon">КОД ПОДТВЕРЖДЕНИЯ</label>
                <input
                  type="text"
                  className="auth-input-glass"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  required
                  style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '24px' }}
                />
                {mode === 'reset' && (
                  <div style={{ marginTop: '24px' }}>
                    <label className="auth-label-neon">НОВЫЙ ПАРОЛЬ</label>
                    <input
                      type="password"
                      className="auth-input-glass"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                )}
                <div style={{ textAlign: 'center', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <span
                    onClick={handleResendCode}
                    style={{ 
                      fontSize: '13px', 
                      color: resendTimer > 0 ? 'var(--text-dim)' : 'var(--primary-neon)', 
                      cursor: resendTimer > 0 ? 'default' : 'pointer',
                      fontWeight: 700,
                      textDecoration: resendTimer > 0 ? 'none' : 'underline'
                    }}
                  >
                    {resendTimer > 0 ? `Отправить код повторно через ${resendTimer}с` : 'Отправить код повторно'}
                  </span>
                  
                  <span
                    onClick={() => handleModeChange('login')}
                    style={{ fontSize: '12px', color: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Вернуться к входу
                  </span>
                </div>
              </div>
            )}

            <button type="submit" className="neon-btn" style={{ marginTop: '15px', padding: '18px' }}>
              {mode === 'login' ? 'Войти в систему' :
                mode === 'mfa' ? 'Подтвердить код' :
                  mode === 'forgot' ? 'Получить код' : 'Сбросить пароль'}
            </button>
          </form>

          <p style={{ marginTop: '30px', fontSize: '14px', color: 'var(--text-dim)' }}>
            Нужна учетная запись? <Link to="/register" style={{ color: '#ffffff', fontWeight: 800, textDecoration: 'underline' }}>Зарегистрироваться</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;










