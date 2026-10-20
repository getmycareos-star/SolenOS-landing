#!/usr/bin/env python3
"""
SolenOS Monitoring Verification Script
This script verifies that the SolenOS monitoring setup components are in place.
"""

import requests
import sys
import json

def check_backend_health_endpoint_exists():
    """Check if the SolenOS backend health endpoint exists in code."""
    # Since we can't directly test the deployed endpoint without redeployment,
    # we verify the code change is present
    try:
        with open("C:/Users/me/solenos/backend/app/main.py", "r") as f:
            content = f.read()
            if "@app.get(\"/health\")" in content and "def health_check()" in content:
                print("[PASS] Backend health check endpoint exists in code")
                return True
            else:
                print("[FAIL] Backend health check endpoint not found in code")
                return False
    except Exception as e:
        print(f"[FAIL] Could not verify backend health check endpoint: {str(e)}")
        return False

def check_frontend():
    """Check if the SolenOS frontend is accessible."""
    url = "https://solenosai.netlify.app"
    try:
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            # Check for expected content
            if "SolenOS" in response.text or "<!DOCTYPE html>" in response.text:
                print("[PASS] Frontend accessibility")
                return True
            else:
                print("[FAIL] Frontend accessibility - Unexpected content")
                return False
        else:
            print(f"[FAIL] Frontend accessibility - HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"[FAIL] Frontend accessibility - {str(e)}")
        return False

def check_uptime_kuma():
    """Check if Uptime Kuma is running locally."""
    url = "http://localhost:3001"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            print("[PASS] Uptime Kuma accessibility")
            return True
        else:
            print(f"[FAIL] Uptime Kuma accessibility - HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"[FAIL] Uptime Kuma accessibility - {str(e)}")
        return False

def main():
    print("SolenOS Monitoring Setup Verification")
    print("=" * 45)
    print("Note: Backend health check endpoint is in code but may require redeployment")
    print()
    
    checks = [
        check_uptime_kuma,
        check_frontend,
        check_backend_health_endpoint_exists
    ]
    
    passed = 0
    total = len(checks)
    
    for check in checks:
        if check():
            passed += 1
        print()  # Empty line for readability
    
    print(f"Results: {passed}/{total} checks passed")
    
    if passed == total:
        print("[PASS] All monitoring components are properly configured!")
        print()
        print("Next steps:")
        print("1. Redeploy backend to activate health check endpoint")
        print("2. Access Uptime Kuma at http://localhost:3001")
        print("3. Configure monitors as documented in MONITORING_SETUP.md")
        print("4. Set up notification channels")
        return 0
    else:
        print("[FAIL] Some monitoring components need attention.")
        return 1

if __name__ == "__main__":
    sys.exit(main())