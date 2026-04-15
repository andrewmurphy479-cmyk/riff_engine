import React from "react";
import { StyleSheet, View } from "react-native";
import { SCALE_PRETTY } from "../engine/riff/display";
import { RiffSpec } from "../engine/riff/spec";
import { spacing } from "../theme/colors";
import { MetaPair } from "./ui/MetaPair";

interface Props {
  riff: RiffSpec;
  currentBarIndex: number;
  phraseTag: string;
}

export function RiffBarMetaStrip({ riff, currentBarIndex, phraseTag }: Props) {
  const scalePretty = riff.scale
    .replace(/_/g, " ")
    .replace("+blue", " + blue");
  const intervalHint = SCALE_PRETTY[riff.scale];
  const notesInBar = riff.bars[currentBarIndex]?.notes.length ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        <MetaPair label="Key" value={`${riff.key} ${scalePretty}`} />
        <MetaPair label="Tempo" value={`${riff.tempo_bpm} BPM`} />
        {riff.feel && <MetaPair label="Feel" value={riff.feel} />}
        {riff.rhythm_name && (
          <MetaPair label="Rhythm" value={riff.rhythm_name} />
        )}
        <MetaPair
          label="Bar"
          value={`${currentBarIndex + 1} · ${phraseTag} · ${notesInBar} notes`}
        />
        {intervalHint && <MetaPair label="Scale" value={intervalHint} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: "#12121e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
    columnGap: 16,
  },
});
