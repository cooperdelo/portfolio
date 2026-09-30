// =====================================================================
// /admin/academics/_js/academics.js
// Degree progress dashboard, source of truth: degree-audit-2026-07-07.
// Data embedded here (updates ~once/semester). Easy to move to Supabase later.
// =====================================================================
import { mountShell } from '/admin/_shell/admin-shell.js';
await mountShell({ title: 'Academics', demo: true });

const DATA = {
  gpa: 3.867, gradTerm: 'Spring 2028',
  creditsDone: 97.5, creditsInProgress: 13.5, creditsTotal: 120, // after Fall 2026 → 111
  programs: [
    { cls:'major', name:'Business Administration', kind:'Major', done:16.5, total:46.5, unit:'hrs',
      note:'Core: 401·405·406·407·408 done · remaining 402/ECON410, 403, 404, 410, 411, 412. Electives 1.5/19.5.' },
    { cls:'cs', name:'Computer Science', kind:'Major → Minor (planned)', done:5, total:6, unit:'courses',
      note:'Minor needs 210·211·301 + two of {311 / COMP 420+}. Have 110·210·211·301·426 → 1 course left, then downgrade major→minor before final audit.' },
    { cls:'music', name:'Music', kind:'Minor', done:9, total:15, unit:'hrs',
      note:'Group 1 ✓ (MUSC 121). Still need a Group-2 course (e.g. MUSC 261) + ~3 more MUSC hrs (a lesson/ensemble counts). ≈2 courses.' },
  ],
  remaining: [
    { t:'BUSI 410, Business Analytics (core; not in Fall ’26!)', h:'3' },
    { t:'BUSI 403 · 402/ECON 410 · 404 · 411 · 412 (remaining core)', h:'~12' },
    { t:'BUSI electives', h:'18' },
    { t:'Gen-ed: Engagement with the Human Past', h:'3' },
    { t:'Gen-ed: Research & Discovery', h:'~3' },
    { t:'CS minor, 1 more (COMP 311 or 420+)', h:'3' },
    { t:'Music minor, Group 2 + ~3 hrs', h:'~6' },
  ],
  terms: [
    { term:'Fall 2026', title:'Junior Fall', state:'enrolled', where:'Chapel Hill',
      courses:[['BUSI 405 Leading & Managing','3'],['BUSI 406 Marketing','3'],['BUSI 408 Corp Finance','3'],['BUSI 608 FinTech','1.5'],['COMP 426 Modern Web','3']] },
    // Singapore exchange CANCELLED (Aug 17 2026, academic owner; playbook "Career facts"
    // row 2026-09-24). Spring 2027 is in Chapel Hill; courses not registered yet.
    { term:'Spring 2027', title:'Junior Spring', where:'Chapel Hill',
      courses:[['Remaining BUSI core + electives','not registered yet']] },
    { term:'Fall 2027', title:'Senior Fall', where:'Chapel Hill',
      courses:[['BUSI 410 Analytics','3'],['BUSI 403 Operations','3'],['BUSI 402 / ECON 410','3'],['BUSI 411 Strategy I','1.5'],['Human Past gen-ed','3'],['CS course (311/420+)','3']] },
    { term:'Spring 2028', title:'Senior Spring · GRAD', where:'Chapel Hill',
      courses:[['BUSI 412 Strategy II (capstone)','3'],['Research & Discovery gen-ed','3'],['Music minor course','3'],['BUSI 404 / elective','1.5–3']] },
  ],
  // Degree numbers come from the 2026-07-07 audit. Rule (admin-stale-sweep 2026-09-28):
  // anything past-dated or older than its cadence is flagged, never shown as current.
  auditDate: '2026-07-07', auditCadenceDays: 150, // re-audit once a semester
};

const el = (h) => { const t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstElementChild; };
const root = document.getElementById('root');

// ---- hero ring ----
const after = DATA.creditsDone + DATA.creditsInProgress;
const pct = Math.round(after / DATA.creditsTotal * 100);
const R=64, C=2*Math.PI*R, off=C*(1-pct/100);
root.appendChild(el(`
<div class="acad-hero">
  <div class="ring-wrap">
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r="${R}" fill="none" stroke="rgba(244,239,230,0.10)" stroke-width="10"/>
      <circle cx="75" cy="75" r="${R}" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 75 75)" id="ring"/>
    </svg>
    <div class="num"><b>${pct}%</b><span>to 120 hrs</span></div>
  </div>
  <div class="hero-facts">
    <div class="fact"><div class="k">Cumulative GPA</div><div class="v">${DATA.gpa}</div></div>
    <div class="fact"><div class="k">Credits</div><div class="v">${after}<small> / ${DATA.creditsTotal} after Fall ’26</small></div></div>
    <div class="fact"><div class="k">Graduation</div><div class="v">${DATA.gradTerm}</div></div>
    <div class="fact"><div class="k">Degree audit</div><div class="v">${new Date(DATA.auditDate+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}<small> · ${Math.round((Date.now()-new Date(DATA.auditDate+'T12:00'))/864e5)}d old${(Date.now()-new Date(DATA.auditDate+'T12:00'))/864e5 > DATA.auditCadenceDays ? ' · re-run audit' : ''}</small></div></div>
  </div>
</div>`));
requestAnimationFrame(()=>{ const r=document.getElementById('ring'); r.style.transition='stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)'; r.style.strokeDashoffset=off; });

// ---- programs ----
const pg = el(`<div class="grid2"></div>`);
DATA.programs.forEach(p=>{
  const pctp = Math.round(p.done/p.total*100);
  pg.appendChild(el(`
  <div class="card prog-card ${p.cls}">
    <div class="htitle"><b>${p.name}</b><span class="badge">${p.kind}</span></div>
    <div class="prog"><div class="bar"><i style="width:${pctp}%"></i></div>
      <div class="pl"><span>${p.done} / ${p.total} ${p.unit}</span><span>${pctp}%</span></div></div>
    <p style="font-size:0.8rem;color:var(--ink-2);margin-top:0.7rem;line-height:1.5;">${p.note}</p>
  </div>`));
});
root.appendChild(el(`<h2 class="section-h">Majors & minors</h2>`));
root.appendChild(pg);

// ---- remaining ----
root.appendChild(el(`<h2 class="section-h">Still to take</h2>`));
const todo = el(`<div class="card"><ul class="acad-todo"></ul></div>`);
const ul = todo.querySelector('ul');
DATA.remaining.forEach(r=> ul.appendChild(el(`<li><span class="chk"></span><span>${r.t}</span><span class="hrs">${r.h} hrs</span></li>`)));
root.appendChild(todo);

// ---- timeline ----
root.appendChild(el(`<h2 class="section-h">The plan · Fall ’26 → Spring ’28</h2>`));
const tl = el(`<div class="timeline"></div>`);
DATA.terms.forEach(t=>{
  const term = el(`<div class="term ${t.abroad?'abroad':''} ${t.state==='enrolled'?'':''}">
    <h4>${t.where}</h4>
    <div class="th ${t.abroad?'abroad-tag':''}">${t.term} · ${t.title}</div>
    <ul>${t.courses.map(c=>`<li><span>${c[0]}</span><span class="cr">${c[1]}</span></li>`).join('')}</ul>
    <div class="st">${t.state==='enrolled'?'● Enrolled':(t.abroad?'✈ Exchange':'○ Planned')}</div>
  </div>`);
  tl.appendChild(term);
});
root.appendChild(tl);

// Study-abroad section removed 2026-09-28: Singapore Spring 2027 was cancelled Aug 17.
