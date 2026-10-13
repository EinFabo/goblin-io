#!/bin/bash
# SessionStart-Hook (.claude/settings.json): richtet Cloud-Sitzungen ein, lokal passiert nichts.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

# Pakete nur neu holen, wenn package-lock.json sich geändert hat
if ! cmp -s package-lock.json node_modules/.package-lock.json 2>/dev/null; then
  npm ci --no-audit --no-fund >/dev/null 2>&1 || echo "cloud-setup: npm ci fehlgeschlagen – bitte von Hand laufen lassen"
fi

# Chromium für Sim, Smoke und Sprite-Dump (Playwright ist auf 1.58.2 gepinnt → chromium-1208)
PWB="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
REV=$(node -e "console.log(require('./node_modules/playwright-core/browsers.json').browsers.find(b=>b.name==='chromium-headless-shell').revision)" 2>/dev/null)
if [ -n "$REV" ] && [ ! -e "$PWB/chromium_headless_shell-$REV/INSTALLATION_COMPLETE" ]; then
  if ! timeout 240 npx playwright install chromium >/dev/null 2>&1; then
    # Kein Download möglich: ein vorinstalliertes Chromium (anderer Stand) unter der erwarteten Nummer verlinken
    OLD=$(ls -d "$PWB"/chromium-*/chrome-linux/chrome 2>/dev/null | sort -V | tail -1)
    if [ -n "$OLD" ]; then
      mkdir -p "$PWB/chromium_headless_shell-$REV/chrome-headless-shell-linux64" "$PWB/chromium-$REV"
      SHELL_OLD=$(ls -d "$PWB"/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | sort -V | tail -1)
      ln -sf "${SHELL_OLD:-$OLD}" "$PWB/chromium_headless_shell-$REV/chrome-headless-shell-linux64/chrome-headless-shell"
      ln -sfn "$(dirname "$OLD")" "$PWB/chromium-$REV/chrome-linux64"
      touch "$PWB/chromium_headless_shell-$REV/INSTALLATION_COMPLETE" "$PWB/chromium-$REV/INSTALLATION_COMPLETE"
      echo "cloud-setup: Chromium-Download fehlgeschlagen, nutze vorinstalliertes $OLD"
    else
      echo "cloud-setup: Chromium-Download fehlgeschlagen (Netz-Freigabe für cdn.playwright.dev fehlt?) – npm run sim/smoke gehen dann nicht, test/lint/build schon"
    fi
  fi
fi
exit 0
