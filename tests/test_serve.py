import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

import serve


class UpstreamHandler(BaseHTTPRequestHandler):
    """Echoes the request path as JSON so tests can assert forwarding."""

    def do_GET(self):
        body = json.dumps({"path": self.path}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


@pytest.fixture
def upstream():
    server = HTTPServer(("127.0.0.1", 0), UpstreamHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


@pytest.fixture
def site(upstream):
    server = serve.make_server(0)
    port = server.server_address[1]
    serve.API_URL = upstream
    serve.MAP_URL = upstream
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


def get(url, headers=None):
    import urllib.request

    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, dict(resp.headers), resp.read()


def test_home_page_is_served(site):
    status, _, body = get(site + "/")
    assert status == 200
    assert b"<title>AshenCraft" in body


def test_static_asset_is_served(site):
    import os

    open("probe.css", "w").write("/* probe */")
    try:
        status, _, body = get(site + "/probe.css")
        assert status == 200
        assert b"probe" in body
    finally:
        os.remove("probe.css")


def test_missing_static_asset_404s(site):
    import urllib.error

    with pytest.raises(urllib.error.HTTPError) as exc:
        get(site + "/does-not-exist.css")
    assert exc.value.code == 404


def test_api_route_forwards_with_prefix(site):
    status, _, body = get(site + "/api/launcher/version")
    assert status == 200
    assert json.loads(body) == {"path": "/api/launcher/version"}


def test_map_route_forwards_without_prefix(site):
    status, _, body = get(site + "/map/up/world/world/0")
    assert status == 200
    assert json.loads(body) == {"path": "/up/world/world/0"}


def test_query_string_is_preserved(site):
    status, _, body = get(site + "/map/up/world/world/0?x=1")
    assert status == 200
    assert json.loads(body) == {"path": "/up/world/world/0?x=1"}


def test_site_config_is_not_cached(site):
    import os

    open("site-config.js", "w").write("window.ASHEN_SITE = {};")
    try:
        status, headers, _ = get(site + "/site-config.js")
        assert status == 200
        assert headers.get("cache-control") == "no-store"
    finally:
        os.remove("site-config.js")


def test_upstream_down_returns_502(site):
    serve.MAP_URL = "http://127.0.0.1:1"  # nothing listens here
    import urllib.error

    with pytest.raises(urllib.error.HTTPError) as exc:
        get(site + "/map/up/world/world/0")
    assert exc.value.code == 502