import os
import json
import shutil
import logging

logger = logging.getLogger()

STORAGE_DIR = os.path.join(os.getcwd(), 'local_storage')
IMAGES_DIR = os.path.join(STORAGE_DIR, 'images')
DB_FILE = os.path.join(STORAGE_DIR, 'metadata.json')

# Ensure dirs exist
try:
    os.makedirs(IMAGES_DIR, exist_ok=True)
except OSError:
    # Ignore on read-only filesystems like Vercel
    pass

def _load_db():
    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def _save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# --- S3 Mimic ---

def generate_local_upload_url(host_url, object_name):
    # Returns a URL that the frontend can PUT to.
    # We need a route in api_server: PUT /local-store/<object_name>
    return f"{host_url}/local-store/{object_name}"

def generate_local_download_url(host_url, object_name):
    # Returns a URL that the frontend can GET.
    # We need a route in api_server: GET /local-store/<object_name>
    return f"{host_url}/local-store/{object_name}"

def save_file_content(object_name, content_bytes):
    path = os.path.join(IMAGES_DIR, object_name)
    with open(path, 'wb') as f:
        f.write(content_bytes)
    return True

def get_file_content(object_name):
    path = os.path.join(IMAGES_DIR, object_name)
    if os.path.exists(path):
        return path # Return path for send_file
    return None

def delete_file(object_name):
    path = os.path.join(IMAGES_DIR, object_name)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False

# --- DynamoDB Mimic ---

def save_metadata(item):
    data = _load_db()
    # Remove existing if any (upsert)
    data = [i for i in data if not (i['user_id'] == item['user_id'] and i['image_id'] == item['image_id'])]
    data.append(item)
    _save_db(data)
    return True

def query_images(user_id=None, tag=None):
    data = _load_db()
    results = data
    if not user_id:
        return []
    if user_id:
        results = [i for i in results if i.get('user_id') == user_id]
    if tag:
        results = [i for i in results if tag in i.get('tags', []) or i.get('tag') == tag]
    return results

def delete_metadata(user_id, image_id):
    data = _load_db()
    new_data = [i for i in data if not (i['user_id'] == user_id and i['image_id'] == image_id)]
    if len(new_data) < len(data):
        _save_db(new_data)
        return True
    return False
