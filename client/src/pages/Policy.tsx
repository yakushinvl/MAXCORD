import React from 'react';
import { useNavigate } from 'react-router-dom';

const Policy: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="docs-container" style={{ padding: '0 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div className="policy-content" style={{
                background: 'rgba(13, 13, 15, 0.4)',
                backdropFilter: 'blur(40px) saturate(160%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '32px',
                padding: '80px 60px',
                maxWidth: '1000px',
                width: '100%',
                margin: '100px auto',
                boxShadow: '0 32px 128px rgba(0,0,0,0.6)',
                color: '#fff',
                fontFamily: 'Inter, system-ui, sans-serif'
            }}>
                <button 
                  onClick={() => navigate('/')} 
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    marginBottom: '60px',
                    fontWeight: 700,
                    fontSize: '13px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Назад на главную
                </button>

                <h1 style={{ fontSize: '48px', fontWeight: 900, marginBottom: '20px', letterSpacing: '-1.2px', background: 'linear-gradient(135deg, #fff 0%, #64748b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Политика конфиденциальности MAXCORD</h1>
                <p className="lead" style={{ fontSize: '20px', color: '#94a3b8', marginBottom: '80px', lineHeight: 1.6 }}>
                    Этот документ объясняет, как мы собираем, используем, передаем и защищаем вашу информацию. Мы обязуемся защищать частную жизнь каждого пользователя MAXCORD.
                </p>

                <div className="policy-sections" style={{ display: 'grid', gap: '80px' }}>
                    
                    {/* SECTION 1 */}
                    <section>
                        <h2 style={{ color: 'var(--primary-neon, #00e5ff)', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>1. Какую информацию мы собираем</h2>
                        <div style={{ color: '#cbd5e1', lineHeight: '2', fontSize: '15.5px' }}>
                            <h3 style={{ color: '#fff', fontSize: '17px', marginBottom: '16px' }}>1.1. Информацию, которую вы предоставляете нам напрямую</h3>
                            <ul style={{ paddingLeft: '20px', marginBottom: '32px' }}>
                                <li><strong>Информация об учетной записи:</strong> При регистрации в MAXCORD вы предоставляете нам адрес электронной почты, желаемое имя пользователя и пароль. Если вы включаете двухфакторную аутентификацию (2FA), мы храним соответствующие настройки безопасности. Также мы можем хранить данные вашего профиля: аватары, баннеры и пользовательские статусы.</li>
                                <li><strong>Контент:</strong> Мы храним ваши сообщения, изображения, видео, аудиофайлы и другие материалы, которые вы отправляете через чаты. Это необходимо для того, чтобы вы могли получать доступ к своей истории переписок с любого устройства в любое время.</li>
                                <li><strong>Коммуникации с поддержкой:</strong> Если вы обращаетесь к нам с вопросами или жалобами, мы сохраняем историю этого общения для решения возникших проблем.</li>
                            </ul>

                            <h3 style={{ color: '#fff', fontSize: '17px', marginBottom: '16px' }}>1.2. Информацию, собираемую автоматически</h3>
                            <ul style={{ paddingLeft: '20px', marginBottom: '32px' }}>
                                <li><strong>Технические логи и данные об использовании:</strong> Мы записываем информацию о том, как вы взаимодействуете с приложением: время входа, используемые функции, версии ОС и приложения. Это помогает нам оптимизировать производительность.</li>
                                <li><strong>Данные об устройстве:</strong> IP-адрес, тип браузера (если применимо), уникальные идентификаторы устройства. Мы используем IP-адреса для предотвращения злоупотреблений сервисом (например, для блокировки спам-ботов).</li>
                                <li><strong>Cookie и локальное хранилище:</strong> Мы используем локальное хранилище данных (LocalStorage) в вашем браузере или приложении для сохранения токенов авторизации и ваших визуальных настроек (тема, режим производительности).</li>
                            </ul>

                            <h3 style={{ color: '#fff', fontSize: '17px', marginBottom: '16px' }}>1.3. Голосовые и видео данные</h3>
                            <div style={{ padding: '24px', background: 'rgba(0, 229, 255, 0.03)', borderRadius: '20px', border: '1px solid rgba(0, 229, 255, 0.1)' }}>
                                Мы используем инфраструктуру реального времени (WebRTC) для звонков. Ваш голос и видео передаются по защищенным каналам через наши серверные узлы. <strong>Мы не записываем, не прослушиваем и не храним содержание ваших разговоров.</strong> Потоки данных существуют только во время звонка.
                            </div>
                        </div>
                    </section>

                    {/* SECTION 2 */}
                    <section>
                        <h2 style={{ color: 'var(--primary-neon, #00e5ff)', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>2. Как мы используем вашу информацию</h2>
                        <div style={{ color: '#cbd5e1', lineHeight: '2', fontSize: '15.5px' }}>
                            Мы используем собранные данные для следующих целей:
                            <ul style={{ paddingLeft: '20px', marginTop: '16px' }}>
                                <li><strong>Обеспечение работы Сервиса:</strong> Хранение и доставка сообщений, установление голосовых соединений, поддержка системы ролей и серверов.</li>
                                <li><strong>Безопасность и Модерация:</strong> Мы анализируем подозрительную активность для борьбы со спамом, мошенничеством и ботами. Модераторы используют данные о жалобах для обеспечения соблюдения «Условий использования».</li>
                                <li><strong>Разработка и Улучшение:</strong> Анализ анонимных данных об использовании помогает нам выявлять технические ошибки и выпускать новые функции.</li>
                                <li><strong>Связь с вами:</strong> Отправка уведомлений о безопасности (например, о входе с нового устройства) и ответов на ваши запросы в техподдержку.</li>
                            </ul>
                        </div>
                    </section>

                    {/* SECTION 3 */}
                    <section>
                        <h2 style={{ color: 'var(--primary-neon, #00e5ff)', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>3. Передача и Раскрытие информации</h2>
                        <div style={{ color: '#cbd5e1', lineHeight: '2', fontSize: '15.5px' }}>
                            MAXCORD **не продает** вашу персональную информацию рекламодателям или сторонним компаниям. Мы можем передавать информацию только в случаях:
                            <ul style={{ paddingLeft: '20px', marginTop: '16px' }}>
                                <li><strong>Публичный контент:</strong> Сообщения и данные профиля видны другим пользователям MAXCORD в соответствии с настройками прав доступа (серверные каналы, личные переписки).</li>
                                <li><strong>Сервис-провайдеры:</strong> Мы можем использовать сторонние инструменты для хостинга (серверы базы данных, узлы LiveKit, почтовые шлюзы для 2FA). Эти провайдеры получают доступ к данным только для выполнения своих задач и обязаны сохранять конфиденциальность.</li>
                                <li><strong>Требования закона:</strong> Мы можем раскрыть информацию, если добросовестно считаем, что это необходимо для выполнения судебного приказа, соблюдения закона или защиты жизни и здоровья пользователей.</li>
                            </ul>
                        </div>
                    </section>

                    {/* SECTION 4 */}
                    <section>
                        <h2 style={{ color: 'var(--primary-neon, #00e5ff)', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>4. Ваши права и Контроль</h2>
                        <div style={{ color: '#cbd5e1', lineHeight: '2', fontSize: '15.5px' }}>
                            MAXCORD предоставляет вам широкий спектр инструментов для управления данными:
                            <ul style={{ paddingLeft: '20px', marginTop: '16px' }}>
                                <li><strong>Правка и удаление:</strong> Вы можете изменять данные своего профиля и удалять отправленные сообщения. При удалении сообщения оно становится недоступным для других пользователей и стирается из нашей основной базы данных.</li>
                                <li><strong>Копия данных:</strong> Вы имеете право запросить выгрузку своих данных, хранящихся у нас.</li>
                                <li><strong>Полное удаление:</strong> Вы можете инициировать процедуру полного удаления аккаунта. В этом случае все ваши данные будут безвозвратно удалены (за исключением случаев, когда их хранение требуется законом).</li>
                            </ul>
                        </div>
                    </section>

                    {/* SECTION 5 */}
                    <section>
                        <h2 style={{ color: 'var(--primary-neon, #00e5ff)', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>5. Защита детей</h2>
                        <div style={{ color: '#cbd5e1', lineHeight: '2', fontSize: '15.5px' }}>
                            Сервис MAXCORD предназначен для лиц, достигших 13 лет (или минимального возраста в соответствии с законами вашей страны). Мы не собираем намеренно информацию от детей. Если нам станет известно, что ребенок младше 13 лет предоставил нам свои данные, мы предпримем шаги для немедленного удаления такой информации и закрытия учетной записи.
                        </div>
                    </section>

                    {/* SECTION 6 */}
                    <section>
                        <h2 style={{ color: 'var(--primary-neon, #00e5ff)', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>6. Хранение и Безопасность</h2>
                        <div style={{ color: '#cbd5e1', lineHeight: '2', fontSize: '15.5px' }}>
                            Мы принимаем строгие меры для защиты ваших данных:
                            <ul style={{ paddingLeft: '20px', marginTop: '16px' }}>
                                <li><strong>Шифрование:</strong> Все данные передаются между вашим устройством и сервером по зашифрованным протоколам TLS/HTTPS.</li>
                                <li><strong>Доступ:</strong> Доступ к производственной инфраструктуре строго ограничен и требует многофакторной аутентификации.</li>
                                <li><strong>Срок хранения:</strong> Мы храним данные до тех пор, пока ваш аккаунт существует, или пока это необходимо для реализации целей, описанных выше.</li>
                            </ul>
                        </div>
                    </section>

                    {/* SECTION 7 */}
                    <section>
                        <h2 style={{ color: 'var(--primary-neon, #00e5ff)', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>7. Изменения в Политике</h2>
                        <div style={{ color: '#cbd5e1', lineHeight: '2', fontSize: '15.5px' }}>
                            Мы можем изменять настоящую Политику конфиденциальности в случае внедрения новых функций или изменения юридических требований. При внесении значительных изменений мы уведомим вас через само приложение или через баннер на главной странице. Продолжая пользоваться Сервисом после изменений, вы соглашаетесь с обновленной версией Политики.
                        </div>
                    </section>

                    {/* SECTION 8 */}
                    <section style={{ marginBottom: '40px' }}>
                        <h2 style={{ color: 'var(--primary-neon, #00e5ff)', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '32px', borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: '12px' }}>8. Свяжитесь с нами</h2>
                        <div style={{ color: '#cbd5e1', lineHeight: '2', fontSize: '15.5px' }}>
                            Если у вас есть вопросы по поводу этой политики или ваших данных, пожалуйста, свяжитесь с нашей командой поддержки:
                            <div style={{ marginTop: '24px', display: 'flex', gap: '32px' }}>
                                <div>
                                    <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>Администрация</span>
                                    <span style={{ color: '#fff', fontWeight: 700 }}>@da1lu</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div style={{ marginTop: '100px', paddingTop: '40px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    MAXCORD Platform • Privacy & Safety Center • Последнее обновление: {new Date().toLocaleDateString('ru-RU')}
                </div>
            </div>
        </div>
    );
};

export default Policy;
