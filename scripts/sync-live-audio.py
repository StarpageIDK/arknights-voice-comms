"""Extract changed operator voice bundles from the official Global server.
Dependencies: arkprts[all], UnityPy, FFmpeg. No game account or login is used.
"""
import sys, pathlib, json, urllib.request, io, re, subprocess, concurrent.futures, time
ROOT=pathlib.Path(__file__).resolve().parents[1]; CACHE=ROOT/'.cache'
if (CACHE/'python-deps').exists():sys.path.insert(0,str(CACHE/'python-deps'))
import UnityPy
from arkprts.assets.bundle import asset_path_to_server_filename,unzip_only_file,decompress_lz4ak
from UnityPy.enums.BundleFile import CompressionFlags
from UnityPy.helpers import CompressionHelper
CompressionHelper.DECOMPRESSION_MAP[CompressionFlags.LZHAM]=decompress_lz4ak
live=json.loads((CACHE/'live-manifest.json').read_text());chars=json.loads((CACHE/'character_table.json').read_text(encoding='utf-8'));groups=json.loads((CACHE/'char_meta_table.json').read_text(encoding='utf-8'))['spCharGroups'];alts={id:ids[0] for ids in groups.values() for id in ids}
chars.update(json.loads((CACHE/'char_patch_table.json').read_text(encoding='utf-8'))['patchChars'])
basechars={id for id,c in chars.items() if not c.get('isNotObtainable') and c.get('profession') in ['PIONEER','WARRIOR','TANK','SNIPER','CASTER','MEDIC','SUPPORT','SPECIAL']}
ids={'037','021','022','023','024','025','026','027','028','017','018','019','020','002','003','004','007','008','009'};jobs=[]
for lang,prefix in [('JP','voice'),('EN','voice_en'),('CN','voice_cn'),('KR','voice_kr')]:
 state=json.loads((CACHE/f'voice-{lang.lower()}-state.json').read_text())['done']
 for info in live['manifest']['abInfos']:
  path=info['name'];char=path.rsplit('/',1)[-1].removesuffix('.ab')
  if path.startswith('audio/sound_beta_2/'+prefix+'/') and char in basechars and state.get(path)!=info['hash']:jobs.append((lang,char,info))
print('Changed/new voice packs:',len(jobs),flush=True)
def run(job):
 lang,char,info=job;cache=CACHE/'live-bundles'/f"{info['hash']}.dat";cache.parent.mkdir(exist_ok=True);out=ROOT/'dist'/'live-audio'/char/lang;out.mkdir(parents=True,exist_ok=True);index=out/'index.json'
 if index.exists():
  result=json.loads(index.read_text())
  if result['hash']==info['hash']:return result
 if not cache.exists():
  url=live['base']+asset_path_to_server_filename(info['name'])
  for attempt in range(3):
   try:urllib.request.urlretrieve(url,cache);break
   except Exception:
    if attempt==2:raise
    time.sleep(attempt+1)
 env=UnityPy.load(io.BytesIO(unzip_only_file(cache.read_bytes())));clips={}
 for obj in env.objects:
  if obj.type.name!='AudioClip':continue
  data=obj.read();name=str(data.m_Name).lower();match=re.search(r'cn_(\d{3})',name)
  if not match or match[1] not in ids:continue
  clipid=match[1]
  for blob in data.samples.values():
   target=out/(clipid+'.mp3');temp=CACHE/'live-bundles'/f'{char}-{lang}-{clipid}.wav';temp.write_bytes(blob)
   subprocess.run(['ffmpeg','-v','error','-y','-i',str(temp),'-ac','1','-b:a','64k',str(target)],check=True);temp.unlink()
   duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(target)],text=True))
   clips[clipid]={'path':target.relative_to(ROOT/'dist').as_posix(),'duration':duration}
 result={'language':lang,'operator':char,'hash':info['hash'],'bundle':info['name'],'clips':clips};index.write_text(json.dumps(result,indent=2));return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 results=[]
 for result in ex.map(run,jobs):results.append(result);print(result['language'],result['operator'],len(result['clips']),flush=True)
(CACHE/'live-overrides.json').write_text(json.dumps(results));print('Live extraction complete',flush=True)
