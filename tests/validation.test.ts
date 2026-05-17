import { describe, expect, it } from "vitest";
import { GRID_BUTTON_COUNT } from "../src/shared/types";
import { normalizeAction, normalizeConfig, normalizeProfileState } from "../src/shared/validation";

describe("config validation", () => {
  it("creates a complete default config from invalid input", () => {
    const config = normalizeConfig(null);
    const profile = config.profileState.profiles[0];
    const page = profile.pages[0];

    expect(config.version).toBe(1);
    expect(config.settings.launchAtStartup).toBe(false);
    expect(page.buttons).toHaveLength(GRID_BUTTON_COUNT);
    expect(page.buttons.some((button) => button.enabled === true)).toBe(true);
    expect(page.buttons.map((button) => button.label)).toContain("Toggle Stream");
  });

  it("rejects invalid actions and keeps valid action data", () => {
    expect(normalizeAction({ type: "hotkey", keys: "" })).toBeNull();
    expect(normalizeAction({ type: "delay", ms: -1 })).toBeNull();
    expect(normalizeAction({ type: "openUrl", url: "https://example.com" })).toEqual({
      type: "openUrl",
      url: "https://example.com"
    });
    expect(normalizeAction({ type: "delay", ms: "500" })).toEqual({
      type: "delay",
      ms: 500
    });
  });

  it("preserves imported button icon data URLs", () => {
    const state = normalizeProfileState({
      activeProfileId: "profile_a",
      profiles: [
        {
          id: "profile_a",
          name: "A",
          activePageId: "page_a",
          pages: [
            {
              id: "page_a",
              name: "Main",
              buttons: [
                {
                  id: "button_a",
                  label: "App",
                  color: "#00aa00",
                  icon: "app-window",
                  imageDataUrl: "data:image/png;base64,abc",
                  enabled: true,
                  actions: []
                }
              ]
            }
          ]
        }
      ]
    });

    expect(state.profiles[0].pages[0].buttons[0].imageDataUrl).toBe("data:image/png;base64,abc");
  });

  it("falls back to an available active profile and page", () => {
    const state = normalizeProfileState({
      activeProfileId: "missing",
      profiles: [
        {
          id: "profile_a",
          name: "A",
          activePageId: "missing",
          pages: [{ id: "page_a", name: "Main", buttons: [] }]
        }
      ]
    });

    expect(state.activeProfileId).toBe("profile_a");
    expect(state.profiles[0].activePageId).toBe("page_a");
    expect(state.profiles[0].pages[0].buttons).toHaveLength(GRID_BUTTON_COUNT);
  });
});
