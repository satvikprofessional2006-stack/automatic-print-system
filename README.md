# QR Printing System

A complete self-service QR printing system designed for a campus/college environment. Students scan a QR code, upload a PDF on a mobile-friendly web page, and it prints directly to a local printer (e.g., Canon MF284dw).

## Architecture

1. **Web App (Cloud/Vercel)**: A Next.js application that handles the UI and print queue.
2. **Local Print Server (Mac/Raspberry Pi)**: A Python daemon running on the local network that securely fetches jobs from the web app and prints them using the OS's native `lp` command.

## 1. Setup the Web App (Next.js)

1. Navigate to the `web-app` directory:
   ```bash
   cd web-app
   ```
2. Install dependencies (if not already done):
   ```bash
   npm install
   ```
3. Set up the database (SQLite for local MVP):
   ```bash
   npx prisma db push
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The web app will run on `http://localhost:3000`.

### Environment Variables for Web App
Create a `.env` file in the `web-app` directory:
```
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD="admin"
PRINT_SERVER_SECRET="dev-secret"
```

## 2. Setup the Local Print Server (Python)

1. Navigate to the `local-print-server` directory:
   ```bash
   cd local-print-server
   ```
2. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Run the print daemon:
   ```bash
   python print_daemon.py
   ```

### Environment Variables for Print Server
You can pass these when running the script:
- `WEB_APP_URL`: URL of the Next.js app (default: `http://localhost:3000`)
- `PRINT_SERVER_SECRET`: Must match the web app's secret (default: `dev-secret`)
- `MOCK_MODE`: Set to `True` (default) to simulate printing, or `False` to send to the real printer.

Example to run in production mode with a real printer:
```bash
MOCK_MODE=False WEB_APP_URL="https://your-vercel-app.com" python print_daemon.py
```

## 3. Testing with Mock Mode (Local Development)

1. Start Next.js (`npm run dev`).
2. Start Python daemon in mock mode (`python print_daemon.py`).
3. Open `http://localhost:3000` on your phone (or browser), upload a PDF, and click Print.
4. You will see the job enter the queue, transition to printing (simulated in terminal), and complete!
5. View the admin dashboard at `http://localhost:3000/admin` (password: admin) to see the queue history.

## 4. Connecting to the Real Canon MF284dw

When you are ready to print for real:
1. Ensure your Mac/Raspberry Pi is connected to the Canon printer.
2. Verify your Mac can see the printer by running:
   ```bash
   lpstat -p -d
   ```
3. Run the Python daemon with `MOCK_MODE=False`:
   ```bash
   MOCK_MODE=False python print_daemon.py
   ```
4. Now, jobs sent to the web app will be routed to your physical Canon printer!

## Cloud Deployment (Vercel)

To make this public:
1. Push the `web-app` code to GitHub.
2. Import the project in Vercel.
3. Change the database from SQLite to a cloud PostgreSQL database (like Supabase).
   - Update `prisma/schema.prisma` provider to `"postgresql"`.
   - Run `npx prisma db push` against the new database.
4. Set the environment variables in Vercel.
5. Create a QR code pointing to your Vercel domain!
