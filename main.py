import os
import re
import ssl
import time
import shutil
import asyncio
import logging
import zipfile
import traceback
import urllib.request
from pathlib import Path

import certifi
import decky

TRAINERS_DIR = Path(os.path.expanduser("~/FLiNG-Trainers"))
BASE_URL = "https://flingtrainer.com"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
CACHE_TTL = 300

_SSL_CTX = ssl.create_default_context(cafile=certifi.where())


def _make_request(url, referer=None):
    headers = {"User-Agent": USER_AGENT}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as resp:
        return resp.read()


def _sanitize_name(name):
    return re.sub(r'[<>:"/\\|?*]', "", name).strip()


def _parse_trainer_list(html_text):
    trainers = []
    for match in re.finditer(
        r'<a[^>]*href="([^"]*?/trainer/([\w-]+)/?)"[^>]*>(.*?)</a>', html_text, re.DOTALL
    ):
        href, slug, name = match.group(1), match.group(2), match.group(3)
        name = re.sub(r"<[^>]+>", "", name).strip()
        if not name or "archive" in name.lower():
            continue
        url = href if href.startswith("http") else BASE_URL + href
        trainers.append({"slug": slug, "url": url, "name": name})
    return trainers


def _parse_trainer_details(html_text):
    downloads = []
    for match in re.finditer(
        r'<a[^>]*\bclass="[^"]*attachment-link[^"]*"[^>]*>(.*?)</a>',
        html_text,
        re.DOTALL,
    ):
        tag = match.group(0)
        href = re.search(r'href="([^"]+)"', tag)
        if not href:
            continue
        filename = re.sub(r"<[^>]+>", "", match.group(1)).strip()
        if filename:
            downloads.append({"url": href.group(1), "filename": filename})

    meta = {"options": "", "game_version": "", "last_updated": ""}
    text = re.sub(r"<[^>]+>", " ", html_text)
    m = re.search(
        r"(\d+)\s*Options?\s*[·•]\s*Game\s*Version:\s*([^·•]+)[·•]\s*Last\s*Updated:\s*([\d.]+)",
        text,
    )
    if m:
        meta = {
            "options": m.group(1),
            "game_version": m.group(2).strip(),
            "last_updated": m.group(3).strip(),
        }

    return downloads, meta


class Plugin:
    trainer_cache = []
    cache_timestamp = 0.0

    async def get_trainers(self):
        now = time.time()
        if self.trainer_cache and (now - self.cache_timestamp) < CACHE_TTL:
            return self.trainer_cache

        try:
            decky.logger.info("Fetching trainer list from %s", BASE_URL)
            html = await asyncio.get_event_loop().run_in_executor(
                None, _make_request, BASE_URL + "/all-trainers/"
            )
            decoded = html.decode("utf-8", errors="replace")
            decky.logger.info("Received %d bytes, parsing", len(html))
            self.trainer_cache = _parse_trainer_list(decoded)
            self.cache_timestamp = time.time()
            decky.logger.info("Cached %d trainers", len(self.trainer_cache))
            return self.trainer_cache
        except Exception as e:
            decky.logger.error("get_trainers failed: %s\n%s", e, traceback.format_exc())
            raise

    async def get_trainer_details(self, slug):
        url = f"{BASE_URL}/trainer/{slug}/"
        try:
            html = await asyncio.get_event_loop().run_in_executor(None, _make_request, url)
            downloads, meta = _parse_trainer_details(html.decode("utf-8", errors="replace"))
            decky.logger.info("Details for %s: %d downloads", slug, len(downloads))
            return {
                "name": slug,
                "options": meta["options"],
                "game_version": meta["game_version"],
                "last_updated": meta["last_updated"],
                "downloads": downloads,
            }
        except Exception as e:
            decky.logger.error("get_trainer_details(%s) failed: %s\n%s", slug, e, traceback.format_exc())
            raise

    async def log(self, level, msg):
        fn = getattr(decky.logger, level, decky.logger.info)
        fn("[frontend] %s", msg)

    async def download_trainer(self, slug, name, download_url):
        try:
            safe_name = _sanitize_name(name)
            dest_dir = TRAINERS_DIR / safe_name
            dest_dir.mkdir(parents=True, exist_ok=True)

            data = await asyncio.get_event_loop().run_in_executor(
                None, _make_request, download_url, BASE_URL + "/"
            )

            if data[:2] == b"PK":
                zip_path = dest_dir / "trainer.zip"
                zip_path.write_bytes(data)
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(dest_dir)
                zip_path.unlink()
            else:
                exe_path = dest_dir / f"{safe_name}.exe"
                exe_path.write_bytes(data)

            decky.logger.info(f"Downloaded trainer to {dest_dir}")
            return {"success": True, "path": str(dest_dir)}
        except Exception as e:
            decky.logger.error("Download failed: %s\n%s", e, traceback.format_exc())
            return {"success": False, "error": str(e)}

    async def get_downloaded_trainers(self):
        if not TRAINERS_DIR.exists():
            return []
        return [d.name for d in TRAINERS_DIR.iterdir() if d.is_dir()]

    async def delete_trainer(self, name):
        try:
            target = TRAINERS_DIR / name
            if target.exists() and target.is_dir():
                shutil.rmtree(target)
                decky.logger.info(f"Deleted trainer: {name}")
                return {"success": True}
            return {"success": False, "error": "Not found"}
        except Exception as e:
            decky.logger.error("Delete failed: %s\n%s", e, traceback.format_exc())
            return {"success": False, "error": str(e)}

    async def _main(self):
        TRAINERS_DIR.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(
            os.path.join(decky.DECKY_PLUGIN_LOG_DIR, "plugin.log"), mode="w"
        )
        handler.setFormatter(logging.Formatter("[%(asctime)s][%(levelname)s]: %(message)s"))
        decky.logger.addHandler(handler)
        decky.logger.info("Flinger loaded")

    async def _unload(self):
        decky.logger.info("Flinger unloaded")
