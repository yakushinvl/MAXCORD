import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import './Landing.css';

const Landing: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { alert } = useDialog();

    const handleOpenApp = () => {
        if (user) {
            navigate('/app');
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="landing-container">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>

            <nav className="landing-nav">
                <div className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src={`${import.meta.env.BASE_URL}icon.png`} alt="MAXCORD" />
                    <span>MAXCORD</span>
                </div>
                <div className="nav-links">
                    <span className="nav-link" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Возможности</span>
                    <span className="nav-link" onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })}>Демонстрация</span>
                    <span className="nav-link" onClick={() => navigate('/docs')}>Документация</span>
                </div>
                <div className="nav-actions">
                    {!user && (
                        <button className="btn-nav-neon nav-desktop-only" onClick={() => { window.location.href = 'maxcord://'; }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                            Запустить MAXCORD
                        </button>
                    )}
                    <button className="btn-login" onClick={() => navigate('/login')}>
                        {user ? 'Открыть MAXCORD' : 'Войти'}
                    </button>
                </div>
            </nav>

            <section className="hero-section">
                <div className="hero-bg"></div>
                {/* Hero Image - Premium 3D Abstract */}
                <div className="hero-image-container">
                    <img
                        src={`${import.meta.env.BASE_URL}landing_hero_premium.png`} // We expect this to be available
                        className="hero-main-img"
                        alt="MAXCORD Premium UI"
                        onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=1200';
                        }}
                    />
                </div>
                <div className="hero-content">
                    <h1 className="hero-h1">Место, где звук <br/> становится чувством.</h1>
                    <p className="hero-p">
                        MAXCORD — это революционная платформа для общения.
                        Погрузитесь в атмосферу кристально чистого звука и стриминга в 4K.
                        Создано для геймеров, разработчиков и тех, кто ценит качество.
                    </p>
                    <div className="hero-buttons">
                        <button className="btn-primary-neon" onClick={handleOpenApp}>
                            Запустить в браузере
                        </button>
                        <button className="btn-secondary-outline" onClick={() => window.open('https://github.com/yakushinvl/MAXCORD/releases', '_blank')}>
                            Скачать для Windows
                        </button>
                    </div>
                </div>
            </section>

            <section className="features-section" id="features">
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
                        </div>
                        <h3>Кристальный звук</h3>
                        <p>Наше шумоподавление нового поколения убирает всё лишнее. Вас слышно идеально даже в шумной обстановке.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                        </div>
                        <h3>Стриминг 4K/60fps</h3>
                        <p>Делитесь своим экраном с минимальной задержкой. Поддержка захвата системного аудио включена по умолчанию.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        </div>
                        <h3>Полная приватность</h3>
                        <p>Ваши звонки и сообщения защищены. Мы ценим вашу конфиденциальность и безопасность данных.</p>
                    </div>
                </div>
            </section>

            <section className="showcase-section" id="showcase">
                <div className="showcase-content">
                    <div className="showcase-text">
                        <h2>Создайте свой мир.</h2>
                        <p>
                            Серверы MAXCORD позволяют организовать пространство так, как удобно вам.
                            Создавайте роли, настраивайте права доступа и делайте свой сервер уникальным.
                        </p>
                        <button className="btn-secondary" onClick={() => navigate('/register')}>Присоединиться сейчас</button>
                    </div>
                    <div className="showcase-image">
                        <img src={`${import.meta.env.BASE_URL}landing_hero.png`} alt="MAXCORD Interface" onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=1200';
                        }} />
                    </div>
                </div>
            </section>

            <section className="cta-section" id="download">
                <div className="cta-card">
                    <h2>Готовы начать свое общение?</h2>
                    <p>Большое количество пользователей уже выбрали MAXCORD как основной инструмент для связи.</p>
                    <button className="btn-login" style={{ padding: '16px 48px', fontSize: '18px' }} onClick={() => navigate('/register')}>
                        Зарегистрироваться
                    </button>
                </div>
            </section>

            <footer id="support">
                <div className="footer-content">
                    <div className="footer-brand">
                        <h4>MAXCORD</h4>
                        <div className="bot-api-showcase">
                            <h3>Мощный Bot API</h3>
                            <p>Создавайте уникальные интеграции с помощью Webhooks и Socket.io SDK. Музыкальные боты, управление ролями и кастомные команды.</p>
                            <button className="btn-link" onClick={() => navigate('/docs')}>Читать документацию →</button>
                        </div>
                    </div>
                    <div className="footer-links">
                        <div className="footer-column">
                            <h5>Продукт</h5>
                            <ul>
                                <li><a onClick={() => navigate('/login')}>Безопасность</a></li>
                                <li><a onClick={() => window.open('https://github.com/yakushinvl/MAXCORD/commits/main', '_blank')}>Список изменений</a></li>
                                <li><a onClick={() => navigate('/register')}>Серверы</a></li>
                                <li><a onClick={() => navigate('/docs')}>API для ботов</a></li>
                            </ul>
                        </div>
                        <div className="footer-column">
                            <h5>Компания</h5>
                            <ul>
                                <li><a onClick={() => navigate('/')}>О нас</a></li>
                                <li><a onClick={() => document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' })}>Загрузить</a></li>
                                <li><a onClick={() => window.open('https://github.com/yakushinvl/MAXCORD', '_blank')}>Github</a></li>
                            </ul>
                        </div>
                        <div className="footer-column">
                            <h5>Ресурсы</h5>
                            <ul>
                                <li><a onClick={() => navigate('/docs')}>Для разработчиков</a></li>
                                <li><a onClick={() => navigate('/policy')}>Условия использования</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
