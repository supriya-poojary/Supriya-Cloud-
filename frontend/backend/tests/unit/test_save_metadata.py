import boto3
import json
import pytest
from moto import mock_dynamodb
from src.app import handlers
import os

@pytest.fixture
def dynamo_setup():
    with mock_dynamodb():
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[
                {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                {'AttributeName': 'image_id', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'user_id', 'AttributeType': 'S'},
                {'AttributeName': 'image_id', 'AttributeType': 'S'},
                {'AttributeName': 'tag', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5},
            GlobalSecondaryIndexes=[{
                'IndexName': 'tag-index',
                'KeySchema': [
                    {'AttributeName': 'tag', 'KeyType': 'HASH'},
                    {'AttributeName': 'image_id', 'KeyType': 'RANGE'}
                ],
                'Projection': {'ProjectionType': 'ALL'},
                'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            }]
        )
        os.environ['TABLE_NAME'] = 'test-table'
        yield table

def test_save_metadata_success(dynamo_setup):
    event = {
        'body': json.dumps({
            'user_id': 'user123',
            'image_id': 'img123',
            'tag': 'vacation',
            'meta': 'data'
        })
    }
    response = handlers.save_metadata_handler(event, None)
    
    assert response['statusCode'] == 201
    
    # Verify in DB
    item = dynamo_setup.get_item(Key={'user_id': 'user123', 'image_id': 'img123'})
    assert item['Item']['tag'] == 'vacation'

def test_save_metadata_missing_fields(dynamo_setup):
    event = {
        'body': json.dumps({'tag': 'vacation'})
    }
    response = handlers.save_metadata_handler(event, None)
    
    assert response['statusCode'] == 400
