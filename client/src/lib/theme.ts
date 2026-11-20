import { useColorScheme } from "react-native";

const light = {
  bg: "#FAFAF9",
  surface: "#FFFFFF",
  ink: "#18181B",
  muted: "#71717A",
  faint: "#A1A1AA",
  line: "#E7E5E4",
  sentBg: "#27272A",
  sentInk: "#FAFAF9",
  recvBg: "#EFEEEC",
  recvInk: "#18181B",
  danger: "#B42318",
};

const dark: typeof light = {
  bg: "#111113",
  surface: "#18181B",
  ink: "#F4F4F5",
  muted: "#A1A1AA",
  faint: "#71717A",
  line: "#3A3A40",
  sentBg: "#E4E4E7",
  sentInk: "#18181B",
  recvBg: "#232326",
  recvInk: "#F4F4F5",
  danger: "#F97066",
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);
export const FRAME_WIDTH = 720;
