"""
HosiKe Concurrent Load Testing Tool
Run 50, 100, or more simultaneous requests against HosiKe to test performance and database resilience.

Usage:
    python load_test.py
    python load_test.py --users 50
    python load_test.py --users 100 --ai
"""

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hospital_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import django
django.setup()

from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken
from api.models import User


def run_benchmark(num_users=50, include_ai=False):
    print(f"\n🚀 Initializing HosiKe Stress Test with {num_users} simultaneous requests...")
    
    # 1. Gather users and tokens
    users = list(User.objects.all())
    user_map = {u.username: str(RefreshToken.for_user(u).access_token) for u in users}
    
    if 'admin1' not in user_map or 'patient1' not in user_map:
        print("⚠️ Warning: Demo accounts not found. Run 'python manage.py loaddata data_backup.json' first.")
        return

    # Standard dashboard endpoints
    standard_endpoints = [
        ('admin1', '/api/admin/overview/', 'GET', None),
        ('doctor1', '/api/doctor/dashboard/', 'GET', None),
        ('nurse1', '/api/nurse/queue/', 'GET', None),
        ('patient1', '/api/appointments/mine/', 'GET', None),
        ('patient1', '/api/patient/me/', 'GET', None),
    ]

    ai_endpoints = [
        ('patient1', '/api/ai/chat/', 'POST', {'message': 'When is my next appointment?'}),
        ('admin1', '/api/ai/chat/', 'POST', {'message': 'How many doctors do we have?'}),
    ]

    endpoints = (standard_endpoints + ai_endpoints) if include_ai else standard_endpoints

    def execute_single_request(req_id):
        uname, path, method, payload = endpoints[req_id % len(endpoints)]
        tok = user_map.get(uname)
        c = Client()
        
        t0 = time.perf_counter()
        try:
            if method == 'GET':
                resp = c.get(path, HTTP_AUTHORIZATION=f"Bearer {tok}", HTTP_HOST="127.0.0.1")
            else:
                resp = c.post(path, data=payload, content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {tok}", HTTP_HOST="127.0.0.1")
            latency = time.perf_counter() - t0
            return resp.status_code, latency, path, None
        except Exception as err:
            latency = time.perf_counter() - t0
            return 500, latency, path, str(err)

    print(f"⚡ Firing {num_users} requests in parallel...")
    t_start = time.perf_counter()
    results = []
    
    with ThreadPoolExecutor(max_workers=min(num_users, 60)) as executor:
        futures = [executor.submit(execute_single_request, i) for i in range(num_users)]
        for f in as_completed(futures):
            results.append(f.result())
            
    t_total = time.perf_counter() - t_start

    # Metrics calculation
    successes = [r for r in results if r[0] == 200]
    failures = [r for r in results if r[0] != 200]
    latencies = [r[1] for r in results]
    latencies.sort()

    avg_lat = sum(latencies) / len(latencies)
    p50 = latencies[len(latencies) // 2]
    p90 = latencies[int(len(latencies) * 0.90)]
    p99 = latencies[int(len(latencies) * 0.99)]

    print("\n" + "=" * 55)
    print(f"📊 BENCHMARK REPORT: {num_users} SIMULTANEOUS USERS")
    print("=" * 55)
    print(f"  • Success Rate:        {len(successes)}/{num_users} ({len(successes)/num_users*100:.1f}%)")
    print(f"  • Failed Requests:     {len(failures)}")
    print(f"  • Total Test Duration: {t_total:.2f} seconds")
    print(f"  • Average Latency:     {avg_lat:.2f}s per request")
    print(f"  • Median (P50):        {p50:.2f}s")
    print(f"  • 90th Percentile:     {p90:.2f}s")
    print(f"  • 99th Percentile:     {p99:.2f}s")
    print(f"  • System Throughput:   {num_users / t_total:.1f} requests/second")
    print("=" * 55)

    if failures:
        print("\n⚠️ Samples of failed requests:")
        for code, lat, path, err in failures[:3]:
            print(f"   - Path: {path} | Code: {code} | Error: {err}")
    else:
        print("\n✅ Zero dropped requests! Supabase connection pooler and Django handled all concurrent traffic cleanly.\n")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="HosiKe Concurrency Load Tester")
    parser.add_argument('--users', type=int, default=50, help="Number of concurrent requests (default: 50)")
    parser.add_argument('--ai', action='store_true', help="Include AI endpoints in the load test")
    args = parser.parse_args()

    run_benchmark(num_users=args.users, include_ai=args.ai)
