import os
import shutil
import subprocess

REPO = os.path.join(os.path.dirname(__file__), "..")


def find_bash():
    """Git Bash's POSIX PATH entries break Windows CreateProcess, so resolve
    bash explicitly instead of relying on the inherited PATH."""
    found = shutil.which("bash")
    if found:
        return found
    for candidate in [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        "/usr/bin/bash",
    ]:
        if os.path.exists(candidate):
            return candidate
    raise RuntimeError("bash not found - Git Bash is required to run start.sh tests")


def run_start_sh(env_overrides, tmp_path):
    env = os.environ.copy()
    env.update(env_overrides)
    env["SITE_TMP"] = str(tmp_path)
    proc = subprocess.run(
        [find_bash(), "start.sh", "--write-config-only"],
        cwd=REPO,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return proc


def test_start_sh_generates_config_from_env(tmp_path):
    proc = run_start_sh(
        {
            "MAP_URL": "https://map.example.net",
            "API_URL": "https://api.example.net",
            "DISCORD_INVITE": "https://discord.gg/abc",
        },
        tmp_path,
    )
    assert proc.returncode == 0, proc.stderr
    config = (tmp_path / "site-config.js").read_text()
    assert "map.example.net" in config
    assert "api.example.net" in config
    assert "discord.gg/abc" in config


def test_start_sh_defaults_when_env_empty(tmp_path):
    proc = run_start_sh({}, tmp_path)
    assert proc.returncode == 0, proc.stderr
    config = (tmp_path / "site-config.js").read_text()
    assert "eu.ashencraft.overdev.net" in config
    assert "ashenapi.overdev.net" in config
    assert "discord.gg/Y6nk7vnMzY" in config