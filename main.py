import os
import re
import time
import json
import shutil
import asyncio
import zipfile
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

import decky

TRAINERS_DIR = Path(os.path.expanduser("~/FLiNG-Trainers"))
BASE_URL = "https://flingtrainer.com"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
CACHE_TTL = 300


def _make_request(url, referer=None):
    headers = {"User-Agent": USER_AGENT}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def _sanitize_name(name):
    return re.sub(r'[<>:"/\\|?*]', "", name).strip()


class TrainerListParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.trainers = []
        self._in_link = False
        self._current = None

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        attrs_dict = dict(attrs)
        href = attrs_dict.get("href", "")
        match = re.search(r"/trainer/([\w-]+)/?$", href)
        if match:
            self._in_link = True
            self._current = {
                "slug": match.group(1),
                "url": href if href.startswith("http") else BASE_URL + href,
                "name": "",
            }

    def handle_data(self, data):
        if self._in_link and self._current is not None:
            self._current["name"] += data

    def handle_endtag(self, tag):
        if tag == "a" and self._in_link:
            self._in_link = False
            if self._current and self._current["name"].strip():
                self._current["name"] = self._current["name"].strip()
                self.trainers.append(self._current)
            self._current = None


class TrainerDetailParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.downloads = []
        self.metadata_text = ""
        self._capture_text = False
        self._all_text = []
        self._in_attachment = False
        self._current_download = None

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            attrs_dict = dict(attrs)
            cls = attrs_dict.get("class", "")
            href = attrs_dict.get("href", "")
            if "attachment-link" in cls and href:
                self._in_attachment = True
                self._current_download = {"url": href, "filename": ""}

    def handle_data(self, data):
        self._all_text.append(data)
        if self._in_attachment and self._current_download is not None:
            self._current_download["filename"] += data

    def handle_endtag(self, tag):
        if tag == "a" and self._in_attachment:
            self._in_attachment = False
            if self._current_download and self._current_download["filename"].strip():
                self._current_download["filename"] = self._current_download["filename"].strip()
                self.downloads.append(self._current_download)
            self._current_download = None

    def get_metadata(self):
        full_text = " ".join(self._all_text)
        match = re.search(
            r"(\d+)\s*Options?\s*[·•]\s*Game\s*Version:\s*([^·•]+)[·•]\s*Last\s*Updated:\s*([\d.]+)",
            full_text,
        )
        if match:
            return {
                "options": match.group(1),
                "game_version": match.group(2).strip(),
                "last_updated": match.group(3).strip(),
            }
        return {"options": "", "game_version": "", "last_updated": ""}


class Plugin:
    trainer_cache = []
    cache_timestamp = 0.0

    async def get_trainers(self):
        now = time.time()
        if self.trainer_cache and (now - self.cache_timestamp) < CACHE_TTL:
            return self.trainer_cache

        loop = asyncio.get_event_loop()
        html = await loop.run_in_executor(
            None, _make_request, BASE_URL + "/all-trainers/"
        )
        parser = TrainerListParser()
        parser.feed(html.decode("utf-8", errors="replace"))
        self.trainer_cache = parser.trainers
        self.cache_timestamp = time.time()
        decky.logger.info(f"Cached {len(self.trainer_cache)} trainers")
        return self.trainer_cache

    async def get_trainer_details(self, slug):
        url = f"{BASE_URL}/trainer/{slug}/"
        loop = asyncio.get_event_loop()
        html = await loop.run_in_executor(None, _make_request, url)
        parser = TrainerDetailParser()
        parser.feed(html.decode("utf-8", errors="replace"))
        meta = parser.get_metadata()
        return {
            "name": slug,
            "options": meta["options"],
            "game_version": meta["game_version"],
            "last_updated": meta["last_updated"],
            "downloads": parser.downloads,
        }

    async def download_trainer(self, slug, name, download_url):
        try:
            safe_name = _sanitize_name(name)
            dest_dir = TRAINERS_DIR / safe_name
            dest_dir.mkdir(parents=True, exist_ok=True)

            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
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
            decky.logger.error(f"Download failed: {e}")
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
            decky.logger.error(f"Delete failed: {e}")
            return {"success": False, "error": str(e)}

    async def _main(self):
        TRAINERS_DIR.mkdir(parents=True, exist_ok=True)
        decky.logger.info("Flinger loaded")

    async def _unload(self):
        decky.logger.info("Flinger unloaded")
