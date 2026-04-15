import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { generate } from "../engine/riff/generate";
import { Feel } from "../engine/riff/rhythm";
import { RiffSpec } from "../engine/riff/spec";

interface NewRiffState {
  currentRiff: RiffSpec | null;
  feel: Feel | null;
  savedRiffs: RiffSpec[];

  generateNewRiff: () => void;
  setFeel: (feel: Feel | null) => void;
  toggleSaveCurrent: () => void;
  unsaveRiff: (seed: number) => void;
}

export const useNewRiffStore = create<NewRiffState>()(
  persist(
    (set, get) => ({
      currentRiff: null,
      feel: null,
      savedRiffs: [],

      generateNewRiff: () => {
        const { feel } = get();
        set({ currentRiff: generate({ feel }) });
      },

      setFeel: (feel) => {
        set({ feel, currentRiff: generate({ feel }) });
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
      partialize: (state) => ({ savedRiffs: state.savedRiffs }),
      version: 1,
    },
  ),
);
