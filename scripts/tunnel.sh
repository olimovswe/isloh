#!/usr/bin/env bash
# Cloudflare tunnel: Isloh serveriga internetdan https manzil beradi (telefon va Telegram tugmalari uchun).
# Manzil (https://....trycloudflare.com) data/public_url fayliga yoziladi — server uni o'zi o'qiydi.
APP="$HOME/.local/share/isloh"
PORT=$(grep -E '^PORT=' "$HOME/.config/isloh/.env" 2>/dev/null | cut -d= -f2); PORT=${PORT:-8080}
URLFILE="$APP/data/public_url"
mkdir -p "$APP/data"
CF="$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")"
"$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" 2>&1 | while IFS= read -r line; do
  echo "$line"
  url=$(printf '%s' "$line" | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)
  if [ -n "$url" ]; then printf '%s\n' "$url" > "$URLFILE.tmp" && mv "$URLFILE.tmp" "$URLFILE"; fi
done
