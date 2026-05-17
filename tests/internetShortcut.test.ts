import { describe, expect, it } from "vitest";
import { parseInternetShortcut } from "../src/shared/internetShortcut";

describe("internet shortcut parser", () => {
  it("extracts Steam game URL and icon path from a Windows .url file", () => {
    const shortcut = parseInternetShortcut(`
[InternetShortcut]
URL=steam://rungameid/570
IconFile=F:\\Steam\\steam\\games\\dota.ico
IconIndex=0
`);

    expect(shortcut.url).toBe("steam://rungameid/570");
    expect(shortcut.iconFile).toBe("F:\\Steam\\steam\\games\\dota.ico");
  });
});
