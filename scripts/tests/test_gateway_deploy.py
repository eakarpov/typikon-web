import argparse
import contextlib
import fcntl
import importlib.util
import io
import json
import pathlib
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("gateway_deploy", ROOT / "scripts/gateway-nginx-remote.py")
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class FakeCommands:
    def __init__(self, fixture, fail=""):
        self.fixture = fixture
        self.fail = fail
        self.calls = []
        self.reloads = 0

    def run(self, command, log):
        self.calls.append(command)
        log.touch(exist_ok=True)
        candidate = "map $uri" in self.fixture.site.read_text()
        if command == ["nginx", "-T"]:
            log.write_text(
                f"# configuration file {self.fixture.nginx / 'nginx.conf'}:\n"
                "events {}\nhttp { include sites-enabled/*; }\n"
                f"# configuration file {self.fixture.site}:\n{self.fixture.site.read_text()}\n"
                f"# configuration file {self.fixture.nginx / 'other-site.conf'}:\n"
                "server { listen 80; server_name unrelated.example; }\n"
                + (f"# configuration file {self.fixture.nginx / 'duplicate.conf'}:\n"
                   "server { server_name typikon.su; }\n" if self.fail == "duplicate" else "")
            )
        if command == ["nginx", "-t"] and candidate and self.fail == "syntax":
            raise subprocess.CalledProcessError(1, command)
        if command == ["systemctl", "reload", "nginx"]:
            self.reloads += 1
            if self.reloads == 1 and self.fail == "reload":
                raise subprocess.CalledProcessError(1, command)
        if "check-legacy-gateway.py" in str(command[1:2]):
            if "--snapshot" in command:
                pathlib.Path(command[command.index("--snapshot") + 1]).write_text('[{"old":true}]')
            elif "--compare-snapshot" in command:
                if self.fail == "restore-check":
                    raise subprocess.CalledProcessError(1, command)
                assert self.fixture.site.read_text() == self.fixture.original
            elif "--upstream-only" not in command and self.fail in {"routes", "restore-check"}:
                raise subprocess.CalledProcessError(1, command)

    def capture(self, command):
        self.calls.append(command)
        if self.fail == "port":
            return 'LISTEN 0 511 *:80 *:* users:(("node",pid=1,fd=2))\n'
        return 'LISTEN 0 511 *:80 *:* users:(("nginx",pid=2,fd=2))\n'


