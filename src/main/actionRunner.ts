import { shell } from "electron";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { MacroAction, MacroButton, TriggerResult } from "../shared/types";
import { parseInternetShortcut } from "../shared/internetShortcut";
import type { ConfigStore } from "./storage";
import { sendHotkey } from "./hotkeys";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findButton(buttons: MacroButton[], buttonId: string): MacroButton | null {
  return buttons.find((button) => button.id === buttonId) ?? null;
}

function isShellAppsFolderTarget(value: string): boolean {
  return value.toLowerCase().startsWith("shell:appsfolder\\");
}

async function spawnDetached(command: string, args: string[], useShell = false): Promise<void> {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: useShell
  });

  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });

  child.unref();
}

async function launchProgram(path: string, args: string[] = []): Promise<void> {
  const trimmedPath = path.trim();

  if (!trimmedPath) {
    throw new Error("Launch app path is empty.");
  }

  if (args.length === 0 && isShellAppsFolderTarget(trimmedPath)) {
    await spawnDetached("explorer.exe", [trimmedPath]);
    return;
  }

  const extension = extname(trimmedPath).toLowerCase();

  if (args.length === 0 && extension === ".url") {
    const shortcut = parseInternetShortcut(await readFile(trimmedPath, "utf8"));

    if (!shortcut.url) {
      throw new Error("Shortcut does not contain a URL.");
    }

    await openAllowedUrl(shortcut.url);
    return;
  }

  if (args.length === 0 && extension === ".lnk") {
    const error = await shell.openPath(trimmedPath);
    if (error) {
      throw new Error(error);
    }
    return;
  }

  const command =
    extension === ".ps1"
      ? "powershell.exe"
      : trimmedPath;
  const commandArgs =
    extension === ".ps1"
      ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", trimmedPath, ...args]
      : args;

  await spawnDetached(command, commandArgs, extension === ".bat" || extension === ".cmd");
}

async function openAllowedUrl(value: string): Promise<void> {
  const url = new URL(value);

  if (!["http:", "https:", "mailto:", "steam:"].includes(url.protocol)) {
    throw new Error("Only http, https, mailto, and steam URLs are allowed.");
  }

  await shell.openExternal(url.toString());
}

export class ActionRunner {
  constructor(
    private readonly store: ConfigStore,
    private readonly getTargetHwnd: () => number | null
  ) {}

  async triggerButton(buttonId: string): Promise<TriggerResult> {
    const profileState = await this.store.getProfileState();
    const profile = profileState.profiles.find((item) => item.id === profileState.activeProfileId);
    const page = profile?.pages.find((item) => item.id === profile.activePageId);
    const button = page ? findButton(page.buttons, buttonId) : null;

    if (!button) {
      return { ok: false, message: "Button was not found." };
    }

    if (!button.enabled) {
      return { ok: false, message: "Button is disabled." };
    }

    if (button.actions.length === 0) {
      return { ok: false, message: "Button has no actions." };
    }

    try {
      for (const action of button.actions) {
        await this.executeAction(action);
      }

      return { ok: true, message: `${button.label} completed.` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Action failed."
      };
    }
  }

  private async executeAction(action: MacroAction): Promise<void> {
    switch (action.type) {
      case "hotkey":
        await sendHotkey(action.keys, this.getTargetHwnd());
        return;

      case "launch": {
        await launchProgram(action.path, action.args ?? []);
        return;
      }

      case "openPath": {
        const error = await shell.openPath(action.path);
        if (error) {
          throw new Error(error);
        }
        return;
      }

      case "openUrl": {
        await openAllowedUrl(action.url);
        return;
      }

      case "delay":
        await delay(action.ms);
        return;

      default:
        action satisfies never;
    }
  }
}
