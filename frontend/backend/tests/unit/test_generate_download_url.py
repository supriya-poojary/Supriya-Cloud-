import boto3
import json
import pytest
from moto import mock_s3
from src.app import handlers
import os

@pytest.fixture
def s3_setup():
    with mock_s3():
        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket='test-bucket')
        os.environ['BUCKET_NAME'] = 'test-bucket'
        yield s3

def test_generate_download_url_success(s3_setup):
    event = {
        'queryStringParameters': {'id': 'test.jpg'}
    }
    response = handlers.generate_download_url_handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'download_url' in body

def test_generate_download_url_missing_id(s3_setup):
    event = {
        'queryStringParameters': {}
    }
    response = handlers.generate_download_url_handler(event, None)
    
    assert response['statusCode'] == 400
