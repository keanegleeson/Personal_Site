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

# Target distances in meters with tolerance
DISTANCES = {
    "mile": {"target": 1609.34, "tolerance": 0.05},
    "5k": {"target": 5000, "tolerance": 0.03},
    "10k": {"target": 10000, "tolerance": 0.03},
    "half": {"target": 21097.5, "tolerance": 0.03},
    "marathon": {"target": 42195, "tolerance": 0.03}
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


def is_within_tolerance(distance, target, tolerance):
    """Check if distance is within tolerance of target."""
    return abs(distance - target) / target <= tolerance


def compute_pbs(activities):
    """Compute personal bests from activity list."""
    pbs = {key: None for key in DISTANCES.keys()}
    
    for activity in activities:
        # Only consider running activities
        activity_type = activity.get("activityType", {}).get("typeKey", "")
        if "running" not in activity_type.lower() and "run" not in activity_type.lower():
            continue
        
        distance = activity.get("distance", 0)  # in meters
        duration = activity.get("duration", 0)  # in seconds
        
        if distance <= 0 or duration <= 0:
            continue
        
        # Check each target distance
        for key, config in DISTANCES.items():
            if is_within_tolerance(distance, config["target"], config["tolerance"]):
                if pbs[key] is None or duration < pbs[key]:
                    pbs[key] = duration
    
    return pbs


def get_garmin_pbs():
    """Fetch activities from Garmin and compute PBs."""
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    
    if not email or not password:
        raise Exception("Garmin credentials not configured")
    
    # Initialize Garmin client
    client = Garmin(email, password)
    client.login()
    
    # Fetch all running activities (up to 1000 to ensure we get history)
    activities = client.get_activities(0, 1000)
    
    # Compute PBs
    pbs = compute_pbs(activities)
    
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
