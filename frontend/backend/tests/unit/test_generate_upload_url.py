import boto3
import json
import pytest
from moto import mock_s3, mock_dynamodb
from src.app import handlers
import os

@pytest.fixture
def s3_setup():
    with mock_s3(), mock_dynamodb():
        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket='test-bucket')
        
        # DynamoDB Setup
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        dynamodb.create_table(
            TableName='test-table',
            KeySchema=[{'AttributeName': 'user_id', 'KeyType': 'HASH'}, {'AttributeName': 'image_id', 'KeyType': 'RANGE'}],
            AttributeDefinitions=[{'AttributeName': 'user_id', 'AttributeType': 'S'}, {'AttributeName': 'image_id', 'AttributeType': 'S'}],
            ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
        )
        
        os.environ['BUCKET_NAME'] = 'test-bucket'
        os.environ['TABLE_NAME'] = 'test-table'
        yield s3

def test_generate_upload_url_success(s3_setup):
    event = {
        'body': json.dumps({'filename': 'test.jpg', 'filetype': 'image/jpeg'})
    }
    response = handlers.generate_upload_url_handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'upload_url' in body
    assert 'object_name' in body
    assert 'test.jpg' in body['object_name']

def test_unified_upload_success(s3_setup):
    event = {
        'body': json.dumps({
            'filename': 'unified.jpg', 
            'content_type': 'image/jpeg',
            'user_id': 'u1',
            'tags': ['unified'],
            'description': 'test'
        })
    }
    response = handlers.generate_upload_url_handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'upload_url' in body
    
    # Verify Metadata (need to read from DynamoDB)
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.Table('test-table')
    # We need the object name to query
    obj_name = body['object_name']
    item = table.get_item(Key={'user_id': 'u1', 'image_id': obj_name})
    assert 'Item' in item
    assert item['Item']['tag'] == 'unified'

def test_generate_upload_url_missing_filename(s3_setup):
    event = {
        'body': json.dumps({'filetype': 'image/jpeg'})
    }
    response = handlers.generate_upload_url_handler(event, None)
    
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['message'] == 'Missing filename'
