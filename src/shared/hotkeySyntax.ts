const MODIFIER_TO_AHK: Record<string, string> = {
  ctrl: "^",
  control: "^",
  shift: "+",
  alt: "!",
  option: "!",
  win: "#",
  windows: "#",
  meta: "#",
  cmd: "#",
  command: "#"
};

const MODIFIER_TO_WSH: Record<string, string> = {
  ctrl: "^",
  control: "^",
  shift: "+",
  alt: "%",
  option: "%"
};

const AHK_SPECIAL_KEYS: Record<string, string> = {
  enter: "{Enter}",
  return: "{Enter}",
  esc: "{Esc}",
  escape: "{Esc}",
  tab: "{Tab}",
  space: "{Space}",
  backspace: "{Backspace}",
  delete: "{Delete}",
  del: "{Delete}",
  insert: "{Insert}",
  home: "{Home}",
  end: "{End}",
  pageup: "{PgUp}",
  pagedown: "{PgDn}",
  up: "{Up}",
  down: "{Down}",
  left: "{Left}",
  right: "{Right}"
};

const WSH_SPECIAL_KEYS: Record<string, string> = {
  enter: "{ENTER}",
  return: "{ENTER}",
  esc: "{ESC}",
  escape: "{ESC}",
  tab: "{TAB}",
  space: " ",
  backspace: "{BACKSPACE}",
  delete: "{DELETE}",
  del: "{DELETE}",
  insert: "{INSERT}",
  home: "{HOME}",
  end: "{END}",
  pageup: "{PGUP}",
  pagedown: "{PGDN}",
  up: "{UP}",
  down: "{DOWN}",
  left: "{LEFT}",
  right: "{RIGHT}"
};

function splitChord(input: string): string[] {
  return input
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatAhkKey(key: string): string {
  const normalized = key.toLowerCase();

  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(normalized)) {
    return `{${normalized.toUpperCase()}}`;
  }

  return AHK_SPECIAL_KEYS[normalized] ?? key.toLowerCase();
}

function formatWshKey(key: string): string {
  const normalized = key.toLowerCase();

  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(normalized)) {
    return `{${normalized.toUpperCase()}}`;
  }

  return WSH_SPECIAL_KEYS[normalized] ?? key.toLowerCase();
}

export function toAutoHotkeyChord(input: string): string {
  const trimmed = input.trim();

  if (trimmed.includes("{") || trimmed.includes("}")) {
    return trimmed;
  }

  const parts = splitChord(trimmed);

  if (parts.length === 0) {
    throw new Error("Hotkey is empty.");
  }

  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1).map((part) => {
    const modifier = MODIFIER_TO_AHK[part.toLowerCase()];

    if (!modifier) {
      throw new Error(`Unknown hotkey modifier: ${part}`);
    }

    return modifier;
  });

  return `${modifiers.join("")}${formatAhkKey(key)}`;
}

export function toWshSendKeysChord(input: string): string {
  const parts = splitChord(input.trim());

  if (parts.length === 0) {
    throw new Error("Hotkey is empty.");
  }

  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1).map((part) => {
    const normalized = part.toLowerCase();
    const modifier = MODIFIER_TO_WSH[normalized];

    if (normalized === "win" || normalized === "windows" || normalized === "meta") {
      throw new Error("Windows-key hotkeys require the bundled AutoHotkey helper.");
    }

    if (!modifier) {
      throw new Error(`Unknown hotkey modifier: ${part}`);
    }

    return modifier;
  });

  return `${modifiers.join("")}${formatWshKey(key)}`;
}
