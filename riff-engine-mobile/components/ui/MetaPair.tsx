import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme/colors";

interface Props {
  label: string;
  value: string;
}

export function MetaPair({ label, value }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    maxWidth: "100%",
    alignItems: "center",
    gap: 6,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 12,
    flexShrink: 1,
    fontFamily: "monospace",
  },
});
