import boto3
import json
import pytest
from moto import mock_s3, mock_dynamodb
from src.app import handlers
import os

@pytest.fixture
def resource_setup():
    with mock_s3(), mock_dynamodb():
        # S3 Setup
        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket='test-bucket')
        s3.put_object(Bucket='test-bucket', Key='img1', Body=b'data')
        os.environ['BUCKET_NAME'] = 'test-bucket'
        
        # DynamoDB Setup
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[{'AttributeName': 'user_id', 'KeyType': 'HASH'}, {'AttributeName': 'image_id', 'KeyType': 'RANGE'}],
            AttributeDefinitions=[{'AttributeName': 'user_id', 'AttributeType': 'S'}, {'AttributeName': 'image_id', 'AttributeType': 'S'}],
            ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
        )
        table.put_item(Item={'user_id': 'u1', 'image_id': 'img1'})
        os.environ['TABLE_NAME'] = 'test-table'
        
        yield s3, table

def test_delete_success(resource_setup):
    s3_client, table = resource_setup
    
    event = {
        'queryStringParameters': {'id': 'img1', 'user_id': 'u1'}
    }
    response = handlers.delete_image_handler(event, None)
    
    assert response['statusCode'] == 200
    
    # Verify S3 Deletion
    # List objects should be empty or check head_object raises 404
    objs = s3_client.list_objects(Bucket='test-bucket').get('Contents', [])
    assert len(objs) == 0
    
    # Verify DynamoDB Deletion
    item = table.get_item(Key={'user_id': 'u1', 'image_id': 'img1'})
    assert 'Item' not in item

def test_delete_idempotent(resource_setup):
    s3_client, table = resource_setup
    
    event = {
        'queryStringParameters': {'id': 'img1', 'user_id': 'u1'}
    }
    # First call
    handlers.delete_image_handler(event, None)
    # Second call (should still be 200 or 207? Logic says 200 if verify checks return True. 
    # S3 delete on non-existent is success. DynamoDB delete on non-existent is success.
    # So handlers should return 200.)
    
    response = handlers.delete_image_handler(event, None)
    
    # Actually, logic assumes delete_metadata_item returns True even if item didn't exist?
    # boto3 delete_item is idempotent and succeeds if item doesn't exist.
    assert response['statusCode'] == 200
