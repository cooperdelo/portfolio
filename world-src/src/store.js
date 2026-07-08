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

  setReady: (v) => set({ ready: v }),
  setHovered: (h) => set({ hovered: h }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),

  dive: (section) => { if (get().phase === 'idle') set({ phase: 'dropping', section }); },
  swapToRoom: () => set((s) => ({ shown: s.section ? s.section.key : 'hub' })),
  finishDrop: () => set((s) => ({ phase: 'inroom', room: s.section ? s.section.key : 'hub' })),

  returnToHub: () => { if (get().phase === 'inroom') set({ phase: 'returning', lightbox: null }); },
  swapToHub: () => set({ shown: 'hub' }),
  finishReturn: () => set({ phase: 'idle', room: 'hub', section: null }),

  // jump straight from one room to another (via the crate)
  jumpTo: (section) => { const p = get().phase; if (p === 'idle') set({ phase: 'dropping', section }); },

  openLightbox: (src, caption) => set({ lightbox: { src, caption } }),
  closeLightbox: () => set({ lightbox: null })
}));

if (typeof window !== 'undefined') window.__store = useStore;
