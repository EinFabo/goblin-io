#!/bin/bash
# SessionStart-Hook (.claude/settings.json): richtet Cloud-Sitzungen ein, lokal passiert nichts.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

# Pakete nur neu holen, wenn package-lock.json sich geändert hat
if ! cmp -s package-lock.json node_modules/.package-lock.json 2>/dev/null; then
  npm ci --no-audit --no-fund >/dev/null 2>&1 || echo "cloud-setup: npm ci fehlgeschlagen – bitte von Hand laufen lassen"
fi

# Chromium für Sim, Smoke und Sprite-Dump (Playwright ist auf 1.58.2 gepinnt → chromium-1208)
if ! ls ~/.cache/ms-playwright 2>/dev/null | grep -q '^chromium_headless_shell-'; then
  timeout 240 npx playwright install chromium >/dev/null 2>&1 \
    || echo "cloud-setup: Chromium-Download fehlgeschlagen (Netz-Freigabe für cdn.playwright.dev fehlt?) – npm run sim/smoke gehen dann nicht, test/lint/build schon"
fi
exit 0
