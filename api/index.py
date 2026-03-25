import sys
import os

# Add the root and backend directory to path so it can find 'backend' and 'src'
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_path)
sys.path.append(os.path.join(root_path, 'backend'))

# Import the Flask app from backend/api_server.py
from backend.api_server import app

# This is the entry point for Vercel
# Vercel handles the 'app' object automatically
