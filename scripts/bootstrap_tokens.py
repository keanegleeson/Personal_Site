"""One-time bootstrap: log into Garmin from your local machine and print a
base64-encoded copy of the resulting token file. Paste the output into the
GARMIN_TOKENS_B64 GitHub Actions secret so the workflow never has to do a
password login from a rate-limited GitHub runner IP.

Usage:
    set GARMIN_EMAIL=you@example.com
    set GARMIN_PASSWORD=...
    py scripts/bootstrap_tokens.py

If your account has MFA enabled the script will prompt you for the code.
Re-run this any time the refresh token expires (you'll see auth errors in
the workflow) — typically once a year.
"""

from __future__ import annotations

import base64
import getpass
import os
import sys
from pathlib import Path

from garminconnect import Garmin


TOKEN_DIR = Path.home() / ".garminconnect"
TOKEN_FILE = TOKEN_DIR / "garmin_tokens.json"


def main() -> int:
    email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ").strip()
    password = os.environ.get("GARMIN_PASSWORD") or getpass.getpass("Garmin password: ")

    client = Garmin(
        email=email,
        password=password,
        prompt_mfa=lambda: input("MFA code: ").strip(),
    )
    client.login(str(TOKEN_DIR))

    if not TOKEN_FILE.exists():
        print(f"ERROR: expected {TOKEN_FILE} to exist after login.", file=sys.stderr)
        return 1

    encoded = base64.b64encode(TOKEN_FILE.read_bytes()).decode("ascii")
    print()
    print("Login OK. Copy the line below (no surrounding whitespace) into the")
    print("GitHub repo secret named GARMIN_TOKENS_B64:")
    print()
    print(encoded)
    return 0


if __name__ == "__main__":
    sys.exit(main())
