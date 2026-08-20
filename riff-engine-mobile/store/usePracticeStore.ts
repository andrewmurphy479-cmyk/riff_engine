import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { generateSafe } from "../engine/riff/generate";
import { Feel, Level } from "../engine/riff/rhythm";
import { RiffSpec } from "../engine/riff/spec";
import {
  MIXED_SET_THEME,
  planSession,
  SessionTheme,
} from "../engine/riff/themes";
import { GUITAR_KEYS } from "./useNewRiffStore";

// ---------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------
// The generator has no genre dimension — its expressive knob is `feel`. Genres
// are a friendlier onboarding vocabulary that we map onto feel. True per-genre
// generation is a future engine project; until then a genre simply *flavors*
// the feel used to seed a user's daily practice.

export interface Genre {
  id: string;
  label: string;
  feel: Feel;
}

export const GENRES: readonly Genre[] = [
  { id: "rock", label: "Rock", feel: "driving" },
  { id: "metal", label: "Metal", feel: "heavy" },
  { id: "blues", label: "Blues", feel: "laid_back" },
  { id: "funk", label: "Funk", feel: "bouncy" },
  { id: "pop", label: "Pop", feel: "bouncy" },
  { id: "indie", label: "Indie", feel: "laid_back" },
];

const FEEL_ORDER: readonly Feel[] = ["driving", "heavy", "bouncy", "laid_back"];

