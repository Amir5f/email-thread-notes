#!/usr/bin/env bash
# record-demo.sh — macOS screen capture helper for Email Thread Notes demo
#
# Usage:  bash scripts/record-demo.sh [duration_seconds]
# Output: demo-YYYY-MM-DD.mov in the project root
#
# Requires: macOS (uses screencapture built-in)
# Tip: convert to GIF afterwards with ffmpeg:
#   ffmpeg -i demo-*.mov -vf "fps=12,scale=800:-1:flags=lanczos" demo.gif

set -e

DURATION=${1:-45}
OUTFILE="demo-$(date +%Y-%m-%d).mov"

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│            Email Thread Notes — Demo Recording              │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo "  Recording:  $OUTFILE"
echo "  Duration:   ${DURATION}s  (pass a number as argument to change)"
echo ""
echo "  BEFORE you press Enter, do this:"
echo "    1. Open Chrome → Gmail → any email thread"
echo "    2. Open the Email Thread Notes sidebar"
echo "    3. Make sure the side panel is visible and the note is empty"
echo "    4. Position the Chrome window where you want it"
echo ""
echo "  DURING recording (~${DURATION}s), follow this script:"
echo "    [0–5s]   Show the sidebar open on a Gmail thread"
echo "    [5–12s]  Type a short note (e.g. 'Follow up Friday — check quote')"
echo "    [12–18s] Click 'All Notes' tab — show the note appears in the list"
echo "    [18–25s] Right-click the note card → Pin → note floats to top"
echo "    [25–32s] Type something in the Search box → highlight appears"
echo "    [32–40s] Click ⋮ → Archive → Undo toast appears → click Undo"
echo "    [40–45s] Open Settings → show storage meter"
echo ""
read -p "  Press Enter to start recording in 3 seconds... " _
echo ""

for i in 3 2 1; do
  echo "  $i..."
  sleep 1
done

echo "  Recording started. Follow the script above."
echo "  (screencapture will ask you to select a window or area)"
echo ""

screencapture -V "$DURATION" "$OUTFILE"

echo ""
echo "  Done! Saved to: $OUTFILE"
echo ""
echo "  To convert to GIF (requires ffmpeg — 'brew install ffmpeg'):"
echo "    ffmpeg -i $OUTFILE -vf \"fps=12,scale=800:-1:flags=lanczos\" demo.gif"
echo ""
