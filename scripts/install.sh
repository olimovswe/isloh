#!/usr/bin/env bash
# Isloh desktop dasturini shu kompyuterga o'rnatadi (Linux).
#  - ilovalar menyusida "Isloh" paydo bo'ladi;
#  - kompyuter yonganda dastur trayda o'zi ishga tushadi: Telegram bot, eslatmalar va PDF hisobotlar doim ishlaydi.
# Veb-server, port yoki brauzer yo'q.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP="$HOME/.local/share/isloh"
CONF="$HOME/.config/isloh"
cd "$SRC"

# 1. Dasturni yig'ish
[ -d node_modules/electron-builder ] || npm ci
[ -x node_modules/electron/dist/electron ] || node node_modules/electron/install.js
npx --no-install electron-builder --linux dir >/dev/null
echo "Dastur yig'ildi."

# 2. Ishlab turgan Isloh'ni to'xtatish
pkill -x isloh 2>/dev/null || true
for _ in $(seq 1 30); do pgrep -x isloh >/dev/null || break; sleep 0.2; done

# 3. Eski versiyalar qoldiqlari: fon serveri (127.0.0.1:8080) va brauzer oynasi
if [ -f "$HOME/.config/systemd/user/isloh.service" ]; then
  systemctl --user disable --now isloh.service >/dev/null 2>&1 || true
  rm -f "$HOME/.config/systemd/user/isloh.service"
  systemctl --user daemon-reload
fi
pkill -f "^/opt/google/chrome/chrome .*--user-data-dir=$APP/window" 2>/dev/null || true
rm -rf "$APP/server" "$APP/web" "$APP/window" "$APP/package.json"

# 4. Dastur fayllari
mkdir -p "$APP" "$CONF" "$HOME/.local/share/applications" "$HOME/.config/autostart"
rm -rf "$APP/app"
cp -r dist/linux-unpacked "$APP/app"
install -m 644 ui/icons/icon-512.png "$APP/icon.png"
install -m 755 scripts/set-token.sh "$APP/set-token.sh"
cat > "$APP/isloh" <<'SH'
#!/bin/sh
# Ubuntu ilovalarga sandbox uchun AppArmor ruxsatini talab qiladi; ruxsat (/etc/apparmor.d/isloh) yo'q bo'lsa sandbox'siz ochiladi
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = 1 ] && [ ! -e /etc/apparmor.d/isloh ]; then
  set -- --no-sandbox "$@"
fi
exec "$(dirname "$0")/app/isloh" "$@"
SH
chmod 755 "$APP/isloh"

# 5. Sozlamalar: faqat bot tokeni va nomi (eski PORT/DATA_DIR kerak emas)
TOKEN=""; NAME="islohuzbot"
if [ -f "$CONF/.env" ]; then
  TOKEN=$(grep -E '^BOT_TOKEN=' "$CONF/.env" | tail -1 | cut -d= -f2- || true)
  NAME=$(grep -E '^BOT_USERNAME=' "$CONF/.env" | tail -1 | cut -d= -f2- || true); NAME=${NAME:-islohuzbot}
fi
umask 077
{ grep -v '^BOT_TOKEN=\|^BOT_USERNAME=' .env.example; printf 'BOT_TOKEN=%s\nBOT_USERNAME=%s\n' "$TOKEN" "$NAME"; } > "$CONF/.env"
umask 022

# 6. Ilovalar menyusi va avtomatik ishga tushish
cat > "$HOME/.local/share/applications/isloh.desktop" <<EOF2
[Desktop Entry]
Type=Application
Name=Isloh
Comment=Maqsad sari ongli hayot
Exec=$APP/isloh %U
Icon=$APP/icon.png
Terminal=false
Categories=Office;Utility;
StartupWMClass=isloh
EOF2
cat > "$HOME/.config/autostart/isloh.desktop" <<EOF2
[Desktop Entry]
Type=Application
Name=Isloh
Comment=Telegram bot va eslatmalar (trayda)
Exec=$APP/isloh --hidden
Icon=$APP/icon.png
Terminal=false
X-GNOME-Autostart-enabled=true
EOF2
update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true

echo "O'rnatildi: ilovalar menyusida «Isloh». Kompyuter yonganda trayda o'zi ishga tushadi."
echo "Ma'lumotlar: $APP/data   Sozlamalar: $CONF/.env   Jurnal: $APP/isloh.log"
[ -n "$TOKEN" ] || echo "Bot tokeni yo'q — qo'shish uchun: $APP/set-token.sh"
if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = 1 ] && [ ! -e /etc/apparmor.d/isloh ]; then
  echo "Ixtiyoriy (to'liq sandbox uchun, bir marta): sudo $SRC/scripts/apparmor.sh"
fi
