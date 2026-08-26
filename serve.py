"""Local preview for the portfolio (plain static, no Range needed)."""
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
ROOT = os.path.dirname(os.path.abspath(__file__))
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 4199), H).serve_forever()
