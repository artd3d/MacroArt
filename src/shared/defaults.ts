import {
  CONFIG_VERSION,
  GRID_BUTTON_COUNT,
  type AppSettings,
  type MacroButton,
  type MacroConfig,
  type MacroPage,
  type MacroProfile,
  type ProfileState
} from "./types";

const DEFAULT_COLORS = [
  "#2fd17c",
  "#f5b84b",
  "#ef6f6c",
  "#6ea8fe",
  "#c084fc",
  "#4dd4c6",
  "#f28cb1",
  "#a3e635"
];

export const ICON_OPTIONS = [
  "zap",
  "keyboard",
  "app-window",
  "folder",
  "globe",
  "broadcast",
  "circle-dot",
  "corner-up-left",
  "play",
  "save",
  "camera",
  "mic",
  "monitor",
  "command",
  "music",
  "settings",
  "square",
  "circle"
] as const;

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createBlankButton(index: number): MacroButton {
  return {
    id: createId("button"),
    label: `Button ${index + 1}`,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    icon: ICON_OPTIONS[index % ICON_OPTIONS.length],
    enabled: false,
    actions: []
  };
}

function createPresetButton(index: number, button: Partial<MacroButton>): MacroButton {
  return {
    ...createBlankButton(index),
    ...button,
    id: createId("button"),
    enabled: button.enabled ?? true,
    actions: button.actions ?? []
  };
}

export function createDefaultPage(name = "Main"): MacroPage {
  const buttons = Array.from({ length: GRID_BUTTON_COUNT }, (_, index) => createBlankButton(index));

  buttons[0] = createPresetButton(0, {
    label: "",
    color: "#6a6a6a",
    icon: "corner-up-left",
    enabled: false
  });
  buttons[1] = createPresetButton(1, {
    label: "Toggle Stream",
    color: "#00b31a",
    icon: "broadcast",
    actions: [{ type: "hotkey", keys: "Ctrl+Shift+S" }]
  });
  buttons[2] = createPresetButton(2, {
    label: "Toggle Recording",
    color: "#00b31a",
    icon: "circle-dot",
    actions: [{ type: "hotkey", keys: "Ctrl+Shift+R" }]
  });
  buttons[4] = createPresetButton(4, {
    label: "Spotify",
    color: "#189647",
    icon: "folder",
    actions: [{ type: "openUrl", url: "https://open.spotify.com" }]
  });
  buttons[10] = createPresetButton(10, {
    label: "Scene 1",
    color: "#c40000",
    icon: "square",
    actions: [{ type: "hotkey", keys: "Ctrl+1" }]
  });
  buttons[11] = createPresetButton(11, {
    label: "Scene 2",
    color: "#00a6d6",
    icon: "square",
    actions: [{ type: "hotkey", keys: "Ctrl+2" }]
  });

  return {
    id: createId("page"),
    name,
    buttons
  };
}

export function createDefaultProfile(): MacroProfile {
  const page = createDefaultPage();

  return {
    id: createId("profile"),
    name: "Default",
    pages: [page],
    activePageId: page.id
  };
}

export function createDefaultProfileState(): ProfileState {
  const profile = createDefaultProfile();

  return {
    activeProfileId: profile.id,
    profiles: [profile]
  };
}

export function createDefaultSettings(): AppSettings {
  return {
    launchAtStartup: false
  };
}

export function createDefaultConfig(): MacroConfig {
  return {
    version: CONFIG_VERSION,
    settings: createDefaultSettings(),
    profileState: createDefaultProfileState()
  };
}
