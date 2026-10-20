import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PlayheadSyncRow } from "../components/PlayheadSyncRow";
import { RemoveAdsSheet } from "../components/RemoveAdsSheet";
import { useRemoveAds } from "../lib/useRemoveAds";
import { isAdPrivacyOptionsRequired, showAdPrivacyOptions } from "../monetization/consent";
import { GENRES, usePracticeStore } from "../store/usePracticeStore";
import { useNewRiffStore } from "../store/useNewRiffStore";
import { borderRadius, colors, spacing, typography } from "../theme/colors";

const PRIVACY_POLICY_URL = "https://andrewmurphy479-cmyk.github.io/riffology-privacy/";
const SUPPORT_URL = "https://andrewmurphy479-cmyk.github.io/riffology-privacy/support.html";

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SettingsScreen() {
  const profile = usePracticeStore((s) => s.profile);
  const resetOnboarding = usePracticeStore((s) => s.resetOnboarding);

  const metronomeEnabled = useNewRiffStore((s) => s.metronomeEnabled);
  const countInEnabled = useNewRiffStore((s) => s.countInEnabled);
  const toggleMetronome = useNewRiffStore((s) => s.toggleMetronome);
  const toggleCountIn = useNewRiffStore((s) => s.toggleCountIn);

  const genreLabels = (profile?.genres ?? [])
    .map((id) => GENRES.find((g) => g.id === id)?.label)
    .filter(Boolean)
    .join(" · ");

  const handleRerunSetup = useCallback(() => {
    Alert.alert(
      "Redo setup?",
      "This re-runs the level, genre, and taste check. Today's practice session will be rebuilt; your streak and stats are kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redo setup",
          style: "destructive",
          // The root layout's guard swaps to the onboarding stack once
          // onboardingComplete flips, unmounting this modal with it.
          onPress: () => resetOnboarding(),
        },
      ],
    );
  }, [resetOnboarding]);

  const openLink = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert("Couldn't open link", url);
    });
  }, []);

  // Only players in regions that require it (EEA, UK, Switzerland) get the
  // row; Google's policy requires a way to change consent there.
  const [adPrivacyRequired, setAdPrivacyRequired] = useState(false);
  useEffect(() => {
    let mounted = true;
    isAdPrivacyOptionsRequired().then((required) => {
      if (mounted) setAdPrivacyRequired(required);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleAdPrivacy = useCallback(async () => {
    const shown = await showAdPrivacyOptions();
    if (!shown) {
      Alert.alert("Couldn't open ad choices", "Please check your connection and try again.");
    }
  }, []);

  const { adsRemoved, restore } = useRemoveAds();
  const [removeAdsOpen, setRemoveAdsOpen] = useState(false);

  const handleRestorePurchases = useCallback(async () => {
    const result = await restore();
    if (result === "restored") {
      Alert.alert("Welcome back", "Your purchase has been restored.");
    } else if (result === "none") {
      Alert.alert("Nothing to restore", "No previous purchase was found for this account.");
    } else {
      Alert.alert("Couldn't reach the store", "Please check your connection and try again.");
    }
  }, [restore]);

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile */}
      <Text style={styles.sectionLabel}>PROFILE</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Level</Text>
            <Text style={styles.rowValue}>
              {profile ? titleCase(profile.level) : "Not set"}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Genres</Text>
            <Text style={styles.rowValue}>
              {genreLabels || "Not set"}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.row}
          onPress={handleRerunSetup}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Redo the setup and taste check"
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, styles.linkTitle]}>
              Redo setup & taste check
            </Text>
            <Text style={styles.rowHint}>
              Change your level and genres from scratch
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Audio */}
      <Text style={styles.sectionLabel}>AUDIO</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Metronome click</Text>
            <Text style={styles.rowHint}>Click track during playback</Text>
          </View>
          <Switch
            value={metronomeEnabled}
            onValueChange={toggleMetronome}
            trackColor={{ false: colors.chipInactive, true: colors.accentDark }}
            thumbColor={metronomeEnabled ? colors.accentLight : colors.textMuted}
            accessibilityLabel="Metronome click"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Count-in</Text>
            <Text style={styles.rowHint}>Four clicks before playback starts</Text>
          </View>
          <Switch
            value={countInEnabled}
            onValueChange={toggleCountIn}
            trackColor={{ false: colors.chipInactive, true: colors.accentDark }}
            thumbColor={countInEnabled ? colors.accentLight : colors.textMuted}
            accessibilityLabel="Count-in before playback"
          />
        </View>
        <View style={styles.divider} />
        <PlayheadSyncRow />
      </View>

      {/* Purchases */}
      <Text style={styles.sectionLabel}>PURCHASES</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => setRemoveAdsOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={adsRemoved ? "Ads removed" : "Remove ads"}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, !adsRemoved && styles.linkTitle]}>
              {adsRemoved ? "Ads removed" : "Remove ads"}
            </Text>
            <Text style={styles.rowHint}>
              {adsRemoved
                ? "Thanks for supporting Riffology"
                : "One-time purchase, no subscription"}
            </Text>
          </View>
          <Ionicons
            name={adsRemoved ? "checkmark-circle" : "chevron-forward"}
            size={18}
            color={adsRemoved ? colors.success : colors.textMuted}
          />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.row}
          onPress={handleRestorePurchases}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Restore purchases</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* About */}
      <Text style={styles.sectionLabel}>ABOUT</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Version</Text>
          </View>
          <Text style={styles.rowValue}>{version}</Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.row}
          onPress={() => openLink(PRIVACY_POLICY_URL)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Privacy policy"
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Privacy policy</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.row}
          onPress={() => openLink(SUPPORT_URL)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Help and support"
        >
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Help & support</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {adPrivacyRequired && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.row}
              onPress={handleAdPrivacy}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Ad privacy choices"
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Ad privacy choices</Text>
                <Text style={styles.rowHint}>Change your personalised-ads consent</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.footerNote}>Riffology · practice riffs, daily</Text>

      <RemoveAdsSheet visible={removeAdsOpen} onClose={() => setRemoveAdsOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionLabel: {
    ...typography.small,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  linkTitle: {
    color: colors.accent,
  },
  rowValue: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
  footerNote: {
    ...typography.caption,
    color: colors.textDisabled,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
});
