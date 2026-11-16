"""Receive ephemeral official export URLs through a local FIFO, never written to disk."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import urllib.request
from urllib.parse import urlparse

root = Path(__file__).resolve().parent.parent
folder = root / "private" / "pdfs"
folder.mkdir(parents=True, exist_ok=True)
pipe = root / "private" / "download.pipe"
if pipe.exists():
    pipe.unlink()
os.mkfifo(pipe, 0o600)

def download(record):
    name = record["name"]
    parsed = urlparse(record["url"])
    if parsed.scheme != "https" or parsed.hostname != "pressview5.immanens.com" or not parsed.path.startswith("/api/user-print/"):
        return
    if not name.replace("-", "").isalnum():
        return
    path = folder / (name + ".pdf")
    if path.exists() and path.stat().st_size > 100000:
        print(json.dumps({"name": name, "ok": True, "cached": True}), flush=True)
        return
    try:
        req = urllib.request.Request(record["url"], headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.epsiloon.com/"})
        with urllib.request.urlopen(req, timeout=180) as response:
            data = response.read()
        if not data.startswith(b"%PDF-"):
            raise ValueError("PDF expected")
        part = path.with_suffix(".pdf.part")
        part.write_bytes(data)
        os.chmod(part, 0o600)
        part.replace(path)
        info = subprocess.check_output(["pdfinfo", str(path)], text=True)
        pages = next(int(line.split(":")[1]) for line in info.splitlines() if line.startswith("Pages:"))
        print(json.dumps({"name": name, "ok": True, "bytes": len(data), "pages": pages}), flush=True)
    except Exception as exc:
        print(json.dumps({"name": name, "ok": False, "reason": type(exc).__name__}), flush=True)

print("Collecte prête : 4 téléchargements au maximum, liens transmis en mémoire.", flush=True)
try:
    fd = os.open(pipe, os.O_RDWR)
    with os.fdopen(fd) as stream, ThreadPoolExecutor(max_workers=4) as pool:
        for line in stream:
            record = json.loads(line)
            if record.get("done"):
                break
            pool.submit(download, record)
finally:
    pipe.unlink(missing_ok=True)
