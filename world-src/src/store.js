import { create } from 'zustand';

// Global experience state: which room we're in, the transition phase, and the
// active lightbox / inspected artifact. Rooms are entered by "dropping" a record.
export const useStore = create((set, get) => ({
  // 'hub' or a section key (HOME/PLUGVERSE/MUSIC/ATHLETIC/LENS/NOW)
  room: 'hub',
  // 'idle' | 'dropping' | 'inroom' | 'returning'
  phase: 'idle',
  section: null,          // the SECTIONS entry we dove into
  hovered: null,          // key of hovered record (hub) or artifact id
  lightbox: null,         // { src, caption } or null
  soundOn: false,
  ready: false,           // assets warmed / loader done

  setReady: (v) => set({ ready: v }),
  setHovered: (h) => set({ hovered: h }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),

  dive: (section) => {
    if (get().phase !== 'idle') return;
    set({ phase: 'dropping', section });
    // the transition component flips to 'inroom' when the needle lands
  },
  arriveInRoom: () => set((s) => ({ phase: 'inroom', room: s.section.key })),
  returnToHub: () => {
    if (get().phase !== 'inroom') return;
    set({ phase: 'returning', lightbox: null });
  },
  arriveInHub: () => set({ phase: 'idle', room: 'hub', section: null }),

  openLightbox: (src, caption) => set({ lightbox: { src, caption } }),
  closeLightbox: () => set({ lightbox: null })
}));
