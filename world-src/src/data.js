// ============================================================================
// COOPER DELO — full content inventory, lifted from the live site so the 3D
// world can render every artifact in-world (nothing links out to a flat page).
// Sourced from index / plugverse / rubber-band / athletic / lens / now .html.
// ============================================================================

export const P = '/photos/';
export const V = '/videos/';
// 800px thumbnails used for in-world textures (keeps GPU memory sane; originals
// are only loaded by the DOM lightbox). See public/thumbs.
export const T = import.meta.env.BASE_URL + 'thumbs/';
export const thumb = (name) => T + name.replace(/\.(jpe?g|png|JPG)$/i, '.jpg');

// Brand accents per section/room.
export const ACCENTS = {
  HOME: '#E8DCC6', PLUGVERSE: '#FF8A3D', MUSIC: '#FF4D2E',
  ATHLETIC: '#9FC9C7', LENS: '#E7C9A0', NOW: '#8FA382'
};

export const CONTACT = {
  email: 'cooperdelo6@gmail.com',
  gmail: 'https://mail.google.com/mail/?view=cm&fs=1&to=cooperdelo6@gmail.com',
  linkedin: 'https://www.linkedin.com/in/cooperdelo/',
  instagram: 'https://instagram.com/cooperdelo',
  tiktok: 'https://tiktok.com/@cooperdelo',
  location: 'Chapel Hill, NC'
};

// HOME is NOT a record/room — the studio hub IS home. Its identity content is
// surfaced directly in the hub (manifesto sign, facts, portraits, contact).
export const HOME = {
  key: 'HOME', accent: ACCENTS.HOME, eyebrow: 'cooper delo',
  blurb: 'Sophomore at UNC Kenan-Flagler, solo founder of Plugverse, bassist, photographer, lifter. Build it, ship it, run it back.',
  manifesto: ['Build. Ship.', 'Learn what hit.', 'Run it back.'],
  facts: [
    ['Age', '20 · Chapel Hill'], ['School', 'UNC Kenan-Flagler'], ['Majors', 'Business + CS'],
    ['GPA', '3.867'], ['Building', 'Plugverse'], ['Abroad', 'Singapore · Spring 2027']
  ],
  roles: ['Builder.', 'Founder.', 'Musician.', 'Student.', 'Writer.'],
  portraits: ['cooper_park_portrait.jpg', 'cooper_suit_campus.jpg', 'cooper_tux_with_canon.jpg',
    'cooper_with_guitar_outdoor.jpg', 'cooper_laughing_with_bass.jpg', 'hs_grad.jpg', 'front-page-hero.jpg']
};

