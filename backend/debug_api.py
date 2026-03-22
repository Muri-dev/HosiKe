import requests
import json

try:
    # Need to authenticate first to get token
    # login as doctor
    auth = requests.post('http://127.0.0.1:8000/api/auth/login/', json={'username': 'doc1', 'password': 'password123'})
    if auth.status_code != 200:
        print("Login failed:", auth.text)
        exit()
    
    token = auth.json()['access']
    headers = {'Authorization': f'Bearer {token}'}

    res = requests.get('http://127.0.0.1:8000/api/admissions/?status=admitted', headers=headers)
    print(f"Status: {res.status_code}")
    print(json.dumps(res.json(), indent=2))
except Exception as e:
    print(e)
