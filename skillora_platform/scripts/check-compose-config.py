"""Render the real Compose layers with fake secrets; optionally validate Nginx in an isolated container."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = {
    "SKILLORA_CONTAINER_PREFIX": "skillora-config-check",
    "JWT_SECRET": "test-only-compose-secret-at-least-32-bytes",
    "FRONTEND_URL": "https://skillora.invalid",
    "PASSWORD_RESET_URL": "https://skillora.invalid/reset-password?token={token}",
    "PUBLIC_API_BASE_URL": "https://skillora.invalid",
    "PAYMENT_RESULT_URL": "https://skillora.invalid/payment/result",
    "DB_PASSWORD": "test-only-db", "STAGING_DB_HOST": "db.invalid",
    "STAGING_DB_NAME": "Skillora", "STAGING_DB_USERNAME": "test", "STAGING_DB_PASSWORD": "test-only-db",
    "MAIL_HOST": "mail.invalid", "MAIL_USERNAME": "test", "MAIL_PASSWORD": "test-only-mail",
    "PAYMENT_ENABLED": "false", "MOMO_ENDPOINT": "https://momo.invalid/create", "VNPAY_URL": "https://vnpay.invalid/pay",
    "MOMO_PARTNER_CODE": "test-partner", "MOMO_ACCESS_KEY": "test-access", "MOMO_SECRET_KEY": "test-only-momo",
    "VNPAY_TMN_CODE": "test-terminal", "VNPAY_HASH_SECRET": "test-only-vnpay",
    "VNPAY_IPN_ALLOWED_IPS": "192.0.2.1", "MOMO_IPN_ALLOWED_IPS": "192.0.2.2",
    "GEMINI_API_KEY": "", "BUNNY_LIBRARY_ID": "test-library", "BUNNY_API_KEY": "test-only-bunny",
    "BUNNY_WEBHOOK_SIGNING_SECRET": "test-only-webhook", "BUNNY_TOKEN_SECURITY_KEY": "test-only-playback",
    "BUNNY_PULL_ZONE_HOST": "video.invalid", "GOOGLE_CLIENT_ID": "test-google", "GOOGLE_CLIENT_SECRET": "test-only-google",
}


def render(*layers):
    args = ["docker", "compose", "--env-file", str(ROOT / ".env.example"), "--project-name", "skillora-config-check"]
    for layer in ("docker-compose.yml", *layers):
        args.extend(["-f", str(ROOT / layer)])
    result = subprocess.run(args + ["config", "--format", "json"], cwd=ROOT,
                            env={**os.environ, **FIXTURE}, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


for layer in ("docker-compose.local.yml", "docker-compose.staging.yml", "docker-compose.prod.yml"):
    config = render(layer)
    app = config["services"]["app"]
    for key in ("PAYMENT_ENABLED", "MOMO_ENDPOINT", "VNPAY_URL", "BUNNY_WEBHOOK_SIGNING_SECRET",
                "BUNNY_TOKEN_SECURITY_KEY", "BUNNY_PULL_ZONE_HOST"):
        assert app["environment"][key] == FIXTURE[key], f"{layer}: {key} did not reach app"
    for service in ("app", "mysql", "redis"):
        assert all(port["host_ip"] == "127.0.0.1" for port in config["services"][service]["ports"])
    assert all(service["container_name"].startswith(FIXTURE["SKILLORA_CONTAINER_PREFIX"] + "-")
               for service in config["services"].values() if "container_name" in service)
    if "nginx" in config["services"]:
        assert (ROOT / "nginx/nginx.conf").is_file()
        assert config["services"]["frontend"]["build"]["args"]["NEXT_PUBLIC_APP_URL"] == FIXTURE["FRONTEND_URL"]
        assert config["services"]["frontend"]["build"]["args"]["NEXT_PUBLIC_API_BASE_URL"] == FIXTURE["PUBLIC_API_BASE_URL"]
    print(f"PASS {layer}: provider overrides and loopback-only data/API ports")

oauth = render("docker-compose.prod.yml", "docker-compose.oauth.yml")
assert oauth["services"]["frontend"]["environment"]["OAUTH_GOOGLE_ENABLED"] == "true"
assert oauth["services"]["app"]["environment"]["OAUTH2_AUTHORIZED_REDIRECT_URI"] == FIXTURE["FRONTEND_URL"] + "/oauth2/redirect"
print("PASS optional Google OAuth configuration")

if "--nginx" in sys.argv:
    subprocess.run(["docker", "info", "--format", "{{.ServerVersion}}"], check=True, capture_output=True)
    with tempfile.TemporaryDirectory(prefix="skillora-nginx-check-") as tmp:
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
                        "-subj", "/CN=skillora.invalid", "-keyout", str(Path(tmp) / "privkey.pem"),
                        "-out", str(Path(tmp) / "fullchain.pem")], check=True, capture_output=True)
        subprocess.run(["docker", "run", "--rm", "--name", "skillora-nginx-check-" + uuid.uuid4().hex[:8],
                        "--add-host", "app:127.0.0.1", "--add-host", "frontend:127.0.0.1",
                        "--mount", f"type=bind,src={ROOT / 'nginx/nginx.conf'},dst=/etc/nginx/nginx.conf,readonly",
                        "--mount", f"type=bind,src={tmp},dst=/etc/nginx/certs,readonly",
                        "nginx:1.27-alpine", "nginx", "-t"], check=True)
    print("PASS nginx -t with disposable test certificate")
else:
    print("Nginx runtime check not run; use --nginx when Docker is available.")
