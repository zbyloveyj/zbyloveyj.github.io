"""Loopback-only, offline web interface. No keys or network model calls in the UI."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json

from .core import offline_answer, validate_search

HTML = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AI Agent 证据练习</title><style>body{font:17px/1.7 system-ui,sans-serif;margin:40px auto;padding:0 24px;max-width:850px;color:#17352e;background:#f7f7ef}h1{line-height:1.2}textarea{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #78998c;border-radius:8px}button{font:inherit;background:#1b6950;color:white;border:0;border-radius:8px;padding:9px 18px;cursor:pointer}pre{white-space:pre-wrap;word-break:break-word;background:white;padding:20px;border-radius:10px}label{display:block;margin:20px 0 8px}.note{color:#566c63}</style><main><p>个人成长院 · Day 26</p><h1>你的第一个证据助手</h1><p class="note">本地规则练习：从 8 条教学笔记检索并拼接原文。输入问题，检查引用，再判断材料是否真的支持回答。</p><form id="form"><label for="question">今天想核对什么？</label><textarea id="question" rows="3" maxlength="4000">What is a tool contract?</textarea><p><label for="topk">最多返回几条证据</label><select id="topk"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></p><button id="submit">查找证据</button></form><p id="status" role="status"></p><pre id="result">结果将在这里显示。</pre></main><script>document.querySelector('#form').addEventListener('submit',async(e)=>{e.preventDefault();const button=document.querySelector('#submit');button.disabled=true;document.querySelector('#status').textContent='正在检索…';try{const r=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:document.querySelector('#question').value,top_k:Number(document.querySelector('#topk').value)})});const data=await r.json();document.querySelector('#result').textContent=JSON.stringify(data,null,2);document.querySelector('#status').textContent=r.ok?'请逐条检查来源与不确定性。':'请求未通过检查。';}catch(err){document.querySelector('#status').textContent='连接失败，请确认本地服务仍在运行。';}finally{button.disabled=false;}});</script></html>'''


def handle_ask(value):
    errors = validate_search(value)
    if errors:
        raise ValueError("; ".join(errors))
    return offline_answer(value["question"], value["top_k"])


class Handler(BaseHTTPRequestHandler):
    server_version = "AgentCourse/1.0"

    def log_message(self, format, *args):
        return  # User questions are not written into an HTTP access log.

    def send(self, status, value, content_type="application/json; charset=utf-8"):
        data = value.encode("utf-8") if isinstance(value, str) else json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(data)

    def same_site(self):
        port = self.server.server_address[1]
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin")
        if host not in hosts or (origin is not None and origin != "http://" + host):
            self.send(403, {"error": "Only requests from this loopback origin are accepted."})
            return False
        return True

    def do_GET(self):
        if not self.same_site():
            return
        if self.path == "/":
            self.send(200, HTML, "text/html; charset=utf-8")
        elif self.path == "/health":
            self.send(200, {"ok": True, "provider": "offline", "scope": "loopback"})
        else:
            self.send(404, {"error": "Not found"})

    def do_POST(self):
        if not self.same_site():
            return
        if self.path != "/api/ask":
            self.send(404, {"error": "Not found"})
            return
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip() != "application/json":
            self.send(415, {"error": "Content-Type must be application/json"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 16384:
                raise ValueError("Request body must have 1..16384 bytes")
            self.connection.settimeout(5)
            value = json.loads(self.rfile.read(length).decode("utf-8"))
            self.send(200, handle_ask(value))
        except (ValueError, UnicodeError, TimeoutError) as exc:
            self.send(400, {"error": str(exc)})


def make_server(port=8765):
    if type(port) is not int or not 0 <= port <= 65535:
        raise ValueError("port must be 0..65535; port 0 is used by automated tests")
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def serve(port=8765):
    server = make_server(port)
    print("Offline practice is available at http://127.0.0.1:"+str(server.server_address[1])+"/ — Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
