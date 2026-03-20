import sys
import types
import asyncio
import logging

logger = logging.getLogger("flinger")
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)

decky = types.ModuleType("decky")
decky.logger = logger
sys.modules["decky"] = decky

import os
import tempfile
import main

main.TRAINERS_DIR = main.Path(tempfile.mkdtemp(prefix="flinger-test-"))

from main import Plugin

p = Plugin()


def run(coro):
    return asyncio.run(coro)


def test_get_trainers():
    trainers = run(p.get_trainers())
    assert len(trainers) > 100, f"Expected 100+ trainers, got {len(trainers)}"
    t = trainers[0]
    assert "name" in t and "slug" in t and "url" in t
    print(f"get_trainers: {len(trainers)} trainers")
    for t in trainers[:5]:
        print(f"  {t['name']} -> {t['slug']}")


def _pick_trainer():
    trainers = run(p.get_trainers())
    for t in trainers:
        if "archive" not in t["slug"]:
            return t
    return trainers[1]


def test_get_trainer_details():
    t = _pick_trainer()
    slug = t["slug"]
    details = run(p.get_trainer_details(slug))
    assert "downloads" in details
    assert len(details["downloads"]) > 0, f"No downloads for {slug}"
    print(f"get_trainer_details({slug}):")
    print(f"  options={details['options']} version={details['game_version']} updated={details['last_updated']}")
    for dl in details["downloads"]:
        print(f"  {dl['filename']} -> {dl['url']}")


def test_download_and_cleanup():
    t = _pick_trainer()
    slug = t["slug"]
    name = t["name"]
    details = run(p.get_trainer_details(slug))
    dl = details["downloads"][0]

    result = run(p.download_trainer(slug, name, dl["url"]))
    assert result["success"], f"Download failed: {result.get('error')}"
    print(f"download_trainer: {result['path']}")

    downloaded = run(p.get_downloaded_trainers())
    assert len(downloaded) > 0
    print(f"get_downloaded_trainers: {downloaded}")

    delete_result = run(p.delete_trainer(downloaded[0]))
    assert delete_result["success"]
    print(f"delete_trainer: {downloaded[0]} deleted")


if __name__ == "__main__":
    test_get_trainers()
    print()
    test_get_trainer_details()
    print()
    test_download_and_cleanup()
    import shutil
    shutil.rmtree(main.TRAINERS_DIR, ignore_errors=True)
    print()
    print("All tests passed")
