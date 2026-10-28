"""Export this checkout and its built Compose images without bundling local secrets or databases."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--env-file", default=".env.docker.local")
parser.add_argument("--output", default="artifacts/skillora-docker-final-20261028")
args = parser.parse_args()
output = (ROOT / args.output).resolve()
output.relative_to(ROOT / "artifacts")
bundle = output.with_suffix(".zip")
checksum = bundle.with_suffix(".zip.sha256")
if bundle.exists() or checksum.exists():
    raise SystemExit("Bundle/checksum already exists; choose a new output name.")
output.mkdir(parents=True, exist_ok=True)
if any(output.iterdir()):
    raise SystemExit("Output must be empty; choose a new bundle directory to preserve prior artifacts.")


def run(*command):
    return subprocess.check_output(command, cwd=ROOT, text=True, encoding="utf-8").strip()


config = json.loads(run("docker", "compose", "--env-file", args.env_file, "config", "--format", "json"))
images = {}
for service, definition in config["services"].items():
    reference = definition["image"]
    info = json.loads(run("docker", "image", "inspect", reference))[0]
    images[service] = {"reference": reference, "id": info["Id"], "repo_digests": info.get("RepoDigests", []), "size": info["Size"]}

refs = sorted({item["reference"] for item in images.values()})
subprocess.run(["docker", "image", "save", "-o", str(output / "images.tar"), *refs], cwd=ROOT, check=True)
files = run("git", "--no-pager", "ls-files", "--cached", "--others", "--exclude-standard").splitlines()
included = []
with zipfile.ZipFile(output / "source.zip", "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(set(files)):
        file = ROOT / name
        if not file.is_file() or name.startswith((".agent/", ".idea/", "artifacts/")):
            continue
        if file.name.startswith(".env") and "example" not in file.name:
            continue
        if file.suffix in (".pem", ".key"):
            continue
        archive.write(file, name)
        included.append(name)

# Use the exported image IDs for offline startup, avoiding changes to local tags or registries.
override = {"services": {name: {"image": item["id"]} for name, item in images.items()}}
(output / "compose.images.json").write_text(json.dumps(override, indent=2) + "\n", encoding="utf-8")
(output / "bundle.env.example").write_text((ROOT / ".env.docker.example").read_text(encoding="utf-8"), encoding="utf-8")
(output / "START_HERE.md").write_text("""# Skillora Docker bundle

1. Install Docker Engine/Desktop with Compose and use Linux containers.
2. Extract `source.zip` into a new directory and copy `compose.images.json` and `bundle.env.example` into that directory.
3. Review the local-only demo defaults in `bundle.env.example` and choose free HTTP/mail ports and a unique project name.
4. Load images: `docker image load -i /path/to/images.tar`.
5. From the extracted source, start offline:
   `docker compose --env-file bundle.env.example -f compose.yaml -f compose.images.json up -d --no-build --pull never --wait`.
6. Open http://localhost:18080 and Mailpit at http://localhost:18025 (unless ports were changed).
7. Read `README.md`, `docs/PROJECT_REPORT.md`, `docs/COMPLETION_PLAN.md` and `docs/DOCKER_PACKAGE.md`.

Demo users: admin@skillora.test, instructor@skillora.test, learner@skillora.test. Default demo password: Skillora@12345.
This is a loopback-only local/UAT bundle. Real payment, Bunny, Google and Gemini integrations are disabled here.
For production use the TLS/provider runbook and complete the business/provider acceptance gates first.
`source.zip` excludes local environment files, private keys, databases, IDE and agent-local configuration.
Database volumes are created fresh; existing live data is not included. Stop with `docker compose ... stop`; do not delete volumes to stop the app.
""", encoding="utf-8")


def digest(file):
    hasher = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


manifest = {
    "created_utc": datetime.now(timezone.utc).isoformat(),
    "baseline_commit": run("git", "--no-pager", "rev-parse", "HEAD"),
    "branch": run("git", "--no-pager", "branch", "--show-current"),
    "working_tree_dirty": bool(run("git", "--no-pager", "status", "--porcelain")),
    "images": images, "source_file_count": len(included),
    "artifacts": {file.name: {"bytes": file.stat().st_size, "sha256": digest(file)} for file in output.iterdir() if file.is_file()},
}
(output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
    for file in sorted(output.iterdir()):
        archive.write(file, file.name)
bundle_hash = digest(bundle)
checksum.write_text(f"{bundle_hash}  {bundle.name}\n", encoding="utf-8")
print(json.dumps({"output": str(output), "source_files": len(included), "images": len(refs),
                  "artifacts": manifest["artifacts"], "bundle": str(bundle),
                  "bundle_bytes": bundle.stat().st_size, "bundle_sha256": bundle_hash}, indent=2))
