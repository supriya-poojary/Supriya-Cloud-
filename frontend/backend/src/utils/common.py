import json
import decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            if o % 1 > 0:
                return float(o)
            else:
                return int(o)
        return super(DecimalEncoder, self).default(o)

def create_response(status_code, body):
    """Create a standard API Gateway response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body, cls=DecimalEncoder)
    }

def create_error_response(status_code, message, details=None):
    """Create a standard error response."""
    body = {
        "status": "error",
        "message": message
    }
    if details:
        body["details"] = details
    return create_response(status_code, body)
