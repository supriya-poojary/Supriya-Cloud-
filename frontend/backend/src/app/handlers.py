import json
import logging
import os
import uuid
import datetime
from src.utils import supabase_utils, common

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET_NAME = os.environ.get('BUCKET_NAME')
TABLE_NAME = os.environ.get('TABLE_NAME')

def generate_upload_url_handler(event, context):
    """
    POST /images/upload (formerly /generate-upload-url)
    Body: { "filename": "...", "content_type": "...", "user_id": "...", "tags": [], "description": "..." }
    """
    try:
        body = json.loads(event.get('body', '{}'))
        filename = body.get('filename')
        user_id = body.get('user_id')
        
        if not filename:
            return common.create_error_response(400, "Missing filename")
        
        # Metadata logic integrated here for Unified Upload
        # Requirement: "image_id (ISO timestamp based)" so it is sortable for range queries.
        iso_timestamp = datetime.datetime.utcnow().isoformat() + 'Z'
        safe_timestamp = iso_timestamp.replace(':', '-')
        object_name = f"{safe_timestamp}_{uuid.uuid4()}-{filename}"
        
        # Supabase Presigned URL
        presigned_url = supabase_utils.generate_presigned_upload_url(object_name)
        if not presigned_url:
             return common.create_error_response(500, "Failed to generate upload URL")

        # Save Metadata if user_id is provided (Unified Flow)
        if user_id:
            tag = body.get('tag')
            tags = body.get('tags', [])
            if tag and tag not in tags:
                tags.append(tag)
            
            primary_tag = tags[0] if tags else (tag or 'uncategorized')

            item = {
                'id': str(uuid.uuid4()),  # Supabase usually uses 'id' as primary key
                'user_id': user_id,
                'image_id': object_name,
                'tag': primary_tag,
                'tags': json.dumps(tags), # Supabase text/JSON
                'description': body.get('description', ''),
                'content_type': body.get('content_type', 'application/octet-stream'),
                'file_size': body.get('file_size', 0),
                'upload_time': iso_timestamp,
                'original_filename': filename
            }
            
            if not supabase_utils.save_metadata(item):
                logger.error(f"Failed to save metadata for {object_name}")
                # We could return 500, but the URL was generated. 
                # Ideally, we save metadata first? No, doesn't matter much for presigned.
                return common.create_error_response(500, "Failed to save metadata")

        return common.create_response(200, {
            "upload_url": presigned_url,
            "object_name": object_name
        })
    except Exception as e:
        logger.error(e)
        return common.create_error_response(500, "Internal Server Error", str(e))

def save_metadata_handler(event, context):
    """
    POST /save-metadata
    Body: { "user_id": "...", "image_id": "...", "tag": "...", ... }
    """
    try:
        body = json.loads(event.get('body', '{}'))
        user_id = body.get('user_id')
        image_id = body.get('image_id') # Should match object_name or be derived
        tag = body.get('tag')
        
        if not user_id or not image_id:
             return common.create_error_response(400, "Missing required fields")

        # Ensure image_id allows ISO sort (prefix check or just store as is if client provides ISO-based ID)
        # If image_id is not time-sortable, date range queries rely on separate attribute if GSI is used differently.
        # Requirement: "image_id (ISO timestamp based)" -> Assumed client generates implementation or we enforce it.
        # Simplified: Just save what is passed.

        # Extract all requested metadata fields
        description = body.get('description', '')
        content_type = body.get('content_type', 'application/octet-stream')
        s3_key = body.get('s3_key') # Should ideally match image_id/object_name
        
        item = {
            'user_id': user_id,
            'image_id': image_id,
            'tag': tag,
            'description': description,
            'content_type': content_type,
            's3_key': s3_key or image_id, # Fallback to image_id if not provided
            'upload_time': datetime.datetime.utcnow().isoformat() + 'Z', # Renamed from created_at to match requirement
            'created_at': datetime.datetime.utcnow().isoformat() + 'Z', # Keep for backward compat
        }
        # item.update(body) # Explicit fields preferred for strict compliance

        if dynamo_utils.save_metadata(TABLE_NAME, item):
            return common.create_response(201, {"status": "success", "data": item})
        else:
            return common.create_error_response(500, "Failed to save metadata")

    except Exception as e:
        logger.error(e)
        return common.create_error_response(500, "Internal Server Error", str(e))

