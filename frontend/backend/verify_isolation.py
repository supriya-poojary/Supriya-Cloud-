import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_isolation():
    print("Starting User Isolation Verification...")

    # User A Flow
    user_a = "user_A_auth_id"
    file_a = "image_A.txt"
    print(f"\n[User A] Uploading {file_a}...")
    
    # 1. Get Upload URL for A
    payload_a = {
        "filename": file_a,
        "content_type": "text/plain",
        "user_id": user_a,  # Correct user
        "tags": ["test"],
        "file_size": 123
    }
    
    try:
        res = requests.post(f"{BASE_URL}/images/upload", json=payload_a)
        if res.status_code != 200:
            print(f"FAILED to get upload URL: {res.text}")
            return
        
        data = res.json()
        upload_url = data['upload_url']
        
        # 2. Upload Content
        requests.put(upload_url, data="Content for A")
        print(f"[User A] Upload successful.")
        
    except Exception as e:
        print(f"FAILED: Server might not be running? {e}")
        return

    # User B Flow
    user_b = "user_B_auth_id"
    file_b = "image_B.txt"
    print(f"\n[User B] Uploading {file_b}...")
    
    # 1. Get Upload URL for B
    payload_b = {
        "filename": file_b,
        "content_type": "text/plain",
        "user_id": user_b,  # Correct user
        "tags": ["test"],
        "file_size": 123
    }
    
    try:
        res = requests.post(f"{BASE_URL}/images/upload", json=payload_b)
        data = res.json()
        upload_url = data['upload_url']
        requests.put(upload_url, data="Content for B")
        print(f"[User B] Upload successful.")
    except Exception as e:
        print(f"FAILED: {e}")
        return

    # Verification
    print("\n[Verification] Checking Isolation...")
    time.sleep(2) # Increased sleep

    # Check Legacy user_123 (Should see many images)
    try:
        res_123 = requests.get(f"{BASE_URL}/images", params={"user_id": "user_123"})
        images_123 = res_123.json().get('images', [])
        print(f"User 123 sees {len(images_123)} images. (Expected > 0)")
    except Exception as e:
        print(f"Failed to query user_123: {e}")

    # Check A
    print(f"Querying User A: user_id={user_a}")
    res_a = requests.get(f"{BASE_URL}/images", params={"user_id": user_a})
    print(f"Response A Status: {res_a.status_code}")
    if res_a.status_code != 200:
        print(f"Response A Body: {res_a.text}")
    images_a = res_a.json().get('images', [])
    print(f"User A sees {len(images_a)} images.")
    
    found_a_files = [img['original_filename'] for img in images_a]
    if file_a in found_a_files and file_b not in found_a_files:
         print("PASS: User A sees only their image.")
    else:
         print(f"FAIL: User A sees: {found_a_files}")

    # Check B
    print(f"Querying User B: user_id={user_b}")
    res_b = requests.get(f"{BASE_URL}/images", params={"user_id": user_b})
    images_b = res_b.json().get('images', [])
    print(f"User B sees {len(images_b)} images.")
    
    found_b_files = [img['original_filename'] for img in images_b]
    if file_b in found_b_files and file_a not in found_b_files:
         print("PASS: User B sees only their image.")
    else:
         print(f"FAIL: User B sees: {found_b_files}")

    # Check Anonymous (Should be empty)
    print("Querying Anonymous (no user_id)...")
    res_anon = requests.get(f"{BASE_URL}/images")
    images_anon = res_anon.json().get('images', [])
    print(f"Anonymous sees {len(images_anon)} images.")
    # Write results to file
    with open("backend/verify_result.txt", "w") as f:
        f.write(f"User A Images: {len(images_a)}\n")
        f.write(f"User A Files: {found_a_files}\n")
        f.write(f"User B Images: {len(images_b)}\n")
        f.write(f"User B Files: {found_b_files}\n")
        f.write(f"Anonymous Images: {len(images_anon)}\n")
        
        success = False
        if (file_a in found_a_files and file_b not in found_a_files and
            file_b in found_b_files and file_a not in found_b_files and
            len(images_anon) == 0):
            success = True
            f.write("RESULT: PASS\n")
        else:
            f.write("RESULT: FAIL\n")
    
    print("Verification complete. Results written to backend/verify_result.txt")

if __name__ == "__main__":
    test_isolation()
