#!/usr/bin/env python3
"""AshenCraft website server: pretty URLs + static files + same-origin proxy.

Routes:
  /api/<path>      -> forwarded to {API_URL}/api/<path>  (prefix kept)
  /map/<path>      -> forwarded to {MAP_URL}/<path>      (prefix stripped)
  /site-config.js  -> served with Cache-Control: no-store (regenerated at boot)
  /<page>          -> <page>.html when it exists (extensionless URLs)
  /community/<page>-> community/<page>.html the same way
  /<old>.html      -> 301 redirect to the extensionless form
  everything else  -> static files from the repo directory

Stdlib only. The proxy exists so the browser never makes cross-origin
requests: the map feed (/up/...), the launcher download and the account
endpoints (/api/auth/*) are all reached same-origin through this server,
sidestepping CORS entirely. GET/HEAD serve pages + proxy; POST forwards
to the API only (login/register/logout are the site's only writes).
"""
import functools
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "80"))
API_URL = os.environ.get("API_URL", "https://ashenapi.overdev.net").rstrip("/")
MAP_URL = os.environ.get("MAP_URL", "https://eu.ashencraft.overdev.net").rstrip("/")

_PASS_THROUGH = {"content-type", "cache-control", "etag"}


def _read_static(handler, filename):
    import pathlib

    file_path = pathlib.Path(handler.translate_path("/" + filename))
    try:
        return file_path.read_bytes()
    except (OSError, ValueError):
        return None


def _proxy(base_url: str, path: str, query: str, body: bytes | None = None,
           content_type: str | None = None, method: str = "GET"):
    """Forward a request to {base_url}/{path}?{query}.

    Returns (status, headers, body-bytes). POST carries the caller's body so
    the auth endpoints (/api/auth/login, /api/auth/register) work same-origin
    from the website.
    """
    url = f"{base_url}/{path}"
    if query:
        url = f"{url}?{query}"
    headers = {"User-Agent": "AshenSite/1.0"}
    data = None
    if method == "POST":
        data = body or b""
        if content_type:
            headers["Content-Type"] = content_type
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            picked = {
                name: value
                for name, value in response.headers.items()
                if name.lower() in _PASS_THROUGH
            }
            return response.status, picked, response.read()
    except urllib.error.HTTPError as error:
        return error.code, {"content-type": "application/json"}, error.read()
    except (urllib.error.URLError, TimeoutError):
        return 502, {"content-type": "application/json"}, b'{"error":"upstream unreachable"}'


class SiteHandler(SimpleHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (http.server naming)
        return self._route(head_only=False)

    def do_HEAD(self):  # noqa: N802 (http.server naming)
        return self._route(head_only=True)

    def do_POST(self):  # noqa: N802 (http.server naming)
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path.lstrip("/")
        if path.startswith("api/"):
            length = int(self.headers.get("content-length") or 0)
            body = self.rfile.read(length) if length else b""
            result = _proxy(API_URL, path, parsed.query, body=body,
                            content_type=self.headers.get("content-type"), method="POST")
            return self._reply_proxy(result, head_only=False)
        self.send_error(405)

    def _route(self, head_only: bool):
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path.lstrip("/")
        if path == "site-config.js":
            return self._serve_no_store("site-config.js", head_only)
        if path.startswith("api/"):
            return self._reply_proxy(_proxy(API_URL, path, parsed.query), head_only)
        if path.startswith("map/"):
            return self._reply_proxy(_proxy(MAP_URL, path[len("map/"):], parsed.query), head_only)
        if path.endswith(".html"):
            # Canonical addresses are extensionless: the legacy form 301s.
            target = "/" + path[: -len(".html")]
            return self._redirect(target)
        if not path or path.endswith("/"):
            # Bare directories resolve to their index page directly (no
            # redirect), which keeps "/" canonical for the home page.
            candidates = [(path or "") + "index.html"]
        else:
            # A page first (/map -> map.html), then the raw path so plain
            # static assets (css/js/png) keep working unchanged.
            candidates = [path + ".html", path]
        for candidate in candidates:
            if _read_static(self, candidate) is not None:
                return self._serve_local(candidate, head_only)
        self.send_error(404)

    def _redirect(self, target):
        self.send_response(301)
        self.send_header("location", target)
        self.send_header("content-length", "0")
        self.end_headers()

    def _reply_proxy(self, result, head_only: bool):
        status, headers, body = result
        self.send_response(status)
        for name, value in headers.items():
            self.send_header(name, value)
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def _serve_no_store(self, filename, head_only: bool):
        body = _read_static(self, filename)
        if body is None:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("content-type", "text/javascript")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def _serve_local(self, filename, head_only: bool):
        """Serve a repo file after mapping the URL (guessed mime, 404 guard)."""
        body = _read_static(self, filename)
        if body is None:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("content-type", self.guess_type(filename))
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def log_message(self, fmt, *args):  # quiet container logs
        pass


def make_server(port: int) -> ThreadingHTTPServer:
    handler = functools.partial(SiteHandler, directory=os.path.dirname(os.path.abspath(__file__)))
    return ThreadingHTTPServer(("0.0.0.0", port), handler)


if __name__ == "__main__":
    print(f"[AshenSite] serving on :{PORT} (api={API_URL}, map={MAP_URL})")
    make_server(PORT).serve_forever()
