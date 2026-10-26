#!/usr/bin/env bash
# Ubuntu 24.04+ ilovalardan sandbox uchun AppArmor ruxsatini so'raydi (VS Code, Chrome va boshqalardagi kabi).
# Bir marta: sudo ./scripts/apparmor.sh — shundan keyin Isloh to'liq Chromium sandbox bilan ishlaydi.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "sudo bilan ishga tushiring: sudo $0"; exit 1; }
U="${SUDO_USER:-$USER}"; H=$(getent passwd "$U" | cut -d: -f6)
cat > /etc/apparmor.d/isloh <<EOF2
abi <abi/4.0>,
include <tunables/global>

profile isloh $H/.local/share/isloh/app/isloh flags=(unconfined) {
  userns,

  include if exists <local/isloh>
}
EOF2
apparmor_parser -r /etc/apparmor.d/isloh
echo "Tayyor. Isloh'ni qayta oching."
