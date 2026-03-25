import pytest
import requests
import json
import boto3
import time
import os

# Configuration (Assumes LocalStack default ports)
API_ENDPOINT = "http://localhost:4566" # This won't work easily for Lambda directly without API Gateway shim.
# However, user's docker-compose has backend container.
# If testing against LocalStack Lambda, we invoke lambda directly or via API Gateway.
# The user asked for "Integration tests using LocalStack".
# BUT the backend code is running in a separate container `backend` in docker-compose, or maybe just meant to be triggered.
# Actually, the user's Part 1 output includes NO API Gateway configuration (just handlers).
# Part 2 `docker-compose` has `localstack` + `backend` container (using python image).
# If the `backend` container is just running a sleep loop, we can't hit it via HTTP unless we expose a server.
# The `handlers.py` are pure lambda handlers.
#
# INTERPRETATION:
# The integration test should probably:
# 1. Interact with S3/DynamoDB on LocalStack directly.
# 2. Invoke the Lambda handlers locally (importing them) BUT pointing them to LocalStack resources.
# OR
# 3. If the user expects a full HTTP test, we need a wrapper (like flask/fastapi) or use LocalStack's lambda execution.
#
# Given the instructions "serverless backend", usually implies deploying to LocalStack Lambda.
# But we didn't deploy code to LocalStack in Part 2 init scripts.
#
# Safest Integration Test approach for this context:
# Run the `handlers` code LOCALLY (in the test runner), but configured to talk to the `LocalStack` container for S3/DynamoDB.
# This validates that the handlers interact correctly with "real" (simulated) AWS services.
#
# Notes on networking:
# If tests run on HOST, they talk to localhost:4566.
# If tests run in CONTAINER, they talk to localstack:4566.
#
# I will write the test to assume it's running where it can reach LocalStack (either localhost or service name).
# I'll use env var for endpoint.

ENDPOINT_URL = os.environ.get("TEST_ENDPOINT_URL", "http://localhost:4566")

@pytest.fixture
def api_env(monkeypatch):
    # Point handlers to LocalStack
    monkeypatch.setenv('AWS_ACCESS_KEY_ID', 'test')
    monkeypatch.setenv('AWS_SECRET_ACCESS_KEY', 'test')
    monkeypatch.setenv('AWS_DEFAULT_REGION', 'us-east-1')
    monkeypatch.setenv('BUCKET_NAME', 'image-uploads')
    monkeypatch.setenv('TABLE_NAME', 'ImageMetadata')
    
    # We need to ensure boto3 clients in the app use the endpoint_url.
    # The current `src/utils/s3_utils.py` uses `boto3.client('s3', ...)` without endpoint_url.
    # This is a common issue. We need to patch the utils to use LocalStack endpoint OR set AWS_ENDPOINT_URL environment variable (supported in newer boto3/localstack envs, but explicit controls are better).
    #
    # Boto3 doesn't automatically pick up AWS_ENDPOINT_URL by default unless configured.
    # I should probably update `src/utils` to respect an env var for endpoint, or monkeypatch `boto3.client`.
    #
    # FOR TEST STABILITY: I will monkeypatch boto3.client/resource in the test to inject endpoint_url.
    
    original_client = boto3.client
    original_resource = boto3.resource
    
    def mocked_client(service_name, **kwargs):
        kwargs['endpoint_url'] = ENDPOINT_URL
        return original_client(service_name, **kwargs)
        
    def mocked_resource(service_name, **kwargs):
        kwargs['endpoint_url'] = ENDPOINT_URL
        return original_resource(service_name, **kwargs)
        
    monkeypatch.setattr(boto3, 'client', mocked_client)
    monkeypatch.setattr(boto3, 'resource', mocked_resource)
    
    from src.app import handlers
    return handlers

