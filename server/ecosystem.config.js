// PM2 Ecosystem конфигурация для MAXCORD Server
// Использование: pm2 start ecosystem.config.js

module.exports = {
  apps: [{
    name: 'maxcord-server',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    // Автоматический перезапуск при сбоях
    autorestart: true,
    // Наблюдение за файлами (только для разработки)
    watch: false,
    // Максимальное использование памяти (перезапуск при превышении)
    max_memory_restart: '500M',
    // Логирование
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    // Количество дней хранения логов
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Перезапуск при изменении файлов (только для разработки)
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    // Переменные окружения из .env
    env_file: './.env'
  }]
};



