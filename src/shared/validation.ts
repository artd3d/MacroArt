import {
  CONFIG_VERSION,
  GRID_BUTTON_COUNT,
  type AppSettings,
  type MacroAction,
  type MacroButton,
  type MacroConfig,
  type MacroPage,
  type MacroProfile,
  type ProfileState
} from "./types";
import {
  createBlankButton,
  createDefaultConfig,
  createDefaultPage,
  createDefaultProfile,
  createDefaultProfileState,
  createDefaultSettings,
  createId
} from "./defaults";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asOptionalDataUrl(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("data:image/") ? value : undefined;
}

function normalizeArgs(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const args = value.filter((item): item is string => typeof item === "string");
  return args.length > 0 ? args : undefined;
}

export function normalizeAction(value: unknown): MacroAction | null {
  if (!isObject(value) || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "hotkey": {
      const keys = asString(value.keys, "").trim();
      return keys.length > 0 ? { type: "hotkey", keys } : null;
    }
    case "launch": {
      const path = asString(value.path, "").trim();
      return path.length > 0 ? { type: "launch", path, args: normalizeArgs(value.args) } : null;
    }
    case "openPath": {
      const path = asString(value.path, "").trim();
      return path.length > 0 ? { type: "openPath", path } : null;
    }
    case "openUrl": {
      const url = asString(value.url, "").trim();
      return url.length > 0 ? { type: "openUrl", url } : null;
    }
    case "delay": {
      const ms = typeof value.ms === "number" ? Math.trunc(value.ms) : Number(value.ms);
      return Number.isFinite(ms) && ms >= 0 && ms <= 600_000 ? { type: "delay", ms } : null;
    }
    default:
      return null;
  }
}

export function normalizeButton(value: unknown, index: number): MacroButton {
  const fallback = createBlankButton(index);

  if (!isObject(value)) {
    return fallback;
  }

  const actions = Array.isArray(value.actions)
    ? value.actions.map(normalizeAction).filter((action): action is MacroAction => action !== null)
    : [];

  return {
    id: asString(value.id, fallback.id),
    label: asString(value.label, fallback.label),
    color: asString(value.color, fallback.color),
    icon: asString(value.icon, fallback.icon),
    imageDataUrl: asOptionalDataUrl(value.imageDataUrl),
    enabled: asBoolean(value.enabled, fallback.enabled),
    actions
  };
}

export function normalizePage(value: unknown, index: number): MacroPage {
  const fallback = createDefaultPage(index === 0 ? "Main" : `Page ${index + 1}`);

  if (!isObject(value)) {
    return fallback;
  }

  const rawButtons = Array.isArray(value.buttons) ? value.buttons : [];
  const buttons = Array.from({ length: GRID_BUTTON_COUNT }, (_, buttonIndex) =>
    normalizeButton(rawButtons[buttonIndex], buttonIndex)
  );

  return {
    id: asString(value.id, fallback.id),
    name: asString(value.name, fallback.name),
    buttons
  };
}

export function normalizeProfile(value: unknown, index: number): MacroProfile {
  const fallback = createDefaultProfile();

  if (!isObject(value)) {
    return {
      ...fallback,
      name: index === 0 ? fallback.name : `Profile ${index + 1}`
    };
  }

  const rawPages = Array.isArray(value.pages) && value.pages.length > 0 ? value.pages : [createDefaultPage()];
  const pages = rawPages.map(normalizePage);
  const activePageId = asString(value.activePageId, pages[0]?.id ?? createId("page"));
  const hasActivePage = pages.some((page) => page.id === activePageId);

  return {
    id: asString(value.id, fallback.id),
    name: asString(value.name, index === 0 ? "Default" : `Profile ${index + 1}`),
    pages,
    activePageId: hasActivePage ? activePageId : pages[0].id
  };
}

export function normalizeProfileState(value: unknown): ProfileState {
  if (!isObject(value)) {
    return createDefaultProfileState();
  }

  const rawProfiles = Array.isArray(value.profiles) && value.profiles.length > 0 ? value.profiles : [createDefaultProfile()];
  const profiles = rawProfiles.map(normalizeProfile);
  const activeProfileId = asString(value.activeProfileId, profiles[0]?.id ?? createId("profile"));
  const hasActiveProfile = profiles.some((profile) => profile.id === activeProfileId);

  return {
    activeProfileId: hasActiveProfile ? activeProfileId : profiles[0].id,
    profiles
  };
}

export function normalizeSettings(value: unknown): AppSettings {
  const fallback = createDefaultSettings();

  if (!isObject(value)) {
    return fallback;
  }

  return {
    selectedDisplayId: asOptionalString(value.selectedDisplayId),
    launchAtStartup: asBoolean(value.launchAtStartup, fallback.launchAtStartup)
  };
}

export function normalizeConfig(value: unknown): MacroConfig {
  if (!isObject(value)) {
    return createDefaultConfig();
  }

  return {
    version: CONFIG_VERSION,
    settings: normalizeSettings(value.settings),
    profileState: normalizeProfileState(value.profileState)
  };
}