def list_images_handler(event, context):
    """
    GET /images?user_id=&tag=&start_date=&end_date=
    """
    try:
        query_params = event.get('queryStringParameters', {}) or {}
        user_id = query_params.get('user_id')
        tag = query_params.get('tag')
        start_date = query_params.get('start_date')
        end_date = query_params.get('end_date')

        items = supabase_utils.query_images(user_id, tag, start_date, end_date)
        
        return common.create_response(200, {"images": items})

    except Exception as e:
        logger.error(e)
        return common.create_error_response(500, "Internal Server Error", str(e))

def generate_download_url_handler(event, context):
    """
    GET /generate-download-url?id=<image_id>
    """
    try:
        query_params = event.get('queryStringParameters', {}) or {}
        object_name = query_params.get('id')
        
        if not object_name:
            return common.create_error_response(400, "Missing image id")

        url = supabase_utils.generate_presigned_download_url(object_name)
        
        if url:
             return common.create_response(200, {"download_url": url})
        else:
             return common.create_error_response(500, "Failed to generate download URL")

    except Exception as e:
        logger.error(e)
        return common.create_error_response(500, "Internal Server Error", str(e))

def delete_image_handler(event, context):
    """
    DELETE /delete?id=<image_id>&user_id=<user_id>
    """
    try:
        query_params = event.get('queryStringParameters', {}) or {}
        image_id = query_params.get('id') # object_name
        user_id = query_params.get('user_id') 
        
        if not image_id or not user_id:
             return common.create_error_response(400, "Missing id or user_id")

        # 1. Delete from Supabase Storage
        storage_deleted = supabase_utils.delete_object(image_id)
        
        # 2. Delete from Supabase Database
        db_deleted = supabase_utils.delete_metadata_item(user_id, image_id)
        
        if storage_deleted and db_deleted:
            return common.create_response(200, {"status": "deleted", "id": image_id})
        else:
            errors = []
            if not storage_deleted: errors.append("Storage delete failed")
            if not db_deleted: errors.append("Database delete failed")
            return common.create_response(207, {
                "status": "partial_success", 
                "errors": errors,
                "debug": "Idempotency safe: retry allowed."
            })

    except Exception as e:
        logger.error(e)
        return common.create_error_response(500, "Internal Server Error", str(e))

def get_storage_usage_handler(event, context):
    """
    GET /usage?user_id=<user_id>
    Returns total storage usage for a user.
    """
    try:
        query_params = event.get('queryStringParameters', {}) or {}
        user_id = query_params.get('user_id')
        
        if not user_id:
             return common.create_error_response(400, "Missing user_id")

        # Query all images for the user
        # Note: In a production system with millions of images, this aggregation should be 
        # maintained in a separate 'UserStats' table and updated via DynamoDB Streams.
        # For this scale, a query is acceptable.
        items = dynamo_utils.query_images(TABLE_NAME, user_id)
        
        total_bytes = 0
        file_count = 0
        
        for item in items:
            # Safely get file_size, default to 0 if missing (backward compatibility)
            size = item.get('file_size', 0)
            # Handle potential string storage of numbers
            if isinstance(size, str) and size.isdigit():
                size = int(size)
            elif not isinstance(size, (int, float)):
                size = 0
                
            total_bytes += size
            file_count += 1
            
        return common.create_response(200, {
            "user_id": user_id,
            "total_bytes": total_bytes,
            "total_kb": round(total_bytes / 1024, 2),
            "total_mb": round(total_bytes / (1024 * 1024), 2),
            "file_count": file_count
        })

    except Exception as e:
        logger.error(e)
        return common.create_error_response(500, "Internal Server Error", str(e))
