#!/usr/bin/env bash
# Isloh serverini shu kompyuterda doimiy xizmat sifatida o'rnatadi (Linux, systemd --user).
# Kompyuter yonganda o'zi ishga tushadi; bot, eslatmalar va PDF hisobotlar doim ishlaydi.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP="$HOME/.local/share/isloh"
CONF="$HOME/.config/isloh"
NODE="$(command -v node)"
"$NODE" -e "require('node:sqlite')" 2>/dev/null || { echo "Node.js 22.13 yoki yangisi kerak"; exit 1; }

mkdir -p "$APP" "$CONF" "$HOME/.config/systemd/user" "$HOME/.local/share/applications"
rm -rf "$APP/server" "$APP/web"
cp -r "$SRC/server" "$SRC/web" "$SRC/package.json" "$APP/"
install -m 755 "$SRC/scripts/set-token.sh" "$APP/set-token.sh"
if [ ! -f "$CONF/.env" ]; then
  sed -e "s|^DATA_DIR=.*|DATA_DIR=$APP/data|" -e "s|^DEV_LOGIN=.*|DEV_LOGIN=0|" "$SRC/.env.example" > "$CONF/.env"
  chmod 600 "$CONF/.env"
fi

cat > "$HOME/.config/systemd/user/isloh.service" <<EOF
[Unit]
Description=Isloh — server, Telegram bot va eslatmalar
After=network-online.target

[Service]
Environment=ISLOH_ENV=$CONF/.env
ExecStart=$NODE $APP/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

PORT=$(grep -E '^PORT=' "$CONF/.env" | cut -d= -f2); PORT=${PORT:-8080}
BROWSER=$(command -v google-chrome || command -v chromium || command -v chromium-browser || echo xdg-open)
cat > "$HOME/.local/share/applications/isloh.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Isloh
Comment=Maqsad sari ongli hayot
Exec=$BROWSER --app=http://127.0.0.1:$PORT/ --class=Isloh
Icon=$APP/web/icons/icon-512.png
Terminal=false
Categories=Office;Utility;
EOF

systemctl --user daemon-reload
systemctl --user enable isloh.service >/dev/null 2>&1
systemctl --user restart isloh.service
for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$PORT/api/config" >/dev/null && break; sleep 0.3; done
echo "Isloh ishlayapti: http://127.0.0.1:$PORT"
echo "Sozlamalar: $CONF/.env   Ma'lumotlar: $APP/data"
grep -q '^BOT_TOKEN=.\+' "$CONF/.env" || echo "Bot tokeni yo'q — qo'shish uchun: $APP/set-token.sh"
