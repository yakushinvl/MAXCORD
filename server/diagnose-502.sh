#!/bin/bash

echo "=== Диагностика ошибки 502 Bad Gateway ==="
echo ""

# Проверка статуса Node.js сервера
echo "1. Проверка статуса Node.js сервера (PM2):"
pm2 list
echo ""

# Проверка порта 5000
echo "2. Проверка, слушает ли что-то порт 5000:"
netstat -tlnp | grep :5000 || ss -tlnp | grep :5000
echo ""

# Проверка статуса nginx
echo "3. Статус Nginx:"
sudo systemctl status nginx --no-pager | head -20
echo ""

# Проверка логов nginx
echo "4. Последние ошибки Nginx:"
sudo tail -20 /var/log/nginx/error.log
echo ""

# Проверка логов приложения
echo "5. Последние логи приложения (PM2):"
pm2 logs --lines 20 --nostream
echo ""

# Проверка конфигурации nginx
echo "6. Проверка конфигурации Nginx:"
sudo nginx -t
echo ""

# Проверка доступности localhost:5000
echo "7. Проверка доступности localhost:5000:"
curl -I http://localhost:5000/api/health 2>&1 | head -5
echo ""

echo "=== Рекомендации ==="
echo "Если сервер не запущен:"
echo "  cd /var/www/maxcord/server"
echo "  pm2 restart ecosystem.config.js"
echo ""
echo "Если nginx не может подключиться:"
echo "  sudo systemctl restart nginx"
echo "  sudo systemctl restart pm2-root"
echo ""

