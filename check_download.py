import requests
import os
url = "https://automatic-print-system.vercel.app/api/print-server/download/8f6c7936-5956-47a0-97c5-1248bf582fca"
headers = {"Authorization": "Bearer dev-secret"}
r = requests.get(url, headers=headers)
print(f"Status: {r.status_code}")
print(f"Content Length: {len(r.content)}")
print(f"First 100 bytes: {r.content[:100]}")
