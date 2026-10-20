import { Platform } from "react-native";

/** Shared Analog Club identity across the app. */
export const analog = {
  paper: "#FFF9E8",
  butter: "#F5D76C",
  oxblood: "#722C3D",
  indigo: "#343B80",
  ink: "#292D35",
  muted: "#6C625D",
  line: "#DFD5C3",
  inset: "#F3ECDD",
  selected: "#F4E4DE",
  success: "#38614C",
  headingFont: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" }),
  roleColors: {
    root: "#722C3D", b3: "#725A1F", "4": "#326B62", "5": "#9A4826",
    b7: "#6C4582", blue: "#795117", "?": "#6C625D",
  } as Record<string, string>,
} as const;
