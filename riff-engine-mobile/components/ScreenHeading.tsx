import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { analog } from "../theme/analog";
import { BrandWordmark } from "./BrandWordmark";

/** A quiet brand signature above each tab's actual job. */
export function ScreenHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <BrandWordmark width={108} />
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: "100%", maxWidth: 740, alignSelf: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  top: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 14, rowGap: 4 },
  title: { fontFamily: analog.headingFont, fontSize: 30, lineHeight: 38, fontWeight: "700", color: analog.oxblood, flexShrink: 1 },
  subtitle: { fontSize: 13, lineHeight: 19, color: analog.muted, marginTop: 4 },
});
