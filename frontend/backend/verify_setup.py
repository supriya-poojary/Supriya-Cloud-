import sys
import os
import requests
import time
import subprocess

def test_imports():
    print("Testing imports...")
    try:
        from src.utils import s3_utils, dynamo_utils, local_adapter
        print("Imports successful!")
        return True
    except Exception as e:
        print(f"Import failed: {e}")
        return False

def test_server_launch():
    print("Testing server launch...")
    # Start server in background
    proc = subprocess.Popen([sys.executable, 'api_server.py'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(5) # Wait for startup
    
    try:
        # Check health
        resp = requests.get('http://localhost:8000/health')
        if resp.status_code == 200:
            print("Server is responding! Health OK.")
            return True
        else:
            print(f"Server returned {resp.status_code}")
            return False
    except Exception as e:
        print(f"Connection failed: {e}")
        return False
    finally:
        proc.kill()

if __name__ == "__main__":
    # Add current dir to path to simulate running from backend/
    sys.path.insert(0, os.getcwd())
    
    if test_imports():
        print("Backend code structure seems OK.")
        # We won't auto-run server test to avoid port conflicts if it IS running.
        # But we can try hitting the running server.
        try:
            print("Checking if server is ALREADY running on port 8000...")
            resp = requests.get('http://localhost:8000/health')
            if resp.status_code == 200:
                print("Confirmed: Server is currently running and healthy.")
            else:
                print("Server is running but returned unexpected status.")
        except:
            print("Server does not seem to be running on port 8000.")
            print("Please run 'start_backend.bat' and keep it open.")
