from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import datetime, timedelta
from garminconnect import Garmin

# In-memory cache for PBs
_cache = {
    "data": None,
    "expires_at": None
}

# Mapping from Garmin's PR type keys to our display names
PR_TYPE_MAP = {
    "pr_mile": "mile",
    "pr_5k": "5k",
    "pr_10k": "10k",
    "pr_half_marathon": "half",
    "pr_marathon": "marathon"
}


def format_time(seconds):
    """Convert seconds to human-readable time format."""
    if seconds is None:
        return "--:--"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"


def get_garmin_pbs():
    """Fetch personal records directly from Garmin."""
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    
    if not email or not password:
        raise Exception("Garmin credentials not configured")
    
    # Initialize Garmin client
    client = Garmin(email, password)
    client.login()
    
    # Fetch personal records directly from Garmin
    personal_records = client.get_personal_record()
    
    # Parse the personal records
    pbs = {
        "mile": None,
        "5k": None,
        "10k": None,
        "half": None,
        "marathon": None
    }
    
    # Personal records come as a list of record objects
    for record in personal_records:
        type_key = record.get("prTypePk", "")
        
        # Map Garmin's type key to our display key
        for garmin_key, our_key in PR_TYPE_MAP.items():
            if garmin_key in type_key.lower() or type_key.lower() in garmin_key:
                # Get the time value (in seconds)
                time_val = record.get("value")
                if time_val is not None:
                    pbs[our_key] = time_val
                break
    
    return {key: format_time(val) for key, val in pbs.items()}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global _cache
        
        try:
            # Check cache
            now = datetime.now()
            if _cache["data"] and _cache["expires_at"] and now < _cache["expires_at"]:
                pbs = _cache["data"]
            else:
                # Fetch fresh data
                pbs = get_garmin_pbs()
                
                # Cache for 24 hours
                _cache["data"] = pbs
                _cache["expires_at"] = now + timedelta(hours=24)
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET")
            self.end_headers()
            
            self.wfile.write(json.dumps(pbs).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            error_response = {
                "error": str(e),
                "mile": "--:--",
                "5k": "--:--",
                "10k": "--:--",
                "half": "--:--",
                "marathon": "--:--"
            }
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
