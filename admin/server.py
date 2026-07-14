"""
jskim.art local-helper
-----------------------
Runs ONLY on 등작의 로컬 PC. Never deploy this publicly.

Responsibilities:
  - Resize uploaded images into originals / standard / zoom, EXIF-orientation corrected
  - Append entries to works.json with automatic backup + rollback on failure
  - Run `git add / commit / push` against the two local repo clones
    (jskim.art and jskim-images), using whatever git auth is already
    configured on this machine (Git Credential Manager or SSH key).
    This script never reads, stores, or transmits a GitHub token.

Setup (Windows / Mac / Linux):
  1. Clone both repos locally, e.g.:
       git clone https://github.com/dungzakcestlavie/jskim.art.git
       git clone https://github.com/dungzakcestlavie/jskim-images.git
  2. Copy .env.example to .env and set the two paths below.
  3. pip install -r requirements.txt
  4. python server.py
  5. Open admin/index.html in a browser (e.g. via `python -m http.server`
     from inside the jskim.art repo folder, then visit
     http://localhost:8000/admin/).
"""

import os
import json
import shutil
import subprocess
import datetime
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageOps
from dotenv import load_dotenv

load_dotenv()

ART_REPO = Path(os.environ.get("JSKIM_ART_REPO_PATH", "")).expanduser()
IMAGES_REPO = Path(os.environ.get("JSKIM_IMAGES_REPO_PATH", "")).expanduser()

STANDARD_LONG_EDGE = 1600
ZOOM_LONG_EDGE = 3000
ORIGINAL_MAX_LONG_EDGE = 4000  # cap runaway camera-original resolution

app = Flask(__name__)
CORS(app)  # local-only tool; admin page runs on localhost too


def require_repo_paths():
    if not ART_REPO.exists():
        raise RuntimeError(f"JSKIM_ART_REPO_PATH가 존재하지 않습니다: {ART_REPO}")
    if not IMAGES_REPO.exists():
        raise RuntimeError(f"JSKIM_IMAGES_REPO_PATH가 존재하지 않습니다: {IMAGES_REPO}")


def resize_long_edge(img: Image.Image, long_edge: int) -> Image.Image:
    w, h = img.size
    current_long = max(w, h)
    if current_long <= long_edge:
        return img  # never upscale
    scale = long_edge / current_long
    return img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/sections")
def get_sections():
    require_repo_paths()
    path = ART_REPO / "sections.json"
    return jsonify(json.loads(path.read_text(encoding="utf-8")) if path.exists() else [])


@app.get("/api/works")
def get_works():
    require_repo_paths()
    path = ART_REPO / "works.json"
    return jsonify(json.loads(path.read_text(encoding="utf-8")) if path.exists() else [])


@app.post("/api/process-image")
def process_image():
    require_repo_paths()
    work_id = request.form.get("id", "").strip()
    file = request.files.get("image")
    if not work_id or not file:
        return jsonify({"error": "id와 image 파일이 필요합니다."}), 400

    ext = Path(file.filename).suffix.lower() or ".jpg"
    filename = f"{work_id}{ext}"

    for sub in ("originals", "standard", "zoom"):
        (IMAGES_REPO / sub).mkdir(parents=True, exist_ok=True)

    # Duplicate filename guard
    if (IMAGES_REPO / "standard" / filename).exists():
        return jsonify({"error": f"{filename} 파일이 이미 standard/ 에 존재합니다."}), 409

    img = Image.open(file.stream)
    img = ImageOps.exif_transpose(img)  # correct EXIF orientation
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    original_img = resize_long_edge(img, ORIGINAL_MAX_LONG_EDGE)
    original_img.save(IMAGES_REPO / "originals" / filename, quality=92)

    standard_img = resize_long_edge(img, STANDARD_LONG_EDGE)
    standard_img.save(IMAGES_REPO / "standard" / filename, quality=88)

    zoom_img = resize_long_edge(img, ZOOM_LONG_EDGE)
    zoom_img.save(IMAGES_REPO / "zoom" / filename, quality=90)

    return jsonify({
        "imagePath": f"standard/{filename}",
        "zoomPath": f"zoom/{filename}",
        "originalPath": f"originals/{filename}",
    })


@app.post("/api/save-work")
def save_work():
    require_repo_paths()
    work = request.get_json(force=True)
    if not work or not work.get("id"):
        return jsonify({"error": "유효한 work 객체가 필요합니다."}), 400

    works_path = ART_REPO / "works.json"
    works = json.loads(works_path.read_text(encoding="utf-8")) if works_path.exists() else []

    if any(w["id"] == work["id"] for w in works):
        return jsonify({"error": f"작품 ID {work['id']} 가 이미 존재합니다."}), 409

    backup_path = ART_REPO / f"works.json.bak.{datetime.datetime.now():%Y%m%d%H%M%S}"
    if works_path.exists():
        shutil.copy(works_path, backup_path)

    works.append(work)
    try:
        works_path.write_text(
            json.dumps(works, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception as e:
        if backup_path.exists():
            shutil.copy(backup_path, works_path)  # rollback
        return jsonify({"error": f"저장 실패, 원상복구됨: {e}"}), 500

    return jsonify({"status": "ok", "count": len(works)})


@app.post("/api/git-commit-push")
def git_commit_push():
    require_repo_paths()
    message = (request.get_json(force=True) or {}).get("message", "update jskim.art data")

    results = {}
    for name, repo in (("jskim.art", ART_REPO), ("jskim-images", IMAGES_REPO)):
        status = subprocess.run(["git", "status", "--porcelain"], cwd=repo, capture_output=True, text=True)
        if not status.stdout.strip():
            results[name] = "변경사항 없음"
            continue
        subprocess.run(["git", "add", "-A"], cwd=repo, check=True)
        subprocess.run(["git", "commit", "-m", message], cwd=repo, check=True)
        push = subprocess.run(["git", "push"], cwd=repo, capture_output=True, text=True)
        if push.returncode != 0:
            return jsonify({"error": f"{name} push 실패: {push.stderr}"}), 500
        results[name] = "push 완료"

    return jsonify({"status": "ok", "results": results})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8420, debug=True)
