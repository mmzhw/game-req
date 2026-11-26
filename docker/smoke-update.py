import argparse
import http.cookiejar
import io
import json
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.request
import zipfile


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def smoke(image, packages):
    name = "game-req-smoke-" + secrets.token_hex(5)
    subprocess.run(
        ["docker", "run", "-d", "--rm", "--name", name, "-p", "127.0.0.1::3000", image],
        stdout=subprocess.DEVNULL,
        check=True,
    )
    try:
        base = "http://" + docker("port", name, "3000/tcp")
        session = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

        def request(route, data=None, authorized=False, content_type=None):
            headers = {"X-Game-Req": "1"} if data is not None else {}
            if content_type:
                headers["Content-Type"] = content_type
            opener = session.open if authorized else urllib.request.urlopen
            with opener(urllib.request.Request(base + route, data=data, headers=headers), timeout=15) as response:
                return json.load(response)

        def wait_for(route, predicate, timeout=35, authorized=False):
            deadline = time.monotonic() + timeout
            previous = None
            while time.monotonic() < deadline:
                try:
                    result = request(route, authorized=authorized)
                    if result.get("phase") and result["phase"] != previous:
                        previous = result["phase"]
                        print("Update:", previous, result["message"], flush=True)
                    if predicate(result):
                        return result
                except (OSError, ValueError):
                    pass
                time.sleep(0.75)
            raise AssertionError("Timed out: " + route)

        def upload(route, archive, authorized=True):
            boundary = "smoketest-" + secrets.token_hex(10)
            prefix = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.zip"\r\nContent-Type: application/zip\r\n\r\n'
            body = prefix.encode() + archive + f"\r\n--{boundary}--\r\n".encode()
            try:
                return request(route, body, authorized, "multipart/form-data; boundary=" + boundary)
            except urllib.error.HTTPError as error:
                raise ValueError(error.code, error.read().decode()) from None

        def status(job):
            return wait_for(
                "/api/update/jobs/" + job["id"],
                lambda body: body["phase"] in {"success", "failed", "rollback_failed"},
                timeout=330,
                authorized=True,
            )

        wait_for("/api/update/health", lambda body: body.get("id"))
        assert request("/api/auth/status")["setupRequired"]
        credentials = {"username": "smoke", "password": secrets.token_hex(16)}
        assert request("/api/auth/setup", json.dumps(credentials).encode(), True, "application/json")["username"] == "smoke"
        assert request("/api/update/status", authorized=True)["enabled"]
        assert request("/api/checkin", authorized=True)["config"]["enabled"] is False
        docker("exec", name, "sh", "-c", "test ! -e /opt/server/dist/111.119.248.34.key && test ! -e /opt/server/data/checkin/config.json && test ! -e /opt/server/dist/server.js")
        pid = docker("exec", name, "pm2", "pid", "server")
        frontend = (packages / "dist.zip").read_bytes()
        release = (packages / "release.zip").read_bytes()
        for package, authorized, code in [(frontend, False, 401), (release, True, 400)]:
            try:
                upload("/upload", package, authorized)
            except ValueError as error:
                assert error.args[0] == code, error.args
            else:
                raise AssertionError("Invalid request was accepted")

        result = status(upload("/upload", frontend))
        assert result["phase"] == "success", result
        assert docker("exec", name, "pm2", "pid", "server") == pid
        print("PASS: Auth, package type validation, and front-end update without restart", flush=True)

        accepted = upload("/uploadServer", release)
        result = status(accepted)
        assert result["phase"] == "success", result
        assert request("/api/update/health")["id"] == accepted["id"]
        assert docker("exec", name, "pm2", "pid", "server") != pid
        assert request("/api/auth/status", authorized=True) == {"setupRequired": False, "username": "smoke"}
        assert request("/api/checkin", authorized=True)["config"]["enabled"] is False
        print("PASS: Server bundle installs dependencies and proves the restarted build is healthy", flush=True)

        bad = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(release)) as old, zipfile.ZipFile(bad, "w") as broken:
            for entry in old.infolist():
                body = b'throw new Error("intentional smoke-test startup failure");\n' if entry.filename == "runtime/server.js" else old.read(entry)
                broken.writestr(entry, body)
        result = status(upload("/uploadServer", bad.getvalue()))
        assert result["phase"] == "failed", result
        assert request("/api/update/health")["id"] == accepted["id"]
        assert request("/api/checkin", authorized=True)["config"]["enabled"] is False
        print("PASS: Failed startup restores the previous release; check-in was never enabled", flush=True)
    except BaseException:
        subprocess.run(["docker", "logs", "--tail", "50", name], check=False)
        raise
    finally:
        subprocess.run(["docker", "stop", "-t", "3", name], stdout=subprocess.DEVNULL, check=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify both page update paths using a disposable Docker container.")
    parser.add_argument("image")
    parser.add_argument("--packages", type=Path, default=Path("server"))
    options = parser.parse_args()
    smoke(options.image, options.packages)
