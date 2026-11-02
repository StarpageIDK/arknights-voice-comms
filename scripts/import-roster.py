import json, pathlib, urllib.request, concurrent.futures, subprocess, re, time
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache';OUT=ROOT/'dist'
CACHE.mkdir(exist_ok=True)
for table in ['character_table','handbook_info_table','char_meta_table','handbook_team_table']:
 target=CACHE/(table+'.json')
 if not target.exists():urllib.request.urlretrieve('https://raw.githubusercontent.com/ArknightsAssets/ArknightsGamedata/master/en/gamedata/excel/'+table+'.json',target)
load=lambda name:json.load(open(CACHE/(name+'.json'),encoding='utf-8'))
voices=json.load(open(ROOT/'voice-source.json',encoding='utf-8'));chars=load('character_table');handbook=load('handbook_info_table')['handbookDict'];teams=load('handbook_team_table');groups=load('char_meta_table')['spCharGroups']
names=['Amiya','Exusiai','SilverAsh','Ifrit','Eyjafjalla','Warfarin','Siege','Shining','Skadi','Specter','Texas','Lappland','Saria','Hoshiguma','Ch’en','Ch\'en','Angelina','Suzuran','Surtr','Thorns','Mountain','Blaze','Mudrock','Bagpipe','Myrtle','Elysium','Saileach','Nightingale','Ptilopsis','Perfumer','Silence','Lumen','Kal\'tsit','Ceobe','Mostima','Goldenglow','Passenger','Dusk','Ling','Nian','W','Weedy','Phantom','Projekt Red','Gravel','Jaye','Lee','Aak','Dorothy','Mizuki','Fiammetta','Schwarz','Schwarz','Archetto','Rosa','Rosmontis','Blue Poison','Platinum','Meteorite','Nearl','Liskarm','Cuora','Gummy','Sussurro','Kroos','Fang','Melantha','Spot','Orchid','Shirayuki','Gitano','Vigna']
alters={id:ids[0] for ids in groups.values() for id in ids};jobs=[];operators=[]
clip_ids=['037','021','022','023','024','025','026','027','028','017','018','019','020','002','003','004','007','008','009']
classes={'PIONEER':'Vanguard','WARRIOR':'Guard','TANK':'Defender','SNIPER':'Sniper','CASTER':'Caster','MEDIC':'Medic','SUPPORT':'Supporter','SPECIAL':'Specialist'}
for id,c in chars.items():
 if c['name'] not in names or c.get('isNotObtainable') or alters.get(id,id)!=id or id not in voices['data']:continue
 stories=handbook.get(id,{}).get('storyTextAudio',[]);texts='\n'.join(s['storyText'] for block in stories for s in block.get('stories',[]) if block.get('storyTitle')=='Basic Info');race=re.search(r'\[Race\]\s*([^\n]+)',texts)
 faction=next((teams[x]['powerName'] for x in [c.get('teamId'),c.get('groupId'),c.get('nationId')] if x in teams),'Independent')
 op=dict(id=id,name=c['name'],rarity=int(c['rarity'].split('_')[-1]),**{'class':classes[c['profession']]},race=race.group(1).strip() if race else 'Undisclosed',faction=faction,avatar=f'avatars/{id}.png',voices={},clips={})
 for lang,v in voices['data'][id]['variations'].items():
  if lang not in ['JP','EN','CN','KR']:continue
  clips=v['clips'];mapping={x['name']:(x['start'],clips[i+1]['start'] if i+1<len(clips) else v['duration']) for i,x in enumerate(clips)}
  ids=[n for n in clip_ids if 'CN_'+n in mapping]
  if '037' not in ids or len(ids)<5:continue
  op['voices'][lang]={n:f'audio/{id}/{lang}/{n}.ogg' for n in ids};op['clips'][lang]=[dict(id=n,duration=round(mapping['CN_'+n][1]-mapping['CN_'+n][0],3),kind='title' if n=='037' else 'trust' if n in ['007','008','009'] else 'talk' if n in ['002','003','004'] else 'battle') for n in ids];jobs.append((op,lang,mapping,ids))
 if op['voices']:operators.append(op)
def fetch(url,path):
 if path.exists() and path.stat().st_size>100:return
 for attempt in range(3):
  try:urllib.request.urlretrieve(url,path);return
  except Exception:
   if attempt==2:raise
   time.sleep(attempt+1)
def work(job):
 op,lang,mapping,ids=job;id=op['id'];dest=OUT/'audio'/id/lang;dest.mkdir(parents=True,exist_ok=True);source=CACHE/f'{id}-{lang}.ogg';fetch(f"https://raw.githubusercontent.com/isHarryh/Ark-Voice/main/{voices['storageDirectory'][lang]}/{id}.ogg",source)
 for n in ids:
  target=dest/(n+'.ogg')
  if target.exists():continue
  start,end=mapping['CN_'+n];subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(source),'-t',str(end-start),'-c:a','libvorbis',str(target)],check=True)
 return id
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
 for i,_ in enumerate(ex.map(work,jobs),1):
  if i%20==0:print(f'{i}/{len(jobs)} voice packs ready',flush=True)
(OUT/'avatars').mkdir(exist_ok=True)
for op in operators:fetch(f"https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets/cn/assets/torappu/dynamicassets/arts/charavatars/{op['id']}.png",OUT/op['avatar'])
(OUT/'game-data.json').write_text(json.dumps(dict(attempts=['037','021','002','003','009'],operators=operators),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Completed: {len(operators)} operators, {len(jobs)} language packs',flush=True)
