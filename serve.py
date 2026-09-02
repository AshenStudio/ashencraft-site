#!/usr/bin/env python3
"""AshenCraft website server: static files + same-origin proxy.

Routes:
  /api/<path>      -> forwarded to {API_URL}/api/<path>  (prefix kept)
  /map/<path>      -> forwarded to {MAP_URL}/<path>      (prefix stripped)
  /site-config.js  -> served with Cache-Control: no-store (regenerated at boot)
  everything else  -> static files from the repo directory

Stdlib only. The proxy exists so the browser never makes cross-origin
requests: the map feed (/up/...) and the API (/api/launcher/version) are
reached same-origin through this server, sidestepping CORS entirely.
"""
import functools
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "80"))
API_URL = os.environ.get("API_URL", "https://ashenapi.overdev.net").rstrip("/")
MAP_URL = os.environ.get("MAP_URL", "https://map.ashencraft.overdev.net").rstrip("/")

_PASS_THROUGH = {"content-type", "cache-control", "etag"}


def _proxy(base_url: str, path: str, query: str):
    """Fetch {base_url}/{path}?{query}; returns (status, headers, body-bytes)."""
    url = f"{base_url}/{path}"
    if query:
        url = f"{url}?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": "AshenSite/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            headers = {
                name: value
                for name, value in response.headers.items()
                if name.lower() in _PASS_THROUGH
            }
            return response.status, headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, {"content-type": "application/json"}, error.read()
    except (urllib.error.URLError, TimeoutError):
        return 502, {"content-type": "application/json"}, b'{"error":"upstream unreachable"}'


class SiteHandler(SimpleHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (http.server naming)
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path.lstrip("/")
        if path == "site-config.js":
            return self._serve_no_store("site-config.js")
        if path.startswith("api/"):
            return self._reply_proxy(_proxy(API_URL, path, parsed.query))
        if path.startswith("map/"):
            return self._reply_proxy(_proxy(MAP_URL, path[len("map/"):], parsed.query))
        return super().do_GET()

    def _reply_proxy(self, result):
        status, headers, body = result
        self.send_response(status)
        for name, value in headers.items():
            self.send_header(name, value)
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _serve_no_store(self, filename):
        import pathlib

        file_path = pathlib.Path(self.translate_path("/" + filename))
        try:
            body = file_path.read_bytes()
        except OSError:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("content-type", "text/javascript")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # quiet container logs
        pass


def make_server(port: int) -> ThreadingHTTPServer:
    handler = functools.partial(SiteHandler, directory=os.path.dirname(os.path.abspath(__file__)))
    return ThreadingHTTPServer(("0.0.0.0", port), handler)


if __name__ == "__main__":
    print(f"[AshenSite] serving on :{PORT} (api={API_URL}, map={MAP_URL})")
    make_server(PORT).serve_forever()