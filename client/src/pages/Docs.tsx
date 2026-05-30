import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Docs.css';

const Docs: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'general' | 'bot-api' | 'miniapps'>('general');

    return (
        <div className="docs-container">
            <nav className="docs-nav">
                <div className="nav-logo" onClick={() => navigate('/')}>
                    <img src={`${import.meta.env.BASE_URL}logo_256x256.png`} alt="MAXCORD" />
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
                    <div
                        className={`sidebar-item ${activeTab === 'miniapps' ? 'active' : ''}`}
                        onClick={() => setActiveTab('miniapps')}
                    >
                        Мини-приложения
                    </div>
                </aside>

                <main className="docs-main">
                    {activeTab === 'general' && (
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
                    )}

                    {activeTab === 'bot-api' && (
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

                    {activeTab === 'miniapps' && (
                        <div className="docs-content">
                            <h1>Мини-приложения (Embedded Web Apps)</h1>
                            <p className="lead">Интегрируйте свои веб-сервисы, игры или инструменты прямо в интерфейс MAXCORD.</p>

                            <section className="disclaimer-section" style={{ background: 'rgba(255, 107, 0, 0.1)', borderLeft: '4px solid #ff6b00', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
                                <h3 style={{ color: '#ff6b00', marginTop: 0 }}>⚠️ Критическое требование</h3>
                                <p>Сайт, на котором размещено ваше мини-приложение, <strong>НЕ ДОЛЖЕН блокировать</strong> возможность открытия в <code>iframe</code> (плавающем окне MAXCORD).</p>
                                <p>Убедитесь, что заголовки на вашем сервере настроены следующим образом:</p>
                                <ul>
                                    <li><code>X-Frame-Options</code>: не должен иметь значение <code>DENY</code> или <code>SAMEORIGIN</code>.</li>
                                    <li><code>Content-Security-Policy</code>: директива <code>frame-ancestors</code> должна разрешать домены MAXCORD или быть установлена в <code>*</code>.</li>
                                </ul>
                                <p style={{ marginBottom: 0 }}>Если эти заголовки настроены неверно, приложение отобразится в виде пустого окна (отказ в соединении).</p>
                            </section>

                            <section>
                                <h2>🚀 Как это работает</h2>
                                <p>Мини-приложения открываются внутри MAXCORD как изолированные плавающие окна. Это позволяет пользователям взаимодействовать с вашим контентом, не покидая чат или голосовой канал.</p>
                                <ul>
                                    <li><strong>Изоляция:</strong> Каждое приложение работает в своем контексте.</li>
                                    <li><strong>Адаптивность:</strong> Окна могут изменять размер, поэтому ваше приложение должно быть полностью адаптивным.</li>
                                    <li><strong>HTTPS:</strong> Поддерживаются только защищенные соединения.</li>
                                    <li><strong>Свёртывание:</strong> Любое окно можно свернуть кнопкой в шапке (≡) — оно превратится в розовую иконку в левом сайдбаре под витриной. Клик — развернуть, ПКМ — закрыть. Аппка продолжает работать в фоне (мини-аппке делать ничего не нужно — это встроено в платформу).</li>
                                </ul>
                            </section>

                            <section>
                                <h2>🎨 Оформление и Витрина</h2>
                                <p>Вы можете опубликовать своё приложение на «Витрине», чтобы другие пользователи могли его запускать.</p>
                                <ul>
                                    <li><strong>Баннеры и Аватары:</strong> Настройте привлекательный внешний вид в панели разработчика.</li>
                                    <li><strong>Описание:</strong> Расскажите пользователям о возможностях вашего приложения.</li>
                                    <li><strong>Запуск из профиля:</strong> Если вы открыли приложение, другие пользователи увидят кнопку «Запустить» в вашем профиле и смогут присоединиться к вам.</li>
                                </ul>
                            </section>

                            <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.08)', margin: '40px 0' }} />

                            <h1 style={{ marginTop: 0 }}>MAXCORD Mini-App SDK</h1>
                            <p className="lead">
                                Универсальный JavaScript-SDK для взаимодействия мини-аппки с хостом MAXCORD: профиль пользователя, голосовой канал, трансляция аудио в voice, постоянное хранилище, CORS-прокси, OAuth-попап.
                            </p>

                            <section>
                                <h2>🧩 Подключение</h2>
                                <p>Подключите SDK скриптом в <code>&lt;head&gt;</code>. Он отдаётся с того же домена, что и MAXCORD, и доступен по абсолютному пути <code>/maxcord-sdk.js</code>.</p>
                                <div className="code-block">
                                    <pre>{`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="/maxcord-sdk.js"></script>
</head>
<body>
  <script>
    (async () => {
      // SDK инициализируется синхронно при загрузке скрипта.
      // На случай динамической вставки можно дождаться события:
      await new Promise(r => window.maxcord ? r() : addEventListener('maxcord-sdk-ready', r, { once: true }));

      const init = await maxcord.init();
      console.log(init); // { user, app, voiceChannelId }
    })();
  </script>
</body>
</html>`}</pre>
                                </div>
                                <p>SDK работает только когда страница загружена внутри iframe MAXCORD. Если открыть напрямую — методы будут висеть без ответа.</p>
                            </section>

                            <section>
                                <h2>📚 Полный API-справочник</h2>

                                <h3>maxcord.init()</h3>
                                <p>Хэндшейк. Вызывайте первой. Возвращает текущий контекст.</p>
                                <div className="code-block">
                                    <pre>{`const { user, app, voiceChannelId } = await maxcord.init();
// user: { _id, username, avatar } | null
// app:  { _id, name }
// voiceChannelId: string | null`}</pre>
                                </div>

                                <h3>maxcord.getUser()</h3>
                                <p>Профиль текущего пользователя MAXCORD.</p>
                                <div className="code-block">
                                    <pre>{`const user = await maxcord.getUser();
// { _id: "65f...", username: "anton", avatar: "/api/uploads/..." } | null`}</pre>
                                </div>

                                <h3>maxcord.getVoiceChannel()</h3>
                                <p>В каком голосовом канале сейчас находится пользователь.</p>
                                <div className="code-block">
                                    <pre>{`const { channelId } = await maxcord.getVoiceChannel();
// channelId: string | null`}</pre>
                                </div>

                                <h3>maxcord.publishAudioTrack(track)</h3>
                                <p>
                                    Транслирует <code>MediaStreamTrack</code> (kind=&quot;audio&quot;) в голосовой канал пользователя. Все участники канала будут слышать этот звук как дополнительный аудио-источник от данного юзера.
                                </p>
                                <p>
                                    Возвращает <code>sid</code> публикации — сохраните, чтобы потом остановить через <code>unpublishAudioTrack(sid)</code>. Если юзер не в голосовом — вернёт <code>null</code>.
                                </p>
                                <div className="code-block">
                                    <pre>{`const audio = new Audio('https://example.com/song.mp3');
audio.crossOrigin = 'anonymous'; // обязательно для captureStream
await audio.play();

const stream = audio.captureStream();
const track = stream.getAudioTracks()[0];

const sid = await maxcord.publishAudioTrack(track);
// ...позже:
await maxcord.unpublishAudioTrack(sid);`}</pre>
                                </div>
                                <p style={{ color: '#ff9966' }}>
                                    <strong>Ограничение браузера:</strong> <code>MediaStreamTrack</code> передаётся в host через transferable postMessage — это Chrome&nbsp;116+ / Firefox&nbsp;117+. В старых браузерах метод вернёт ошибку.
                                </p>

                                <h3>maxcord.unpublishAudioTrack(sid)</h3>
                                <p>Остановить ранее опубликованный трек по его sid.</p>

                                <h3>maxcord.fetch(url, options)</h3>
                                <p>
                                    HTTP-запрос через серверный прокси MAXCORD — обходит CORS. Используйте, когда нужно дёргать сторонние API, которые не отдают <code>Access-Control-Allow-Origin</code>.
                                </p>
                                <div className="code-block">
                                    <pre>{`const r = await maxcord.fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ...' },
  body: JSON.stringify({ q: 'hello' }),
  responseType: 'json',     // 'json' | 'text' | 'arraybuffer'
  timeout: 15000,           // мс, максимум 30000
});

// r.status, r.headers, r.data
// для responseType='arraybuffer' вместо data будет r.base64`}</pre>
                                </div>
                                <p>
                                    <strong>Безопасность:</strong> заголовки <code>Cookie</code>/<code>Host</code> вырезаются. Запросы к private-IP (10/172.16/192.168/127, IPv6 ULA, localhost) блокируются.
                                </p>

                                <h3>maxcord.sendMessage(channelId, payload)</h3>
                                <p>Отправляет сообщение в текстовый канал от лица текущего пользователя.</p>
                                <div className="code-block">
                                    <pre>{`await maxcord.sendMessage('65f...', {
  content: 'Сейчас играет: ' + trackName,
  embeds: [{ title, description, color: '#ffcc00' }],
});`}</pre>
                                </div>

                                <h3>maxcord.oauthPopup(url, options)</h3>
                                <p>
                                    Открывает OAuth-попап и резолвится URL'ом, на который провайдер вернул пользователя. Удобно для implicit-flow (<code>response_type=token</code>) — токен приходит в hash, ничего серверного не нужно.
                                </p>
                                <div className="code-block">
                                    <pre>{`const r = await maxcord.oauthPopup(
  'https://oauth.example.com/authorize?response_type=token&client_id=...&redirect_uri=https://my-maxcord-domain/miniapps/myapp/cb.html',
  { width: 600, height: 720 }
);
// r.href, r.hash, r.search — то, на что редиректнул провайдер
const params = new URLSearchParams(r.hash.replace(/^#/, ''));
const accessToken = params.get('access_token');
await maxcord.storage.set('access_token', accessToken);`}</pre>
                                </div>
                                <p>
                                    Поллинг идёт пока popup не окажется same-origin (т.е. вы должны зарегистрировать <code>redirect_uri</code> внутри вашей мини-аппки — например, статическая <code>oauth-callback.html</code> в её папке).
                                </p>

                                <h3>maxcord.storage</h3>
                                <p>
                                    Постоянное key-value хранилище <em>на уровне (пользователь, мини-аппка)</em>. Идеально для хранения токенов авторизации, настроек, состояния.
                                </p>
                                <div className="code-block">
                                    <pre>{`await maxcord.storage.set('access_token', 'y0_...');
const token = await maxcord.storage.get('access_token');
const all = await maxcord.storage.getAll();   // { access_token, ... }
await maxcord.storage.delete('access_token');`}</pre>
                                </div>

                                <h3>maxcord.on(event, handler)</h3>
                                <p>Подписка на события хоста. Возвращает функцию отписки.</p>
                                <div className="code-block">
                                    <pre>{`const off = maxcord.on('voiceChannelChanged', ({ channelId }) => {
  console.log('Юзер сменил канал:', channelId);
});

// Позже:
off();`}</pre>
                                </div>
                                <p>Текущие события: <code>voiceChannelChanged</code>.</p>
                            </section>

                            <section>
                                <h2>⚙️ Серверные endpoints (под капотом)</h2>
                                <p>
                                    SDK — просто обёртка над postMessage и этими REST-эндпоинтами. Вам они напрямую не нужны, но знать полезно (особенно если пишете нативный клиент).
                                </p>
                                <ul>
                                    <li><code>GET /api/miniapps/:id/storage</code> — все ключи текущего юзера для аппки</li>
                                    <li><code>GET /api/miniapps/:id/storage/:key</code> — <code>{`{ value }`}</code></li>
                                    <li><code>PUT /api/miniapps/:id/storage/:key</code> — body <code>{`{ value }`}</code></li>
                                    <li><code>DELETE /api/miniapps/:id/storage/:key</code></li>
                                    <li><code>POST /api/miniapps/:id/fetch</code> — body <code>{`{ url, method, headers, body, responseType, timeout }`}</code></li>
                                </ul>
                                <p>Все запросы требуют JWT-токен MAXCORD (<code>Authorization: Bearer ...</code>) — SDK подставляет автоматически.</p>
                            </section>

                            <section>
                                <h2>🎵 Пример: музыкальный плеер</h2>
                                <p>Полная аппка-проигрыватель, которая стримит аудио в голосовой канал — около 60 строк.</p>
                                <div className="code-block">
                                    <pre>{`<script src="/maxcord-sdk.js"></script>
<script>
(async () => {
  const init = await maxcord.init();
  if (!init.voiceChannelId) {
    alert('Зайди в голосовой канал');
    return;
  }

  // Скачиваем mp3 через прокси, чтобы Blob был same-origin
  // и captureStream() заработал без CORS-проблем.
  const r = await maxcord.fetch('https://example.com/song.mp3', {
    responseType: 'arraybuffer'
  });
  const bytes = Uint8Array.from(atob(r.base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/mpeg' });

  const audio = new Audio(URL.createObjectURL(blob));
  await audio.play();

  const track = audio.captureStream().getAudioTracks()[0];
  const sid = await maxcord.publishAudioTrack(track);

  audio.addEventListener('ended', async () => {
    await maxcord.unpublishAudioTrack(sid);
  });
})();
</script>`}</pre>
                                </div>
                            </section>

                            <section>
                                <h2>🔐 Пример: OAuth через сторонний провайдер</h2>
                                <p>Шаблон implicit-flow с сохранением токена в storage.</p>
                                <div className="code-block">
                                    <pre>{`const CLIENT_ID = 'your_client_id';
const REDIRECT = new URL('./oauth-callback.html', location.href).toString();

let token = await maxcord.storage.get('access_token');
if (!token) {
  const url = 'https://oauth.provider.com/authorize'
    + '?response_type=token'
    + '&client_id=' + encodeURIComponent(CLIENT_ID)
    + '&redirect_uri=' + encodeURIComponent(REDIRECT);
  const r = await maxcord.oauthPopup(url);
  token = new URLSearchParams(r.hash.slice(1)).get('access_token');
  await maxcord.storage.set('access_token', token);
}

// Используем токен через прокси
const me = await maxcord.fetch('https://api.provider.com/me', {
  headers: { Authorization: 'Bearer ' + token }
});`}</pre>
                                </div>
                                <p>
                                    Файл <code>oauth-callback.html</code> в папке вашей мини-аппки может быть пустой — SDK поллит location.href попапа и резолвится, как только адрес становится same-origin.
                                </p>
                            </section>

                            <section>
                                <h2>🧭 Жизненный цикл и очистка</h2>
                                <ul>
                                    <li>Все опубликованные через <code>publishAudioTrack</code> треки автоматически снимаются с публикации при закрытии окна мини-аппки.</li>
                                    <li>Если юзер выходит из голосового канала, активные публикации автоматически удаляются — но событие <code>voiceChannelChanged</code> поможет обновить UI.</li>
                                    <li>Storage сохраняется навсегда (до явного <code>delete</code>) — это правильное место для refresh-токенов, настроек, кэшей.</li>
                                </ul>
                            </section>

                            <section>
                                <h2>🎙️ Voice Presence — мини-аппка как участник голосового канала</h2>
                                <p>
                                    Мощный примитив: мини-аппка может «встать» виртуальным участником в текущий
                                    голосовой канал пользователя. Появится отдельная карточка-тайл с обложкой
                                    (или live-видео), кнопками управления и слайдером прогресса — всё интерактивно
                                    для остальных членов канала.
                                </p>
                                <p>
                                    <strong>Кто видит:</strong> все, кто сейчас в этом голосовом канале (включая инициатора).<br />
                                    <strong>Кто контролирует:</strong> любой член канала, нажатия приходят владельцу-мини-аппке.<br />
                                    <strong>Когда исчезает:</strong> при <code>destroy()</code>, при выходе хоста из канала, при дисконнекте.
                                </p>

                                <h3>Создание сессии</h3>
                                <div className="code-block">
                                    <pre>{`const presence = await maxcord.voicePresence.create({
  displayName: 'Яндекс Музыка',
  avatar: '/logo_256x256.png', // fallback если не задан background
});

// Опционально — обложка/цвет на фоне тайла
await presence.setBackground({ type: 'image', url: 'https://.../cover.jpg' });
// или: { type: 'color', color: '#a155ff' }
// или: null — fallback on avatar`}</pre>
                                </div>

                                <h3>Трансляция аудио в канал</h3>
                                <div className="code-block">
                                    <pre>{`const audio = new Audio(blobUrl);
await audio.play();
const track = audio.captureStream().getAudioTracks()[0];
await presence.publishAudio(track);

// потом:
await presence.unpublishAudio();`}</pre>
                                </div>
                                <p>
                                    Аудио идёт через того же пользователя, что создал presence, но как отдельный
                                    LiveKit-трек с именем <code>maxcord-presence:&lt;sessionId&gt;</code>. Получатели
                                    автоматически роутят его в нужный тайл, минуя обычный mic-микс.
                                </p>

                                <h3>Live-видео (фон тайла)</h3>
                                <div className="code-block">
                                    <pre>{`const v = document.createElement('video');
v.src = '/path/to/clip.mp4';
await v.play();
const vt = v.captureStream().getVideoTracks()[0];
await presence.publishVideo(vt); // background tile показывает live-видео`}</pre>
                                </div>

                                <h3>Контролы (кнопки + слайдеры)</h3>
                                <div className="code-block">
                                    <pre>{`await presence.setControls([
  { id: 'prev',       kind: 'button', label: '⏮', tooltip: 'Предыдущий' },
  { id: 'play-pause', kind: 'button', label: '⏸', style: 'primary' },
  { id: 'next',       kind: 'button', label: '⏭' },
  { id: 'seek',       kind: 'slider', min: 0, max: 100, value: 0 },
]);

// Обновляй слайдер/лейбл по ходу проигрывания:
setInterval(() => {
  const pct = Math.round((audio.currentTime / audio.duration) * 100);
  presence.updateControl('seek', { value: pct });
}, 1000);

// Когда кто-то кликает — событие прилетает только владельцу presence:
presence.on('control', ({ controlId, value, fromUserId }) => {
  if (controlId === 'play-pause') audio.paused ? audio.play() : audio.pause();
  if (controlId === 'next') skipNext();
  if (controlId === 'seek')  audio.currentTime = (value / 100) * audio.duration;
});`}</pre>
                                </div>
                                <p>
                                    Контролы поддерживают два <code>kind</code>: <code>button</code> и <code>slider</code>.
                                    Поля: <code>id</code>, <code>label</code>, <code>tooltip</code>, <code>style</code>
                                    (<code>'primary' | 'danger' | ''</code>), <code>min</code>/<code>max</code>/<code>value</code> для слайдеров.
                                </p>

                                <h3>Громкость presence — на стороне слушателя</h3>
                                <p>
                                    У каждого тайла presence в voice-канале есть свой регулятор громкости (появляется в правом
                                    верхнем углу при hover). Значение хранится локально для каждого слушателя в
                                    <code>localStorage</code> под ключом <code>presenceVolumes</code> и переживает
                                    перезагрузки. Диапазон 0..2 (0% — mute, 100% — обычно, 200% — усиление).
                                </p>
                                <p>
                                    Мини-аппке делать ничего не нужно — управление громкостью встроено в платформу и работает
                                    автоматически для любого опубликованного через <code>presence.publishAudio()</code> трека.
                                </p>

                                <h3>Завершение</h3>
                                <div className="code-block">
                                    <pre>{`await presence.destroy(); // снимает audio/video с публикации, удаляет тайл у всех`}</pre>
                                </div>

                                <p style={{ color: '#ff9966', marginTop: 16 }}>
                                    <strong>Сейчас работает только в серверных голосовых каналах.</strong> Поддержка DM-звонков —
                                    в следующих версиях (там LiveKit-комната живёт в другом компоненте).
                                </p>
                            </section>

                            <section>
                                <h2>🍿 Готовый пример</h2>
                                <p>
                                    Аппка <strong>Яндекс Музыка</strong> в витрине MAXCORD написана целиком на этом SDK — без какой-либо специальной серверной логики. Исходники: <code>server/public/miniapps/yandex-music/</code> в репозитории.
                                </p>
                            </section>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Docs;
