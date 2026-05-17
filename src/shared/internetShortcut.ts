export type InternetShortcut = {
  url?: string;
  iconFile?: string;
};

function cleanShortcutValue(value: string): string {
  return value.trim().replace(/^"|"$/g, "");
}

export function parseInternetShortcut(content: string): InternetShortcut {
  const shortcut: InternetShortcut = {};

  for (const line of content.split(/\r?\n/)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = cleanShortcutValue(line.slice(separatorIndex + 1));

    if (!value) {
      continue;
    }

    if (key === "url") {
      shortcut.url = value;
    }

    if (key === "iconfile") {
      shortcut.iconFile = value;
    }
  }

  return shortcut;
}
