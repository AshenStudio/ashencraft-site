#!/bin/sh
# AshenCraft website - container entrypoint.
# Regenerates site-config.js from the stack env at boot, then serves.
set -e

CONFIG_DIR="${SITE_TMP:-/app}"
CONFIG_FILE="$CONFIG_DIR/site-config.js"

cat > "$CONFIG_FILE" <<EOF
window.ASHEN_SITE = {
    mapUrl: '${MAP_URL:-https://map.ashencraft.overdev.net}',
    apiUrl: '${API_URL:-https://ashenapi.overdev.net}',
    discordInvite: '${DISCORD_INVITE:-https://discord.gg/Y6nk7vnMzY}',
};
EOF

echo "[AshenSite] wrote $CONFIG_FILE"

if [ "$1" = "--write-config-only" ]; then
    exit 0
fi

exec python /app/serve.py