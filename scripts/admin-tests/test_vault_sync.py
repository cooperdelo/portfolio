"""Exercise actual vault sync scripts with isolated files and mocked transport."""
import json, os, subprocess, tempfile, unittest
from pathlib import Path

SOURCE=Path('C:/Users/coope/Desktop/Claude/Scheduled-Tasks/supabase-vault-sync')
REL='Projects/plugverse/outreach/CODING-AGENT-BRIEF-ADMIN-ACQUISITION-2026-09-30.md'
MOCK=r'''
function Invoke-RestMethod {
 param($Uri,$Method,$Headers,$Body)
 $state = Get-Content -LiteralPath $env:SYNC_FIXTURE_STATE -Raw | ConvertFrom-Json
 Add-Content -LiteralPath $env:SYNC_FIXTURE_CALLS -Value $Method
 if ($Method -eq 'Get') { return $state }
 if ($env:SYNC_FIXTURE_CONFLICT -eq '1') { return @() }
 $patch = [Text.Encoding]::UTF8.GetString($Body) | ConvertFrom-Json
 foreach ($p in $patch.PSObject.Properties) { $state | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value -Force }
 $state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $env:SYNC_FIXTURE_STATE
 return $state
}
'''

class SyncTests(unittest.TestCase):
 def run_case(self,script,local,remote,conflict=False,local_new=False,remote_path=REL):
  with tempfile.TemporaryDirectory(prefix='admin-sync-test-') as temp:
   root=Path(temp); disk=root/REL; disk.parent.mkdir(parents=True); disk.write_text(local)
   os.utime(disk,(1800000000,1800000000) if local_new else (1600000000,1600000000))
   envfile=root/'Projects/personal-brand/factory/.env'; envfile.parent.mkdir(parents=True); envfile.write_text('SUPABASE_SERVICE_KEY=fixture-only')
   state=root/'state.json'; state.write_text(json.dumps(dict(path=remote_path,content=remote,direction='in' if script=='push-inputs' else 'out',owner_task='original-owner',updated_at='2026-09-30T12:00:00Z',synced_to_vault_at='2026-09-29T12:00:00Z')))
   calls=root/'calls.txt'
   original=(SOURCE/(script+'.ps1')).read_text(encoding='utf-8-sig')
   original=original.replace("'C:\\Users\\coope\\Desktop\\Claude'", "'"+str(root)+"'")
   (root/'sync-guard.ps1').write_text((SOURCE/'sync-guard.ps1').read_text(),encoding='utf-8-sig')
   copied=root/(script+'.ps1'); copied.write_text(original,encoding='utf-8-sig')
   runner=root/'run.ps1'; runner.write_text(MOCK+f"\n& '{copied}'"+(f" -Auto -OnlyPath '{REL}'" if script=='push-inputs' else '')+'\n',encoding='utf-8-sig')
   env={**os.environ,'SYNC_FIXTURE_STATE':str(state),'SYNC_FIXTURE_CALLS':str(calls),'SYNC_FIXTURE_CONFLICT':'1' if conflict else '0'}
   result=subprocess.run(['powershell','-NoProfile','-ExecutionPolicy','Bypass','-File',str(runner)],env=env,capture_output=True,text=True)
   return result, json.loads(state.read_text(encoding='utf-8-sig')), disk.read_text(), calls.read_text().splitlines()
 def test_unchanged_does_not_write_or_advance_timestamp(self):
  r,state,disk,calls=self.run_case('push-inputs','same','same')
  self.assertIn('UNCHANGED',r.stdout); self.assertEqual(calls,['Get']); self.assertEqual(state['updated_at'],'2026-09-30T12:00:00Z')
 def test_push_preserves_owner_and_verifies(self):
  r,state,disk,calls=self.run_case('push-inputs','new','old')
  self.assertIn('pushed=1 failed=0',r.stdout); self.assertEqual(state['content'],'new'); self.assertEqual(state['owner_task'],'original-owner'); self.assertEqual(calls,['Get','Patch','Get'])
 def test_push_conflict_never_overwrites(self):
  r,state,disk,calls=self.run_case('push-inputs','new','old',conflict=True)
  self.assertIn('Concurrent update detected',r.stdout); self.assertEqual(state['content'],'old')
 def test_pull_reads_back_and_acknowledges(self):
  r,state,disk,calls=self.run_case('pull-outputs','old','new')
  self.assertIn('failed=0',r.stdout); self.assertEqual(disk,'new'); self.assertEqual(calls,['Get','Patch'])
 def test_pull_preserves_local_changes(self):
  r,state,disk,calls=self.run_case('pull-outputs','local edit','remote edit',local_new=True)
  self.assertIn('Local file differs',r.stdout); self.assertEqual(disk,'local edit'); self.assertEqual(calls,['Get'])
 def test_pull_conflict_does_not_acknowledge_newer_cloud(self):
  r,state,disk,calls=self.run_case('pull-outputs','old','new',conflict=True)
  self.assertIn('Cloud changed during pull',r.stdout); self.assertEqual(state['synced_to_vault_at'],'2026-09-29T12:00:00Z')
 def test_pull_refuses_traversal_and_executable_outputs(self):
  for path in ['../escape.md','Context/unsafe.ps1','Context/file.md:stream','Context/alias./file.md']:
   r,state,disk,calls=self.run_case('pull-outputs','original','untrusted',remote_path=path)
   self.assertIn('REFUSED',r.stdout);self.assertEqual(disk,'original');self.assertEqual(calls,['Get'])

if __name__=='__main__': unittest.main()
