#!/usr/bin/env python3
"""Проверки шлюза без смены DNS, без -L, без ключей и изменяющих данные запросов."""
import argparse
import ipaddress
import json
import pathlib
import subprocess
import sys
import tempfile


def request(host, scheme, old_ip, path, method="GET", extra_headers=()):
    port = 443 if scheme == "https" else 80
    with tempfile.TemporaryDirectory(prefix="typikon-gateway-check-") as directory:
        headers_path = pathlib.Path(directory) / "headers"
        body_path = pathlib.Path(directory) / "body"
        command = ["curl", "--disable", "--silent", "--show-error", "--noproxy", "*", "--max-time", "30",
                   "--user-agent", "typikon-gateway-check/1.0", "--request", method,
                   "--dump-header", str(headers_path), "--output", str(body_path),
                   "--write-out", "%{http_code}"]
        if old_ip:
            address = f"[{old_ip}]" if ":" in old_ip else old_ip
            command += ["--resolve", f"{host}:{port}:{address}"]
        for header in extra_headers:
            command += ["--header", header]
        if method == "POST":
            # GET-only API: ожидается 405. Этот POST не меняет данные.
            command += ["--header", "Content-Type: application/json", "--data-binary", '{"gateway_probe":true}']
        command += [f"{scheme}://{host}{path}"]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode:
            raise RuntimeError(f"curl: {result.stderr.strip()}")
        headers = {}
        for line in headers_path.read_text().splitlines():
            if line.startswith("HTTP/"):
                headers = {}
            elif ":" in line:
                name, value = line.split(":", 1)
                headers.setdefault(name.lower(), []).append(value.strip())
        return int(result.stdout), headers, body_path.read_bytes()


def check(host, scheme, old_ip, path, expected, kind, method="GET", extra_headers=(), expected_build=None):
    status, headers, raw = request(host, scheme, old_ip, path, method, extra_headers)
    assert status == expected, f"ожидался {expected}, получен {status}"
    assert headers.get("x-typikon-gateway") == ["legacy-nginx"], "не найден маркер нового шлюза"
    if kind == "redirect":
        assert headers.get("location") == ["https://www.typikon.info" + path], "потеряны путь или query"
    else:
        assert "location" not in headers, "исключение получило редирект"
    if kind == "health":
        body = json.loads(raw)
        assert body.get("status") == "ready" and body.get("buildId") == expected_build, "отвечает другая или неготовая сборка"
    elif kind == "json":
        assert isinstance(json.loads(raw), dict), "API не вернул JSON-объект"
    elif kind == "assetlinks":
        links = json.loads(raw)
        assert any(item.get("target", {}).get("namespace") == "android_app"
                   and item["target"].get("package_name") == "su.typikon.typikon" for item in links), "неверный assetlinks"
    elif kind == "calendar":
        assert b"BEGIN:VCALENDAR" in raw and b"END:VCALENDAR" in raw, "получена не лента календаря"
    elif kind == "embed":
        assert "text/html" in headers.get("content-type", [""])[0], "виджет не HTML"
        assert not headers.get("x-frame-options"), "X-Frame-Options запрещает внешнюю рамку"
        assert any("frame-ancestors *" in value for value in headers.get("content-security-policy", [])), "не разрешено встраивание"
        assert not any("frame-ancestors 'self'" in value or "frame-ancestors 'none'" in value
                       for value in headers.get("content-security-policy", [])), "конфликтующая CSP запрещает рамку"
    elif kind == "rss":
        assert b"<rss" in raw or b"<feed" in raw, "получена не RSS/Atom-лента"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--old-ip", type=ipaddress.ip_address, help="проверить указанную старую машину через curl --resolve")
    parser.add_argument("--host", choices=["typikon.su", "www.typikon.su"], action="append", help="по умолчанию оба имени")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--upstream-only", action="store_true", help="только готовность новой машины")
    mode.add_argument("--snapshot", type=pathlib.Path, help="сохранить ответы старого nginx перед выкладкой")
    mode.add_argument("--compare-snapshot", type=pathlib.Path, help="проверить возврат прежних маршрутов")
    args = parser.parse_args()
    if args.snapshot or args.compare_snapshot:
        try:
            before = json.loads(args.compare_snapshot.read_text()) if args.compare_snapshot else None
            routes = []
            for host in args.host or ["typikon.su", "www.typikon.su"]:
                for scheme in ["http", "https"]:
                    for path in ["/reading/gateway-probe?gateway=rollback", "/api/v1/app/version"]:
                        status, headers, _ = request(host, scheme, str(args.old_ip) if args.old_ip else None, path)
                        routes.append({"host": host, "scheme": scheme, "path": path, "status": status,
                                       "location": headers.get("location", []), "gateway": headers.get("x-typikon-gateway", [])})
            if before is not None:
                assert routes == before, "прежние маршруты после отката не восстановились"
                print("Прежние маршруты восстановлены")
            else:
                args.snapshot.write_text(json.dumps(routes, indent=2) + "\n")
                print("Прежние маршруты сохранены")
            return 0
        except (AssertionError, RuntimeError, ValueError, OSError) as error:
            print(f"FAIL проверка прежних маршрутов: {error}", file=sys.stderr)
            return 1
    try:
        status, _, body = request("www.typikon.info", "https", None, "/api/health")
        direct = json.loads(body)
        assert status == 200 and direct.get("status") == "ready" and direct.get("buildId"), "новый сервер не готов"
    except (AssertionError, RuntimeError, ValueError, OSError) as error:
        print(f"FAIL новый сервер: {error}", file=sys.stderr)
        return 1
    if args.upstream_only:
        print("Новый сервер готов: " + direct["buildId"])
        return 0
    cases = [
        ("/api/health", 200, "health", "GET"),
        ("/reading/gateway-probe?lang=cu&source=a%2Fb", 301, "redirect", "GET"),
        ("/api/v1/app/version?gateway=1", 200, "json", "GET"),
        ("/api/v2/app/version?gateway=1", 200, "json", "GET"),
        ("/api/v2/app/version?gateway=post", 405, "status", "POST"),
        ("/api/v2/app/version", 204, "status", "OPTIONS"),
        ("/api/user-notes", 401, "status", "GET"),
        ("/.well-known/assetlinks.json", 200, "assetlinks", "GET"),
        ("/calendar.ics?gateway=1", 200, "calendar", "GET"),
        ("/embed/day?lang=cu", 200, "embed", "GET"),
        ("/rss.xml", 200, "rss", "GET"),
        ("/dump/latest/manifest.json", 200, "json", "GET"),
    ]
    for host in args.host or ["typikon.su", "www.typikon.su"]:
        for scheme in ["http", "https"]:
            for path, expected, kind, method in cases:
                try:
                    check(host, scheme, str(args.old_ip) if args.old_ip else None, path, expected, kind, method, expected_build=direct["buildId"])
                except (AssertionError, RuntimeError, ValueError, OSError) as error:
                    print(f"FAIL {method} {scheme}://{host}{path}: {error}", file=sys.stderr)
                    return 1
                print(f"OK {method} {scheme}://{host}{path}")
    print("Шлюз прошёл общие проверки. Личные токены, приходские ленты, IP и загрузки проверь по инструкции.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
