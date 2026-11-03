"""Resolve and pin the latest Global metadata, archive trees, and live CDN manifest."""
import sys,pathlib,json,urllib.request,asyncio,concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache';CACHE.mkdir(exist_ok=True)
if (CACHE/'python-deps').exists():sys.path.insert(0,str(CACHE/'python-deps'))
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'arknights-voice-comms'}),timeout=90) as r:return json.load(r)
def raw(repo,sha,path):return get(f'https://raw.githubusercontent.com/{repo}/{sha}/{path}')
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
def archive(lang):
 repo='ThiagoVsky/arknights-voice-'+lang;commit=get('https://api.github.com/repos/'+repo+'/commits?per_page=1')[0];sha=commit['sha']
 # Cache bust avoids a stale GitHub proxy failure on large recursive trees.
 import time
 tree=get(f'https://api.github.com/repos/{repo}/git/trees/{sha}?recursive=1&t={time.time_ns()}')
 if tree.get('truncated'):raise RuntimeError('Incomplete upstream tree: '+repo)
 write(CACHE/f'arknights-voice-{lang}-tree.json',tree);write(CACHE/f'voice-{lang}-state.json',raw(repo,sha,f'.state/voice-{lang}.json'))
 return lang.upper(),{'repo':repo,'commit':sha,'updatedAt':commit['commit']['committer']['date']}
async def main():
 from arkprts import network
 repo='ArknightsAssets/ArknightsGamedata';commit=get('https://api.github.com/repos/'+repo+'/commits?path=en/gamedata/excel/character_table.json&per_page=1')[0];sha=commit['sha']
 for table in ['character_table','handbook_info_table','handbook_team_table','char_meta_table','charword_table','uniequip_table','char_patch_table']:write(CACHE/(table+'.json'),raw(repo,sha,'en/gamedata/excel/'+table+'.json'))
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:archives=dict(ex.map(archive,['jp','en','cn','kr']))
 session=network.NetworkSession(default_server='en')
 try:
  await session.load_version_config('en','Android');version=session.versions[('en','Android')]['resVersion'];base=f"{session.domains['en']['hu']}/Android/assets/{version}/";write(CACHE/'live-manifest.json',{'base':base,'version':version,'manifest':get(base+'hot_update_list.json')})
 finally:await session.close()
 lock={'metadata':{'repo':repo,'commit':sha,'updatedAt':commit['commit']['committer']['date']},'archives':archives,'live':{'version':version,'base':base}}
 previous=ROOT/'sources.lock.json'
 if previous.exists() and 'icons' in (old:=json.loads(previous.read_text(encoding='utf-8'))):lock['icons']=old['icons']
 write(ROOT/'sources.lock.json',lock);print('Sources pinned:',version,flush=True)
if __name__=='__main__':asyncio.run(main())
