"""Download an official, user-requested Epsiloon export. Input is hidden JSON on stdin."""
import json
import os
from pathlib import Path
import sys
import termios
import urllib.request
from urllib.parse import urlparse

if sys.stdin.isatty():
    old = termios.tcgetattr(sys.stdin)
    new = list(old)
    new[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin, termios.TCSANOW, new)
else:
    old = None
print("Prêt pour les exports officiels (entrée masquée).", flush=True)
try:
    for line in sys.stdin:
        record = json.loads(line)
        if record.get("done"):
            break
        url = record["url"]
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != "pressview5.immanens.com" or not parsed.path.startswith("/api/user-print/"):
            raise ValueError("Export officiel attendu")
        name = record["name"]
        if not name.replace("-", "").replace("_", "").isalnum():
            raise ValueError("Identifiant de numéro invalide")
        folder = Path(__file__).resolve().parent.parent / "private" / "pdfs"
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / (name + ".pdf")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.epsiloon.com/"})
            with urllib.request.urlopen(req, timeout=120) as response:
                data = response.read()
            if not data.startswith(b"%PDF-"):
                print(json.dumps({"name": name, "ok": False, "reason": "Le serveur n'a pas renvoyé de PDF"}), flush=True)
                continue
            path.write_bytes(data)
            os.chmod(path, 0o600)
            print(json.dumps({"name": name, "ok": True, "bytes": len(data), "path": str(path)}), flush=True)
        except Exception as exc:
            print(json.dumps({"name": name, "ok": False, "reason": type(exc).__name__}), flush=True)
finally:
    if old is not None:
        termios.tcsetattr(sys.stdin, termios.TCSANOW, old)
