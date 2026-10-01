"""Run a reviewed SQL file against the portfolio admin (never product finance)."""
import argparse, json, os, re
from pathlib import Path
import requests

p = argparse.ArgumentParser()
p.add_argument('sql', type=Path)
p.add_argument('--write', action='store_true')
p.add_argument('--output', type=Path)
a = p.parse_args()
token = os.environ.get('SUPABASE_ACCESS_TOKEN')
if not token:
    source = Path('F:/Github/plugverse/.env.local').read_text()
    token = re.search(r'^SUPABASE_ACCESS_TOKEN\s*=\s*(.+?)\s*$', source, re.M).group(1).strip('\"\'')
r = requests.post('https://api.supabase.com/v1/projects/eibtnkaoqsgwiqttiwjo/database/query',
    headers={'Authorization': 'Bearer '+token},
    json={'query': a.sql.read_text(encoding='utf-8-sig'), 'read_only': not a.write}, timeout=90)
if not r.ok:
    # Database errors contain the reviewed SQL error, never the bearer token.
    raise SystemExit('Database query failed: '+r.text[:1500])
result = json.dumps(r.json(), indent=2)
if a.output:
    a.output.write_text(result, encoding='utf-8')
    print('Saved database result:', a.output)
else:
    print(result)
