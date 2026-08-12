import React, { useCallback, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioEngine } from "../audio/AudioEngine";
import { generateSafe } from "../engine/riff/generate";
import { Feel, Level } from "../engine/riff/rhythm";
import { RiffSpec } from "../engine/riff/spec";
import { riffSpecToEvents } from "../engine/riff/toEvents";
import {
  GENRES,
  derivePreferredFeel,
  usePracticeStore,
} from "../store/usePracticeStore";
import { GUITAR_KEYS, useNewRiffStore } from "../store/useNewRiffStore";
import { borderRadius, colors, spacing, typography } from "../theme/colors";

const LEVEL_OPTIONS: { level: Level; title: string; blurb: string }[] = [
  { level: "beginner", title: "Beginner", blurb: "Simpler riffs, fewer notes, gentle stretches" },
  { level: "intermediate", title: "Intermediate", blurb: "Faster rhythms, wider stretches, some technique" },
  { level: "advanced", title: "Advanced", blurb: "Dense phrasing, big stretches, blue notes" },
];

// Two A/B rounds, each contrasting a pair of feels. Across both rounds the user
// hears all four feels and we infer which they gravitate toward.
const AB_ROUNDS: [Feel, Feel][] = [
  ["driving", "laid_back"],
  ["heavy", "bouncy"],
];

const FEEL_BLURB: Record<Feel, string> = {
  driving: "Steady & propulsive",
  laid_back: "Relaxed & spacious",
  heavy: "Dark & aggressive",
  bouncy: "Springy & syncopated",
};

function randomKey() {
  return GUITAR_KEYS[Math.floor(Math.random() * GUITAR_KEYS.length)];
}

