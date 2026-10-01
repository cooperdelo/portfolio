"""Import an observed Drive manifest; never modify originals or sharing.
Metadata is keyed by Drive's immutable ID. Reruns do not alter reviews.
"""
import argparse, json, re, subprocess, hashlib
from pathlib import Path
import requests
p=argparse.ArgumentParser()
p.add_argument('manifest',type=Path)
p.add_argument('--proxy',type=Path)
p.add_argument('--drive-id')
a=p.parse_args()
raw=Path('C:/Users/coope/Desktop/Claude/Projects/personal-brand/factory/.env').read_text()
key=re.search(r'^SUPABASE_SERVICE_KEY\s*=\s*(.+?)\s*$',raw,re.M).group(1).strip('\"\'')
base='https://eibtnkaoqsgwiqttiwjo.supabase.co'
headers={'apikey':key,'Authorization':'Bearer '+key}
rows=[]
for folder in json.loads(a.manifest.read_text(encoding='utf-8-sig')):
 for f in folder['files']:
  if not f['mime_type'].startswith(('video/','image/')) or f['title'].startswith('._'): continue
  rows.append({'drive_file_id':f['id'],'name':f['title'],'gig':folder['gig'],'mime_type':f['mime_type']})
assert len({x['drive_file_id'] for x in rows})==len(rows),'duplicate manifest identities'
r=requests.post(base+'/rest/v1/band_media_assets?on_conflict=drive_file_id',headers={**headers,'Prefer':'resolution=merge-duplicates,return=representation'},json=rows,timeout=30)
r.raise_for_status()
assert len(r.json())==len(rows)
if a.proxy:
 assert any(x['drive_file_id']==a.drive_id for x in rows),'proxy identity missing from observed manifest'
 digest=hashlib.sha256(a.proxy.read_bytes()).hexdigest()
 path=a.drive_id+'/'+digest[:16]+'.mp4'
 with a.proxy.open('rb') as f:
  r=requests.post(base+'/storage/v1/object/band-review/'+path,headers={**headers,'Content-Type':'video/mp4','x-upsert':'true'},data=f,timeout=90)
 r.raise_for_status()
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(a.proxy)],text=True))
 r=requests.patch(base+'/rest/v1/band_media_assets',params={'drive_file_id':'eq.'+a.drive_id},headers={**headers,'Prefer':'return=representation'},json={'proxy_path':path,'duration':duration},timeout=30)
 r.raise_for_status();assert r.json()[0]['proxy_path']==path
 # Confirm stored bytes independently of the upload response.
 r=requests.get(base+'/storage/v1/object/authenticated/band-review/'+path,headers=headers,timeout=90)
 r.raise_for_status();assert hashlib.sha256(r.content).hexdigest()==digest
 print('Private proxy upload + byte readback verified')
r=requests.get(base+'/rest/v1/band_media_assets?select=drive_file_id',headers=headers,timeout=30)
r.raise_for_status();ids=[x['drive_file_id'] for x in r.json()]
assert len(ids)==len(set(ids)) and set(x['drive_file_id'] for x in rows)<=set(ids)
print('Verified unique media records:',len(rows))
