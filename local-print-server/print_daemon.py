import os
import time
import requests
import subprocess

# Configuration
WEB_APP_URL = os.environ.get("WEB_APP_URL", "http://localhost:3000")
SECRET_TOKEN = os.environ.get("PRINT_SERVER_SECRET", "dev-secret")
MOCK_MODE = os.environ.get("MOCK_MODE", "True").lower() in ("true", "1", "t")
POLL_INTERVAL = 3  # seconds

HEADERS = {
    "Authorization": f"Bearer {SECRET_TOKEN}",
    "Content-Type": "application/json"
}

def check_for_jobs():
    try:
        response = requests.get(f"{WEB_APP_URL}/api/print-server/next", headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            return data.get("job")
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to web app: {e}")
    return None

def download_pdf(job_id, filename):
    try:
        response = requests.get(f"{WEB_APP_URL}/api/print-server/download/{job_id}", headers=HEADERS)
        if response.status_code == 200:
            # Extract extension from original filename
            _, ext = os.path.splitext(filename)
            ext = ext.lower()
            filepath = os.path.join(os.getcwd(), f"{job_id}{ext}")
            with open(filepath, 'wb') as f:
                f.write(response.content)
            return filepath
        else:
            print(f"Failed to download PDF for job {job_id}")
    except requests.exceptions.RequestException as e:
        print(f"Error downloading PDF: {e}")
    return None

def update_job_status(job_id, status):
    try:
        requests.post(
            f"{WEB_APP_URL}/api/print-server/update/{job_id}",
            headers=HEADERS,
            json={"status": status}
        )
    except requests.exceptions.RequestException as e:
        print(f"Error updating job status: {e}")

def print_job(filepath, copies):
    if MOCK_MODE:
        print(f"[MOCK] Simulating print for {filepath} ({copies} copies)")
        time.sleep(3)  # Simulate print time
        return True
    
    try:
        # 1. Un-pause the printer queue (Mac often pauses it if the printer sleeps)
        try:
            default_printer_res = subprocess.run(["lpstat", "-d"], capture_output=True, text=True)
            if "destination: " in default_printer_res.stdout:
                printer_name = default_printer_res.stdout.split("destination: ")[-1].strip()
                subprocess.run(["cupsenable", printer_name])
        except Exception:
            pass

        # 2. Using lp command for macOS/Linux
        # -n specifies number of copies
        result = subprocess.run(
            ["lp", "-n", str(copies), filepath],
            check=True,
            capture_output=True,
            text=True
        )
        print(f"Print spooled successfully: {result.stdout.strip()}")
        
        import re
        match = re.search(r'request id is (\S+)', result.stdout)
        if match:
            cups_job_id = match.group(1)
            print(f"Waiting for physical printer to finish {cups_job_id}...")
            
            start_time = time.time()
            # Poll lpstat to see if the job has left the active queue
            while True:
                lpstat_res = subprocess.run(["lpstat"], capture_output=True, text=True)
                if cups_job_id not in lpstat_res.stdout:
                    elapsed = time.time() - start_time
                    if elapsed < 4.0:
                        print(f"Job {cups_job_id} left queue too quickly ({elapsed:.1f}s). Printer likely offline/aborted.")
                        return False
                        
                    print(f"Physical print completed for {cups_job_id} in {elapsed:.1f}s!")
                    break
                time.sleep(2)
                
        return True
    except subprocess.CalledProcessError as e:
        print(f"Print failed: {e.stderr}")
        return False
    except Exception as e:
        print(f"Print error: {e}")
        return False

def main():
    print(f"Starting QR Print Daemon...")
    print(f"Web App URL: {WEB_APP_URL}")
    print(f"Mock Mode: {MOCK_MODE}")
    print("Polling for jobs...")
    
    while True:
        try:
            job = check_for_jobs()
            
            if job:
                job_id = job["id"]
                filename = job["filename"]
                copies = job["copies"]
                
                print(f"Found new job: {filename} ({copies} copies)")
                
                # 1. Update status to printing
                update_job_status(job_id, "printing")
                
                # 2. Download the file
                filepath = download_pdf(job_id, filename)
                
                if filepath:
                    # 3. Print the file
                    success = print_job(filepath, copies)
                    
                    # 4. Update final status
                    if success:
                        update_job_status(job_id, "completed")
                        print(f"Job {job_id} completed successfully.")
                    else:
                        update_job_status(job_id, "failed")
                        print(f"Job {job_id} failed.")
                    
                    # 5. Cleanup local file
                    try:
                        os.remove(filepath)
                    except OSError:
                        pass
                else:
                    update_job_status(job_id, "failed")
            
        except Exception as e:
            print(f"CRITICAL ERROR in main loop: {e}. Retrying in {POLL_INTERVAL}s...")
            
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
