"""Quick E2E test: submit analyze job and poll status until done."""
import urllib.request
import json
import time

# 1. Submit analysis
payload = json.dumps({
    "nl_goal": "I want 15 percent return moderate risk 5 lakh capital 1 year",
    "portfolio": [],
}).encode()
req = urllib.request.Request(
    "http://localhost:8000/api/analyze",
    data=payload,
    headers={"Content-Type": "application/json"},
)
res = json.loads(urllib.request.urlopen(req).read().decode())
job_id = res["job_id"]
print(f"Job submitted: {job_id}")

# 2. Poll status every 2 seconds
for i in range(90):
    time.sleep(2)
    url = f"http://localhost:8000/api/status/{job_id}"
    st = json.loads(urllib.request.urlopen(url).read().decode())
    pct = st["progress"]
    status = st["status"]
    msg = st["message"]
    print(f"  [{i*2:3d}s] {pct:3d}% | {status:8s} | {msg}")
    if status in ("done", "error"):
        break

print("FINISHED")
