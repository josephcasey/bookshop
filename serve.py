"""Local dev server for the bookshop: like `python3 -m http.server`, but tells the browser
not to cache, so edited files always show up on a plain reload. Usage: python3 serve.py [port]"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # the page requests ~25 scripts at once; the default backlog of 5 resets connections
    request_queue_size = 128
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    print(f"Dog-Eared Books on http://localhost:{port}")
    Server(("", port), NoCacheHandler).serve_forever()
