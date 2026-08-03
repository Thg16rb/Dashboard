#!/usr/bin/env bash
#
# Deploy da demo do Dashboard/TrafficIntel em um VPS Linux (Ubuntu/Debian).
# Servidor alvo: 185.225.22.172
#
# COMO USAR (dentro do VPS, como root ou com sudo):
#   1. Edite a variável DOMINIO abaixo com o seu domínio (ex.: dashboard.seusite.com).
#      Deixe vazio ("") para acessar só por IP:3000, sem HTTPS.
#   2. bash deploy.sh
#
set -euo pipefail

# ===== JÁ PREENCHIDO =====
DOMINIO="dashboard.sistemautomacao.com"   # subdomínio dedicado (não mexe no site principal)
EMAIL_CERTBOT="thiago16ribeiro@gmail.com" # para avisos de renovação do certificado
# =========================

echo "==> [1/5] Instalando Node 20, pnpm e PM2"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm i -g pnpm pm2

echo "==> [2/5] Clonando o repositório (branch demo, via SSH)"
if [ ! -d "$HOME/Dashboard" ]; then
  git clone git@github.com:Thg16rb/Dashboard.git "$HOME/Dashboard"
fi
cd "$HOME/Dashboard"
git remote set-url origin git@github.com:Thg16rb/Dashboard.git
git fetch origin
git checkout demo/dashboard-preview
git pull origin demo/dashboard-preview || true

echo "==> [3/5] Instalando deps e buildando o front"
pnpm --filter @dashboard/web install
pnpm --filter @dashboard/web build

echo "==> [4/5] Subindo com PM2 na porta 3000"
cd apps/web
pm2 delete dashboard 2>/dev/null || true
pm2 start "pnpm start" --name dashboard
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1 || true

if [ -n "$DOMINIO" ]; then
  echo "==> [5/5] Configurando Nginx + HTTPS para $DOMINIO"
  sudo apt-get install -y nginx certbot python3-certbot-nginx
  sudo tee /etc/nginx/sites-available/dashboard > /dev/null <<NGINX
server {
    server_name $DOMINIO;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX
  sudo ln -sf /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  sudo ufw allow 'Nginx Full' 2>/dev/null || true
  sudo certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos -m "$EMAIL_CERTBOT" || \
    echo "!! Certbot falhou — verifique se o DNS de $DOMINIO aponta para 185.225.22.172"
  echo ""
  echo "PRONTO ✅  Acesse: https://$DOMINIO/dashboard"
else
  sudo ufw allow 3000/tcp 2>/dev/null || true
  echo ""
  echo "PRONTO ✅  Acesse: http://185.225.22.172:3000/dashboard"
  echo "(sem HTTPS — defina DOMINIO no topo do script para ativar o cadeado)"
fi
