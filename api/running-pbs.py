from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import datetime, timedelta
from garminconnect import Garmin

# In-memory cache for PBs (survives within a single warm instance)
_cache = {
    "data": None,
    "expires_at": None
}

# Last-known-good PB values — update these whenever you set a new PR.
# Returned when Garmin is unreachable (rate-limited, down, etc.)
FALLBACK_PBS = {
    "mile": "4:50",
    "5k": "16:44",
    "10k": "35:35",
    "half": "1:18:32",
    "marathon": "2:54:05"
}

TYPE_ID_MAP = {
    2: "mile",
    3: "5k",
    4: "10k",
    5: "half",
    6: "marathon"
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
    
    # Initialize PBs
    pbs = {
        "mile": None,
        "5k": None,
        "10k": None,
        "half": None,
        "marathon": None
    }
    
    # Parse records by typeId
    for record in personal_records:
        type_id = record.get("typeId")
        if type_id in TYPE_ID_MAP:
            key = TYPE_ID_MAP[type_id]
            # Value is in seconds
            time_val = record.get("value")
            if time_val is not None:
                pbs[key] = time_val
    
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
            # Garmin unreachable — serve fallback PBs so the site still shows data
            fallback = dict(FALLBACK_PBS)
            fallback["cached"] = True
            fallback["error"] = str(e)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET")
            self.end_headers()
            self.wfile.write(json.dumps(fallback).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
