# QR Printing System

A complete self-service QR printing system designed for a campus/college environment. Students scan a QR code, upload a PDF on a mobile-friendly web page, and it prints directly to a local printer (e.g., Canon MF284dw).

## Architecture

1. **Web App (Cloud/Vercel)**: A Next.js application that handles the UI and print queue.
2. **Local Print Server (Mac/Raspberry Pi)**: A Python daemon running on the local network that securely fetches jobs from the web app and prints them using the OS's native `lp` command.

## 1. Setup the Web App (Next.js)

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies (if not already done):
   ```bash
   npm install
   ```
3. Set up the database (Supabase / PostgreSQL):
   ```bash
   npx prisma db push
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The web app will run on `http://localhost:5000`.

### Environment Variables for Web App
Copy `.env.example` to `.env.local` in the `frontend` directory:
```bash
cp .env.example .env.local
```
Fill in your configuration:
```env
SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
ADMIN_PASSWORD="admin"
PRINT_SERVER_SECRET="dev-secret"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="your_secret_..."
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
ALLOWED_EMAIL_DOMAIN="rishihood.edu.in"
ADMIN_EMAILS="admin@rishihood.edu.in"
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
- `WEB_APP_URL`: URL of the Next.js app (default: `http://localhost:5000` locally, or your production Vercel URL)
- `PRINT_SERVER_SECRET`: Must match the web app's secret (default: `dev-secret`)
- `MOCK_MODE`: Set to `True` (default) to simulate printing, or `False` to send to the real printer.

Example to run in production mode with a real printer connected to a Vercel deployment:
```bash
MOCK_MODE=False WEB_APP_URL="https://automatic-print-system.vercel.app" python3 print_daemon.py
```

## 3. Testing with Mock Mode (Local Development)

1. Start Next.js (`npm run dev` in `frontend/`).
2. Start Python daemon in mock mode (`python3 print_daemon.py` in `local-print-server/`).
3. Open `http://localhost:5000` on your phone (or browser), upload a document, and proceed.
4. You will see the job enter the queue, transition to printing (simulated in terminal), and complete!
5. View the admin dashboard at `http://localhost:5000/ruprint-ops` to monitor and manage the live queue.

## 4. Connecting to the Real Canon MF284dw

When you are ready to print for real:
1. Ensure your Mac/Raspberry Pi is connected to the Canon printer.
2. Verify your Mac can see the printer by running:
   ```bash
   lpstat -p -d
   ```
3. Run the Python daemon with `MOCK_MODE=False`:
   ```bash
   MOCK_MODE=False python3 print_daemon.py
   ```
   *(Or double-click `start_daemon.command` on macOS).*
4. Now, jobs sent to the web app will be routed to your physical Canon printer!

## Cloud Deployment (Vercel)

To deploy to production:
1. Push the code to GitHub.
2. Import the repository in Vercel, setting Root Directory to `frontend`.
3. Set the environment variables in Vercel Project Settings.
4. Create a QR code pointing to your production Vercel domain!
