import os
import time
import requests
import subprocess
import threading

# Configuration
WEB_APP_URL = os.environ.get("WEB_APP_URL", "http://localhost:3000")
SECRET_TOKEN = os.environ.get("PRINT_SERVER_SECRET", "dev-secret")
MOCK_MODE = os.environ.get("MOCK_MODE", "True").lower() in ("true", "1", "t")
POLL_INTERVAL = 1  # seconds

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

def print_job(filepath, copies, double_sided=False, color=False, layout="portrait", page_range="all"):
    if MOCK_MODE:
        color_str = "Colour" if color else "B&W"
        layout_str = str(layout).capitalize()
        range_str = f"pages {page_range}" if page_range and page_range != "all" else "all pages"
        print(f"[MOCK] Simulating {color_str} ({layout_str}, {range_str}) print for {filepath} ({copies} copies)")
        time.sleep(3)  # Simulate print time
        return True
    
    try:
        # We rely on CUPS built-in imagetopdf filter which correctly scales 
        # images to A4, avoiding the Canon data light blink caused by sips.
        print_filepath = filepath

        # 1. Un-pause the printer queue (Mac often pauses it if the printer sleeps)
        try:
            default_printer_res = subprocess.run(["lpstat", "-d"], capture_output=True, text=True)
            if "destination: " in default_printer_res.stdout:
                printer_name = default_printer_res.stdout.split("destination: ")[-1].strip()
                subprocess.run(["cupsenable", printer_name])
        except Exception:
            pass

        # 2. Using lpr command for macOS/Linux
        cmd = ["lpr", "-#", str(copies)]
        if double_sided:
            cmd.extend(["-o", "sides=two-sided-long-edge"])
        
        # Color mode handling for CUPS / standard drivers
        if color:
            cmd.extend(["-o", "print-color-mode=color", "-o", "ColorModel=Color"])
        else:
            cmd.extend(["-o", "print-color-mode=monochrome", "-o", "ColorModel=Gray"])

        # Orientation / layout handling (landscape vs portrait)
        if str(layout).lower() == "landscape":
            cmd.extend(["-o", "landscape", "-o", "orientation-requested=4"])
        else:
            cmd.extend(["-o", "orientation-requested=3"])

        # Page range handling for CUPS (All, Odd, Even, Custom)
        if page_range and str(page_range).lower() != "all" and str(page_range).strip() != "":
            range_val = str(page_range).lower().strip()
            if range_val == "odd":
                cmd.extend(["-o", "page-set=odd"])
            elif range_val == "even":
                cmd.extend(["-o", "page-set=even"])
            else:
                clean_range = str(page_range).replace(" ", "")
                cmd.extend(["-o", f"page-ranges={clean_range}"])

        cmd.extend(["-o", "media=A4", "-o", "PageSize=A4", "-o", "fit-to-page"])
        cmd.append(print_filepath)
        
        result = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True
        )
        print(f"Print spooled successfully: {result.stdout.strip()}")
        
        if print_filepath != filepath:
            try: os.remove(print_filepath)
            except: pass
        return True
    except subprocess.CalledProcessError as e:
        print(f"Print failed: {e.stderr}")
        if 'print_filepath' in locals() and print_filepath != filepath:
            try: os.remove(print_filepath)
            except: pass
        return False
    except Exception as e:
        print(f"Print error: {e}")
        if 'print_filepath' in locals() and print_filepath != filepath:
            try: os.remove(print_filepath)
            except: pass
        return False

processing_jobs = set()

def process_job(job):
    job_id = job["id"]
    filename = job["filename"]
    copies = job["copies"]
    double_sided = job.get("doubleSided", False)
    color = job.get("color", False)
    layout = job.get("layout", "portrait")
    page_range = job.get("page_range") or job.get("pageRange") or "all"
    
    print(f"Found new job: {filename} ({copies} copies, double-sided: {double_sided}, color: {color}, layout: {layout}, page_range: {page_range}). Processing in background thread.")
    
    try:
        # 1. Update status to printing
        update_job_status(job_id, "printing")
        
        # 2. Download the file
        filepath = download_pdf(job_id, filename)
        
        if filepath:
            # 3. Print the file
            success = print_job(filepath, copies, double_sided, color, layout, page_range)
            
            # 4. Update final status
            if success:
                update_job_status(job_id, "completed")
                print(f"Job {job_id} completed successfully.")
            else:
                update_job_status(job_id, "failed")
                print(f"Job {job_id} failed.")
            
            # 5. Cleanup local files
            try:
                os.remove(filepath)
            except OSError:
                pass
        else:
            update_job_status(job_id, "failed")
    finally:
        if job_id in processing_jobs:
            processing_jobs.remove(job_id)

def main():
    print(f"Starting QR Print Daemon (Multithreaded)...")
    print(f"Web App URL: {WEB_APP_URL}")
    print(f"Mock Mode: {MOCK_MODE}")
    print("Polling for jobs...")
    
    while True:
        try:
            job = check_for_jobs()
            
            if job:
                job_id = job["id"]
                if job_id in processing_jobs:
                    # We are already processing this job, but the cloud hasn't updated its status yet.
                    # Sleep briefly to avoid infinite rapid looping.
                    time.sleep(POLL_INTERVAL)
                    continue
                    
                processing_jobs.add(job_id)
                # Start job processing in a background thread
                t = threading.Thread(target=process_job, args=(job,))
                t.daemon = True
                t.start()
                # Do NOT sleep if we found a new job; immediately check for the next one
                continue
                
        except Exception as e:
            print(f"CRITICAL ERROR in main loop: {e}. Retrying in {POLL_INTERVAL}s...")
            
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
