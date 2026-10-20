import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRemoveAds } from "../lib/useRemoveAds";
import { analog } from "../theme/analog";
import { borderRadius, colors, spacing, typography } from "../theme/colors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: "flash-outline", text: "Generate riff after riff with no ads in between" },
  { icon: "pricetag-outline", text: "One-time purchase — no subscription" },
  { icon: "phone-portrait-outline", text: "Restores on any device with your store account" },
];

/** The Remove Ads offer: auto-shown after a player's first ad, and from Settings. */
export function RemoveAdsSheet({ visible, onClose }: Props) {
  const { adsRemoved, product, busy, purchase, restore } = useRemoveAds();
  const [pendingNotice, setPendingNotice] = useState(false);

  const handlePurchase = async () => {
    const outcome = await purchase();
    if (outcome.status === "pending") {
      setPendingNotice(true);
    } else if (outcome.status === "error") {
      Alert.alert("Something went wrong", outcome.message);
    }
    // "purchased" flips adsRemoved through the store; "cancelled" needs no
    // feedback — the player closed the store sheet themselves.
  };

  const handleRestore = async () => {
    const result = await restore();
    if (result === "restored") {
      Alert.alert("Welcome back", "Your purchase has been restored.");
    } else if (result === "none") {
      Alert.alert("Nothing to restore", "No previous purchase was found for this account.");
    } else {
      Alert.alert("Couldn't reach the store", "Please check your connection and try again.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop backdrop presses from closing when tapping the sheet itself */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.badge}>
            <Ionicons
              name={adsRemoved ? "checkmark" : "musical-notes"}
              size={26}
              color={colors.accent}
            />
          </View>

          {adsRemoved ? (
            <>
              <Text style={styles.title}>Ads removed</Text>
              <Text style={styles.body}>
                Thanks for supporting Riffology. Every riff from here on is yours,
                uninterrupted.
              </Text>
              <TouchableOpacity
                style={styles.buyButton}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={onClose}
              >
                <Text style={styles.buyLabel}>Back to the riffs</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Keep the riffs coming</Text>
              <Text style={styles.body}>
                Riffology is made by one guitarist. Remove ads once and practice
                without the interruptions — for good.
              </Text>

              <View style={styles.benefits}>
                {BENEFITS.map(({ icon, text }) => (
                  <View key={text} style={styles.benefitRow}>
                    <Ionicons name={icon} size={18} color={colors.accent} />
                    <Text style={styles.benefitText}>{text}</Text>
                  </View>
                ))}
              </View>

              {pendingNotice && (
                <Text style={styles.pendingNotice}>
                  Your payment is processing — ads will disappear as soon as it
                  completes.
                </Text>
              )}

              <TouchableOpacity
                style={[styles.buyButton, (busy || !product) && styles.buyDisabled]}
                activeOpacity={0.8}
                disabled={busy || !product}
                accessibilityRole="button"
                accessibilityLabel={
                  product ? `Remove ads for ${product.displayPrice}` : "Store unavailable"
                }
                onPress={handlePurchase}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buyLabel}>
                    {product ? `Remove ads · ${product.displayPrice}` : "Store unavailable"}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.secondaryRow}>
                <TouchableOpacity
                  style={styles.secondary}
                  activeOpacity={0.7}
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={handleRestore}
                >
                  <Text style={styles.secondaryLabel}>Restore purchase</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondary}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  onPress={onClose}
                >
                  <Text style={styles.secondaryLabel}>Not now</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    alignItems: "center",
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.textDisabled,
    marginBottom: spacing.lg,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: analog.butter,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: {
    ...typography.body,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 360,
  },
  benefits: {
    alignSelf: "stretch",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  benefitText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  pendingNotice: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.md,
  },
  buyButton: {
    alignSelf: "stretch",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
    marginTop: spacing.lg,
  },
  buyDisabled: {
    opacity: 0.5,
  },
  buyLabel: {
    ...typography.body,
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
  secondaryRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  secondary: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  secondaryLabel: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
