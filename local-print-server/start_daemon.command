#!/bin/bash
echo -e "\033[1;32mStarting Campus Print Hub Server...\033[0m"
cd "/Users/satvikkesarwani/printer direct print/qr-print-system/local-print-server"
source venv/bin/activate
MOCK_MODE=False WEB_APP_URL="https://automatic-print-system.vercel.app" python print_daemon.py