/** Tally the feels of the chosen genres and return the most common (null if none). */
export function derivePreferredFeel(genreIds: string[]): Feel | null {
  const votes = new Map<Feel, number>();
  for (const id of genreIds) {
    const g = GENRES.find((x) => x.id === id);
    if (!g) continue;
    votes.set(g.feel, (votes.get(g.feel) ?? 0) + 1);
  }
  let best: Feel | null = null;
  let bestCount = 0;
  for (const feel of FEEL_ORDER) {
    const count = votes.get(feel) ?? 0;
    if (count > bestCount) {
      best = feel;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Date helpers (local-day based)
// ---------------------------------------------------------------------------

/** Local YYYY-MM-DD for a given date (defaults to now). */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from a -> b (b later = positive). Both are YYYY-MM-DD keys. */
function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.round((db - da) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PracticeProfile {
  level: Level;
  genres: string[];
  preferredFeel: Feel | null;
}

export interface DailySession {
  date: string; // dayKey when built
  /** What today drills. Determined by the date, so a re-roll keeps it. */
  theme: SessionTheme;
  riffs: RiffSpec[];
  completed: boolean[];
  goalCount: number; // riffs needed to "complete" the day
  credited: boolean; // whether this day has been counted toward streak/stats
}

export interface Streak {
  current: number; // consecutive completed days up to lastCompletedDate
  longest: number;
  lastCompletedDate: string | null;
}

export interface PracticeStats {
  totalRiffs: number;
  totalSeconds: number; // accumulated practice time
  daysPracticed: number;
}

const SESSION_RIFF_COUNT = 4;

/**
 * How many times to re-roll a riff that fails its theme's acceptance test.
 * Some themes (legato) can't be expressed as a generator constraint and have to
 * filter after the fact; this bounds the cost of that. On exhaustion we keep
 * the last riff — a slightly off-theme riff beats a missing one.
 */
const THEME_ACCEPT_ATTEMPTS = 10;

/** A theme is only useful if every string the UI renders is actually there. */
function isValidTheme(theme: unknown): theme is SessionTheme {
  if (typeof theme !== "object" || theme === null) return false;
  const t = theme as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.label === "string" &&
    typeof t.blurb === "string" &&
    typeof t.focus === "string"
  );
}

/**
 * Structural check on a persisted session. Sessions persist full RiffSpec
 * blobs, so an engine shape change can strand returning users with specs the
 * app can no longer render. Rather than trusting stored data, anything that
 * doesn't look like a session the *current* engine could have produced is
 * discarded and rebuilt (the day's progress is the only loss).
 */
export function isValidSession(session: unknown): session is DailySession {
  if (typeof session !== "object" || session === null) return false;
  const s = session as Record<string, unknown>;
  if (typeof s.date !== "string") return false;
  if (typeof s.goalCount !== "number" || typeof s.credited !== "boolean") {
    return false;
  }
  if (!isValidTheme(s.theme)) return false;
  if (!Array.isArray(s.completed) || !s.completed.every((c) => typeof c === "boolean")) {
    return false;
  }
  if (!Array.isArray(s.riffs) || s.riffs.length === 0) return false;
  if (s.completed.length !== s.riffs.length) return false;
  return s.riffs.every((riff) => {
    if (typeof riff !== "object" || riff === null) return false;
    const r = riff as Record<string, unknown>;
    if (typeof r.key !== "string" || typeof r.tempo_bpm !== "number") return false;
    if (!Array.isArray(r.bars) || r.bars.length === 0) return false;
    return r.bars.every((bar: unknown) => {
      if (typeof bar !== "object" || bar === null) return false;
      const notes = (bar as Record<string, unknown>).notes;
      if (!Array.isArray(notes)) return false;
      return notes.every(
        (n: unknown) =>
          typeof n === "object" &&
          n !== null &&
          typeof (n as Record<string, unknown>).step === "number" &&
          typeof (n as Record<string, unknown>).duration === "number" &&
          typeof (n as Record<string, unknown>).string === "number" &&
          typeof (n as Record<string, unknown>).fret === "number" &&
          typeof (n as Record<string, unknown>).velocity === "number" &&
          typeof (n as Record<string, unknown>).technique === "string",
      );
    });
  });
}

interface PracticeState {
  onboardingComplete: boolean;
  profile: PracticeProfile | null;
  session: DailySession | null;
  streak: Streak;
  stats: PracticeStats;

  completeOnboarding: (profile: PracticeProfile) => void;
  resetOnboarding: () => void;
  /** Build today's session if missing or stale. No-op if today's already exists. */
  ensureTodaySession: () => void;
  /** Force a brand-new set of riffs for today. */
  regenerateSession: () => void;
  /** Mark one riff in today's session as practiced; credits the day if goal met. */
  markRiffPracticed: (index: number) => void;
  addPracticeSeconds: (seconds: number) => void;
}

function buildSession(profile: PracticeProfile): DailySession {
  const date = dayKey();
  const plan = planSession({
    level: profile.level,
    feel: profile.preferredFeel,
    keys: GUITAR_KEYS,
    count: SESSION_RIFF_COUNT,
    dayKey: date,
  });

  const riffs = plan.plans.map((opts) => {
    let riff = generateSafe(opts);
    if (!plan.accept) return riff;
    for (let i = 0; i < THEME_ACCEPT_ATTEMPTS && !plan.accept(riff); i++) {
      riff = generateSafe({ ...opts, seed: null });
    }
    return riff;
  });

  return {
    date,
    theme: plan.theme,
    riffs,
    completed: riffs.map(() => false),
    goalCount: SESSION_RIFF_COUNT,
    credited: false,
  };
}

const INITIAL_STREAK: Streak = {
  current: 0,
  longest: 0,
  lastCompletedDate: null,
};

const INITIAL_STATS: PracticeStats = {
  totalRiffs: 0,
  totalSeconds: 0,
  daysPracticed: 0,
};

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set, get) => ({
      onboardingComplete: false,
      profile: null,
      session: null,
      streak: INITIAL_STREAK,
      stats: INITIAL_STATS,

      completeOnboarding: (profile) => {
        set({
          profile,
          onboardingComplete: true,
          session: buildSession(profile),
        });
      },

      resetOnboarding: () => {
        set({
          onboardingComplete: false,
          profile: null,
          session: null,
        });
      },

      ensureTodaySession: () => {
        const { profile, session } = get();
        if (!profile) return;
        // Rebuild when stale (new day) OR structurally invalid — a session
        // persisted by an older engine shape must never reach the UI.
        if (session && session.date === dayKey() && isValidSession(session)) {
          return;
        }
        set({ session: buildSession(profile) });
      },

      regenerateSession: () => {
        const { profile } = get();
        if (!profile) return;
        set({ session: buildSession(profile) });
      },

      markRiffPracticed: (index) => {
        const { session, stats, streak } = get();
        if (!session) return;
        if (index < 0 || index >= session.completed.length) return;
        if (session.completed[index]) return; // already done

        const completed = session.completed.slice();
        completed[index] = true;
        const doneCount = completed.filter(Boolean).length;

        let nextStats = { ...stats, totalRiffs: stats.totalRiffs + 1 };
        let nextStreak = streak;
        let credited = session.credited;

        // Credit the day the first time the goal is reached.
        if (!credited && doneCount >= session.goalCount) {
          credited = true;
          const today = dayKey();
          const last = streak.lastCompletedDate;
          const gap = last ? daysBetween(last, today) : null;
          const current = gap === 1 ? streak.current + 1 : 1;
          nextStreak = {
            current,
            longest: Math.max(streak.longest, current),
            lastCompletedDate: today,
          };
          nextStats = { ...nextStats, daysPracticed: nextStats.daysPracticed + 1 };
        }

        set({
          session: { ...session, completed, credited },
          stats: nextStats,
          streak: nextStreak,
        });
      },

      addPracticeSeconds: (seconds) => {
        if (seconds <= 0) return;
        const { stats } = get();
        set({ stats: { ...stats, totalSeconds: stats.totalSeconds + seconds } });
      },
    }),
    {
      name: "riff-engine:practice:v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        onboardingComplete: state.onboardingComplete,
        profile: state.profile,
        session: state.session,
        streak: state.streak,
        stats: state.stats,
      }),
      version: 3,
      migrate: (persisted: any, version: number) => {
        let next = persisted;

        // v3: sessions carry a theme. Backfill the unthemed descriptor onto an
        // otherwise-good session rather than dropping it — this runs mid-day for
        // upgrading users, and losing their progress to a cosmetic field would
        // be a bad trade. Run before v2's validation, which now requires it.
        if (version < 3 && next?.session && !next.session.theme) {
          next = {
            ...next,
            session: { ...next.session, theme: MIXED_SET_THEME },
          };
        }

        // v2: sessions persist engine RiffSpec blobs; validate instead of
        // trusting them. Profile/streak/stats survive; an unparseable session
        // is dropped and rebuilt by ensureTodaySession on next launch.
        if (version < 2) {
          next = {
            ...next,
            session: isValidSession(next?.session) ? next.session : null,
          };
        }

        return next;
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * The streak as it should be *displayed*. The stored `current` count is anchored
 * to lastCompletedDate; a streak stays alive if the last completed day was today
 * or yesterday, otherwise it has lapsed and reads as 0.
 */
export function effectiveStreak(state: PracticeState): number {
  const last = state.streak.lastCompletedDate;
  if (!last) return 0;
  const gap = daysBetween(last, dayKey());
  if (gap <= 0) return state.streak.current; // completed today
  if (gap === 1) return state.streak.current; // completed yesterday, still alive
  return 0; // lapsed
}

/** Whether today's goal has been met. */
export function isTodayComplete(state: PracticeState): boolean {
  const s = state.session;
  if (!s || s.date !== dayKey()) return false;
  return s.completed.filter(Boolean).length >= s.goalCount;
}
