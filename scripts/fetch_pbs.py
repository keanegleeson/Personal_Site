"""Fetch running PBs from Garmin Connect and write them to data/pbs.json.

Run by .github/workflows/update-pbs.yml on a schedule. Designed to be safe to
re-run: if Garmin login fails (rate-limited, creds wrong, API down) we exit
non-zero WITHOUT touching pbs.json so the site keeps the last-known-good values.

Auth strategy: prefer cached OAuth tokens at ~/.garminconnect (restored from
the Actions cache). Fall back to email+password login only when no tokens
exist or they've expired. After a successful run we re-dump tokens so the
next workflow run can skip the password login entirely.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)


TOKEN_DIR = Path.home() / ".garminconnect"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "pbs.json"

TYPE_ID_MAP = {
    2: "mile",
    3: "5k",
    4: "10k",
    5: "half",
    6: "marathon",
}


def format_time(seconds: float | None) -> str:
    if seconds is None:
        return "--:--"
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def get_client() -> Garmin:
    """Return an authenticated Garmin client, preferring cached tokens."""
    if TOKEN_DIR.exists() and any(TOKEN_DIR.iterdir()):
        try:
            client = Garmin()
            client.login(str(TOKEN_DIR))
            print("Logged in via cached tokens.")
            return client
        except (GarminConnectAuthenticationError, FileNotFoundError) as exc:
            print(f"Cached tokens unusable ({exc}); falling back to password login.")

    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        raise RuntimeError("GARMIN_EMAIL / GARMIN_PASSWORD env vars are required for first-time login.")

    client = Garmin(email, password)
    client.login()
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    client.garth.dump(str(TOKEN_DIR))
    print(f"Logged in with password and cached tokens to {TOKEN_DIR}.")
    return client


def fetch_pbs(client: Garmin) -> dict[str, str | None]:
    pbs: dict[str, float | None] = {key: None for key in TYPE_ID_MAP.values()}
    for record in client.get_personal_record():
        type_id = record.get("typeId")
        if type_id in TYPE_ID_MAP:
            value = record.get("value")
            if value is not None:
                pbs[TYPE_ID_MAP[type_id]] = value
    return {key: format_time(val) for key, val in pbs.items()}


def main() -> int:
    try:
        client = get_client()
        pbs = fetch_pbs(client)
    except GarminConnectTooManyRequestsError as exc:
        print(f"Rate limited by Garmin: {exc}. Leaving pbs.json untouched.")
        return 1
    except (GarminConnectAuthenticationError, GarminConnectConnectionError) as exc:
        print(f"Garmin error: {exc}. Leaving pbs.json untouched.")
        return 1
    except Exception as exc:
        print(f"Unexpected error: {exc}. Leaving pbs.json untouched.")
        return 1

    payload = {
        **pbs,
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "garmin",
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}: {payload}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
