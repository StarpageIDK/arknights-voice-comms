"""Download the roster's class/archetype icons from the pinned asset revision."""
import concurrent.futures
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
lock = json.loads((ROOT / 'sources.lock.json').read_text(encoding='utf-8'))['icons']
roster = json.loads((ROOT / 'dist/game-data.json').read_text(encoding='utf-8'))['operators']
jobs = {}
for op in roster:
    profession = pathlib.Path(op['classIcon']).stem
    jobs[op['classIcon']] = f'assets/dyn/arts/profession_no_shadow_hub/icon_profession_{profession}.png'
    jobs[op['archetypeIcon']] = f"assets/dyn/arts/ui/subprofessionicon/sub_{op['archetypeId']}_icon.png"

def download(job):
    target, source = job
    path = ROOT / 'dist' / target
    url = f"https://raw.githubusercontent.com/{lock['repo']}/{lock['commit']}/{source}"
    with urllib.request.urlopen(url, timeout=45) as response:
        data = response.read()
    if not data.startswith(b'\x89PNG'):
        raise ValueError('Not a PNG: ' + source)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    list(executor.map(download, jobs.items()))
print(f'Saved {len(jobs)} class/archetype icons')
