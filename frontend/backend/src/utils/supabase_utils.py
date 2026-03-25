import os
from supabase import create_client, Client
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_KEY", "")

# We only initialize if keys are present (prevents crash on import if using local_storage config)
supabase: Client = create_client(url, key) if url and key else None

BUCKET_NAME = "images"
TABLE_NAME = "ImageMetadata"

def generate_presigned_upload_url(object_name, expiration=3600):
    if not supabase:
        from src.utils import local_adapter
        host_url = os.environ.get('API_BASE_URL') or os.environ.get('RENDER_EXTERNAL_URL') or 'http://localhost:8000'
        return local_adapter.generate_local_upload_url(host_url, object_name)
    
    try:
        # Supabase creates a presigned POST/PUT URL
        # For simplicity with Supabase storage, we often just create a signed URL for upload
        # Warning: Supabase Python SDK signed upoads are simpler with direct upload
        # but to keep the frontend identical (doing a PUT to the URL), we use create_signed_upload_url
        res = supabase.storage.from_(BUCKET_NAME).create_signed_upload_url(object_name)
        # res returns {'signedUrl': '...'} or {'signedURL': '...'}
        # The key in v2.3.x is usually 'signedUrl'
        return res.get('signedURL', res.get('signedUrl'))
    except Exception as e:
        logger.error(f"Generate upload URL failed: {str(e)}")
        # For debugging purposes in serverless logs
        print(f"DEBUG: Supabase Storage Error: {str(e)}")
        return None

def generate_presigned_download_url(object_name, expiration=3600):
    if not supabase:
        from src.utils import local_adapter
        host_url = os.environ.get('API_BASE_URL') or os.environ.get('RENDER_EXTERNAL_URL') or 'http://localhost:8000'
        return local_adapter.generate_local_download_url(host_url, object_name)
    
    try:
        # If the bucket is public, we can just return the public URL
        # res = supabase.storage.from_(BUCKET_NAME).get_public_url(object_name)
        # return res
        
        # If private, we generate a signed URL
        res = supabase.storage.from_(BUCKET_NAME).create_signed_url(object_name, expiration)
        # res is a string or dict predicting python version
        if isinstance(res, str):
            return res
        return res.get('signedURL', res.get('signedUrl'))
    except Exception as e:
        logger.error(f"Generate download URL failed: {e}")
        return None

def delete_object(object_name):
    if not supabase:
        from src.utils import local_adapter
        return local_adapter.delete_file(object_name)
        
    try:
        supabase.storage.from_(BUCKET_NAME).remove([object_name])
        return True
    except Exception as e:
        logger.error(f"Delete object failed: {e}")
        return False

# --- Database Methods ---

def save_metadata(item):
    if not supabase:
        from src.utils import local_adapter
        return local_adapter.save_metadata(item)
    try:
        # Supabase replaces DynamoDB. We use 'upsert' based on the primary key ('id' or 'user_id'/'image_id')
        # The item must match the table schema
        supabase.table(TABLE_NAME).upsert(item).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to save metadata to Supabase: {e}")
        return False

def query_images(user_id=None, tag=None, start_date=None, end_date=None):
    if not supabase:
        from src.utils import local_adapter
        data = local_adapter.query_images(user_id, tag)
        if start_date:
            data = [i for i in data if i.get('upload_time', '') >= start_date]
        if end_date:
            data = [i for i in data if i.get('upload_time', '') <= end_date]
        return data

    try:
        query = supabase.table(TABLE_NAME).select("*")
        if user_id:
            query = query.eq('user_id', user_id)
        if tag:
            # For array columns we might use .contains('tags', [tag])
            # Or if it's a string, we eq it. Let's assume 'tag' column is the primary tag.
            query = query.eq('tag', tag)
        if start_date:
            query = query.gte('upload_time', start_date)
        if end_date:
            query = query.lte('upload_time', end_date)
            
        # Optional: Order by upload time
        query = query.order('upload_time', desc=True)
            
        res = query.execute()
        return res.data
    except Exception as e:
        logger.error(f"Failed to query images from Supabase: {e}")
        return []

def delete_metadata_item(user_id, image_id):
    if not supabase:
        from src.utils import local_adapter
        return local_adapter.delete_metadata(user_id, image_id)
        
    try:
        # Delete by both matching fields to be safe
        supabase.table(TABLE_NAME).delete().eq('user_id', user_id).eq('image_id', image_id).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to delete metadata from Supabase: {e}")
        return False
