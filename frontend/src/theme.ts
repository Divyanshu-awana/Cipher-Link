/**
 * CipherLink theme tokens, derived from /app/design_guidelines.json.
 */
export type ThemeMode = "light" | "dark";

export const COLORS = {
  primary: "#1A73E8",
  aiAccent: "#7C3AED",
  aiAccent2: "#14B8A6",
  success: "#34A853",
  error: "#EA4335",
  warning: "#FBBC04",
  light: {
    background: "#F8F9FA",
    surface: "#FFFFFF",
    surfaceVariant: "#F1F3F4",
    textPrimary: "#202124",
    textSecondary: "#5F6368",
    border: "#E8EAED",
    bubbleSent: "#1A73E8",
    bubbleReceived: "#E8EAED",
    bubbleTextSent: "#FFFFFF",
    bubbleTextReceived: "#202124",
    tabBar: "#FFFFFF",
  },
  dark: {
    background: "#121212",
    surface: "#1E1E1E",
    surfaceVariant: "#2D2D2D",
    textPrimary: "#E8EAED",
    textSecondary: "#9AA0A6",
    border: "#3C4043",
    bubbleSent: "#1A73E8",
    bubbleReceived: "#2D2D2D",
    bubbleTextSent: "#FFFFFF",
    bubbleTextReceived: "#E8EAED",
    tabBar: "#1E1E1E",
  },
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const RADIUS = { card: 16, bubble: 24, button: 100, avatar: 100 };

export const ELEVATION = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.62,
    elevation: 4,
  },
  ai: {
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
};

export const TYPO = {
  h1: { fontSize: 32, fontWeight: "700" as const },
  h2: { fontSize: 24, fontWeight: "700" as const },
  h3: { fontSize: 20, fontWeight: "600" as const },
  bodyLg: { fontSize: 18, fontWeight: "400" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  caption: { fontSize: 14, fontWeight: "400" as const },
  micro: { fontSize: 12, fontWeight: "400" as const },
};

export const ASSETS = {
  cipherAvatar:
    "https://static.prod-images.emergentagent.com/jobs/516fd2f8-6558-4f6e-aaa0-027f1fc37246/images/c43a0ce85323c89a50e371fea68353d90ea9a976d2ab626e93d84ecf860313d2.png",
  onboardingHero:
    "https://static.prod-images.emergentagent.com/jobs/516fd2f8-6558-4f6e-aaa0-027f1fc37246/images/a9d606360b2ddf3f9540b9d96a38bfb11a5eacc5a2f679a306c6c7486a1349fb.png",
  humanAvatars: [
    "https://images.unsplash.com/photo-1647969539749-edae0467472b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwzfHxkaXZlcnNlJTIwcG9ydHJhaXQlMjBmYWNlfGVufDB8fHx8MTc3NzYzOTkzMnww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1647970761845-e64f18b4edae?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHw0fHxkaXZlcnNlJTIwcG9ydHJhaXQlMjBmYWNlfGVufDB8fHx8MTc3NzYzOTkzMnww&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1775817647097-04b0cfad5cd2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwcG9ydHJhaXQlMjBmYWNlfGVufDB8fHx8MTc3NzYzOTkzMnww&ixlib=rb-4.1.0&q=85",
  ],
  restaurant:
    "https://images.unsplash.com/photo-1642158136957-0f43fb43d3cb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwyfHxpdGFsaWFuJTIwZm9vZCUyMGNhZmV8ZW58MHx8fHwxNzc3NjM5OTMyfDA&ixlib=rb-4.1.0&q=85",
  weather:
    "https://images.unsplash.com/photo-1590064438961-e815cd0e19b5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwyfHxzdW5ueSUyMHdlYXRoZXIlMjBsYW5kc2NhcGV8ZW58MHx8fHwxNzc3NjM5OTMyfDA&ixlib=rb-4.1.0&q=85",
};

export function pickColors(mode: ThemeMode) {
  return mode === "dark" ? COLORS.dark : COLORS.light;
}

/** Stable avatar selector based on user id */
export function avatarFor(seed: string): string {
  if (!seed) return ASSETS.humanAvatars[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  return ASSETS.humanAvatars[Math.abs(h) % ASSETS.humanAvatars.length];
}
