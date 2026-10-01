import {mountShell,isLocalDemo} from '/admin/_shell/admin-shell.js';
import {getSession} from '/admin/_shell/supabase.js';
import {esc} from '/admin/_shell/ui.js';
const ctx=await mountShell({title:'Band media'});
if(ctx.role!=='full'){location.replace('/admin/plugverse/');throw new Error('Personal media access required');}
let source=null;
if(!isLocalDemo()){
 try{const session=await getSession();const response=await fetch('/api/band-media-source',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});if(response.ok)source=await response.json();}catch{}
}
document.querySelector('#band-media').innerHTML=`<header class="ws-head"><span class="ws-kicker">Rubber Band / Media</span><h1>Keep the good moments.</h1><p>Your original gig folders. The shared reviewer is still pending integration.</p></header><section class="ws-card"><span class="ws-state warn">Reviewer not connected</span><h2>Originals in Drive</h2><p>No sharing permissions have been changed. Folder details are loaded only after personal-admin authentication.</p>${source?.folder_url?`<a href="${esc(source.folder_url)}" target="_blank" rel="noopener">Open original folder ?</a>`:'<p>Folder source unavailable in this preview.</p>'}<p class="ws-provenance">A source link does not verify app-level streaming or bandmate permissions.</p></section><section class="ws-card" style="margin-top:20px"><h2>Before shared reviewing works</h2><p>Connect app-level Drive access and verify each bandmate?s access. Then test durable favorites, rejects, comments, video timestamps and separate trimmed exports. Those actions are not available yet.</p><p class="ws-note">Acquisition access does not include this workspace. Original files will remain untouched.</p></section>`;
