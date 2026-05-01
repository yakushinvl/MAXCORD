#!/bin/bash

# Скрипт автоматического развертывания MAXCORD Server на Ubuntu VPS
# Использование: sudo bash deploy.sh

set -e

echo "=========================================="
echo "MAXCORD Server - Автоматическое развертывание"
echo "=========================================="

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo "Пожалуйста, запустите скрипт с правами root (sudo)"
    exit 1
fi

# Переменные
APP_DIR="/var/www/maxcord"
SERVER_DIR="$APP_DIR/server"
NODE_VERSION="20"

echo ""
echo "Шаг 1: Обновление системы..."
apt update
apt upgrade -y

echo ""
echo "Шаг 2: Установка необходимых пакетов..."
apt install -y curl wget git build-essential

echo ""
echo "Шаг 3: Установка Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
else
    echo "Node.js уже установлен: $(node --version)"
fi

echo ""
echo "Шаг 4: Установка PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "PM2 уже установлен"
fi

echo ""
echo "Шаг 5: Установка MongoDB..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt update
    apt install -y mongodb-org
    systemctl start mongod
    systemctl enable mongod
    echo "MongoDB установлен и запущен"
else
    echo "MongoDB уже установлен"
    systemctl start mongod || true
    systemctl enable mongod || true
fi

echo ""
echo "Шаг 6: Создание директорий..."
mkdir -p "$APP_DIR"
mkdir -p "$SERVER_DIR/uploads"
chmod 755 "$SERVER_DIR/uploads" 2>/dev/null || true

echo ""
echo "Шаг 7: Настройка переменных окружения..."
if [ ! -f "$SERVER_DIR/.env" ]; then
    cat > "$SERVER_DIR/.env" << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/maxcord
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
CLIENT_URL=http://localhost:3000
EOF
    echo "Файл .env создан. Пожалуйста, отредактируйте его:"
    echo "  nano $SERVER_DIR/.env"
else
    echo "Файл .env уже существует"
fi

echo ""
echo "Шаг 8: Установка Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl enable nginx
else
    echo "Nginx уже установлен"
fi

echo ""
echo "Шаг 9: Настройка Nginx..."
cat > /etc/nginx/sites-available/maxcord << 'NGINX_CONFIG'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /api/uploads {
        alias /var/www/maxcord/server/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_CONFIG

if [ ! -L /etc/nginx/sites-enabled/maxcord ]; then
    ln -s /etc/nginx/sites-available/maxcord /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
fi

nginx -t && systemctl reload nginx
echo "Nginx настроен"

echo ""
echo "Шаг 10: Настройка Firewall..."
if command -v ufw &> /dev/null; then
    ufw --force enable || true
    ufw allow 22/tcp || true
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    echo "Firewall настроен"
else
    echo "UFW не установлен, пропускаем настройку firewall"
fi

echo ""
echo "=========================================="
echo "Развертывание завершено!"
echo "=========================================="
echo ""
echo "Следующие шаги:"
echo ""
echo "1. Скопируйте файлы сервера в $SERVER_DIR"
echo "   Например:"
echo "   scp -r server/* user@server:$SERVER_DIR/"
echo ""
echo "2. Отредактируйте переменные окружения:"
echo "   nano $SERVER_DIR/.env"
echo "   Особенно важно изменить CLIENT_URL на ваш домен/IP"
echo ""
echo "3. Установите зависимости:"
echo "   cd $SERVER_DIR"
echo "   npm install --production"
echo ""
echo "4. Запустите приложение:"
echo "   cd $SERVER_DIR"
echo "   pm2 start server.js --name maxcord-server"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "5. (Опционально) Настройте SSL:"
echo "   apt install -y certbot python3-certbot-nginx"
echo "   certbot --nginx -d your-domain.com"
echo ""
echo "Проверка статуса:"
echo "  pm2 status"
echo "  pm2 logs maxcord-server"
echo "  systemctl status nginx"
echo "  systemctl status mongod"
echo ""



