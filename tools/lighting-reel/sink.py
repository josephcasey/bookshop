"""Dev tool for the lighting reel (see README.md).
Serves reel.js and the golden images to the page, and saves the PNGs the page POSTs:
  POST /            {name, data: dataURL, dir: 'out' | 'golden'}  -> <dir>/<name>.png
  GET  /reel.js, GET /golden/<name>.png
Run:  python3 tools/lighting-reel/sink.py   (listens on 127.0.0.1:8124)"""
import base64, json, os, re
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
        name = re.sub(r'[^a-zA-Z0-9_-]', '', body['name'])
        sub = 'golden' if body.get('dir') == 'golden' else 'out'
        with open(os.path.join(HERE, sub, name + '.png'), 'wb') as f:
            f.write(base64.b64decode(body['data'].split(',', 1)[1]))
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')

    def do_GET(self):
        rel = self.path.split('?')[0].lstrip('/')
        if rel == 'reel.js':
            path, ctype = os.path.join(HERE, 'reel.js'), 'text/javascript'
        elif re.fullmatch(r'golden/[a-zA-Z0-9_-]+\.png', rel):
            path, ctype = os.path.join(HERE, rel), 'image/png'
        else:
            path = None
        if not path or not os.path.isfile(path):
            self.send_response(404); self._cors(); self.end_headers(); return
        self.send_response(200); self._cors()
        self.send_header('Content-Type', ctype); self.send_header('Cache-Control', 'no-store'); self.end_headers()
        with open(path, 'rb') as f:
            self.wfile.write(f.read())

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    HTTPServer(('127.0.0.1', 8124), H).serve_forever()
