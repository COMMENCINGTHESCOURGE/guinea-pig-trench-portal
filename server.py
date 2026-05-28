#!/usr/bin/env python
"""
Guinea Pig Trench — Local Test Server
Run this, then open http://localhost:8000 in your browser.
"""
import http.server
import socketserver
import webbrowser
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIRECTORY)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        if '200' in str(args) or '304' in str(args):
            return
        print(f"  {args[0]}")

print()
print("=" * 50)
print("  GUINEA PIG TRENCH — LOCAL TEST SERVER")
print("=" * 50)
print()
print(f"  Server: http://localhost:{PORT}")
print(f"  Directory: {DIRECTORY}")
print()
print("  Opening browser...")
print("  Press Ctrl+C to stop")
print()

webbrowser.open(f'http://localhost:{PORT}')

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")
