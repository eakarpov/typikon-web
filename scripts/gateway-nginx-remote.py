#!/usr/bin/env python3
"""Транзакция nginx: backup, замена только vhost/snippets, test/reload/smoke, возврат."""
import argparse
import datetime
import fcntl
import json
import os
import pathlib
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid


class DeploymentError(Exception):
    pass


class Commands:
    def run(self, command, log):
        with log.open("ab") as output:
            subprocess.run(command, stdout=output, stderr=subprocess.STDOUT, check=True)

    def capture(self, command):
        return subprocess.run(command, capture_output=True, text=True, check=True).stdout


def safe_path(value):
    if not re.fullmatch(r"/[A-Za-z0-9_./-]+", str(value)):
        raise DeploymentError(f"Нужен абсолютный путь без пробелов/спецсимволов: {value}")
    return pathlib.Path(value)


def uncomment(text):
    return re.sub(r"#.*", "", text)


def names(text):
    return {name.strip('\"\'') for match in re.finditer(r"\bserver_name\s+([^;]+);", uncomment(text))
            for name in match[1].split()}


def certificate(text, directive, override):
    choices = {match[1].strip().strip('\"\'') for match in re.finditer(r"\b" + directive + r"\s+([^;]+);", uncomment(text))}
    if not override and len(choices) != 1:
        raise DeploymentError(f"Не найден единственный {directive}; укажи соответствующий GATEWAY_CERTIFICATE[_KEY]")
    path = safe_path(override or choices.pop())
    if not path.is_file():
        raise DeploymentError(f"Не найден файл {directive}: {path}")
    return path


