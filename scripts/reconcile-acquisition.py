"""Read-only reconciliation. An observed UI table is never approval or a DB export."""
from pathlib import Path
import csv,json,re,hashlib,datetime
V=Path('C:/Users/coope/Desktop/Claude')
O=V/'Projects/plugverse/outreach'
A=V/'Scheduled-Tasks/acquisition'
def readcsv(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def norm(h):return str(h).strip().lower().removeprefix('@')
board_file=O/'automation/board-visible-prospects-20260930.json'
board_observation=json.loads(board_file.read_text(encoding='utf-8'))
board={}
for cells in board_observation['rows']:
 m=re.search(r'@([a-zA-Z0-9._-]+)',cells[0])
 if m:board[norm(m.group(1))]={'name':cells[0].split('\n')[0],'bucket':cells[1],'reason':cells[2],'status':cells[8]}
assert len(board)==len(board_observation['rows']),'Ambiguous or duplicate board identities'
master_rows=readcsv(O/'MASTER-LIST.csv');master={norm(r['handle']):r for r in master_rows}
sends=readcsv(O/'SEND-LOG.csv')
version=re.search(r'RULES_VERSION\s*=\s*[\"\']([^\"\']+)',(A/'rules.py').read_text(encoding='utf-8')).group(1)
pipeline_file=A/f'data/pipeline_{version}.csv'
pipeline_rows=readcsv(pipeline_file);pipeline={norm(r['handle']):r for r in pipeline_rows}
dossiers=json.loads((A/'data/dossiers.json').read_text(encoding='utf-8'))
contacts={norm(line.split('|',1)[0]):line.split('|',1)[1].strip() for line in (A/'contacted.txt').read_text(encoding='utf-8').splitlines() if '|' in line and not line.startswith('#')}
yes=lambda value:str(value).strip().lower() in ('yes','y','1','true')
sent=[r for r in sends if yes(r.get('sent'))]
existing={h for h,r in master.items() if 'existing_user' in r.get('cooper_ruling','')}
existing|={h for h,r in board.items() if 'already signed up' in r['reason'].lower() or r['status']=='Signed up'}
holds={h:{'reason':'Existing-user evidence; not eligible for cold first contact','board_status':board.get(h,{}).get('status'),'pipeline_block_present':h in contacts} for h in sorted(existing)}
report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'board_observed_at':board_observation['observed_at'],
 'operational_owner':'Claude Acquisition Board database','migration_safe':False,
 'coverage':'Visible prospect table only. Complete drafts, events, conversations, assignments and native IDs have not been exported.',
 'counts':{'board':len(board),'master':len(master),'pipeline':len(pipeline),'pipeline_version':version,'dossiers':len(dossiers),'send_log_rows':len(sends),'explicit_sent_rows':len(sent),'pipeline_contact_blocks':len(contacts)},
 'board_not_master':sorted(set(board)-set(master)),'master_not_board':sorted(set(master)-set(board)),
 'board_not_pipeline':sorted(set(board)-set(pipeline)),'dossiers_not_board':sorted(set(dossiers)-set(board)),
 'existing_user_holds':holds,'sent_not_marked_on_board':[r['handle'] for r in sent if board.get(norm(r['handle']),{}).get('status') not in ('Sent','Replied','Signed up')],
 'duplicate_master_handles':len(master_rows)-len(master),'duplicate_pipeline_handles':len(pipeline_rows)-len(pipeline),
 'source_hashes':{str(p.relative_to(V)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [board_file,O/'MASTER-LIST.csv',O/'SEND-LOG.csv',pipeline_file,A/'data/dossiers.json',A/'contacted.txt']}}
out=O/'automation/acquisition-reconciliation-20260930.json';out.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'counts':report['counts'],'existing_user_holds':holds,'migration_safe':False},indent=2))
