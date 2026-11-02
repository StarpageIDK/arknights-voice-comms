"""Build the full Global roster from pinned game tables and verified voice indexes.
Run refresh-sources.py and sync-live-audio.py first. No hardcoded roster allowlist.
"""
import json,pathlib,re,urllib.request,concurrent.futures,time
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache';OUT=ROOT/'dist'
def load(path):return json.loads(path.read_text(encoding='utf-8'))
lock=load(ROOT/'sources.lock.json');chars=load(CACHE/'character_table.json');handbook=load(CACHE/'handbook_info_table.json')['handbookDict'];teams=load(CACHE/'handbook_team_table.json');groups=load(CACHE/'char_meta_table.json')['spCharGroups'];alts={id:ids[0] for ids in groups.values() for id in ids}
classes={'PIONEER':'Vanguard','WARRIOR':'Guard','TANK':'Defender','SNIPER':'Sniper','CASTER':'Caster','MEDIC':'Medic','SUPPORT':'Supporter','SPECIAL':'Specialist'}
clip_ids=['037','021','022','023','024','025','026','027','028','017','018','019','020','002','003','004','007','008','009']
trees={lang:{x['path']:x for x in load(CACHE/f'arknights-voice-{lang.lower()}-tree.json')['tree'] if x['type']=='blob'} for lang in lock['archives']}
live=load(CACHE/'live-manifest.json');manifest={x['name']:x for x in live['manifest']['abInfos']};states={lang:load(CACHE/f'voice-{lang.lower()}-state.json')['done'] for lang in lock['archives']};overrides={(x['operator'],x['language']):x for x in load(CACHE/'live-overrides.json')}
report={'sourceVersions':lock,'baseOperators':0,'includedOperators':0,'excluded':[],'languages':{},'mergedAlternateForms':sum(len(ids)-1 for ids in groups.values()),'voiceSources':{'archived':0,'live':0}}
operators=[]
for id,c in chars.items():
 if c.get('isNotObtainable') or c.get('profession') not in classes or alts.get(id,id)!=id:continue
 report['baseOperators']+=1
 texts='\n'.join(s['storyText'] for block in handbook.get(id,{}).get('storyTextAudio',[]) for s in block.get('stories',[]) if block.get('storyTitle')=='Basic Info');race=re.search(r'\[Race\]\s*([^\n]+)',texts)
 faction=next((teams[x]['powerName'] for x in [c.get('teamId'),c.get('groupId'),c.get('nationId')] if x in teams),'Independent')
 op={'id':id,'name':c['name'],'rarity':int(c['rarity'].split('_')[-1]),'class':classes[c['profession']],'race':race.group(1).strip() if race else 'Undisclosed','faction':faction,'avatar':f'avatars/{id}.png','voices':{},'clips':{}}
 for lang,prefix in [('JP','voice'),('EN','voice_en'),('CN','voice_cn'),('KR','voice_kr')]:
  bundle=f'audio/sound_beta_2/{prefix}/{id}.ab';entries=[];urls={};override=overrides.get((id,lang));info=manifest.get(bundle)
  if not info:continue
  if override and override['hash']!=info['hash']:raise RuntimeError('Stale live override '+bundle)
  if not override and states[lang].get(bundle)!=info['hash']:raise RuntimeError('Changed bundle not extracted '+bundle)
  for n in clip_ids:
   kind='title' if n=='037' else 'trust' if n in ['007','008','009'] else 'talk' if n in ['002','003','004'] else 'battle'
   if override:
    clip=override['clips'].get(n)
    if not clip:continue
    urls[n]=clip['path'];duration=clip['duration'];estimated=False
   else:
    path=f'{id}/cn_{n}.mp3';entry=trees[lang].get(path)
    if not entry:continue
    source=lock['archives'][lang];urls[n]=f"https://raw.githubusercontent.com/{source['repo']}/{source['commit']}/{path}";duration=entry['size']/12000;estimated=True
   entries.append({'id':n,'duration':round(duration,3),'durationEstimated':estimated,'kind':kind})
  if '037' not in urls or len(entries)<5:
   report.setdefault('unplayableLanguages',[]).append({'id':id,'language':lang,'reason':'Missing title or fewer than five clips'});continue
  op['voices'][lang]=urls;op['clips'][lang]=entries;report['voiceSources']['live' if override else 'archived']+=1
 if op['voices']:operators.append(op)
 else:report['excluded'].append({'id':id,'name':c['name'],'reason':'No supported language has a title and four other clips'})

def avatar(op):
 path=OUT/op['avatar'];path.parent.mkdir(exist_ok=True)
 if path.exists():return
 urls=[f"https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/avatar/{op['id']}.png",f"https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets/cn/assets/torappu/dynamicassets/arts/charavatars/{op['id']}.png",f"https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/cn/assets/dyn/arts/charavatars/{op['id']}.png"]
 for url in urls:
  for attempt in range(2):
   try:
    with urllib.request.urlopen(url,timeout=45) as response:data=response.read()
    if not data.startswith(b'\x89PNG'):raise ValueError('Invalid avatar')
    path.write_bytes(data);return
   except Exception as e:last_error=e;time.sleep(.2)
 raise RuntimeError('Missing avatar '+op['id']) from last_error
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:list(ex.map(avatar,operators))
operators.sort(key=lambda o:o['name'].casefold());report['includedOperators']=len(operators);report['languages']={lang:sum(lang in o['voices'] for o in operators) for lang in lock['archives']};report['clipCount']=sum(len(c) for o in operators for c in o['clips'].values())
(OUT/'game-data.json').write_text(json.dumps({'attempts':['037','021','002','003','009'],'operators':operators,'coverage':{'available':report['includedOperators'],'total':report['baseOperators']},'resourceVersion':live['version']},ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'coverage-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:report[k] for k in ['baseOperators','includedOperators','languages','clipCount','excluded']},ensure_ascii=True),flush=True)
