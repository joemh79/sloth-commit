#!/usr/bin/env python3
"""SlothCommit local backend — uses Ollama + Gemma (open weights) on your machine.
Run:  python3 local_server.py
Then open http://localhost:8080 and paste a diff.
Requires: ollama running with gemma3:4b pulled (ollama pull gemma3:4b)
"""
import json, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma3:4b"
HERE = Path(__file__).parent

STYLE_GUIDE = {
    "conventional": "Follow Conventional Commits: type(scope): subject. Types: feat, fix, docs, style, refactor, test, chore.",
    "simple": "Write a short, plain-English summary line under 72 chars. No prefixes.",
    "emoji": "Start the subject with one relevant emoji, then a short summary under 72 chars.",
}

def ollama(prompt, max_tokens=400):
    data = json.dumps({"model": MODEL, "prompt": prompt, "stream": False,
                       "options": {"num_predict": max_tokens}}).encode()
    req = urllib.request.Request(OLLAMA_URL, data=data,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["response"].strip()

def clean(s):
    s = s.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s
    return s.rstrip("`").strip()

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        b = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(200, (HERE / "index.html").read_bytes(), "text/html; charset=utf-8")
        else:
            self._send(404, "not found", "text/plain")

    def do_POST(self):
        if self.path != "/api/generate":
            return self._send(404, json.dumps({"error": "not found"}))
        try:
            d = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            diff, style, with_pr = d.get("diff", ""), d.get("style", "conventional"), d.get("withPr", True)
            if not diff or len(diff) > 12000:
                return self._send(400, json.dumps({"error": "invalid diff"}))
            guide = STYLE_GUIDE.get(style, STYLE_GUIDE["conventional"])
            prompt = (f"You are SlothCommit, a lazy-but-precise commit message generator. {guide}\n\n"
                      "Rules:\n- Subject line: imperative mood, under 72 characters, no trailing period.\n"
                      "- Then a blank line, then 1-3 bullet body lines explaining WHAT changed and WHY (not HOW).\n"
                      "- Never invent file names or details not in the diff. Never add \"Co-authored-by\".\n"
                      "- Output ONLY the commit message, no commentary, no code fences.\n\n"
                      f"Git diff:\n{diff[:8000]}")
            commit = clean(ollama(prompt))
            pr = ""
            if with_pr:
                prp = ("Write a concise PR description for this change. Format:\n## What changed\n- bullet list\n"
                       "## Why\n- bullet list\n## Testing\n- bullet list\n\nKeep it under 150 words. "
                       "No commentary outside the description.\n\nGit diff:\n" + diff[:6000])
                pr = clean(ollama(prp, 500))
            self._send(200, json.dumps({"commit": commit, "pr": pr}))
        except Exception as e:
            self._send(500, json.dumps({"error": str(e)}))

    def log_message(self, *a): pass

if __name__ == "__main__":
    print("🦥 SlothCommit local server on http://localhost:8080 (Ollama + gemma3:4b)")
    HTTPServer(("127.0.0.1", 8080), H).serve_forever()
