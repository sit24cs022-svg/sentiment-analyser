import sys
import os

# Add root folder to sys.path so we can import backend packages
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import our Flask app
from backend.app import app
