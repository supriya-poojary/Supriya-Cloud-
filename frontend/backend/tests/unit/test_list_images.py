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
        
        # Seed data
        table.put_item(Item={'user_id': 'user1', 'image_id': '2023-01-01', 'tag': 'a'})
        table.put_item(Item={'user_id': 'user1', 'image_id': '2023-01-02', 'tag': 'b'})
        table.put_item(Item={'user_id': 'user2', 'image_id': '2023-01-01', 'tag': 'a'})
        
        yield table

def test_list_images_by_user(dynamo_setup):
    event = {
        'queryStringParameters': {'user_id': 'user1'}
    }
    response = handlers.list_images_handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert len(body['images']) == 2

def test_list_images_by_tag(dynamo_setup):
    event = {
        'queryStringParameters': {'tag': 'a'}
    }
    response = handlers.list_images_handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert len(body['images']) == 2 # user1/a and user2/a

def test_list_images_by_user_and_date(dynamo_setup):
    event = {
        'queryStringParameters': {
            'user_id': 'user1',
            'start_date': '2023-01-02',
            'end_date': '2023-01-03'
        }
    }
    response = handlers.list_images_handler(event, None)
    
    body = json.loads(response['body'])
    assert len(body['images']) == 1
    assert body['images'][0]['image_id'] == '2023-01-02'
