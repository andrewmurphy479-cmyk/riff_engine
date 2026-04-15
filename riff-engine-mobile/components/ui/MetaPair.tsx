import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  label: string;
  value: string;
}

export function MetaPair({ label, value }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  value: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: "monospace",
  },
});
