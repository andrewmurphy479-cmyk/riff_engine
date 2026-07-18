import * as Haptics from "expo-haptics";

// Thin fire-and-forget wrappers: haptics are decoration, never let an
// unsupported platform (web, some emulators) surface an error.

/** Light impact — play/stop and other primary action presses. */
export function hapticTap(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Selection tick — chips, steppers, toggles. */
export function hapticSelect(): void {
  Haptics.selectionAsync().catch(() => {});
}

/** Success notification — daily goal met and similar wins. */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}
