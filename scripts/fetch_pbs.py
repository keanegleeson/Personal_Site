"""Fetch running PBs from Garmin Connect and write data/pbs.json.

Run by .github/workflows/update-pbs.yml on a schedule. Designed to be safe to
re-run: if Garmin login fails (rate-limited, creds wrong, API down) we exit
non-zero WITHOUT touching pbs.json so the site keeps the last-known-good values.

Auth strategy (tuned for GitHub Actions, where runner IPs are often rate-limited
by Garmin's mobile login endpoint):

  1. If GARMIN_TOKENS_B64 is set, decode it and write garmin_tokens.json into
     ~/.garminconnect. This is the seed produced by scripts/bootstrap_tokens.py
     run from your home IP.
  2. Call client.login(token_dir). The library uses cached tokens when present
     and only does a full password login as a last resort. Tokens auto-refresh
     and the refreshed copy is rewritten to disk for the next run.
  3. Refreshed tokens get persisted across workflow runs via actions/cache, so
     a credential login from the runner basically never happens.
"""

from __future__ import annotations

import base64
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
TOKEN_FILE = TOKEN_DIR / "garmin_tokens.json"
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


def seed_tokens_from_secret() -> None:
    """If GARMIN_TOKENS_B64 is set and we have no cached tokens, materialize them."""
    blob = os.environ.get("GARMIN_TOKENS_B64")
    if not blob:
        return
    if TOKEN_FILE.exists():
        return
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_bytes(base64.b64decode(blob))
    try:
        os.chmod(TOKEN_FILE, 0o600)
    except OSError:
        pass
    print(f"Seeded {TOKEN_FILE} from GARMIN_TOKENS_B64.")


def get_client() -> Garmin:
    seed_tokens_from_secret()

    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")

    # Pass creds as a fallback path. If TOKEN_FILE exists and is valid, the
    # library uses it and never hits the rate-limited mobile login endpoint.
    client = Garmin(email=email or None, password=password or None)
    client.login(str(TOKEN_DIR))
    return client


def fetch_pbs(client: Garmin) -> dict[str, str]:
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
        print(f"Unexpected error ({type(exc).__name__}): {exc}. Leaving pbs.json untouched.")
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
