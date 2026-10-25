#!/usr/bin/env bash
# Telegram bot tokenini xavfsiz kiritish (ekranda ko'rinmaydi) va serverni qayta ishga tushirish.
set -euo pipefail
CONF="$HOME/.config/isloh/.env"
[ -f "$CONF" ] || { echo "Avval scripts/install-local.sh ni ishga tushiring"; exit 1; }
read -rsp "BotFather bergan tokenni joylang va Enter bosing: " TOKEN; echo
[[ "$TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]{30,}$ ]] || { echo "Token ko'rinishi noto'g'ri (masalan 123456:ABC-...)"; exit 1; }
ME=$(curl -s "https://api.telegram.org/bot$TOKEN/getMe")
echo "$ME" | grep -q '"ok":true' || { echo "Telegram tokenni qabul qilmadi: $ME"; exit 1; }
NAME=$(echo "$ME" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
grep -v '^BOT_TOKEN=\|^BOT_USERNAME=' "$CONF" > "$CONF.tmp" || true
printf 'BOT_TOKEN=%s\nBOT_USERNAME=%s\n' "$TOKEN" "$NAME" >> "$CONF.tmp"
mv "$CONF.tmp" "$CONF"; chmod 600 "$CONF"
systemctl --user restart isloh.service
echo "Tayyor: @$NAME ulandi. Telegram'da botga /start yozing."
