"""
Simple Flask API server for local development.
This wraps the Lambda handlers to provide HTTP endpoints.
"""
import datetime
from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
import os
import sys

# Add current directory to path so it can find 'src'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.app import handlers
from src.utils import local_adapter

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Set environment variables
os.environ.setdefault('BUCKET_NAME', 'image-uploads')
os.environ.setdefault('TABLE_NAME', 'ImageMetadata')
os.environ.setdefault('AWS_ENDPOINT_URL', 'http://localstack:4566')
# Default to false if Vercel is detected, else default to true
is_vercel = os.environ.get('VERCEL') == '1'
os.environ.setdefault('USE_LOCAL_STORAGE', 'false' if is_vercel else 'true')

def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

@app.route('/api/local-store/<object_name>', methods=['PUT', 'OPTIONS'])
def local_upload(object_name):
    if request.method == 'OPTIONS':
        return add_cors(make_response('', 204))
    
    content = request.get_data()
    # Ensure it's not a directory traversal attempt (simple check)
    if '..' in object_name or '/' in object_name:
        return add_cors(make_response('', 400))
    local_adapter.save_file_content(object_name, content)
    return add_cors(make_response('', 200))

@app.route('/api/local-store/<object_name>', methods=['GET', 'OPTIONS'])
def local_download(object_name):
    if request.method == 'OPTIONS':
        return add_cors(make_response('', 204))

    # Ensure it's not a directory traversal attempt
    if '..' in object_name or '/' in object_name:
        return add_cors(make_response('', 400))
    path = local_adapter.get_file_content(object_name)
    if path:
        return add_cors(make_response(send_file(path)))
    return add_cors(make_response('', 404))

@app.route('/api/images/upload', methods=['POST', 'OPTIONS'])
def upload_image():
    if request.method == 'OPTIONS':
        return '', 204
    
    event = {'body': request.get_data(as_text=True)}
    response = handlers.generate_upload_url_handler(event, None)
    
    import json
    body = response.get('body', '{}')
    if isinstance(body, str):
        body = json.loads(body)
    
    return jsonify(body), response.get('statusCode', 200)

@app.route('/api/images', methods=['GET', 'OPTIONS'])
def list_images():
    if request.method == 'OPTIONS':
        return '', 204
    
    event = {'queryStringParameters': request.args.to_dict()}
    response = handlers.list_images_handler(event, None)
    
    # Parse JSON body if it's a string
    import json
    body = response.get('body', '{}')
    if isinstance(body, str):
        body = json.loads(body)
    
    return jsonify(body), response.get('statusCode', 200)

@app.route('/api/images/<id>/download', methods=['GET', 'OPTIONS'])
def download_image(id):
    if request.method == 'OPTIONS':
        return '', 204
    
    # Map path param to query param for handler
    event = {'queryStringParameters': {'id': id}}
    response = handlers.generate_download_url_handler(event, None)
    
    import json
    body = response.get('body', '{}')
    if isinstance(body, str):
        body = json.loads(body)
    
    return jsonify(body), response.get('statusCode', 200)

@app.route('/api/images/<id>', methods=['DELETE', 'OPTIONS'])
def delete_image(id):
    if request.method == 'OPTIONS':
        return '', 204
    
    # Map path param to query param, preserve other query params like user_id
    params = request.args.to_dict()
    params['id'] = id
    event = {'queryStringParameters': params}
    
    response = handlers.delete_image_handler(event, None)
    
    import json
    body = response.get('body', '{}')
    if isinstance(body, str):
        body = json.loads(body)
    
    return jsonify(body), response.get('statusCode', 200)

@app.route('/api/delete', methods=['DELETE', 'OPTIONS'])
def local_delete():
    if request.method == 'OPTIONS':
        return add_cors(make_response('', 204))
    response = handlers.delete_image_handler(request_to_event(request), None)
    import json
    body = response.get('body', '{}')
    if isinstance(body, str):
        body = json.loads(body)
    return add_cors(make_response(jsonify(body), response.get('statusCode', 200)))

@app.route('/api/usage', methods=['GET', 'OPTIONS'])
def local_usage():
    if request.method == 'OPTIONS':
        return add_cors(make_response('', 204))
    response = handlers.get_storage_usage_handler(request_to_event(request), None)
    import json
    body = response.get('body', '{}')
    if isinstance(body, str):
        body = json.loads(body)
    return add_cors(make_response(jsonify(body), response.get('statusCode', 200)))

@app.route('/api/health', methods=['GET'])
def health():
    from src.utils import supabase_utils
    db_status = 'disconnected'
    try:
        if supabase_utils.supabase:
            # Try a simple select to test connection
            supabase_utils.supabase.table('ImageMetadata').select('count', count='exact').limit(1).execute()
            db_status = 'connected'
    except Exception as e:
        db_status = f'error: {str(e)}'
        
    storage_status = 'disconnected'
    try:
        if supabase_utils.supabase:
            # Check if bucket exists/accessible
            buckets = supabase_utils.supabase.storage.list_buckets()
            bucket_names = [b.name for b in buckets]
            if 'images' in bucket_names:
                storage_status = 'connected'
            else:
                storage_status = f'error: bucket "images" not found. Found: {bucket_names}'
    except Exception as e:
        storage_status = f'error: {str(e)}'
        
    return jsonify({
        'status': 'healthy',
        'database': db_status,
        'storage': storage_status,
        'vercel': os.environ.get('VERCEL') == '1'
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    
    # In Lite Mode, ensure the local storage dir exists
    if os.environ.get('USE_LOCAL_STORAGE') == 'true':
        local_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'local_storage')
        os.makedirs(local_dir, exist_ok=True)
    
    app.run(host='0.0.0.0', port=port, debug=True)
else:
    # When imported (like by Vercel), we still might want to ensure some setup
    # But ONLY if not on Vercel or if local storage is explicitly requested and possible
    if os.environ.get('USE_LOCAL_STORAGE') == 'true' and os.environ.get('VERCEL') != '1':
        local_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'local_storage')
        try:
            os.makedirs(local_dir, exist_ok=True)
        except OSError:
            pass
