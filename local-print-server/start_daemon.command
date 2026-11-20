#!/bin/bash
echo -e "\033[1;32mStarting Campus Print Hub Server...\033[0m"
cd "$(dirname "$0")"
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi
MOCK_MODE=False WEB_APP_URL="https://automatic-print-system.vercel.app" python3 print_daemon.py
