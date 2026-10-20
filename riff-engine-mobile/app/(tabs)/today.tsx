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
import { router, useFocusEffect } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { BrandWordmark } from "../../components/BrandWordmark";
import { RiffTabView } from "../../components/RiffTabView";
import { analog } from "../../theme/analog";
import { useAudioEngine } from "../../audio/AudioEngine";
import { DrillSheet } from "../../components/DrillSheet";
import { FEEL_DISPLAY_NAMES } from "../../engine/riff/display";
import { riffSpecToEvents } from "../../engine/riff/toEvents";
import { track } from "../../lib/analytics";
import { hapticSelect, hapticSuccess, hapticTap } from "../../lib/haptics";
import {
  effectiveStreak,
  isTodayComplete,
  RiffResult,
  usePracticeStore,
} from "../../store/usePracticeStore";

function formatMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${mins}`;
}

export default function TodayScreen() {
  const isFocused = useIsFocused();
  const session = usePracticeStore((s) => s.session);
  const stats = usePracticeStore((s) => s.stats);
  const streak = usePracticeStore((s) => effectiveStreak(s));
  const longestStreak = usePracticeStore((s) => s.streak.longest);
  const complete = usePracticeStore((s) => isTodayComplete(s));
  const ensureTodaySession = usePracticeStore((s) => s.ensureTodaySession);
  const regenerateSession = usePracticeStore((s) => s.regenerateSession);
  const markRiffPracticed = usePracticeStore((s) => s.markRiffPracticed);
  const recordDrillResult = usePracticeStore((s) => s.recordDrillResult);
  const addPracticeSeconds = usePracticeStore((s) => s.addPracticeSeconds);

  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [drillIdx, setDrillIdx] = useState<number | null>(null);
  const drillCloseRef = useRef<(() => void) | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
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
    onStepPlay: (step) => setActiveStep(step >= 0 ? step : null),
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
      track("session_riff_done", { method: "mark_done", theme: session.theme.id });
      if (doneAfter === session.goalCount) track("daily_goal_met", { method: "mark_done" });
      markRiffPracticed(idx);
    },
    [session, markRiffPracticed],
  );

  const handleOpenDrill = useCallback(
    (idx: number) => {
      hapticTap();
      audio.stop(); // the drill takes the engine over; don't leave a riff running
      setPlayingIdx(null);
      setDrillIdx(idx);
    },
    [audio],
  );

  // Fires on finish AND on abandon — a drill that recorded reps still counts,
  // and the store merges a later attempt into it rather than replacing it.
  const handleCloseDrill = useCallback(
    (result: RiffResult | null) => {
      const idx = drillIdx;
      setDrillIdx(null);
      if (idx == null || !result) return;
      const doneAfter = session
        ? session.completed.filter(Boolean).length + (session.completed[idx] ? 0 : 1)
        : 0;
      if (session && !session.completed[idx] && doneAfter >= session.goalCount) {
        hapticSuccess();
      }
      track("drill_ended", {
        finished: result.completed,
        top_tempo_pct: result.topTempoPct,
        reps: result.reps,
        seconds: Math.round(result.seconds),
      });
      // A drill credits the riff even when abandoned, so it counts as done.
      if (session && !session.completed[idx]) {
        track("session_riff_done", { method: "drill", theme: session.theme.id });
        if (doneAfter === session.goalCount) track("daily_goal_met", { method: "drill" });
      }
      recordDrillResult(idx, result);
    },
    [drillIdx, session, recordDrillResult],
  );

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        {isFocused && <StatusBar style="dark" />}
        <View style={styles.center}>
          <BrandWordmark width={204} />
          <Text style={styles.subtitle}>Finding something worth playing…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const doneCount = session.completed.filter(Boolean).length;
  const nextIdx = session.completed.findIndex((done) => !done);
  const featuredIdx = Math.min(selectedIdx ?? Math.max(0, nextIdx), session.riffs.length - 1);
  const featured = session.riffs[featuredIdx];
  const featuredPlaying = playingIdx === featuredIdx;

  return (
    <SafeAreaView style={styles.safe}>
      {isFocused && <StatusBar style="dark" />}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.headerRow}>
            <View>
              <BrandWordmark />
              <Text style={styles.brandLine}>Make room for a riff.</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => router.push("/settings")}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <Ionicons name="options-outline" size={23} color={analog.oxblood} />
            </TouchableOpacity>
          </View>

          <View style={styles.focusPanel}>
            <View style={styles.focusTop}>
              <Text style={styles.focusLabel}>Today's focus</Text>
              <Ionicons name="musical-notes-outline" size={22} color={analog.oxblood} />
            </View>
            <Text style={styles.focusTitle}>{session.theme.label}</Text>
            <Text style={styles.focusCopy}>{session.theme.focus}</Text>
            <TouchableOpacity
              style={styles.lessonButton}
              onPress={() => { hapticTap(); setThemeOpen((value) => !value); }}
              accessibilityRole="button"
              accessibilityState={{ expanded: themeOpen }}
              accessibilityLabel={themeOpen ? "Hide lesson detail" : "Show lesson detail"}
            >
              <Text style={styles.lessonButtonText}>{themeOpen ? "Close the lesson" : "Why this matters"}</Text>
              <Ionicons name={themeOpen ? "chevron-up" : "chevron-down"} size={15} color={analog.oxblood} />
            </TouchableOpacity>
            {themeOpen && <Text style={styles.lessonCopy}>{session.theme.blurb}</Text>}
          </View>

          {featured && (
            <View style={styles.featured}>
              <View style={styles.featuredHeader}>
                <View style={styles.featuredTitleGroup}>
                  <Text style={styles.riffEyebrow}>{complete ? "Play it again" : "Something to work on"}</Text>
                  <Text style={styles.featuredTitle}>Riff {featuredIdx + 1}</Text>
                  <Text style={styles.subtitle}>
                    {featured.key} {featured.scale.replace(/_/g, " ").replace("+blue", " + blue")}{featured.feel ? " / " + (FEEL_DISPLAY_NAMES[featured.feel] ?? featured.feel) : ""}
                  </Text>
                </View>
                <View style={styles.tempo}>
                  <Text style={styles.tempoValue}>{featured.tempo_bpm}</Text>
                  <Text style={styles.tempoLabel}>BPM</Text>
                </View>
              </View>
              <RiffTabView riff={featured} appearance="analog" compact activeStep={featuredPlaying ? activeStep : null} />
              <Text style={styles.previewCaption}>Opening phrase · {featured.bars.length} bars in the full riff</Text>
              <View style={styles.featuredActions}>
                <TouchableOpacity
                  style={styles.listenBtn}
                  onPress={() => handlePlay(featuredIdx)}
                  accessibilityRole="button"
                  accessibilityLabel={featuredPlaying ? "Stop preview" : "Listen to this riff"}
                >
                  <Ionicons name={featuredPlaying ? "stop" : "play-outline"} size={18} color={analog.oxblood} />
                  <Text style={styles.listenLabel}>{featuredPlaying ? "Stop" : "Listen"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.practiceBtn}
                  onPress={() => handleOpenDrill(featuredIdx)}
                  accessibilityRole="button"
                  accessibilityLabel={"Practice riff " + (featuredIdx + 1)}
                >
                  <Text style={styles.practiceLabel}>Practice this riff</Text>
                  <Ionicons name="arrow-forward" size={18} color={analog.paper} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.setHeader}>
            <Text style={styles.sectionTitle}>{complete ? "Today's set, played." : "Today's set"}</Text>
            <Text style={styles.setCount}>{doneCount} of {session.goalCount} practiced</Text>
          </View>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityLabel="Daily practice"
            accessibilityValue={{ min: 0, max: session.goalCount, now: doneCount }}
          >
            {session.riffs.map((_, idx) => (
              <View key={idx} style={[styles.progressPart, session.completed[idx] && styles.progressPartDone]} />
            ))}
          </View>

          <View style={styles.riffList}>
            {session.riffs.map((riff, idx) => {
              const done = session.completed[idx];
              const selected = featuredIdx === idx;
              const result = session.results[idx];
              return (
                <View key={riff.seed + "-" + idx} style={[styles.riffRow, selected && styles.riffRowSelected]}>
                  <TouchableOpacity
                    style={styles.riffSelect}
                    onPress={() => {
                      if (playingIdx !== null && playingIdx !== idx) audio.stop();
                      hapticSelect();
                      setSelectedIdx(idx);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={"Preview riff " + (idx + 1)}
                  >
                    <View style={[styles.riffNumber, selected && styles.riffNumberSelected]}>
                      <Text style={[styles.riffNumberText, selected && styles.riffNumberTextSelected]}>{idx + 1}</Text>
                    </View>
                    <View style={styles.riffMeta}>
                      <Text style={styles.riffTitle}>{riff.key} / {FEEL_DISPLAY_NAMES[riff.feel ?? ""] ?? "Riff " + (idx + 1)}</Text>
                      <Text style={styles.riffSub}>
                        {riff.tempo_bpm} bpm{result && result.reps > 0 ? " / " + result.reps + " reps played" : " / " + riff.bars.length + " bars to explore"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => handleMarkDone(idx)}
                    disabled={done}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: done }}
                    accessibilityLabel={done ? "Riff " + (idx + 1) + " practiced" : "Mark riff " + (idx + 1) + " as practiced"}
                  >
                    <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={24} color={done ? analog.success : analog.muted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {complete && <Text style={styles.completeNote}>A little more music in your day. Nice work.</Text>}
          <TouchableOpacity
            style={styles.regenBtn}
            onPress={() => {
              audio.stop();
              setPlayingIdx(null);
              setSelectedIdx(null);
              regenerateSession();
            }}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={17} color={analog.indigo} />
            <Text style={styles.regenText}>Find a fresh set</Text>
          </TouchableOpacity>

          <View style={styles.practiceHistory}>
            <Text style={styles.historyTitle}>Your practice, adding up</Text>
            <View style={styles.statsRow}>
              <Stat label="Days played" value={String(stats.daysPracticed)} />
              <Stat label="Riffs played" value={String(stats.totalRiffs)} />
              <Stat label="Minutes" value={formatMinutes(stats.totalSeconds)} />
            </View>
            <Text style={styles.streakNote}>{streak} day streak / personal best {Math.max(longestStreak, streak)}</Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={drillIdx !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => drillCloseRef.current?.()}
      >
        {drillIdx !== null && session.riffs[drillIdx] && (
          <DrillSheet
            riff={session.riffs[drillIdx]}
            riffNumber={drillIdx + 1}
            onClose={handleCloseDrill}
            closeRef={drillCloseRef}
          />
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
  safe: { flex: 1, backgroundColor: analog.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  page: { width: "100%", maxWidth: 620, alignSelf: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  brandLine: { color: analog.muted, fontSize: 12, marginTop: 2 },
  settingsBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  focusPanel: { backgroundColor: analog.butter, borderRadius: 4, borderTopRightRadius: 28, padding: 22, marginBottom: 24 },
  focusTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  focusLabel: { color: analog.oxblood, fontSize: 13, fontWeight: "600" },
  focusTitle: { fontFamily: analog.headingFont, fontSize: 30, lineHeight: 35, fontWeight: "700", letterSpacing: -0.8, color: analog.oxblood, marginBottom: 10 },
  focusCopy: { fontSize: 15, lineHeight: 23, color: analog.ink },
  lessonButton: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, alignSelf: "flex-start", marginTop: 4 },
  lessonButtonText: { fontSize: 13, fontWeight: "600", color: analog.oxblood },
  lessonCopy: { fontSize: 14, lineHeight: 22, color: analog.ink, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(114,44,61,0.2)" },
  featured: { marginBottom: 30 },
  featuredHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 2 },
  featuredTitleGroup: { flex: 1 },
  riffEyebrow: { color: analog.muted, fontSize: 12, marginBottom: 5 },
  featuredTitle: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5, color: analog.ink, marginBottom: 5 },
  subtitle: { fontSize: 13, lineHeight: 19, color: analog.muted },
  tempo: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 1, borderLeftColor: analog.line },
  tempoValue: { fontSize: 27, fontWeight: "600", color: analog.oxblood, fontVariant: ["tabular-nums"] },
  tempoLabel: { fontSize: 10, color: analog.muted, marginTop: 2 },
  previewCaption: { color: analog.muted, fontSize: 11, textAlign: "center", marginBottom: 18 },
  featuredActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  listenBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 50, paddingHorizontal: 20, borderRadius: 25, borderWidth: 1, borderColor: analog.oxblood, gap: 8 },
  listenLabel: { color: analog.oxblood, fontSize: 14, fontWeight: "600" },
  practiceBtn: { flex: 1, minWidth: 170, flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: 50, borderRadius: 25, paddingHorizontal: 18, gap: 12, backgroundColor: analog.oxblood },
  practiceLabel: { color: analog.paper, fontSize: 14, fontWeight: "600" },
  setHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: analog.ink },
  setCount: { fontSize: 12, color: analog.muted },
  progressTrack: { flexDirection: "row", gap: 5, marginTop: 12, marginBottom: 12 },
  progressPart: { height: 4, borderRadius: 2, flex: 1, backgroundColor: analog.line },
  progressPartDone: { backgroundColor: analog.success },
  riffList: { gap: 2 },
  riffRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, minHeight: 76, paddingRight: 6 },
  riffRowSelected: { backgroundColor: analog.inset },
  riffSelect: { flex: 1, flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14, paddingHorizontal: 12 },
  riffNumber: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: analog.line },
  riffNumberSelected: { backgroundColor: analog.oxblood, borderColor: analog.oxblood },
  riffNumberText: { color: analog.muted, fontSize: 13, fontWeight: "600" },
  riffNumberTextSelected: { color: analog.paper },
  riffMeta: { flex: 1 },
  riffTitle: { fontSize: 15, fontWeight: "600", color: analog.ink },
  riffSub: { fontSize: 12, color: analog.muted, marginTop: 4, lineHeight: 17 },
  doneBtn: { width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
  completeNote: { color: analog.success, fontSize: 14, lineHeight: 21, marginTop: 14 },
  regenBtn: { flexDirection: "row", minHeight: 48, alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12 },
  regenText: { color: analog.indigo, fontSize: 14, fontWeight: "600" },
  practiceHistory: { marginTop: 22, borderTopWidth: 1, borderTopColor: analog.line, paddingTop: 22 },
  historyTitle: { color: analog.muted, fontSize: 13, marginBottom: 18 },
  statsRow: { flexDirection: "row", gap: 12 },
  stat: { flex: 1 },
  statValue: { color: analog.ink, fontSize: 23, fontWeight: "600", fontVariant: ["tabular-nums"] },
  statLabel: { color: analog.muted, fontSize: 11, marginTop: 4 },
  streakNote: { color: analog.muted, fontSize: 12, marginTop: 18 },
});
