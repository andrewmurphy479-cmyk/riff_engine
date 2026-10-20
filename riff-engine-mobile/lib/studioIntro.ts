import AsyncStorage from "@react-native-async-storage/async-storage";

const STUDIO_INTRO_KEY = "riff-engine:studio-intro-date:v1";

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Whether the "LPK Apps" studio intro plays this launch. Once per local day,
 * as in Root Word: the intro suits the launch that feels like opening the app
 * fresh, and is pure tax on the quick repeat sessions a daily practice habit
 * depends on.
 *
 * Stamps the date as a side effect, so a launch abandoned mid-intro still
 * counts. Errs toward playing — a failed storage read shouldn't quietly retire
 * the studio moment.
 */
export async function shouldPlayStudioIntro(now: Date = new Date()): Promise<boolean> {
  try {
    const today = localDateKey(now);
    const last = await AsyncStorage.getItem(STUDIO_INTRO_KEY);
    if (last === today) return false;
    await AsyncStorage.setItem(STUDIO_INTRO_KEY, today);
    return true;
  } catch {
    return true;
  }
}