// The 5 records on the shelf. `cover` is the sleeve art; `blurb` is the
// hover/description card; `room` picks which built environment you drop into.
export const SECTIONS = [
  {
    key: 'PLUGVERSE', room: 'office', accent: ACCENTS.PLUGVERSE, eyebrow: 'the startup',
    cover: 'Plugverse_picture.jpeg',
    blurb: 'A three-sided marketplace for local music — artists, venues, organizers. Built solo. $20K Luby Pitch, 0% equity. Live at plugverse.app.',
    tagline: 'The marketplace for local artists, venues, and organizers.',
    stats: [['Founded', 'Dec 2025'], ['Form', 'NC LLC'], ['Built by', 'Cooper, solo'],
      ['Stack', 'Next · Supabase · Stripe'], ['Raised', '$21,850'], ['Equity given', '0%'], ['Status', 'Live']],
    story: [
      { h: 'The problem', t: 'Every gig starts from scratch. Bio rewritten. Setlist re-attached. Rate re-explained. Contract copy-pasted from a Google Doc. No LinkedIn for local music.' },
      { h: 'The analogy', t: 'Rooms existed before Airbnb. What didn’t exist was the layer that made it standard. Local music has the same gap. Plugverse is the layer.' },
      { h: 'What it is', t: 'Artists list availability + rate. Venues post stages + dates. Organizers book in one flow. Contract auto-generated, payment in escrow until the show is done.' },
      { h: 'The artist profile', t: 'Every artist gets plugverse.app/their-name. Bio, samples, setlists, rates, calendar, instant book. Send the link instead of the twenty-minute pitch.' },
      { h: 'How a booking happens', t: 'An organizer drafts a direct offer with time, role, and budget. The contract auto-fills from the profile. Sign, hold payment in escrow, done.' }
    ],
    kiosks: [
      { role: 'Artists', h: 'One profile, every gig', t: 'Bio, setlist, rate, samples, dates. Send the link instead of the pitch.' },
      { role: 'Venues', h: 'Fill the calendar', t: 'Post the room, the date, the budget. Discoverable to every artist on the platform.' },
      { role: 'Organizers', h: 'Book end-to-end', t: 'Search, offer, sign, pay. One flow. Contract and escrow handled.' }
    ],
    wins: [['$20K', 'Luby Pitch · Innovate Carolina', 'Apr 2026'],
      ['$1.85K', '1789 Student Venture Fund', '2025'], ['LLC', 'Plugverse LLC · NC', 'Mar 2026']],
    closing: 'I play in a band. I plan events for my fraternity. I build the product myself. I live on all three sides of the marketplace.',
    photos: ['Plugverse_picture.jpeg', 'plugverse_profile.jpg', 'luby_pic_with_check.jpg', 'plugverse_merch.jpg', 'plugverse-background.jpg'],
    reels: ['plugverse_ui.mp4', 'hero_plugverse_product.mov'],
    links: [['plugverse.app', 'https://plugverse.app']],
    embeds: []
  },
  {
    key: 'MUSIC', room: 'liveroom', accent: ACCENTS.MUSIC, eyebrow: 'bass · Cooper Delo',
    cover: 'flicker_of_time_ep_cover.jpg',
    blurb: 'Bass in the 5-piece cover band Rubber Band, and originals as Cooper Delo — 34,000+ streams across alt-rock, dream-pop, indie-rap. 45-song set learned in eight weeks.',
    bandStats: [['Per gig', '$1k–$1.8k'], ['Per member', '$200–$360'], ['Cooper', 'Bass'], ['Circuit', 'UNC · NCSU · ECU']],
    lineup: [
      ['Bass', 'Cooper', 'Sophomore · Chi Phi', true], ['Lead Guitar', 'Jackson', 'Senior · Sig Chi', false],
      ['Vocals', 'Stewart', 'Senior · Chi Phi', false], ['Rhythm Guitar', 'Nick', 'Senior · Chi Phi', false],
      ['Drums', 'Ben', 'Senior · Pi Kapp', false]
    ],
    soloStats: [['DAW', 'Ableton Live'], ['Streams', '34,000+'], ['Sound', 'Alt-rock dream-pop']],
    influences: ['Smashing Pumpkins', 'Tame Impala', 'Dominic Fike', 'Phoebe Bridgers', 'Radiohead', 'Beabadoobee'],
    rig: [
      { badge: 'Bass · live', name: 'Epiphone Embassy', img: 'gear-rig-bass.jpg', specs: [['Body', 'Mahogany · SlimTaper'], ['Pickups', '2 × ProBucker'], ['Scale', '34"'], ['Tuning', 'Standard E']] },
      { badge: 'Electric', name: 'PRS Custom 24-08', img: 'gear-rig-prs.jpg', specs: [['Body', 'Mahogany · maple top'], ['Pickups', '85/15 humbuckers'], ['Switching', '3-way + 2 push-pull'], ['Bridge', 'PRS Tremolo']] },
      { badge: 'Acoustic', name: 'Takamine GN51CE', img: 'gear-rig-takamine.jpg', specs: [['Shape', 'NEX cutaway'], ['Top', 'Solid spruce'], ['Back', 'Mahogany'], ['Preamp', 'TK-40D']] },
      { badge: 'Bass amp', name: 'Fender Rumble 500', img: 'gear-rig-amp.jpg', specs: [['Power', '500W'], ['Speaker', '2 × 10"'], ['DI', 'Built-in XLR'], ['Ver', 'v3']] },
      { badge: 'Guitar amp', name: 'Marshall DSL40CR', img: 'gear-rig-marshall.jpg', specs: [['Power', '40W tube'], ['Tubes', 'EL34 · ECC83'], ['Speaker', '12" Celestion'], ['FX', 'Reverb · loop']] },
      { badge: 'Multi-FX', name: 'Line 6 POD Go', img: 'gear-rig-pedals.jpg', specs: [['Type', 'Multi-FX floor'], ['DSP', 'HX modeling'], ['Out', 'XLR · 1/4" · USB'], ['IRs', 'Custom cab']] },
      { badge: 'Interface', name: 'Focusrite Scarlett 2i2', img: 'gear-studio-interface.jpg', specs: [['Inputs', '2 × XLR/TRS'], ['Res', '24-bit · 192kHz'], ['Preamps', '3rd-gen'], ['Conn', 'USB-C']] },
      { badge: 'MIDI', name: 'AKAI MPK Mini', img: 'gear-studio-midi.jpg', specs: [['Keys', '25 mini'], ['Pads', '8 MPC'], ['Knobs', '8 assignable'], ['Power', 'USB-C']] },
      { badge: 'Mic', name: 'sE Electronics sE2200', img: 'gear-studio-mic.jpg', specs: [['Type', 'Cardioid condenser'], ['Capsule', '1" gold'], ['SPL', '130dB'], ['Filter', '100Hz HP']] },
      { badge: 'Monitoring', name: 'Beyerdynamic DT 770', img: 'gear-studio-headphones.jpg', specs: [['Type', 'Closed-back'], ['Imp', '80Ω'], ['Range', '5Hz–35kHz'], ['Use', 'Tracking']] }
    ],
    concerts: [
      { artist: 'Pearl Jam', tag: 'Grunge / Stadium', date: 'May 13, 2025', venue: 'Dark Matter Tour', img: 'concert_pearl_jam_may2025.jpg', blurb: 'Two encores. The room dimmed to a single light on ‘Black.’ Vedder still has the back of every front-row seat.' },
      { artist: 'Coldplay', tag: 'Anthem / Spectacle', date: 'Summer 2024', venue: 'Music of the Spheres', img: 'concert_coldplay.jpg', blurb: 'Synchronized wristbands turned the stadium into one organism. Best argument for pop scale as its own art form.' },
      { artist: 'Foo Fighters', tag: 'Rock / 3-hour set', date: 'Summer 2024', venue: 'PNC Pavilion · Charlotte', img: 'concert_foo_fighters_pnc.jpg', blurb: 'Three hours, no opener. Grohl pulled a kid up to play ‘My Hero’ and didn’t lower the bar.' },
      { artist: 'The Backseat Lovers', tag: 'Indie folk', date: 'Fall 2024', venue: 'The Fillmore · Charlotte', img: 'concert_backseat_lovers_fillmore.jpg', blurb: 'Everyone singing ‘Kilby Girl’ loud enough that the band could’ve stopped playing.' },
      { artist: 'Zach Bryan', tag: 'Country folk / Outdoor', date: 'Summer 2024', venue: 'Credit One · Charleston', img: 'concert_zach_bryan_charleston.jpg', blurb: '30,000 people in cowboy boots remembering they could feel something. Lowcountry sunset doing half the work.' },
      { artist: 'Vance Joy', tag: 'Indie pop / Folk', date: 'Spring 2024', venue: 'The Fillmore · Charlotte', img: 'concert_vance_joy_fillmore.jpg', blurb: '‘Riptide’ hits different in a 2,000-cap room. The crowd finished the chorus for him.' },
      { artist: 'Red Hot Chili Peppers', tag: 'Funk rock / First stadium', date: '2023', venue: 'BofA Stadium · Charlotte', img: 'concert_rhcp_bofa.jpg', blurb: 'First stadium show I ever saw. Frusciante back. The bassline that’s the reason I picked up the instrument.' },
      { artist: 'Keshi', tag: 'Bedroom pop / R&B', date: '2023', venue: 'The Fillmore · Charlotte', img: 'concert_keshi_fillmore.jpg', blurb: 'Dream-pop ceiling, the venue washed in red. Bedroom-pop production filling out into something arena-shaped.' },
      { artist: 'Smashing Pumpkins', tag: 'Alt rock / Direct influence', date: '2024', venue: 'World is a Vampire', img: 'concert_smashing_pumpkins.jpg', blurb: 'Direct influence on the Cooper Delo sound. ‘1979’ through a wall of cabs is its own genre.' }
    ],
    photos: ['flicker_of_time_ep_cover.jpg', 'gig_rubber_big_stage_1.jpg', 'gig_rubber_big_stage_2.jpg', 'gig_rubber_big_stage_3.jpg',
      'gig_rubber_bass_bw.jpg', 'gig_rubber_outdoor_deck.jpg', 'gig_rubber_tent_purple.jpg', 'gig_rubber_toga_bw.jpg',
      'gig_rubber_wedding_lineup.jpg', 'gig_rubber_wedding_bass_close.jpg', 'solo_cooper_bass.jpeg', 'bobs_bar_gig_pic.jpeg',
      'concert_rubber_band_live.jpg', 'rubber_band_full_pic.jpeg', 'recording_studio.jpg', 'studio_recording_session.jpg',
      'guitar_portrait_playing.jpeg', 'cooper_with_guitar_outdoor.jpg'],
    reels: ['rubber_band_live_4.mov', 'cat_cradle_performance.mov'],
    hero_video: 'whole band rubber vid.MOV',
    embeds: [
      { kind: 'spotify', label: 'The setlist', url: 'https://open.spotify.com/embed/playlist/1e8B61S0vylDgN4fsHrl3K' },
      { kind: 'spotify', label: 'Cooper Delo — album', url: 'https://open.spotify.com/embed/album/0cqBE506nUTMvdZqafXOPz' },
      { kind: 'spotify', label: 'Cooper Delo — album', url: 'https://open.spotify.com/embed/album/5kVO52fF80upZVRJlc84SO' }
    ],
    links: [['Artist on Spotify', 'https://open.spotify.com/artist/5ADdu7EYmsFlIUPrH5azhc'], ['Apple Music', 'https://music.apple.com/artist/cooper-delo']]
  },
  {
    key: 'ATHLETIC', room: 'gym', accent: ACCENTS.ATHLETIC, eyebrow: 'lifting · golf · board',
    cover: 'golf_swing_finish.jpg',
    blurb: 'PPL five days a week, golf on the weekends, snowboarding in season. A hole-in-one on a par 4 to prove the range card wrong.',
    iron: {
      lede: 'PPL split, five days a week, no skipping. I lift to stay lean, not bulk. Cutting 168 → 162 at ~12% body fat. Discipline is the input; the version of me that shows up clear-headed is the product.',
      stats: [['Split', 'Push Pull Legs'], ['Frequency', '5 days / wk'], ['Current', '168 lbs cutting'], ['Target', '162 / 12% BF']],
      photos: ['iron_pic_1.jpg', 'iron_pic_2.jpg']
    },
    golf: {
      lede: 'Golf is the hobby. 3–4 rounds a month when school and Plugverse let me. Not chasing scratch — chasing four hours off the clock. It clears my head better than anything.',
      stats: [['Rounds / mo', '3–4'], ['Why', 'Head reset'], ['Stakes', 'None'], ['Bag', 'Titleist']],
      photos: ['hole_in_one_par_4.JPG', 'golf_portrait.jpg', 'golf_swing_finish.jpg', 'golf_course.jpg'],
      bag: [
        { badge: 'Driver', name: 'Titleist TSi3', img: 'gear-golf-driver.jpg', specs: [['Head', 'TSi3 · 9°'], ['Shaft', 'Tensei AV Raw'], ['Grip', 'Tour Velvet'], ['Loft', 'SureFit adj']] },
        { badge: 'Irons', name: 'Titleist T100', img: 'gear-golf-iron.jpg', specs: [['Set', '4 to PW'], ['Build', 'Forged 1025'], ['Shafts', 'AMT Tour White'], ['Lie', 'Standard']] },
        { badge: 'Putter', name: 'Spider GT', img: 'gear-golf-putter.jpg', specs: [['Head', 'Mallet'], ['Face', 'Pure Roll'], ['Length', '34"'], ['Sight', 'Single line']] },
        { badge: 'Bag', name: 'Titleist Players', img: 'gear-golf-bag.jpg', specs: [['Type', 'Stand bag'], ['Top', '4-way'], ['Pockets', '7'], ['Strap', 'Double']] }
      ]
    },
    photos: ['snowboard_athletics.jpg', 'iron_pic_1.jpg', 'iron_pic_2.jpg', 'hole_in_one_par_4.JPG', 'golf_portrait.jpg', 'golf_swing_finish.jpg', 'golf_course.jpg'],
    reels: ['golf_swing_iron.mov', 'golf_swing_driver.mov', 'iron_swing_2.mov', 'driver_swing_golf_2.mov'],
    embeds: []
  },
  {
    key: 'LENS', room: 'darkroom', accent: ACCENTS.LENS, eyebrow: 'photography',
    cover: 'cooper_tux_with_canon.jpg',
    blurb: 'I shoot what I want to remember — the songs, the places, the rooms before they emptied. Shot on a Canon S100, an iPhone 17 Pro through a Moment VND, DJI Mic for sound.',
    manifesto: 'A lens is just a tool for paying attention. Capture it while it’s hot. Cut it before it cools. Run it back.',
    trips: [
      { name: 'Carmel', place: 'Carmel, CA', meta: 'March 2025 · 4 days · 36.55N 121.92W', cover: 'front-page-hero.jpg',
        blurb: 'Drove the Pacific Coast on a stretch off school. Carmel-by-the-Sea, the Big Sur cliff turn, the redwoods. The kind of trip that resets how you frame everything else.',
        gallery: ['carmel_trip_2.jpg', 'carmel_trip_3.jpg', 'santa_cruz_coast.jpg', 'carmel_trip_4.jpg', 'front-page-hero.jpg'] },
      { name: 'Thailand', place: 'Bangkok, Thailand', meta: 'December 2024 · 10 days · 13.75N 100.50E', cover: 'thailand_trip_3.jpg',
        blurb: 'The longest haul I’ve taken. Bangkok by canal boat, temples older than anything I’d walked through. Half the photos came off a film camera — grain baked in.',
        gallery: ['thailand_trip_1.jpg', 'thailand_trip_2.jpg', 'thailand_trip_canal_house.jpg', 'thailand_trip_wat_arun.jpg', 'thailand_trip_canal_water.jpg', 'thailand_trip_bangkok_skyline.jpg', 'thailand_trip_4.jpg'] },
      { name: 'Ireland', place: 'Ireland', meta: 'Summer 2023 · 9 days · 53.41N 8.24W', cover: 'ireland_trip_1.jpg',
        blurb: 'Loop drive: Cliffs of Moher, the Burren, west to Galway. Pubs that didn’t bother with menus and a coastline that does the talking.',
        gallery: ['ireland_trip_2.jpg', 'ireland_trip_3.jpg', 'ireland_trip_4.jpg', 'ireland_trip_5.jpg', 'ireland_trip_6.jpg'] },
      { name: 'Cancún', place: 'Cancún, Mexico', meta: 'Spring 2024 · 5 days · 21.16N 86.85W', cover: 'cancun_trip_1.jpg',
        blurb: 'Spring break with friends. Caribbean blue you don’t believe is real until your feet are in it.',
        gallery: ['cancun_trip_2.jpg'] },
      { name: 'London', place: 'London, UK', meta: '2023 · 6 days · 51.51N 0.13W', cover: 'london_trip_1.jpg',
        blurb: 'Walked it more than rode it. The Thames at dusk, the tube map memorized by day three.',
        gallery: ['london_trip_2.jpg'] },
      { name: 'Panama', place: 'Panama', meta: '2024 · 7 days · 8.98N 79.51W', cover: 'panama_trip_1.jpg',
        blurb: 'Panama City and out toward the coast. The canal at full scale once you’re standing next to it.',
        gallery: ['panama_trip_2.jpg'] }
    ],
    kit: [
      { badge: 'Daily carry', name: 'iPhone 17 Pro', img: 'gear-camera-iphone.jpg', specs: [['Case', 'Moment'], ['Filter', 'Moment VND'], ['Format', 'ProRAW · 4K60']] },
      { badge: 'Pocket digital', name: 'Canon S100', img: 'gear-camera-canon.jpg', specs: [['Sensor', '12.1 MP'], ['Lens', 'f/2.0'], ['Mode', 'RAW · 1080p']] },
      { badge: 'Glass', name: 'Moment VND', img: 'gear-camera-vnd-filter.jpg', specs: [['Type', 'ND 2-5'], ['Mount', 'M-Series'], ['Use', 'Cinematic']] },
      { badge: 'Audio', name: 'DJI Mic', img: 'gear-camera-dji-mic.jpg', specs: [['Channels', '2 TX'], ['Range', '250m'], ['Rec', '8GB']] }
    ],
    reels: [
      { v: 'cat_cradle_performance.mov', poster: 'cooper_laughing_with_bass.jpg', label: 'LIVE' },
      { v: 'coldplay_crowd.mov', poster: 'concert_coldplay.jpg', label: 'CROWD' },
      { v: 'golf_swing_iron.mov', poster: 'golf_portrait.jpg', label: 'SWING' },
      { v: 'studio_overview.mov', poster: 'recording_studio.jpg', label: 'STUDIO' }
    ],
    replay: [['replay/replay-2026-03.jpg', 'March 2026'], ['replay/replay-2026-02.jpg', 'February 2026'], ['replay/replay-2026-01.jpg', 'January 2026']],
    photos: ['cooper_tux_with_canon.jpg', 'landscape_house_view_1.jpg', 'landscape_house_view_2.jpg'],
    embeds: [{ kind: 'apple', label: 'In rotation · Replay 2026', url: 'https://embed.music.apple.com/us/playlist/replay-2026/pl.rp-wPOOu13GPp42' }],
    links: [['@cooperdelo on Instagram', 'https://instagram.com/cooperdelo'], ['on TikTok', 'https://tiktok.com/@cooperdelo']]
  },
  {
    key: 'NOW', room: 'warroom', accent: ACCENTS.NOW, eyebrow: 'currently',
    cover: 'cooper_suit_campus.jpg',
    blurb: 'Closing the last P1 bugs in the booking flow, Stripe Connect going live, prepping the Truist internship and a semester in Singapore, keeping the GPA up.',
    refreshed: 'Last refreshed Monday, April 27, 2026',
    lede: 'Truist internship starts May 27. Plugverse v2 push and SOC II prep through summer.',
    countdown: { label: 'Truist start · May 27, 2026', target: '2026-05-27T09:00:00' },
    nowList: [
      ['this wk', 'Plugverse v2: search ranking + organizer dashboard'],
      ['this wk', 'Stripe Connect dispute flow + escrow edge cases'],
      ['this wk', 'Truist onboarding prep, starts May 27'],
      ['soon', 'Rubber Band summer setlist refresh: 8 new songs']
    ],
    stats: [['Training', '5-day PPL split'], ['Q2 priority', 'Plugverse launch'], ['Reading list', 'Agent fills weekly']],
    note: 'This page is rewritten every Monday by a scheduled agent in my vault. If it looks stale, the agent broke. The cure is usually coffee.',
    photos: ['workspace_studio_desk.jpg', 'cooper_suit_campus.jpg', 'plugverse_profile.jpg'],
    embeds: []
  }
];

export const sectionByKey = (k) => SECTIONS.find(s => s.key === k);
