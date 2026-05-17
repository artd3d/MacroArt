import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AppSettings, MacroConfig, ProfileState } from "../shared/types";
import { createDefaultConfig, createDefaultProfileState } from "../shared/defaults";
import { normalizeConfig, normalizeProfileState, normalizeSettings } from "../shared/validation";

function isUntouchedDefaultState(state: ProfileState): boolean {
  if (state.profiles.length !== 1) {
    return false;
  }

  const [profile] = state.profiles;
  if (profile.pages.length !== 1) {
    return false;
  }

  const [page] = profile.pages;
  return page.buttons.every(
    (button, index) => !button.enabled && button.actions.length === 0 && button.label === `Button ${index + 1}`
  );
}

export class ConfigStore {
  private config: MacroConfig | null = null;
  private readonly filePath: string;

  constructor(filePath = join(app.getPath("userData"), "macrodeck.config.json")) {
    this.filePath = filePath;
  }

  async load(): Promise<MacroConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      this.config = normalizeConfig(JSON.parse(raw));
      if (isUntouchedDefaultState(this.config.profileState)) {
        this.config.profileState = createDefaultProfileState();
        await this.saveConfig(this.config);
      }
    } catch {
      this.config = await this.loadLegacyMacrodeckConfig();
      await this.saveConfig(this.config);
    }

    return this.config;
  }

  private async loadLegacyMacrodeckConfig(): Promise<MacroConfig> {
    const legacyPath = join(app.getPath("appData"), "Macrodeck", "macrodeck.config.json");

    try {
      const raw = await readFile(legacyPath, "utf8");
      return normalizeConfig(JSON.parse(raw));
    } catch {
      return createDefaultConfig();
    }
  }

  async getSettings(): Promise<AppSettings> {
    const config = await this.load();
    return config.settings;
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const config = await this.load();
    const next = normalizeSettings({
      ...config.settings,
      ...partial
    });

    config.settings = next;
    await this.saveConfig(config);
    return next;
  }

  async getProfileState(): Promise<ProfileState> {
    const config = await this.load();
    return config.profileState;
  }

  async updateProfileState(state: ProfileState): Promise<ProfileState> {
    const config = await this.load();
    const next = normalizeProfileState(state);

    config.profileState = next;
    await this.saveConfig(config);
    return next;
  }

  async importProfileState(value: unknown): Promise<ProfileState> {
    const state = normalizeProfileState(
      value && typeof value === "object" && "profileState" in value
        ? (value as { profileState: unknown }).profileState
        : value
    );

    return this.updateProfileState(state);
  }

  async exportConfig(): Promise<MacroConfig> {
    return this.load();
  }

  private async saveConfig(config: MacroConfig): Promise<void> {
    const normalized = normalizeConfig(config);
    const tempPath = `${this.filePath}.tmp`;

    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
    this.config = normalized;
  }
}
