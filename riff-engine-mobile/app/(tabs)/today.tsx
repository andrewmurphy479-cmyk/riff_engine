import React, { useCallback, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAudioEngine } from "../../audio/AudioEngine";
import { FEEL_DISPLAY_NAMES } from "../../engine/riff/display";
import { riffSpecToEvents } from "../../engine/riff/toEvents";
import {
  effectiveStreak,
  isTodayComplete,
  usePracticeStore,
} from "../../store/usePracticeStore";
import { borderRadius, colors, spacing, typography } from "../../theme/colors";

function formatMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${mins}`;
}

export default function TodayScreen() {
  const session = usePracticeStore((s) => s.session);
  const stats = usePracticeStore((s) => s.stats);
  const streak = usePracticeStore((s) => effectiveStreak(s));
  const longestStreak = usePracticeStore((s) => s.streak.longest);
  const complete = usePracticeStore((s) => isTodayComplete(s));
  const ensureTodaySession = usePracticeStore((s) => s.ensureTodaySession);
  const regenerateSession = usePracticeStore((s) => s.regenerateSession);
  const markRiffPracticed = usePracticeStore((s) => s.markRiffPracticed);
  const addPracticeSeconds = usePracticeStore((s) => s.addPracticeSeconds);

  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const playStartRef = useRef<number | null>(null);

  const flushSeconds = useCallback(() => {
    if (playStartRef.current != null) {
      const elapsed = (Date.now() - playStartRef.current) / 1000;
      addPracticeSeconds(elapsed);
      playStartRef.current = null;
    }
  }, [addPracticeSeconds]);

  const audio = useAudioEngine({
    onPlaybackStart: () => {
      playStartRef.current = Date.now();
    },
    onPlaybackEnd: () => {
      flushSeconds();
      setPlayingIdx(null);
    },
  });

  // Roll a fresh session over at day boundaries whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      ensureTodaySession();
      return () => {
        audio.stop();
        flushSeconds();
      };
    }, [ensureTodaySession, audio, flushSeconds]),
  );

  const handlePlay = useCallback(
    (idx: number) => {
      if (!session) return;
      if (playingIdx === idx) {
        audio.stop();
        return;
      }
      audio.stop();
      audio.play(
        riffSpecToEvents(session.riffs[idx]),
        session.riffs[idx].tempo_bpm,
      );
      setPlayingIdx(idx);
    },
    [session, playingIdx, audio],
  );

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.subtitle}>Setting up today's practice…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const doneCount = session.completed.filter(Boolean).length;
  const progress = doneCount / session.goalCount;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>TODAY'S PRACTICE</Text>
            <Text style={styles.title}>
              {complete ? "Nice work!" : "Let's play"}
            </Text>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={18} color={colors.warning} />
            <Text style={styles.streakNum}>{streak}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Stat label="Best" value={`${Math.max(longestStreak, streak)}`} />
          <Stat label="Days" value={`${stats.daysPracticed}`} />
          <Stat label="Riffs" value={`${stats.totalRiffs}`} />
          <Stat label="Minutes" value={formatMinutes(stats.totalSeconds)} />
        </View>

        {/* Goal progress */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalLabel}>Daily goal</Text>
            <Text style={styles.goalCount}>
              {doneCount} / {session.goalCount}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
          {complete && (
            <Text style={styles.completeNote}>
              You hit today's goal — streak secured. 🔥
            </Text>
          )}
        </View>

        {/* Riff list */}
        {session.riffs.map((riff, idx) => {
          const done = session.completed[idx];
          const isPlaying = playingIdx === idx;
          return (
            <View key={`${riff.seed}-${idx}`} style={styles.riffCard}>
              <TouchableOpacity
                style={[styles.playBtn, isPlaying && styles.playBtnActive]}
                onPress={() => handlePlay(idx)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isPlaying ? "stop" : "play"}
                  size={20}
                  color={isPlaying ? colors.white : colors.accent}
                />
              </TouchableOpacity>

              <View style={styles.riffMeta}>
                <Text style={styles.riffTitle}>Riff {idx + 1}</Text>
                <Text style={styles.riffSub}>
                  Key {riff.key}
                  {riff.feel
                    ? ` · ${FEEL_DISPLAY_NAMES[riff.feel] ?? riff.feel}`
                    : ""}
                  {` · ${riff.tempo_bpm} bpm`}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.doneBtn, done && styles.doneBtnActive]}
                onPress={() => markRiffPracticed(idx)}
                disabled={done}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={done ? "checkmark-circle" : "ellipse-outline"}
                  size={26}
                  color={done ? colors.success : colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Regenerate */}
        <TouchableOpacity
          style={styles.regenBtn}
          onPress={() => {
            audio.stop();
            setPlayingIdx(null);
            regenerateSession();
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={16} color={colors.textSecondary} />
          <Text style={styles.regenText}>New set of riffs</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: {
    ...typography.small,
    color: colors.accent,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  streakNum: { ...typography.h3, color: colors.warning },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statValue: { ...typography.h2, color: colors.textPrimary },
  statLabel: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  goalCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  goalLabel: { ...typography.h3, color: colors.textPrimary },
  goalCount: { ...typography.h3, color: colors.accent },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.chipInactive,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  completeNote: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing.md,
  },
  riffCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chipActive,
  },
  playBtnActive: { backgroundColor: colors.accent },
  riffMeta: { flex: 1 },
  riffTitle: { ...typography.h3, color: colors.textPrimary },
  riffSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  doneBtn: { padding: spacing.xs },
  doneBtnActive: {},
  regenBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  regenText: { ...typography.caption, color: colors.textSecondary },
});