def write_atomic(path, content, metadata=None):
    handle, temporary = tempfile.mkstemp(prefix=".typikon-gateway-", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
            os.fchmod(output.fileno(), metadata.st_mode & 0o7777 if metadata else 0o644)
            if metadata:
                os.fchown(output.fileno(), metadata.st_uid, metadata.st_gid)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def deploy(args, commands=None, sleep=time.sleep):
    commands = commands or Commands()
    nginx_dir = safe_path(args.nginx_dir).resolve(strict=True)
    site = safe_path(args.site).resolve(strict=True)
    backup_root = safe_path(args.backup_root)
    acme = safe_path(args.acme_root)
    ca = safe_path(args.ca_file)
    source = safe_path(args.input).resolve(strict=True)
    if nginx_dir not in site.parents or not site.is_file():
        raise DeploymentError("vhost должен быть существующим файлом внутри nginx-dir")
    if backup_root.resolve() == nginx_dir or nginx_dir in backup_root.resolve().parents:
        raise DeploymentError("Backup должен лежать вне дерева nginx")
    if not acme.is_dir() or not ca.is_file():
        raise DeploymentError("Нет действующего ACME webroot или CA-файла")
    text = site.read_text()
    if names(text) != {"typikon.su", "www.typikon.su"}:
        raise DeploymentError("Файл должен содержать только vhost typikon.su и www.typikon.su; общие сайты не заменяются")
    cert = certificate(text, "ssl_certificate", args.certificate)
    key = certificate(text, "ssl_certificate_key", args.certificate_key)
    for tool in ["nginx", "systemctl", "ss", "curl"]:
        if not shutil.which(tool):
            raise DeploymentError(f"Не найдена команда {tool}")
    backup_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (backup_root / "deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeploymentError("Уже идёт выкладка nginx-шлюза") from None
        release = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
        backup = backup_root / release
        backup.mkdir(mode=0o700)
        print(f"Резервная копия и журналы: {backup}", flush=True)
        state = {"status": "preflight", "site": str(site), "backup": str(backup)}
        def save_state(status):
            state["status"] = status
            (backup / "state.json").write_text(json.dumps(state, indent=2) + "\n")
        save_state("preflight")
        log = backup / "commands.log"
        shutil.copy2(source / "scripts/check-legacy-gateway.py", backup / "check-legacy-gateway.py")
        checker = str(backup / "check-legacy-gateway.py")
        def checks(*options):
            commands.run([sys.executable, checker, "--old-ip", "127.0.0.1", *options], backup / "routes.log")
        # Не запускаем/не останавливаем никакие службы. Node на 80 — отказ до записи.
        commands.run(["systemctl", "is-active", "--quiet", "nginx"], log)
        listeners = commands.capture(["ss", "-H", "-ltnp"])
        for line in listeners.splitlines():
            fields = line.split()
            if len(fields) >= 4 and fields[3].rsplit(":", 1)[-1] in {"80", "443"} and "nginx" not in line:
                raise DeploymentError("Порт 80/443 занят не nginx. Старое приложение не трогаем; сначала согласуй порты")
        commands.run(["nginx", "-t"], log)
        commands.run(["nginx", "-T"], backup / "nginx.before.txt")
        dump = (backup / "nginx.before.txt").read_text()
        included = False
        for match in re.finditer(r"^# configuration file ([^\n]+):\n(.*?)(?=^# configuration file |\Z)", dump, re.M | re.S):
            path = pathlib.Path(match[1]).resolve()
            if path == site:
                included = True
            elif names(match[2]) & {"typikon.su", "www.typikon.su"}:
                raise DeploymentError("Другой активный файл также содержит .su; объедини vhost до автоматической выкладки")
        if not included:
            raise DeploymentError("Указанный vhost не найден в nginx -T")
        checks("--upstream-only")
        snapshot = backup / "routes.before.json"
        checks("--snapshot", str(snapshot))
        # Полная копия для оператора; автоматический возврат трогает только три файла.
        with tarfile.open(backup / "nginx.before.tar.gz", "w:gz") as archive:
            archive.add(nginx_dir, arcname="nginx")
        snippet_dir = nginx_dir / "snippets"
        snippet_existed = snippet_dir.exists()
        sources = {
            site: source / "nginx/typikon-legacy.conf",
            snippet_dir / "typikon-legacy-locations.conf": source / "nginx/typikon-legacy-locations.conf",
            snippet_dir / "typikon-legacy-proxy.conf": source / "nginx/typikon-legacy-proxy.conf",
        }
        rendered = {}
        for target, original in sources.items():
            body = original.read_text().replace("/etc/nginx", str(nginx_dir))
            body = body.replace("/etc/letsencrypt/live/typikon.su/fullchain.pem", str(cert))
            body = body.replace("/etc/letsencrypt/live/typikon.su/privkey.pem", str(key))
            body = body.replace("/var/www/letsencrypt", str(acme))
            body = body.replace("/etc/ssl/certs/ca-certificates.crt", str(ca))
            rendered[target] = body.encode()
        saved = {}
        originals = backup / "originals"
        originals.mkdir(mode=0o700)
        for index, target in enumerate(sources):
            copy = originals / str(index)
            if target.is_symlink():
                saved[target] = ("symlink", os.readlink(target), target.lstat())
                copy.symlink_to(os.readlink(target))
            elif target.exists():
                if not target.is_file():
                    raise DeploymentError(f"Путь конфигурации не является файлом: {target}")
                saved[target] = ("file", target.read_bytes(), target.stat())
                shutil.copy2(target, copy)
            else:
                saved[target] = ("absent", None, None)
        state["files"] = {str(path): kind for path, (kind, _, _) in saved.items()}
        changed = False
        reloaded = False
        try:
            changed = True
            save_state("installing")
            snippet_dir.mkdir(exist_ok=True)
            for path, body in rendered.items():
                metadata = saved[path][2] if saved[path][0] == "file" else None
                write_atomic(path, body, metadata)
            # Проверяем действующее дерево на диске до изменения работающего master.
            commands.run(["nginx", "-t"], backup / "nginx.candidate.txt")
            if "conflicting server name" in (backup / "nginx.candidate.txt").read_text():
                raise DeploymentError("Обнаружен конфликт server_name")
            reloaded = True
            commands.run(["systemctl", "reload", "nginx"], log)
            save_state("checking")
            for attempt in range(3):
                try:
                    checks()
                    break
                except subprocess.CalledProcessError:
                    if attempt == 2:
                        raise
                    sleep(1)
            commands.run(["systemctl", "is-active", "--quiet", "nginx"], log)
            save_state("active")
        except BaseException as error:
            if changed:
                try:
                    for path, (kind, value, metadata) in saved.items():
                        if kind == "file":
                            write_atomic(path, value, metadata)
                        elif kind == "symlink":
                            temporary = path.parent / (".typikon-restore-" + uuid.uuid4().hex)
                            temporary.symlink_to(value)
                            os.replace(temporary, path)
                            os.lchown(path, metadata.st_uid, metadata.st_gid)
                        else:
                            path.unlink(missing_ok=True)
                    if not snippet_existed:
                        snippet_dir.rmdir()
                    commands.run(["nginx", "-t"], backup / "nginx.restored.txt")
                    if reloaded:
                        commands.run(["systemctl", "reload", "nginx"], log)
                        for attempt in range(3):
                            try:
                                checks("--compare-snapshot", str(snapshot))
                                break
                            except subprocess.CalledProcessError:
                                if attempt == 2:
                                    raise
                                sleep(1)
                    save_state("rolled-back")
                    print("Прежняя конфигурация nginx восстановлена; приложение не останавливалось", file=sys.stderr)
                except BaseException as restore_error:
                    save_state("rollback-failed")
                    raise DeploymentError(f"ОТКАТ НЕ ЗАВЕРШЁН; проверь nginx и резервную копию {backup}") from restore_error
            raise DeploymentError(f"Шлюз не выложен; подробности в {backup}") from error
        print("nginx-шлюз выложен и проверен. Старые приложение, движок и кроны сохранены.", flush=True)
        return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["input", "site", "acme-root"]:
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--nginx-dir", default="/etc/nginx")
    parser.add_argument("--backup-root", default="/var/backups/typikon-legacy-gateway")
    parser.add_argument("--certificate", default="")
    parser.add_argument("--certificate-key", default="")
    parser.add_argument("--ca-file", default="/etc/ssl/certs/ca-certificates.crt")
    args = parser.parse_args()
    os.umask(0o077)
    def interrupted(signum, _frame):
        raise DeploymentError(f"Выкладка прервана сигналом {signum}")
    for name in [signal.SIGHUP, signal.SIGTERM, signal.SIGINT]:
        signal.signal(name, interrupted)
    try:
        deploy(args)
    except (DeploymentError, OSError, subprocess.CalledProcessError) as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
