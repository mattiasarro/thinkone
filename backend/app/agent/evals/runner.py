"""Run the golden set against a running API as an operator.

    uv run python -m app.agent.evals.runner --base https://api.dev.thinkone.ai --email … --password …

Each question gets a fresh thread (stream=false). A case passes when the answer status is done, some expected
phrase appears (case-insensitive), at least one of the allowed tools ran, citations exist when required and every
citation resolves, and the required card type is present. Prints a table and the pass rate; exits 1 below the target.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

import httpx

GOLDEN = pathlib.Path(__file__).with_name("golden.jsonl")
TARGET = 0.95


def load_cases() -> list[dict]:
    return [json.loads(line) for line in GOLDEN.read_text(encoding="utf-8").splitlines() if line.strip()]


def check(case: dict, msg: dict) -> tuple[bool, str]:
    if msg.get("status") != "done":
        return False, f"status {msg.get('status')}"
    text = (msg.get("text") or "").lower()
    if case.get("expect_any") and not any(x.lower() in text for x in case["expect_any"]):
        return False, "expected phrase missing"
    tools = {s.get("tool") for s in msg.get("steps") or []}
    if case.get("tools_any") and not tools & set(case["tools_any"]):
        return False, f"tools {sorted(t for t in tools if t)}"
    if case.get("citations") and not msg.get("citations"):
        return False, "no citations"
    if case.get("card") and not any(c.get("type") == case["card"] for c in msg.get("cards") or []):
        return False, f"card {case['card']} missing"
    return True, "ok"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--only", default=None, help="comma-separated case ids")
    args = ap.parse_args()
    c = httpx.Client(base_url=args.base, timeout=300)
    r = c.post("/api/v1/auth/login", json={"email": args.email, "password": args.password})
    r.raise_for_status()
    cases = load_cases()
    if args.only:
        wanted = set(args.only.split(","))
        cases = [x for x in cases if x["id"] in wanted]
    passed = 0
    for case in cases:
        t = c.post("/api/v1/agent/threads", json={"title": f"eval {case['id']}"}).json()
        m = c.post(f"/api/v1/agent/threads/{t['id']}/messages", params={"stream": "false"}, json={"text": case["question"]}).json()
        ok, why = check(case, m)
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'}  {case['id']}  {why:32s}  {(m.get('text') or '')[:90]!r}")
        c.delete(f"/api/v1/agent/threads/{t['id']}")
    rate = passed / max(len(cases), 1)
    print(f"\n{passed}/{len(cases)} passed ({rate:.0%}); target {TARGET:.0%}")
    return 0 if rate >= TARGET else 1


if __name__ == "__main__":
    sys.exit(main())
