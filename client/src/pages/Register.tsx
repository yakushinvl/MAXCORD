import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';
import './Landing.css';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user, register } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // Local validation before submitting
      const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        specialOrDigit: /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
      };

      if (!requirements.length || !requirements.uppercase || !requirements.specialOrDigit) {
        setError('Пароль должен содержать минимум 8 символов, хотя бы одну заглавную букву и цифру или спецсимвол');
        return;
      }

      const data = await register(username, email, password);
      if (data.token) {
        const searchParams = new URLSearchParams(window.location.search);
        const returnTo = searchParams.get('returnTo');
        navigate(returnTo || '/');
      } else {
        setSuccess(data.message || 'Регистрация успешна! Пожалуйста, проверьте почту для подтверждения.');
      }
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setError(err.response.data.errors[0].msg);
      } else {
        setError(err.response?.data?.message || 'Ошибка регистрации');
      }
    }
  };

  return (
    <div className="preview-container">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', position: 'relative', zIndex: 5, padding: '20px' }}>
        <div className="glass-panel-base" style={{ width: '100%', maxWidth: '480px', padding: '50px', textAlign: 'center', marginTop: '20px' }}>
          {/* Top floating icon */}
          <div style={{
            position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
            width: '100px', height: '100px', background: 'var(--primary-neon)',
            borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(0, 229, 255, 0.3)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="16 11 18 13 22 9" />
            </svg>
          </div>

          <h1 style={{ marginTop: '20px', fontSize: '32px', fontWeight: 800, marginBottom: '10px', color: 'white' }}>Создать аккаунт</h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: '40px', fontSize: '15px' }}>Присоединяйтесь к нашей экосистеме.</p>

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

            <div>
              <label className="auth-label-neon">ИМЯ ПОЛЬЗОВАТЕЛЯ</label>
              <input
                type="text"
                className="auth-input-glass"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="CyberNaut"
                required
                minLength={3}
                maxLength={20}
              />
            </div>

            <div>
              <label className="auth-label-neon">ЭЛЕКТРОННАЯ ПОЧТА</label>
              <input
                type="email"
                className="auth-input-glass"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
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
                minLength={8}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
                Минимум 8 символов, заглавная буква и цифра или спецсимвол
              </p>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.4', margin: '5px 0' }}>
              Продолжая, вы соглашаетесь с нашими <span style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline' }}>Условиями обслуживания</span> и <span style={{ color: '#ffffff', cursor: 'pointer', textDecoration: 'underline' }}>Политикой конфиденциальности</span>.
            </p>

            <button type="submit" className="neon-btn" style={{ padding: '18px' }}>
              Инициировать регистрацию
            </button>
          </form>

          <p style={{ marginTop: '30px', fontSize: '14px', color: 'var(--text-dim)' }}>
            Уже есть аккаунт? <Link to="/login" style={{ color: '#ffffff', fontWeight: 800, textDecoration: 'underline' }}>Войти</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;










