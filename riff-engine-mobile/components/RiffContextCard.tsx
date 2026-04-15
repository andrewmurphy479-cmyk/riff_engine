import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  PHRASE_NARRATIVES,
  RHYTHM_DESCRIPTIONS,
  ROLE_COLORS,
  ROLE_NARRATIVES,
  ROLE_ORDER,
  SCALE_DESCRIPTIONS,
} from "../engine/riff/display";
import { midiAt } from "../engine/riff/fretboard";
import { roleOf } from "../engine/riff/scale";
import { RiffSpec } from "../engine/riff/spec";
import { colors, spacing } from "../theme/colors";

interface Props {
  riff: RiffSpec;
  currentBarIndex: number;
}

export function RiffContextCard({ riff, currentBarIndex }: Props) {
  const includeBlue = riff.scale.includes("blue");
  const scaleDesc = SCALE_DESCRIPTIONS[riff.scale];
  const phraseDesc = PHRASE_NARRATIVES[riff.motif_structure];
  const rhythmDesc = riff.rhythm_name
    ? RHYTHM_DESCRIPTIONS[riff.rhythm_name]
    : null;

  const rolesInBar = useMemo(() => {
    const bar = riff.bars[currentBarIndex];
    if (!bar) return [] as string[];
    const seen = new Set<string>();
    for (const n of bar.notes) {
      const role = roleOf(midiAt(n.string, n.fret), riff.key, includeBlue);
      if (role) seen.add(role);
    }
    return ROLE_ORDER.filter((r) => seen.has(r));
  }, [riff, currentBarIndex, includeBlue]);

  return (
    <View style={styles.card}>
      <Section title="Scale">
        {scaleDesc ? (
          <Text style={styles.body}>{scaleDesc}</Text>
        ) : (
          <Text style={styles.bodyMuted}>No scale description available.</Text>
        )}
      </Section>

      <Section title="Phrase">
        {phraseDesc ? (
          <Text style={styles.body}>{phraseDesc}</Text>
        ) : (
          <Text style={styles.bodyMuted}>
            Motif: {riff.motif_structure}
          </Text>
        )}
      </Section>

      {rhythmDesc && (
        <Section title="Rhythm">
          <Text style={styles.body}>{rhythmDesc}</Text>
        </Section>
      )}

      <Section title={`Bar ${currentBarIndex + 1} — roles`}>
        {rolesInBar.length === 0 ? (
          <Text style={styles.bodyMuted}>No pool notes in this bar.</Text>
        ) : (
          <View style={styles.rolesList}>
            {rolesInBar.map((role) => (
              <View key={role} style={styles.roleRow}>
                <View
                  style={[
                    styles.roleDot,
                    { backgroundColor: ROLE_COLORS[role] },
                  ]}
                />
                <Text style={styles.roleLabel}>{role}</Text>
                <Text style={styles.roleBody}>{ROLE_NARRATIVES[role]}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: "#12121e",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: spacing.md,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  body: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 19,
  },
  bodyMuted: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  rolesList: {
    gap: 10,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  roleLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    width: 38,
    marginTop: 2,
  },
  roleBody: {
    flex: 1,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    lineHeight: 17,
  },
});
