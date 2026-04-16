import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { generate } from "../engine/riff/generate";
import { Feel } from "../engine/riff/rhythm";
import { RiffSpec } from "../engine/riff/spec";

export const GUITAR_KEYS = ["E", "A", "D", "G", "C", "B", "F#"] as const;
export type GuitarKey = (typeof GUITAR_KEYS)[number];

const DEFAULT_KEY: GuitarKey = "E";

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
  tempoOverride: number | null;
  isLooping: boolean;
  lockedFields: LockedFields;
  savedRiffs: RiffSpec[];

  generateNewRiff: () => void;
  rerollBar: (barIdx: number) => void;
  setKey: (key: string) => void;
  setFeel: (feel: Feel | null) => void;
  setTempoOverride: (bpm: number | null) => void;
  setIsLooping: (v: boolean) => void;
  toggleLock: (field: LockField) => void;
  toggleSaveCurrent: () => void;
  unsaveRiff: (seed: number) => void;
}

export const useNewRiffStore = create<NewRiffState>()(
  persist(
    (set, get) => ({
      currentRiff: null,
      key: DEFAULT_KEY,
      feel: null,
      tempoOverride: null,
      isLooping: false,
      lockedFields: { key: false, feel: false },
      savedRiffs: [],

      generateNewRiff: () => {
        const { key, feel, lockedFields } = get();
        const nextKey = lockedFields.key ? key : randomKey();
        // Feel unlocked + concrete value: shuffle through feels.
        // Feel unlocked + null (no preference): stay null; the generator
        // still varies internally, but the UI doesn't flip chips unasked.
        const nextFeel: Feel | null = lockedFields.feel
          ? feel
          : feel === null
            ? null
            : randomFeel();
        set({
          key: nextKey,
          feel: nextFeel,
          currentRiff: generate({ key: nextKey, feel: nextFeel }),
        });
      },

      rerollBar: (barIdx) => {
        const { currentRiff, key, feel } = get();
        if (!currentRiff) return;
        if (barIdx < 0 || barIdx >= currentRiff.bars.length) return;
        // Bar re-roll preserves the current key regardless of lock — user is
        // targeting this bar, not the whole riff's identity.
        const freshRiff = generate({ key, feel });
        if (barIdx >= freshRiff.bars.length) return;
        const newBars = currentRiff.bars.map((bar, i) =>
          i === barIdx ? freshRiff.bars[barIdx] : bar,
        );
        set({ currentRiff: { ...currentRiff, bars: newBars } });
      },

      setKey: (key) => {
        const { feel, lockedFields } = get();
        set({
          key,
          lockedFields: { ...lockedFields, key: true },
          currentRiff: generate({ key, feel }),
        });
      },

      setFeel: (feel) => {
        const { key, lockedFields } = get();
        set({
          feel,
          lockedFields: { ...lockedFields, feel: feel !== null },
          currentRiff: generate({ key, feel }),
        });
      },

      setTempoOverride: (bpm) => {
        set({ tempoOverride: bpm });
      },

      setIsLooping: (v) => {
        set({ isLooping: v });
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
    }),
    {
      name: "riff-engine:saved-riffs:v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedRiffs: state.savedRiffs,
        key: state.key,
        feel: state.feel,
        tempoOverride: state.tempoOverride,
        isLooping: state.isLooping,
        lockedFields: state.lockedFields,
      }),
      version: 3,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          return {
            savedRiffs: persisted?.savedRiffs ?? [],
            key: DEFAULT_KEY,
            feel: null,
            tempoOverride: null,
            isLooping: false,
            lockedFields: { key: false, feel: false },
          };
        }
        if (version < 3) {
          return { ...persisted, isLooping: false };
        }
        return persisted;
      },
    },
  ),
);