class GatewayDeployment(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="typikon-gateway-deploy-")
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name).resolve()
        self.nginx = self.root / "nginx"
        (self.nginx / "sites-available").mkdir(parents=True)
        (self.nginx / "sites-enabled").mkdir()
        (self.nginx / "snippets").mkdir()
        self.site = self.nginx / "sites-available/typikon"
        self.enabled = self.nginx / "sites-enabled/typikon"
        self.enabled.symlink_to(self.site)
        self.cert, self.key, self.ca = [self.root / name for name in ["cert.pem", "key.pem", "ca.pem"]]
        for path in [self.cert, self.key, self.ca]:
            path.write_text("fixture")
        self.acme = self.root / "acme"
        self.acme.mkdir()
        self.original = ('server { listen 443 ssl; server_name typikon.su www.typikon.su;\n'
                         f'ssl_certificate {self.cert}; ssl_certificate_key {self.key};\n'
                         'location / { proxy_pass http://127.0.0.1:3000; } }\n')
        self.site.write_text(self.original)
        self.site.chmod(0o640)
        (self.nginx / "other-site.conf").write_text("untouched")
        (self.nginx / "snippets/typikon-legacy-proxy.conf").write_text("previous proxy")
        # Старая ссылка snippet должна быть восстановлена как ссылка, а не её содержимое.
        self.shared = self.nginx / "shared-locations.conf"
        self.shared.write_text("shared old")
        (self.nginx / "snippets/typikon-legacy-locations.conf").symlink_to(self.shared)
        self.args = argparse.Namespace(input=str(ROOT), site=str(self.enabled), nginx_dir=str(self.nginx),
            acme_root=str(self.acme), backup_root=str(self.root / "backups"),
            certificate="", certificate_key="", ca_file=str(self.ca))
        self.tools = mock.patch.object(worker.shutil, "which", side_effect=lambda tool: "/fake/" + tool)
        self.tools.start()
        self.addCleanup(self.tools.stop)

    def invoke(self, failure=""):
        commands = FakeCommands(self, failure)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            result = worker.deploy(self.args, commands, sleep=lambda _: None)
        return result, commands

    def assert_old(self):
        self.assertEqual(self.site.read_text(), self.original)
        self.assertEqual(self.site.stat().st_mode & 0o777, 0o640)
        self.assertTrue(self.enabled.is_symlink())
        self.assertEqual(self.enabled.resolve(), self.site)
        self.assertEqual((self.nginx / "other-site.conf").read_text(), "untouched")
        self.assertEqual((self.nginx / "snippets/typikon-legacy-proxy.conf").read_text(), "previous proxy")
        self.assertTrue((self.nginx / "snippets/typikon-legacy-locations.conf").is_symlink())
        self.assertEqual(self.shared.read_text(), "shared old")

    def state(self):
        return json.loads(next((self.root / "backups").glob("*/state.json")).read_text())

    def test_success_backup_reload_routes_without_application_commands(self):
        backup, commands = self.invoke()
        self.assertTrue((backup / "nginx.before.tar.gz").is_file())
        self.assertTrue((backup / "nginx.before.txt").is_file())
        self.assertEqual(backup.stat().st_mode & 0o777, 0o700)
        self.assertIn("map $uri", self.site.read_text())
        self.assertIn(str(self.cert), self.site.read_text())
        self.assertIn(str(self.acme), (self.nginx / "snippets/typikon-legacy-locations.conf").read_text())
        self.assertEqual(self.state()["status"], "active")
        self.assertEqual(commands.reloads, 1)
        self.assertTrue(any("--snapshot" in call for call in commands.calls))
        self.assertTrue(any("check-legacy-gateway.py" in str(call) and "--upstream-only" not in call
                            and "--snapshot" not in call for call in commands.calls))
        for call in commands.calls:
            if call[0] == "systemctl":
                self.assertIn(call, [["systemctl", "is-active", "--quiet", "nginx"], ["systemctl", "reload", "nginx"]])
        self.assertEqual((self.nginx / "other-site.conf").read_text(), "untouched")
        self.assertTrue(self.enabled.is_symlink())

    def test_syntax_error_restores_files_without_reload(self):
        commands = FakeCommands(self, "syntax")
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(worker.DeploymentError):
                worker.deploy(self.args, commands, sleep=lambda _: None)
        self.assert_old()
        self.assertEqual(commands.reloads, 0)
        self.assertEqual(self.state()["status"], "rolled-back")

    def test_failed_routes_restore_and_verify_previous_routes(self):
        commands = FakeCommands(self, "routes")
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(worker.DeploymentError):
                worker.deploy(self.args, commands, sleep=lambda _: None)
        self.assert_old()
        self.assertEqual(commands.reloads, 2)
        self.assertTrue(any("--compare-snapshot" in call for call in commands.calls))
        self.assertEqual(self.state()["status"], "rolled-back")

    def test_reload_failure_also_rolls_back(self):
        commands = FakeCommands(self, "reload")
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(worker.DeploymentError):
                worker.deploy(self.args, commands, sleep=lambda _: None)
        self.assert_old()
        self.assertEqual(commands.reloads, 2)
        self.assertEqual(self.state()["status"], "rolled-back")

    def test_partial_file_install_rolls_back(self):
        original_write = worker.write_atomic
        calls = 0
        def write(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("simulated disk error")
            return original_write(*args, **kwargs)
        with mock.patch.object(worker, "write_atomic", side_effect=write):
            with self.assertRaises(worker.DeploymentError):
                self.invoke()
        self.assert_old()
        self.assertEqual(self.state()["status"], "rolled-back")

    def test_rollback_check_failure_is_reported(self):
        with self.assertRaisesRegex(worker.DeploymentError, "ОТКАТ НЕ ЗАВЕРШЁН"):
            self.invoke("restore-check")
        self.assert_old()
        self.assertEqual(self.state()["status"], "rollback-failed")

    def test_node_on_port_80_is_not_stopped(self):
        commands = FakeCommands(self, "port")
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaisesRegex(worker.DeploymentError, "Старое приложение не трогаем"):
                worker.deploy(self.args, commands)
        self.assert_old()
        self.assertFalse(any(call[:2] == ["systemctl", "reload"] for call in commands.calls))

    def test_other_domains_in_site_are_rejected(self):
        self.site.write_text(self.original.replace("www.typikon.su;", "www.typikon.su other.example;"))
        with self.assertRaisesRegex(worker.DeploymentError, "общие сайты не заменяются"):
            self.invoke()
        self.assertIn("other.example", self.site.read_text())

    def test_duplicate_domain_in_another_active_file_is_rejected(self):
        with self.assertRaisesRegex(worker.DeploymentError, "Другой активный файл"):
            self.invoke("duplicate")
        self.assert_old()
        self.assertEqual(self.state()["status"], "preflight")

    def test_concurrent_deployment_is_rejected(self):
        directory = pathlib.Path(self.args.backup_root)
        directory.mkdir()
        with (directory / "deploy.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(worker.DeploymentError, "Уже идёт"):
                self.invoke()
        self.assert_old()


if __name__ == "__main__":
    unittest.main()
