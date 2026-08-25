/**
 * The guided practice drill.
 *
 * Replaces "mark done", which asked the player to self-report a single bit.
 * This walks the method instead: loop the hard bar slowly, build the whole riff
 * back up, then play it once at speed — three named steps, each of which can be
 * skipped, because a drill that can't be skipped gets closed instead.
 *
 * The app cannot hear the player. Everything on this screen is phrased as reps
 * observed at a tempo, never as accuracy, and the summary says so out loud.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { RiffSpec } from "../engine/riff/spec";
import { hapticSelect } from "../lib/haptics";
import { Observed, useDrillRunner } from "../lib/useDrillRunner";
import { useNewRiffStore } from "../store/useNewRiffStore";
import { RiffResult } from "../store/usePracticeStore";
import { borderRadius, colors, spacing, typography } from "../theme/colors";
import { RiffTabView } from "./RiffTabView";

interface Props {
  riff: RiffSpec;
  /** 1-based, for the header. */
  riffNumber: number;
  /**
   * Called with the result to persist, or null when the drill is abandoned
   * having observed nothing. The caller closes the sheet.
   */
  onClose: (result: RiffResult | null) => void;
  /**
   * Filled with this sheet's own close handler, so the host's Modal can route
   * the Android back gesture through it. Closing any other way would throw
   * away the reps the drill observed.
   */
  closeRef?: React.MutableRefObject<(() => void) | null>;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  return `${mins}:${String(total % 60).padStart(2, "0")}`;
}

