import { app } from "electron";
import { access } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { toAutoHotkeyChord, toWshSendKeysChord } from "../shared/hotkeySyntax";

const execFileAsync = promisify(execFile);

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function firstWhereResult(executable: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("where.exe", [executable], {
      windowsHide: true,
      timeout: 2_000
    });
    const [first] = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return first ?? null;
  } catch {
    return null;
  }
}

async function findAutoHotkeyExecutable(): Promise<string | null> {
  const automationDir = app.isPackaged
    ? join(process.resourcesPath, "automation")
    : resolve(process.cwd(), "resources", "automation");

  const bundled = join(automationDir, "AutoHotkey64.exe");

  if (await exists(bundled)) {
    return bundled;
  }

  return (await firstWhereResult("AutoHotkey64.exe")) ?? (await firstWhereResult("AutoHotkey.exe"));
}

function getHotkeyScriptPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "automation", "send-hotkey.ahk")
    : resolve(process.cwd(), "resources", "automation", "send-hotkey.ahk");
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replaceAll("'", "''");
}

async function sendWithPowerShellFallback(keys: string, targetHwnd: number | null): Promise<void> {
  const sendKeys = escapePowerShellSingleQuoted(toWshSendKeysChord(keys));
  const hwnd = targetHwnd ?? 0;
  const script = `
$signature = @'
using System;
using System.Runtime.InteropServices;
public static class MacrodeckHotkeyTarget {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue | Out-Null
if (${hwnd} -gt 0) {
  [MacrodeckHotkeyTarget]::SetForegroundWindow([IntPtr]${hwnd}) | Out-Null
  Start-Sleep -Milliseconds 120
}
$wshell = New-Object -ComObject WScript.Shell
$wshell.SendKeys('${sendKeys}')
`;

  await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    windowsHide: true,
    timeout: 5_000
  });
}

export async function sendHotkey(keys: string, targetHwnd: number | null): Promise<void> {
  const autoHotkey = await findAutoHotkeyExecutable();

  if (!autoHotkey) {
    await sendWithPowerShellFallback(keys, targetHwnd);
    return;
  }

  const child = spawn(autoHotkey, [getHotkeyScriptPath(), String(targetHwnd ?? 0), toAutoHotkeyChord(keys)], {
    stdio: "ignore",
    windowsHide: true
  });

  await new Promise<void>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`AutoHotkey exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}