def test_full_flow(api_env):
    handlers = api_env
    
    # 1. Generate Upload URL & Save Metadata (Unified)
    evt_upload = {
        'body': json.dumps({
            'filename': 'integration.jpg',
            'user_id': 'int_user',
            'tags': ['integration_test', 'unified'],
            'tag': 'integration_test',
            'description': 'Integration Test Upload'
        })
    }
    res_upload = handlers.generate_upload_url_handler(evt_upload, None)
    assert res_upload['statusCode'] == 200
    body_upload = json.loads(res_upload['body'])
    upload_url = body_upload['upload_url']
    object_name = body_upload['object_name']
    
    print(f"Upload URL: {upload_url}")
    
    # 2. Upload File (Client Side Simulation)
    # Using 'requests' to Put to the presigned url.
    # Note: LocalStack Presigned URLs often point to 'localstack:4566' or 'localhost:4566'.
    # If running on host, 'localhost' is fine.
    
    # Ensure bucket exists (it should be created by init script, but let's be safe if run isolated)
    try:
        s3 = boto3.client('s3', endpoint_url=ENDPOINT_URL)
        s3.create_bucket(Bucket='image-uploads')
    except:
        pass

    upload_res = requests.put(upload_url, data='binary content')
    assert upload_res.status_code == 200
    
    assert upload_res.status_code == 200
    
    # 3. Save Metadata (Merged into Step 1, so skipping explicit call)
    # The handler in Step 1 should have saved it.
    
    # 4. List Images
    evt_list = {
        'queryStringParameters': {'user_id': 'int_user'}
    }
    res_list = handlers.list_images_handler(evt_list, None)
    body_list = json.loads(res_list['body'])
    assert len(body_list['images']) > 0
    assert body_list['images'][0]['image_id'] == object_name
    
    assert body_list['images'][0]['image_id'] == object_name

    # 4b. List Images (Filtered by Tag)
    evt_list_tag = {
        'queryStringParameters': {'tag': 'integration_test'}
    }
    res_list_tag = handlers.list_images_handler(evt_list_tag, None)
    body_list_tag = json.loads(res_list_tag['body'])
    assert len(body_list_tag['images']) > 0
    assert body_list_tag['images'][0]['tag'] == 'integration_test'
    
    # 5. Download URL
    evt_dl = {
        'queryStringParameters': {'id': object_name}
    }
    res_dl = handlers.generate_download_url_handler(evt_dl, None)
    assert res_dl['statusCode'] == 200
    dl_url = json.loads(res_dl['body'])['download_url']
    
    # Verify content
    dl_res = requests.get(dl_url)
    assert dl_res.status_code == 200
    assert dl_res.content == b'binary content'
    
    # 6. Delete
    evt_del = {
        'queryStringParameters': {'id': object_name, 'user_id': 'int_user'}
    }
    res_del = handlers.delete_image_handler(evt_del, None)
    assert res_del['statusCode'] == 200

def test_edge_cases(api_env):
    handlers = api_env
    
    # 1. Get Download URL for non-existent file
    # (S3 Presigning usually succeeds regardless, but we verify it handles the request gracefully)
    evt_dl = {'queryStringParameters': {'id': 'non-existent-file.jpg'}}
    res_dl = handlers.generate_download_url_handler(evt_dl, None)
    assert res_dl['statusCode'] == 200
    
    # 2. List images for user with no images
    evt_list = {'queryStringParameters': {'user_id': 'ghost_user'}}
    res_list = handlers.list_images_handler(evt_list, None)
    assert res_list['statusCode'] == 200
    assert len(json.loads(res_list['body'])['images']) == 0
    
    # 3. Missing Parameters in Upload
    evt_bad_upload = {'body': json.dumps({})} # Missing filename
    res_bad_upload = handlers.generate_upload_url_handler(evt_bad_upload, None)
    assert res_bad_upload['statusCode'] == 400
    
    # 4. Unknown endpoint/method (not really testable via handlers direct call without router)
    # But we can test missing query params for list
    evt_bad_list = {'queryStringParameters': {}}
    res_bad_list = handlers.list_images_handler(evt_bad_list, None)
    assert res_bad_list['statusCode'] == 400