export function DrillSheet({ riff, riffNumber, onClose, closeRef }: Props) {
  const runner = useDrillRunner(riff);
  const metronomeEnabled = useNewRiffStore((s) => s.metronomeEnabled);
  const toggleMetronome = useNewRiffStore((s) => s.toggleMetronome);

  const { phase, step, stepIndex, drill, observed } = runner;
  const finished = phase === "finished";

  const handleClose = useCallback(() => {
    onClose(runner.buildResult(finished));
  }, [onClose, runner, finished]);
  if (closeRef) closeRef.current = handleClose;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={finished ? "Close drill" : "Leave drill"}
        >
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Riff {riffNumber}</Text>
        <TouchableOpacity
          onPress={() => {
            hapticSelect();
            toggleMetronome();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="switch"
          accessibilityState={{ checked: metronomeEnabled }}
          accessibilityLabel="Click track"
        >
          <Ionicons
            name={metronomeEnabled ? "musical-note" : "musical-note-outline"}
            size={22}
            color={metronomeEnabled ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Stepper — where you are in the method, and what's left. */}
      <View style={styles.stepper}>
        {drill.steps.map((s, i) => {
          const done = i < stepIndex || (i === stepIndex && finished);
          const current = i === stepIndex && !finished;
          return (
            <React.Fragment key={s.id}>
              {i > 0 && <View style={styles.stepperBar} />}
              <View style={styles.stepperItem}>
                <View
                  style={[
                    styles.stepperDot,
                    current && styles.stepperDotCurrent,
                    done && styles.stepperDotDone,
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={12} color={colors.white} />
                  ) : (
                    <Text
                      style={[
                        styles.stepperNum,
                        current && styles.stepperNumCurrent,
                      ]}
                    >
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepperLabel,
                    current && styles.stepperLabelCurrent,
                  ]}
                >
                  {s.label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {finished ? (
          <Summary observed={observed} />
        ) : (
          <View style={styles.stepCard}>
            <Text style={styles.stepKicker}>
              {step.label.toUpperCase()} · STEP {stepIndex + 1} OF{" "}
              {drill.steps.length}
            </Text>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepInstruction}>{step.instruction}</Text>

            <View style={styles.tempoRow}>
              <View>
                <Text style={styles.tempoValue}>{runner.bpm}</Text>
                <Text style={styles.tempoLabel}>
                  bpm · {runner.tempoPct}% of {riff.tempo_bpm}
                </Text>
              </View>
              <View style={styles.pips}>
                {Array.from({ length: runner.stepReps }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      i < runner.repsInStep && styles.pipFilled,
                    ]}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.repsLabel}>
              {runner.repsInStep} of {runner.stepReps} reps
              {phase === "stepDone" ? " — step done" : ""}
            </Text>
          </View>
        )}

        <RiffTabView
          riff={riff}
          activeStep={runner.activeStep}
          footer={
            runner.barIndex !== null && !finished ? (
              <Text style={styles.tabHint}>
                Looping bar {runner.barIndex + 1}
              </Text>
            ) : undefined
          }
        />
      </ScrollView>

      <View style={styles.controls}>
        {finished ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save this drill and close"
          >
            <Ionicons name="checkmark" size={18} color={colors.white} />
            <Text style={styles.primaryLabel}>Save & close</Text>
          </TouchableOpacity>
        ) : phase === "stepDone" ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={runner.nextStep}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${drill.steps[stepIndex + 1]?.label}`}
          >
            <Text style={styles.primaryLabel}>
              Next: {drill.steps[stepIndex + 1]?.label}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              phase === "running" && styles.primaryBtnStop,
            ]}
            onPress={phase === "running" ? runner.pause : runner.start}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={phase === "running" ? "Stop" : "Start this step"}
          >
            <Ionicons
              name={phase === "running" ? "stop" : "play"}
              size={18}
              color={colors.white}
            />
            <Text style={styles.primaryLabel}>
              {phase === "running"
                ? "Stop"
                : runner.repsInStep > 0
                  ? "Resume"
                  : "Start"}
            </Text>
          </TouchableOpacity>
        )}

        {!finished && phase !== "stepDone" && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={runner.skipStep}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Skip the ${step.label} step`}
          >
            <Text style={styles.skipLabel}>
              {stepIndex === drill.steps.length - 1 ? "Finish up" : "Skip step"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function Summary({ observed }: { observed: Observed }) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name="ribbon-outline" size={26} color={colors.accent} />
      <Text style={styles.summaryTitle}>Drill done</Text>
      <View style={styles.summaryRow}>
        <SummaryStat label="Reps" value={`${observed.reps}`} />
        <SummaryStat
          label="Top tempo"
          value={observed.topTempoPct > 0 ? `${observed.topTempoPct}%` : "—"}
        />
        <SummaryStat label="Time" value={formatDuration(observed.seconds)} />
      </View>
      {/* The one thing this screen must never let itself imply. */}
      <Text style={styles.summaryNote}>
        Reps counted, not graded — the app can't hear you play. How it sounded
        is still your call.
      </Text>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepperItem: { alignItems: "center", gap: 4, width: 64 },
  stepperBar: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  stepperDot: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperDotCurrent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  stepperDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepperNum: { ...typography.small, color: colors.textMuted, fontWeight: "700" },
  stepperNumCurrent: { color: colors.white },
  stepperLabel: { ...typography.small, color: colors.textMuted },
  stepperLabelCurrent: { color: colors.textPrimary, fontWeight: "700" },

  scroll: { flex: 1 },
  content: { paddingVertical: spacing.md, gap: spacing.md },

  stepCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  stepKicker: {
    ...typography.small,
    color: colors.accent,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  stepTitle: { ...typography.h2, color: colors.textPrimary },
  stepInstruction: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  tempoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  tempoValue: { ...typography.h1, color: colors.textPrimary },
  tempoLabel: { ...typography.small, color: colors.textMuted },
  pips: { flexDirection: "row", gap: 6, marginBottom: 6 },
  pip: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pipFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  repsLabel: { ...typography.small, color: colors.textSecondary },
  tabHint: {
    ...typography.small,
    color: colors.accent,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },

  summaryCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(74, 122, 255, 0.25)",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryTitle: { ...typography.h2, color: colors.textPrimary },
  summaryRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-around",
    marginTop: spacing.xs,
  },
  summaryStat: { alignItems: "center" },
  summaryValue: { ...typography.h2, color: colors.accent },
  summaryLabel: { ...typography.small, color: colors.textMuted },
  summaryNote: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 17,
    marginTop: spacing.xs,
  },

  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  primaryBtnStop: { backgroundColor: colors.error },
  primaryLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  skipBtn: { alignItems: "center", paddingVertical: spacing.sm },
  skipLabel: { ...typography.caption, color: colors.textSecondary },
});
