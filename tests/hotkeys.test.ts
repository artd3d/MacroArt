import { describe, expect, it } from "vitest";
import { toAutoHotkeyChord, toWshSendKeysChord } from "../src/shared/hotkeySyntax";

describe("hotkey conversion", () => {
  it("converts common chords to AutoHotkey syntax", () => {
    expect(toAutoHotkeyChord("Ctrl+S")).toBe("^s");
    expect(toAutoHotkeyChord("Ctrl+Shift+S")).toBe("^+s");
    expect(toAutoHotkeyChord("Alt+F4")).toBe("!{F4}");
    expect(toAutoHotkeyChord("Win+E")).toBe("#e");
  });

  it("converts fallback chords to WScript SendKeys syntax", () => {
    expect(toWshSendKeysChord("Ctrl+S")).toBe("^s");
    expect(toWshSendKeysChord("Ctrl+Shift+S")).toBe("^+s");
    expect(toWshSendKeysChord("Alt+F4")).toBe("%{F4}");
  });

  it("rejects Windows-key fallback chords", () => {
    expect(() => toWshSendKeysChord("Win+E")).toThrow("Windows-key");
  });
});
