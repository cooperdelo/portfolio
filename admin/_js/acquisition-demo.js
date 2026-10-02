// Local design preview only (?demo on localhost). Every act, person and number here is invented.
const now = Date.now(), iso = (h) => new Date(now - h * 3.6e6).toISOString();
const acts = [
  ['the_paper_lanterns', 'The Paper Lanterns', 'high_fit', 'Raleigh, NC\nindie rock · dm for booking', 'Booking phrase in bio; band; Triangle', 1240, 'Fri 10/3, your account'],
  ['harbor.static', 'Harbor Static', 'high_fit', 'durham four piece\nshows: harborstaticband@gmail.com', 'Own mailbox in bio; recent gig posts', 812, 'Fri 10/3, your account'],
  ['velvetcartographers', 'Velvet Cartographers', 'gigging', 'chapel hill surf rock 🌊', 'Gig flyer two weeks ago; no booking line', 2310, 'Fri 10/3, PlugVerse account'],
  ['moth_and_lantern', 'Moth & Lantern', 'high_fit', 'greensboro folk duo\nbooking: dm us', 'Booking phrase in bio; duo counted as band', 640, 'Next'],
  ['lowtide.collective', 'Lowtide Collective', 'solo_fit', 'songwriter. wilmington. available for bookings', 'Solo act, books herself', 3020, 'Next'],
  ['circuitbreakersnc', 'Circuit Breakers', 'review', 'covers + originals', 'Mixed signals: no area named', 455, 'Ask Cooper first'],
  ['djnightowl_demo', 'DJ Night Owl', 'dj_pilot', 'wedding + campus events\nbook now', 'DJ under 50k, books himself', 1890, 'Next week pool'],
];
const db = {
  connection: { state: 'connected', owner: 'Demo data' },
  me: { email: 'cooper@example.invalid', role: 'full', name: 'Cooper' },
  capabilities: { read: true, write: true, approve: true },
  leads: acts.map(([handle, name, bucket, bio, reason, followers, queue_day], i) => ({
    handle, name, bucket, bio, reason, followers, queue_day, queue_order: i, platform: 'instagram', area: 'triangle', status: i === 6 ? 'contacted' : 'new',
    draft_verdict: i === 1 ? 'approved' : i === 6 ? 'approved' : null, finder_verdict: i < 2 ? 'right' : null, last_post: '2026-09-2' + (i % 9),
    draft_text: `hey, came across ${name.toLowerCase()} while looking at nc shows. i play in a band in chapel hill and built plugverse for our gigs. here's ours if you want to see it: plugverse.app/a/rubberband, and you can make yours here: plugverse.app/?s=dm`,
    owner: i % 2 ? 'Karthik' : 'Cooper', notes: '', updated_at: iso(i + 2), updated_by: i % 3 ? 'cooper@example.invalid' : 'karthik@example.invalid',
  })),
  conversations: [
    { id: 'c1', at: iso(20), by_email: 'karthik@example.invalid', by_name: 'Karthik', name: 'Sunroom Radio', handle: 'sunroomradio', kind: 'Artist on PlugVerse', channel: 'Call', date: '2026-10-01', outcome: 'Wants help setting up', quote: 'we mostly book through instagram and it gets messy when two people answer', notes: 'Hasn\'t sent the link to anyone yet. Wants to see an example offer.', tags: ['Setup was confusing', 'Wants a call'], next_step: 'Send an example offer', next_date: '2026-10-03' },
  ],
  activity: [
    { at: iso(1), by_email: 'cooper@example.invalid', by_name: 'Cooper', kind: 'draft_approved', handle: 'harbor.static', detail: '' },
    { at: iso(3), by_email: 'karthik@example.invalid', by_name: 'Karthik', kind: 'sent', handle: 'djnightowl_demo', detail: '' },
    { at: iso(5), by_email: 'cooper@example.invalid', by_name: 'Cooper', kind: 'finder_right', handle: 'the_paper_lanterns', detail: '' },
    { at: iso(20), by_email: 'karthik@example.invalid', by_name: 'Karthik', kind: 'conversation', handle: 'sunroomradio', detail: 'Sunroom Radio' },
  ],
  drafts: {}, lanes: [],
  runs: [{ date: '2026-09-27', source: 'Instagram hashtags (demo)', pulled: 120, high_fit: 6, right: 5, spend_usd: 0.31, note: '' }],
  artists: { pulled_at: 'demo', rows: [{ id: 'a1', name: 'Sunroom Radio', city: 'Durham', signed_up: '2026-09-24', links_sent: 1, requests_in: 0, instagram: 'sunroomradio' }, { id: 'a2', name: 'Glass Pastures', city: 'Raleigh', signed_up: '2026-09-26', links_sent: 0, requests_in: 0, instagram: '' }] },
  tags: ['Setup was confusing', "Doesn't see the point yet", 'Already has a system', 'Wants a feature', 'Worried about cost', "Worried it's a scam", 'Likes the booking link', 'Will put the link in bio', 'Got a request through it', 'Booked through it', 'Wants a call'],
};
export async function handle(method, body) {
  if (method === 'GET') return structuredClone(db);
  const t = new Date().toISOString();
  if (body.op === 'lead.update') {
    const l = db.leads.find((x) => x.handle === body.handle);
    Object.assign(l, body.patch, { updated_at: t, updated_by: db.me.email });
    if (body.patch.draft_verdict === 'approved' && l.status === 'new') l.status = 'approved';
    return { lead: structuredClone(l) };
  }
  if (body.op === 'lead.add') { const l = { ...body.lead, bucket: 'review', status: 'new', followers: 0, reason: 'added by hand, not scored', updated_at: t, updated_by: db.me.email }; db.leads.push(l); return { lead: l }; }
  if (body.op === 'conversation.add') { const c = { ...body.conversation, id: 'c' + Math.random(), at: t, by_email: db.me.email, by_name: 'Cooper' }; db.conversations.unshift(c); return { conversation: c }; }
  throw Object.assign(Error('Unknown change'), { status: 400 });
}
