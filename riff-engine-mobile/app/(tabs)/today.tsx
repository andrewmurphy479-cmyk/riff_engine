import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
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
import { RiffTabView } from "../../components/RiffTabView";
import { FEEL_DISPLAY_NAMES } from "../../engine/riff/display";
import { riffSpecToEvents } from "../../engine/riff/toEvents";
import { hapticSelect, hapticSuccess, hapticTap } from "../../lib/haptics";
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
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
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
      setActiveStep(null);
    },
    onStepPlay: (step) => setActiveStep(step < 0 ? null : step),
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

  // Warm the whole session's riffs up front (audit A8) — it's only a handful,
  // and ToneBank.ensure() dedupes and yields between clips so the list stays
  // responsive. One flattened call, since prepare() debounces.
  useEffect(() => {
    if (!session) return;
    audio.prepare(session.riffs.flatMap(riffSpecToEvents));
  }, [session, audio]);

  const handlePlay = useCallback(
    (idx: number) => {
      if (!session) return;
      hapticTap();
      if (playingIdx === idx) {
        audio.stop();
        return;
      }
      audio.stop();
      audio.play(
        riffSpecToEvents(session.riffs[idx]),
        session.riffs[idx].tempo_bpm,
        false,
        { bars: session.riffs[idx].bars.length },
      );
      setPlayingIdx(idx);
    },
    [session, playingIdx, audio],
  );

  // Success buzz the moment a mark-done completes the daily goal.
  const handleMarkDone = useCallback(
    (idx: number) => {
      if (!session || session.completed[idx]) return;
      const doneAfter = session.completed.filter(Boolean).length + 1;
      if (doneAfter >= session.goalCount) {
        hapticSuccess();
      } else {
        hapticSelect();
      }
      markRiffPracticed(idx);
    },
    [session, markRiffPracticed],
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

        {/* Today's lesson — what these four riffs have in common, and why */}
        <View style={styles.themeCard}>
          <View style={styles.themeHeader}>
            <Ionicons
              name="school-outline"
              size={16}
              color={colors.accent}
            />
            <Text style={styles.themeKicker}>TODAY'S FOCUS</Text>
          </View>
          <Text style={styles.themeLabel}>{session.theme.label}</Text>
          <Text style={styles.themeFocus}>{session.theme.focus}</Text>
          <TouchableOpacity
            onPress={() => {
              hapticTap();
              setThemeOpen((v) => !v);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              themeOpen ? "Hide lesson detail" : "Show lesson detail"
            }
          >
            <Text style={styles.themeMore}>
              {themeOpen ? "Less" : "What is this?"}
            </Text>
          </TouchableOpacity>
          {themeOpen && (
            <Text style={styles.themeBlurb}>{session.theme.blurb}</Text>
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
                accessibilityRole="button"
                accessibilityLabel={
                  isPlaying ? `Stop riff ${idx + 1}` : `Play riff ${idx + 1}`
                }
              >
                <Ionicons
                  name={isPlaying ? "stop" : "play"}
                  size={20}
                  color={isPlaying ? colors.white : colors.accent}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.riffMeta}
                onPress={() => setOpenIdx(idx)}
                activeOpacity={0.7}
              >
                <Text style={styles.riffTitle}>Riff {idx + 1}</Text>
                <Text style={styles.riffSub}>
                  Key {riff.key}
                  {riff.feel
                    ? ` · ${FEEL_DISPLAY_NAMES[riff.feel] ?? riff.feel}`
                    : ""}
                  {` · ${riff.tempo_bpm} bpm`}
                </Text>
                <Text style={styles.riffOpenHint}>View tab ›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.doneBtn, done && styles.doneBtnActive]}
                onPress={() => handleMarkDone(idx)}
                disabled={done}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={
                  done
                    ? `Riff ${idx + 1} practiced`
                    : `Mark riff ${idx + 1} as practiced`
                }
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

      {/* Practice sheet: full tab + playhead for the tapped riff */}
      <Modal
        visible={openIdx !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpenIdx(null)}
      >
        {openIdx !== null && session.riffs[openIdx] && (
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity
                onPress={() => setOpenIdx(null)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close riff sheet"
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Riff {openIdx + 1}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <RiffTabView
                riff={session.riffs[openIdx]}
                activeStep={playingIdx === openIdx ? activeStep : null}
                footer={
                  <View style={styles.sheetControls}>
                    <TouchableOpacity
                      style={[
                        styles.sheetPlayBtn,
                        playingIdx === openIdx && styles.sheetPlayBtnActive,
                      ]}
                      onPress={() => handlePlay(openIdx)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={playingIdx === openIdx ? "stop" : "play"}
                        size={18}
                        color={colors.white}
                      />
                      <Text style={styles.sheetPlayLabel}>
                        {playingIdx === openIdx ? "Stop" : "Play"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.sheetDoneBtn,
                        session.completed[openIdx] && styles.sheetDoneBtnActive,
                      ]}
                      onPress={() => handleMarkDone(openIdx)}
                      disabled={session.completed[openIdx]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={
                          session.completed[openIdx]
                            ? "checkmark-circle"
                            : "checkmark"
                        }
                        size={18}
                        color={
                          session.completed[openIdx]
                            ? colors.success
                            : colors.textPrimary
                        }
                      />
                      <Text
                        style={[
                          styles.sheetDoneLabel,
                          session.completed[openIdx] &&
                            styles.sheetDoneLabelActive,
                        ]}
                      >
                        {session.completed[openIdx] ? "Done" : "Mark done"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
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
  themeCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.22)",
    padding: spacing.lg,
    gap: 6,
  },
  themeHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  themeKicker: {
    ...typography.small,
    color: colors.accent,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  themeLabel: { ...typography.h3, color: colors.textPrimary },
  themeFocus: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  themeMore: {
    ...typography.small,
    color: colors.accent,
    fontWeight: "700",
    marginTop: 2,
  },
  themeBlurb: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 2,
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
  riffOpenHint: {
    ...typography.small,
    color: colors.accent,
    marginTop: 4,
    fontWeight: "600",
  },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingVertical: spacing.md },
  sheetControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  sheetPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  sheetPlayBtnActive: { backgroundColor: colors.error },
  sheetPlayLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sheetDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetDoneBtnActive: {
    borderColor: "rgba(34, 197, 94, 0.4)",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  sheetDoneLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  sheetDoneLabelActive: { color: colors.success },
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
