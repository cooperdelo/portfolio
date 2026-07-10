import { create } from 'zustand';

// Global experience state. `phase` drives the transition; `shown` is which
// scene is actually mounted (flips at the midpoint of the needle-drop so the
// swap happens under the overlay).
export const useStore = create((set, get) => ({
  phase: 'idle',        // 'idle' | 'dropping' | 'inroom' | 'returning'
  shown: 'hub',         // 'hub' | section key
  room: 'hub',
  section: null,        // SECTIONS entry being visited
  hovered: null,
  lightbox: null,       // { src, caption } | null
  soundOn: false,
  ready: false,
  roomView: 'front',    // 'left' | 'front' | 'right' — which wall the camera faces

  setReady: (v) => set({ ready: v }),
  setHovered: (h) => set({ hovered: h }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  setRoomView: (v) => set({ roomView: v }),

  dive: (section) => { if (get().phase === 'idle') set({ phase: 'dropping', section, roomView: 'front' }); },
  voidScene: () => set({ shown: 'void' }),   // brief empty frame under the overlay so scenes never coexist in GPU memory
  swapToRoom: () => set((s) => ({ shown: s.section ? s.section.key : 'hub' })),
  finishDrop: () => set((s) => ({ phase: 'inroom', room: s.section ? s.section.key : 'hub' })),

  returnToHub: () => { if (get().phase === 'inroom') set({ phase: 'returning', lightbox: null }); },
  swapToHub: () => set({ shown: 'hub' }),
  finishReturn: () => set({ phase: 'idle', room: 'hub', section: null, roomView: 'front' }),

  // jump straight from one room to another (via the crate) — works from the
  // hub AND from inside any room (the old idle-gate silently dropped clicks).
  jumpTo: (section) => {
    const p = get().phase;
    if (p !== 'idle' && p !== 'inroom') return;
    set({ phase: 'dropping', section, roomView: 'front', lightbox: null });
  },

  // Accepts either (src, caption) for photos or a rich object
  // { src, title, meta:[[k,v]], blurb, kind:'album'|'photo', accent } for posters.
  openLightbox: (a, b) => set({ lightbox: (a && typeof a === 'object') ? a : { src: a, caption: b } }),
  closeLightbox: () => set({ lightbox: null })
}));

if (typeof window !== 'undefined') window.__store = useStore;