export default function OnboardingScreen() {
  const completeOnboarding = usePracticeStore((s) => s.completeOnboarding);
  const setLevelInRiffStore = useNewRiffStore((s) => s.setLevel);

  const [step, setStep] = useState(0); // 0 level, 1 genres, 2+ A/B rounds
  const [level, setLevel] = useState<Level>("intermediate");
  const [genres, setGenres] = useState<string[]>([]);
  // Feel winners from each A/B round.
  const [feelWins, setFeelWins] = useState<Feel[]>([]);

  const audio = useAudioEngine();

  // Generate the A/B candidate riffs once, keyed on level so they regenerate if
  // the user goes back and changes level.
  const abRiffs = useMemo<Record<Feel, RiffSpec>>(() => {
    const out = {} as Record<Feel, RiffSpec>;
    for (const [a, b] of AB_ROUNDS) {
      out[a] = generateSafe({ key: randomKey(), level, feel: a });
      out[b] = generateSafe({ key: randomKey(), level, feel: b });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const previewFeel = useCallback(
    (feel: Feel) => {
      audio.stop();
      audio.play(riffSpecToEvents(abRiffs[feel]), abRiffs[feel].tempo_bpm, false, {
        bars: abRiffs[feel].bars.length,
      });
    },
    [audio, abRiffs],
  );

  const toggleGenre = (id: string) => {
    setGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const totalSteps = 2 + AB_ROUNDS.length;
  const abRoundIndex = step - 2; // valid when step >= 2

  const finish = useCallback(
    (allWins: Feel[]) => {
      audio.stop();
      // Combine signals: genre prior (one vote) + each A/B win (weighted 2).
      const votes = new Map<Feel, number>();
      const genrePrior = derivePreferredFeel(genres);
      if (genrePrior) votes.set(genrePrior, (votes.get(genrePrior) ?? 0) + 1);
      for (const f of allWins) votes.set(f, (votes.get(f) ?? 0) + 2);

      let preferredFeel: Feel | null = null;
      let best = 0;
      for (const [feel, count] of votes) {
        if (count > best) {
          best = count;
          preferredFeel = feel;
        }
      }

      completeOnboarding({ level, genres, preferredFeel });
      // Seed the Create tab so it reflects the chosen profile.
      setLevelInRiffStore(level);
    },
    [audio, genres, level, completeOnboarding, setLevelInRiffStore],
  );

  const pickAb = (feel: Feel) => {
    const nextWins = [...feelWins, feel];
    setFeelWins(nextWins);
    if (abRoundIndex + 1 >= AB_ROUNDS.length) {
      finish(nextWins);
    } else {
      audio.stop();
      setStep(step + 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.progressRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressDot, i <= step && styles.progressDotActive]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <View>
            <Text style={styles.kicker}>WELCOME</Text>
            <Text style={styles.title}>What's your level?</Text>
            <Text style={styles.subtitle}>
              We'll tune every practice riff to match. You can change this later.
            </Text>
            <View style={styles.cardStack}>
              {LEVEL_OPTIONS.map((opt) => {
                const active = level === opt.level;
                return (
                  <TouchableOpacity
                    key={opt.level}
                    style={[styles.bigCard, active && styles.bigCardActive]}
                    onPress={() => setLevel(opt.level)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.bigCardHeader}>
                      <Text style={[styles.bigCardTitle, active && styles.accentText]}>
                        {opt.title}
                      </Text>
                      {active && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      )}
                    </View>
                    <Text style={styles.bigCardBlurb}>{opt.blurb}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={styles.kicker}>STEP 2</Text>
            <Text style={styles.title}>What do you like to play?</Text>
            <Text style={styles.subtitle}>
              Pick any that fit. This flavors the feel of your riffs — choose as
              many as you like, or none.
            </Text>
            <View style={styles.chipWrap}>
              {GENRES.map((g) => {
                const active = genres.includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genreChip, active && styles.genreChipActive]}
                    onPress={() => toggleGenre(g.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genreLabel, active && styles.accentText]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step >= 2 && abRoundIndex < AB_ROUNDS.length && (
          <View>
            <Text style={styles.kicker}>
              TASTE CHECK {abRoundIndex + 1} / {AB_ROUNDS.length}
            </Text>
            <Text style={styles.title}>Which riff do you like better?</Text>
            <Text style={styles.subtitle}>
              Tap to listen, then pick your favorite. There's no wrong answer —
              we're learning your taste.
            </Text>
            <View style={styles.cardStack}>
              {AB_ROUNDS[abRoundIndex].map((feel, idx) => (
                <View key={feel} style={styles.abCard}>
                  <View style={styles.abCardTop}>
                    <Text style={styles.abLabel}>
                      {idx === 0 ? "Riff A" : "Riff B"}
                    </Text>
                    <TouchableOpacity
                      style={styles.previewBtn}
                      onPress={() => previewFeel(feel)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play" size={16} color={colors.accent} />
                      <Text style={styles.previewBtnText}>Listen</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.abBlurb}>{FEEL_BLURB[feel]}</Text>
                  <TouchableOpacity
                    style={styles.pickBtn}
                    onPress={() => pickAb(feel)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.pickBtnText}>Pick this one</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {step < 2 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => setStep(step + 1)}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              {step === 1 ? "Continue" : "Next"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.chipInactive,
  },
  progressDotActive: { backgroundColor: colors.accent },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  kicker: {
    ...typography.small,
    color: colors.accent,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  cardStack: { gap: spacing.md },
  bigCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  bigCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.chipActive,
  },
  bigCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bigCardTitle: { ...typography.h3, color: colors.textPrimary },
  bigCardBlurb: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  accentText: { color: colors.accentLight },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  genreChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
    backgroundColor: colors.chipInactive,
  },
  genreChipActive: {
    borderColor: colors.chipActiveBorder,
    backgroundColor: colors.chipActive,
  },
  genreLabel: { ...typography.body, color: colors.textSecondary },
  abCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  abCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  abLabel: { ...typography.h3, color: colors.textPrimary },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipActive,
  },
  previewBtnText: { ...typography.small, color: colors.accent },
  abBlurb: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  pickBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  pickBtnText: { ...typography.body, color: colors.white, fontWeight: "600" },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
  },
  nextBtnText: { ...typography.body, color: colors.white, fontWeight: "600" },
});
