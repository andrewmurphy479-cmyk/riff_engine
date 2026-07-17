import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { generateSafe } from "../engine/riff/generate";
import { Feel, Level } from "../engine/riff/rhythm";
import { RiffSpec } from "../engine/riff/spec";

export const GUITAR_KEYS = ["E", "A", "D", "G", "C", "B", "F#"] as const;
export type GuitarKey = (typeof GUITAR_KEYS)[number];

export const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"];

const DEFAULT_KEY: GuitarKey = "E";
const DEFAULT_LEVEL: Level = "intermediate";

const FEELS: readonly Feel[] = ["driving", "laid_back", "heavy", "bouncy"];

function randomKey(): GuitarKey {
  return GUITAR_KEYS[Math.floor(Math.random() * GUITAR_KEYS.length)];
}

function randomFeel(): Feel {
  return FEELS[Math.floor(Math.random() * FEELS.length)];
}

export type LockField = "key" | "feel";

interface LockedFields {
  key: boolean;
  feel: boolean;
}

interface NewRiffState {
  currentRiff: RiffSpec | null;
  key: string;
  feel: Feel | null;
  level: Level;
  tempoOverride: number | null;
  isLooping: boolean;
  showEmbellishments: boolean;
  metronomeEnabled: boolean;
  countInEnabled: boolean;
  lockedFields: LockedFields;
  savedRiffs: RiffSpec[];
  exploreIntroDismissed: boolean;

  generateNewRiff: () => void;
  rerollBar: (barIdx: number) => void;
  setKey: (key: string) => void;
  setFeel: (feel: Feel | null) => void;
  setLevel: (level: Level) => void;
  setTempoOverride: (bpm: number | null) => void;
  setIsLooping: (v: boolean) => void;
  toggleEmbellishments: () => void;
  toggleMetronome: () => void;
  toggleCountIn: () => void;
  toggleLock: (field: LockField) => void;
  toggleSaveCurrent: () => void;
  unsaveRiff: (seed: number) => void;
  dismissExploreIntro: () => void;
}

export const useNewRiffStore = create<NewRiffState>()(
  persist(
    (set, get) => ({
      currentRiff: null,
      key: DEFAULT_KEY,
      feel: null,
      level: DEFAULT_LEVEL,
      tempoOverride: null,
      isLooping: false,
      showEmbellishments: true,
      metronomeEnabled: false,
      countInEnabled: false,
      lockedFields: { key: false, feel: false },
      savedRiffs: [],
      exploreIntroDismissed: false,

      generateNewRiff: () => {
        const { key, feel, level, lockedFields } = get();
        const nextKey = lockedFields.key ? key : randomKey();
        // Feel unlocked + concrete: shuffle. Feel unlocked + null: stay null.
        const nextFeel: Feel | null = lockedFields.feel
          ? feel
          : feel === null
            ? null
            : randomFeel();
        set({
          key: nextKey,
          feel: nextFeel,
          currentRiff: generateSafe({
            key: nextKey,
            feel: nextFeel,
            level,
          }),
        });
      },

      rerollBar: (barIdx) => {
        const { currentRiff, key, feel, level } = get();
        if (!currentRiff) return;
        if (barIdx < 0 || barIdx >= currentRiff.bars.length) return;
        // Bar re-roll preserves the current key regardless of lock — user is
        // targeting this bar, not the whole riff's identity.
        const freshRiff = generateSafe({ key, feel, level });
        if (barIdx >= freshRiff.bars.length) return;
        const newBars = currentRiff.bars.map((bar, i) =>
          i === barIdx ? freshRiff.bars[barIdx] : bar,
        );
        set({ currentRiff: { ...currentRiff, bars: newBars } });
      },

      setKey: (key) => {
        const { feel, level, lockedFields } = get();
        set({
          key,
          lockedFields: { ...lockedFields, key: true },
          currentRiff: generateSafe({ key, feel, level }),
        });
      },

      setFeel: (feel) => {
        const { key, level, lockedFields } = get();
        set({
          feel,
          lockedFields: { ...lockedFields, feel: feel !== null },
          currentRiff: generateSafe({ key, feel, level }),
        });
      },

      setLevel: (level) => {
        const { key, feel } = get();
        set({
          level,
          currentRiff: generateSafe({ key, feel, level }),
        });
      },

      setTempoOverride: (bpm) => {
        set({ tempoOverride: bpm });
      },

      setIsLooping: (v) => {
        set({ isLooping: v });
      },

      toggleEmbellishments: () => {
        set({ showEmbellishments: !get().showEmbellishments });
      },

      toggleMetronome: () => {
        set({ metronomeEnabled: !get().metronomeEnabled });
      },

      toggleCountIn: () => {
        set({ countInEnabled: !get().countInEnabled });
      },

      toggleLock: (field) => {
        const { lockedFields } = get();
        set({
          lockedFields: { ...lockedFields, [field]: !lockedFields[field] },
        });
      },

      toggleSaveCurrent: () => {
        const { currentRiff, savedRiffs } = get();
        if (!currentRiff) return;
        const exists = savedRiffs.some((r) => r.seed === currentRiff.seed);
        const next = exists
          ? savedRiffs.filter((r) => r.seed !== currentRiff.seed)
          : [...savedRiffs, currentRiff];
        set({ savedRiffs: next });
      },

      unsaveRiff: (seed) => {
        const { savedRiffs } = get();
        set({ savedRiffs: savedRiffs.filter((r) => r.seed !== seed) });
      },

      dismissExploreIntro: () => set({ exploreIntroDismissed: true }),
    }),
    {
      name: "riff-engine:saved-riffs:v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedRiffs: state.savedRiffs,
        key: state.key,
        feel: state.feel,
        level: state.level,
        tempoOverride: state.tempoOverride,
        isLooping: state.isLooping,
        showEmbellishments: state.showEmbellishments,
        metronomeEnabled: state.metronomeEnabled,
        countInEnabled: state.countInEnabled,
        lockedFields: state.lockedFields,
        exploreIntroDismissed: state.exploreIntroDismissed,
      }),
      version: 9,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          return {
            savedRiffs: persisted?.savedRiffs ?? [],
            key: DEFAULT_KEY,
            feel: null,
            level: DEFAULT_LEVEL,
            tempoOverride: null,
            isLooping: false,
            lockedFields: { key: false, feel: false },
            exploreIntroDismissed: false,
          };
        }
        if (version < 3) {
          return { ...persisted, isLooping: false, level: DEFAULT_LEVEL };
        }
        if (version < 4) {
          return { ...persisted, level: DEFAULT_LEVEL };
        }
        if (version < 5) {
          return { ...persisted, exploreIntroDismissed: false };
        }
        if (version < 7) {
          return { ...persisted, showEmbellishments: true };
        }
        if (version < 8) {
          const { style: _style, ...rest } = persisted ?? {};
          const {
            style: _styleLocked,
            ...restLocked
          } = rest?.lockedFields ?? { key: false, feel: false };
          return {
            ...rest,
            lockedFields: { key: !!restLocked.key, feel: !!restLocked.feel },
          };
        }
        if (version < 9) {
          return { ...persisted, metronomeEnabled: false, countInEnabled: false };
        }
        return persisted;
      },
    },
  ),
);
