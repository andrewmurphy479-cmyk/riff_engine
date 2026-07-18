import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { borderRadius, colors, spacing, typography } from "../theme/colors";

interface Props {
  /** Bar index the sheet is acting on; null hides the sheet. */
  barIndex: number | null;
  onLoopBar: (barIdx: number) => void;
  onRerollBar: (barIdx: number) => void;
  onClose: () => void;
}

/** Bottom sheet shown when a bar of the tab is tapped on the Create screen. */
export function BarActionSheet({ barIndex, onLoopBar, onRerollBar, onClose }: Props) {
  const visible = barIndex !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop backdrop presses from closing when tapping the sheet itself */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Bar {(barIndex ?? 0) + 1}</Text>

          <TouchableOpacity
            style={styles.option}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Loop bar ${(barIndex ?? 0) + 1}`}
            onPress={() => {
              if (barIndex !== null) onLoopBar(barIndex);
              onClose();
            }}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="repeat" size={20} color={colors.accent} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>Loop this bar</Text>
              <Text style={styles.optionHint}>
                Play just this bar on repeat to drill it
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Re-roll bar ${(barIndex ?? 0) + 1}`}
            onPress={() => {
              if (barIndex !== null) onRerollBar(barIndex);
              onClose();
            }}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="shuffle" size={20} color={colors.accent} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionLabel}>Re-roll this bar</Text>
              <Text style={styles.optionHint}>
                Keep the riff, generate new notes for this bar
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancel}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardSolid,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.textDisabled,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chipActive,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  optionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  cancelLabel: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
