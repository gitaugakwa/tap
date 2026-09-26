import { Platform } from "react-native";

const ink = "#171713";
const paper = "#f3eee3";
const orange = "#f45b35";
const acid = "#e9ff70";
const mint = "#a7f3bd";
const mintText = "#175c29";

export const theme = {
  colors: {
    background: ink,
    surface: paper,
    onSurface: ink,
    onSurfaceMuted: "#5b5b51",
    foreground: paper,
    muted: "#9a988c",
    line: "rgba(243, 238, 227, 0.14)",
    accent: acid,
    accentText: ink,
    success: mint,
    successText: mintText,
    warning: orange,
    failure: orange,
  },
  radius: { sm: 8, md: 13, lg: 22, pill: 999 },
  shadowOffset: 5,
  spacing: 8,
  type: {
    display: {
      fontFamily: Platform.select({ android: "serif", default: undefined }),
      letterSpacing: -1,
    },
    label: {
      fontFamily: Platform.select({ android: "sans-serif-condensed", default: undefined }),
      fontWeight: "700" as const,
      letterSpacing: 1.4,
      textTransform: "uppercase" as const,
    },
  },
} as const;
