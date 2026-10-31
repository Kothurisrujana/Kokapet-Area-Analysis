#!/bin/bash
cd "$(dirname "$0")/public" || exit 1
echo "Starting local server in: $(pwd)"
echo "Keep this window open while testing. Close it to stop."
( sleep 2; open http://localhost:8000 ) &
if command -v python3 >/dev/null; then python3 -m http.server 8000
elif command -v npx >/dev/null; then npx --yes serve -l 8000
else echo "ERROR: install Python from https://www.python.org/downloads/"; read -r; fi
