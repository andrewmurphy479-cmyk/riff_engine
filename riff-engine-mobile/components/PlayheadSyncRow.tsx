/**
 * Playhead sync — the user-facing half of audit A7.
 *
 * Bluetooth output reaches the ear 150-250ms after the audio clock says it
 * left, so the tab's playhead runs ahead of the sound. That was cosmetic while
 * the playhead was decoration; the guided drill makes it the thing telling a
 * learner where the beat is, and a playhead that leads teaches wrong timing.
 *
 * react-native-audio-api exposes no `outputLatency` to query, so the offset is
 * set by ear: a bar of muted low E on the beat, four dots lighting with the
 * playhead, and the player nudges until the light matches the thud.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAudioEngine } from "../audio/AudioEngine";
import { TabEvent } from "../engine/types";
import { hapticSelect, hapticTap } from "../lib/haptics";
import {
  PLAYHEAD_OFFSET_MAX_MS,
  PLAYHEAD_OFFSET_STEP_MS,
  useNewRiffStore,
} from "../store/useNewRiffStore";
import { borderRadius, colors, spacing, typography } from "../theme/colors";

const TEST_BPM = 100;
const STEPS_PER_BEAT = 4;
const BEATS = 4;

/** One bar of muted low E on every beat — percussive enough to match by ear. */
const TEST_EVENTS: TabEvent[] = Array.from({ length: BEATS }, (_, beat) => ({
  string: "E",
  fret: 0,
  step: beat * STEPS_PER_BEAT,
  duration: STEPS_PER_BEAT,
  technique: "mute",
  velocity: 0.9,
}));

/** Starting points, so nobody has to find 160ms one 10ms tap at a time. */
const PRESETS: { label: string; ms: number }[] = [
  { label: "Phone speaker", ms: 0 },
  { label: "Wired", ms: 20 },
  { label: "Bluetooth", ms: 160 },
];

export function PlayheadSyncRow() {
  const offset = useNewRiffStore((s) => s.playheadOffsetMs);
  const setOffset = useNewRiffStore((s) => s.setPlayheadOffsetMs);

  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);

  const audio = useAudioEngine({
    onPlaybackEnd: () => {
      setTesting(false);
      setBeat(null);
    },
    onStepPlay: (step) =>
      setBeat(step < 0 ? null : Math.floor(step / STEPS_PER_BEAT)),
  });

  const stopTest = useCallback(() => {
    audio.stop();
    setTesting(false);
    setBeat(null);
  }, [audio]);

  // Never leave the test running behind a collapsed row or a closed screen.
  useEffect(() => {
    if (!open && testing) stopTest();
  }, [open, testing, stopTest]);
  useEffect(() => () => audio.stop(), [audio]);

  const toggleTest = useCallback(() => {
    hapticTap();
    if (testing) {
      stopTest();
      return;
    }
    setTesting(true);
    void audio.play(TEST_EVENTS, TEST_BPM, true, { bars: 1 });
  }, [testing, stopTest, audio]);

  const nudge = useCallback(
    (delta: number) => {
      hapticSelect();
      setOffset(offset + delta);
    },
    [offset, setOffset],
  );

  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          hapticTap();
          setOpen((v) => !v);
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Playhead sync, currently ${offset} milliseconds`}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Playhead sync</Text>
          <Text style={styles.rowHint}>
            Nudge up if the tab runs ahead of the sound
          </Text>
        </View>
        <Text style={styles.value}>{offset} ms</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.panel}>
          <View style={styles.beats}>
            {Array.from({ length: BEATS }, (_, i) => (
              <View
                key={i}
                style={[styles.beatDot, beat === i && styles.beatDotActive]}
              />
            ))}
          </View>

          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => nudge(-PLAYHEAD_OFFSET_STEP_MS)}
              disabled={offset <= 0}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Less delay"
            >
              <Ionicons
                name="remove"
                size={20}
                color={offset <= 0 ? colors.textMuted : colors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{offset} ms</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => nudge(PLAYHEAD_OFFSET_STEP_MS)}
              disabled={offset >= PLAYHEAD_OFFSET_MAX_MS}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="More delay"
            >
              <Ionicons
                name="add"
                size={20}
                color={
                  offset >= PLAYHEAD_OFFSET_MAX_MS
                    ? colors.textMuted
                    : colors.textPrimary
                }
              />
            </TouchableOpacity>
          </View>

          <View style={styles.presets}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.label}
                style={[styles.preset, offset === p.ms && styles.presetActive]}
                onPress={() => {
                  hapticSelect();
                  setOffset(p.ms);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${p.label}, ${p.ms} milliseconds`}
              >
                <Text
                  style={[
                    styles.presetLabel,
                    offset === p.ms && styles.presetLabelActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.testBtn, testing && styles.testBtnActive]}
            onPress={toggleTest}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={testing ? "Stop the sync check" : "Start the sync check"}
          >
            <Ionicons
              name={testing ? "stop" : "play"}
              size={16}
              color={colors.white}
            />
            <Text style={styles.testLabel}>
              {testing ? "Stop" : "Check sync"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.explainer}>
            Four beats on a loop. Raise the delay until the lit dot lands with
            the note you hear. Wired and phone speakers need none of this;
            Bluetooth usually wants 120-200ms.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.body, color: colors.textPrimary },
  rowHint: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  value: { ...typography.body, color: colors.accent, fontWeight: "600" },

  panel: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  beats: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  beatDot: {
    width: 18,
    height: 18,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.border,
  },
  beatDotActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accentLight,
  },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperValue: {
    ...typography.h3,
    color: colors.textPrimary,
    minWidth: 80,
    textAlign: "center",
  },

  presets: { flexDirection: "row", gap: spacing.sm },
  preset: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: "center",
    backgroundColor: colors.chipInactive,
    borderWidth: 1,
    borderColor: colors.chipInactiveBorder,
  },
  presetActive: {
    backgroundColor: colors.chipActive,
    borderColor: colors.chipActiveBorder,
  },
  presetLabel: { ...typography.small, color: colors.textSecondary },
  presetLabelActive: { color: colors.textPrimary, fontWeight: "700" },

  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  testBtnActive: { backgroundColor: colors.error },
  testLabel: { color: colors.white, fontSize: 14, fontWeight: "700" },

  explainer: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 17,
  },
});
