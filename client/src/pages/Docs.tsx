import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Docs.css';

const Docs: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'general' | 'bot-api'>('general');

    return (
        <div className="docs-container">
            <nav className="docs-nav">
                <div className="nav-logo" onClick={() => navigate('/')}>
                    <img src={`${import.meta.env.BASE_URL}icon.png`} alt="MAXCORD" />
                    <span>MAXCORD Docs</span>
                </div>
                <button className="btn-back" onClick={() => navigate('/')}>На главную</button>
            </nav>

            <div className="docs-layout">
                <aside className="docs-sidebar">
                    <div
                        className={`sidebar-item ${activeTab === 'general' ? 'active' : ''}`}
                        onClick={() => setActiveTab('general')}
                    >
                        Основные возможности
                    </div>
                    <div
                        className={`sidebar-item ${activeTab === 'bot-api' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bot-api')}
                    >
                        API для Ботов
                    </div>
                </aside>

                <main className="docs-main">
                    {activeTab === 'general' ? (
                        <div className="docs-content">
                            <h1>Документация MAXCORD</h1>
                            <p className="lead">MAXCORD — это современная платформа для общения, стриминга и совместного проведения времени.</p>

                            <section>
                                <h2>🚀 Начало работы</h2>
                                <p>Чтобы начать пользоваться MAXCORD, зарегистрируйтесь или войдите в свою учетную запись. Вы можете использовать веб-версию или скачать клиент для Windows.</p>
                                <ul>
                                    <li><strong>Серверы:</strong> Основное место для общения. Вы можете создать свой сервер или присоединиться к существующему по ссылке-приглашению.</li>
                                    <li><strong>Каналы:</strong> На каждом сервере есть Текстовые и Голосовые каналы.</li>
                                    <li><strong>Роли:</strong> Настраивайте права доступа и выделяйте пользователей с помощью гибкой системы ролей.</li>
                                </ul>
                            </section>

                            <section>
                                <h2>🎧 Голосовое общение и Стриминг</h2>
                                <p>MAXCORD поддерживает высококачественный звук и передачу видео в 4K.</p>
                                <ul>
                                    <li><strong>Шумоподавление:</strong> Встроено по умолчанию для кристальной чистоты звука.</li>
                                    <li><strong>Демонстрация экрана:</strong> Стримить можно как весь экран, так и отдельное окно приложения.</li>
                                    <li><strong>Музыкальные боты:</strong> Вы можете добавлять ботов для прослушивания музыки всей компанией.</li>
                                </ul>
                            </section>

                            <section>
                                <h2>🛡️ Безопасность и Шифрование</h2>
                                <p>MAXCORD использует современные стандарты безопасности для защиты ваших данных.</p>
                                <ul>
                                    <li><strong>LiveKit E2EE:</strong> Голосовые и видеопотоки поддерживают сквозное шифрование (E2EE), что гарантирует, что даже сервер не может прослушать ваш разговор.</li>
                                    <li><strong>Защита сообщений:</strong> Все текстовые сообщения передаются через TLS 1.3 и хранятся в защищенной базе данных.</li>
                                    <li><strong>Двухфакторная аутентификация (2FA):</strong> Вы можете включить 2FA в настройках профиля для дополнительной защиты аккаунта.</li>
                                </ul>
                            </section>

                            <section>
                                <h2>🛠️ Управление сервером</h2>
                                <p>Если вы администратор сервера, вам доступны расширенные инструменты управления.</p>
                                <ul>
                                    <li><strong>Логи аудита:</strong> Отслеживайте все действия модераторов и изменения настроек.</li>
                                    <li><strong>Вебхуки:</strong> Интегрируйте внешние сервисы (GitHub, GitLab, Jira) напрямую в текстовые каналы.</li>
                                    <li><strong>Пользовательские эмодзи:</strong> Загружайте свои собственные наборы эмодзи и стикеров.</li>
                                </ul>
                            </section>
                        </div>
                    ) : (
                        <div className="docs-content">
                            <h1>API для ботов (Webhooks & Sockets)</h1>
                            <p className="lead">Вы можете создавать своих ботов для MAXCORD, используя наш простой SDK на основе Socket.io и Webhooks.</p>

                            <section>
                                <h2>🔑 Авторизация</h2>
                                <p>Для работы бота требуется токен (Bot Token), который можно получить в панели разработчика (или через администратора сервера).</p>
                                <div className="code-block">
                                    <code>{`const socket = io("https://maxcord.fun", { auth: { token: "YOUR_BOT_TOKEN" } });`}</code>
                                </div>
                            </section>

                            <section>
                                <h2>📨 Отправка сообщений (Webhooks)</h2>
                                <p>Самый простой способ отправить сообщение в канал — использовать POST запрос на Webhook.</p>
                                <div className="code-block">
                                    <pre>{`POST /api/webhooks/{TOKEN}/{CHANNEL_ID}
{
  "content": "Привет, это сообщение от бота!",
  "buttons": [
    { "label": "Открыть GitHub", "url": "https://github.com..." },
    { "label": "Пропустить трек", "actionId": "skip_track", "style": "primary" }
  ]
}`}</pre>
                                </div>
                            </section>

                            <section>
                                <h2>🔘 Интерактивные кнопки</h2>
                                <p>Боты могут добавлять кнопки в свои сообщения. Когда пользователь нажимает кнопку с <code>actionId</code>, сервер отправляет событие вашему боту.</p>
                                <div className="code-block">
                                    <pre>{`socket.on("interactive-button-click", (data) => {
  const { actionId, messageId, user } = data;
  if(actionId === "skip_track") {
     // Ваша логика пропуска трека
  }
});`}</pre>
                                </div>
                            </section>

                            <section>
                                <h2>🎤 Работа с Голосом и Живой Поток</h2>
                                <p>MAXCORD использует RTC-узлы для передачи звука. Рекомендуется использовать официальный LiveKit SDK для Node.js для подключения к голосовым каналам.</p>
                                <div className="code-block">
                                    <pre>{`// Пример подключения к голосовому каналу (Node.js)
const { Room, AudioSource, LocalAudioTrack } = require("@livekit/rtc-node");
const livekitRoom = new Room();
await livekitRoom.connect(serverUrl, token);
const audioSource = new AudioSource(48000, 1);
const audioTrack = LocalAudioTrack.createAudioTrack("music", audioSource);
await livekitRoom.localParticipant.publishTrack(audioTrack, { source: "microphone" });`}</pre>
                                </div>
                            </section>

                            <section>
                                <h2>🔗 Пример реального бота (Музыкальный бот)</h2>
                                <p>Бот слушает событие <code>!play</code>, извлекает метаданные трека и стримит его через FFmpeg.</p>
                                <div className="code-block">
                                    <pre>{`// Упрощенный цикл воспроизведения
const ffmpeg = spawn("ffmpeg", ["-re", "-i", url, "-f", "s16le", "-ar", "48000", "-ac", "1", "pipe:1"]);
ffmpeg.stdout.on("data", (chunk) => {
  // Нарезка на кадры (FRAME_SIZE = 960 * 2) и захват через audioSource.captureFrame
});`}</pre>
                                </div>
                            </section>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Docs;
