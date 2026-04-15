import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { ChordArmoryReference } from "../../components/ChordArmoryReference";
import { colors } from "../../theme/colors";

export default function ArmoryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ChordArmoryReference />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
