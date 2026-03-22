
import requests
import json

# Setup
BASE_URL = 'http://127.0.0.1:8000/api'
LOGIN_URL = f'{BASE_URL}/auth/login/'
VITALS_URL = f'{BASE_URL}/patient/vitals/mine/'

def run():
    # 1. Login as Patient
    # Assuming 'patient' user exists from previous context or seeds. 
    # If not, we might need to create one, but let's try a likely credential or print error.
    # I'll use a generic patient login if known, otherwise I'll need to create one.
    # Let's assume there's a patient 'patient'/'password123' or similiar.
    # Actually, I'll first try to find a patient user.
    
    # Correction: I cannot easily know the password of existing users.
    # I will create a temporary user in the script or assume the user has flexible auth in dev.
    # Better approach: Use the existing debug_api.py style or just try to hit the endpoint if I had a token.
    
    # Since I can't login easily without known credentials, I'll rely on reading the code mostly.
    # BUT, I can inspect the valid serializers.
    pass

# Wait, I can run a django standalone script to test the serializer directly!
# This avoids auth issues.

import os
import django
from django.conf import settings

# Configure Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hospital_backend.settings')
django.setup()

from api.serializers import VitalSerializer
from api.models import User

def test_serializer():
    print("Testing VitalSerializer with empty strings...")
    
    # Simulate frontend payload (FIXED)
    data = {
        'temperature': None, 
        'blood_pressure': None, 
        'heart_rate': None, 
        'weight': None, 
        'symptoms': 'Feeling dizzy'
    }
    
    # Mock context if needed, but for validation data is enough.
    serializer = VitalSerializer(data=data)
    if serializer.is_valid():
        print("Serializer is VALID")
        print(serializer.validated_data)
    else:
        print("Serializer is INVALID")
        print(serializer.errors)

if __name__ == '__main__':
    test_serializer()
