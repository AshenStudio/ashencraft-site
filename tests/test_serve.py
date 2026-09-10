import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

import serve


class UpstreamHandler(BaseHTTPRequestHandler):
    """Echoes the request path as JSON so tests can assert forwarding."""

    seen_post = {}

    def _reply(self, body: bytes):
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._reply(json.dumps({
            "path": self.path,
            "auth": self.headers.get("Authorization"),
        }).encode())

    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        UpstreamHandler.seen_post = {
            "path": self.path,
            "body": self.rfile.read(length).decode(),
            "content_type": self.headers.get("content-type"),
            "auth": self.headers.get("Authorization"),
        }
        self._reply(json.dumps({"echo": UpstreamHandler.seen_post["body"]}).encode())

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


def get(url, headers=None, method=None, data=None):
    import urllib.request

    req = urllib.request.Request(url, headers=headers or {}, method=method, data=data)
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, dict(resp.headers), resp.read()


def remove_when_free(path):
    """Windows: the server thread can hold a file handle past the response;
    retry the unlink instead of flaking (CI on ubuntu never hits this)."""
    import os
    import time

    for _ in range(50):
        try:
            os.remove(path)
            return
        except PermissionError:
            time.sleep(0.02)
    os.remove(path)


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
        remove_when_free("probe.css")


def test_missing_static_asset_404s(site):
    import urllib.error

    with pytest.raises(urllib.error.HTTPError) as exc:
        get(site + "/does-not-exist.css")
    assert exc.value.code == 404


def test_api_route_forwards_with_prefix(site):
    status, _, body = get(site + "/api/launcher/version")
    assert status == 200
    assert json.loads(body) == {"path": "/api/launcher/version", "auth": None}


def test_api_route_forwards_authorization_header(site):
    # Signed-in calls (/api/identities, /api/craft/characters) ride the
    # proxy with the browser's bearer token - the proxy must not drop it
    # (dropping it 401s the account page back into the sign-in form).
    status, _, body = get(site + "/api/identities", headers={"Authorization": "Bearer tok-abc"})
    assert status == 200
    assert json.loads(body) == {"path": "/api/identities", "auth": "Bearer tok-abc"}


def test_map_route_forwards_without_prefix(site):
    status, _, body = get(site + "/map/up/world/world/0")
    assert status == 200
    assert json.loads(body)["path"] == "/up/world/world/0"


def test_query_string_is_preserved(site):
    status, _, body = get(site + "/map/up/world/world/0?x=1")
    assert status == 200
    assert json.loads(body)["path"] == "/up/world/world/0?x=1"


def test_site_config_is_not_cached(site):
    # Probe the repo's real site-config.js and restore it - never delete it
    # (it is a committed local-dev default).
    original = open("site-config.js", "rb").read()
    try:
        open("site-config.js", "w").write("window.ASHEN_SITE = {};")
        status, headers, _ = get(site + "/site-config.js")
        assert status == 200
        assert headers.get("cache-control") == "no-store"
    finally:
        open("site-config.js", "wb").write(original)


def test_upstream_down_returns_502(site):
    serve.MAP_URL = "http://127.0.0.1:1"  # nothing listens here
    import urllib.error

    with pytest.raises(urllib.error.HTTPError) as exc:
        get(site + "/map/up/world/world/0")
    assert exc.value.code == 502


def test_extensionless_page_is_served(site):
    status, headers, body = get(site + "/map")
    assert status == 200
    assert b"<title>Live Map" in body
    assert headers.get("content-type", "").startswith("text/html")


def test_extensionless_subpage_is_served(site):
    status, _, body = get(site + "/community/bedrock")
    assert status == 200
    assert b"<title>Bedrock" in body


def test_account_page_is_served_extensionless(site):
    status, _, body = get(site + "/account")
    assert status == 200
    assert b"login-form" in body
    assert b"register-form" in body


def test_dotted_path_redirects_to_extensionless(site):
    import urllib.error

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    try:
        opener.open(site + "/map.html", timeout=5)
        raise AssertionError("expected a redirect")
    except urllib.error.HTTPError as exc:
        assert exc.code == 301
        assert exc.headers.get("location") == "/map"


def test_head_works_for_pages_and_proxy(site):
    # Uptime robots / link checkers HEAD the page URLs; the proxy must not
    # choke on a bodyless reply either.
    status, headers, body = get(site + "/map", method="HEAD")
    assert status == 200
    assert body == b""
    assert int(headers.get("content-length")) > 0
    status, _, body = get(site + "/map/up/world/world/0", method="HEAD")
    assert status == 200
    assert body == b""


def test_unknown_page_falls_through_to_404(site):
    import urllib.error

    with pytest.raises(urllib.error.HTTPError) as exc:
        get(site + "/no-such-page")
    assert exc.value.code == 404


def test_post_forwards_body_to_api(site):
    # The account page signs in/registers via POST /api/auth/*: the proxy
    # must carry the JSON body through to the API unchanged.
    status, _, body = get(
        site + "/api/auth/login",
        method="POST",
        data=b'{"username":"u","password":"p"}',
        headers={"Content-Type": "application/json"},
    )
    assert status == 200
    assert json.loads(body) == {"echo": '{"username":"u","password":"p"}'}
    assert UpstreamHandler.seen_post["path"] == "/api/auth/login"
    assert UpstreamHandler.seen_post["content_type"] == "application/json"


def test_post_forwards_authorization_header(site):
    status, _, _ = get(
        site + "/api/auth/logout",
        method="POST",
        data=b'{}',
        headers={"Content-Type": "application/json", "Authorization": "Bearer tok-xyz"},
    )
    assert status == 200
    assert UpstreamHandler.seen_post["auth"] == "Bearer tok-xyz"


def test_post_outside_api_is_rejected(site):
    import urllib.error

    with pytest.raises(urllib.error.HTTPError) as exc:
        get(site + "/account", method="POST", data=b"x=1")
    assert exc.value.code == 405
