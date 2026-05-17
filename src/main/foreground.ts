import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BrowserWindow } from "electron";

const execFileAsync = promisify(execFile);

export type ForegroundWindowInfo = {
  hwnd: number;
  processId: number;
};

const GET_FOREGROUND_SCRIPT = `
$signature = @'
using System;
using System.Runtime.InteropServices;
public static class MacrodeckForegroundWindow {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@
Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue | Out-Null
$hwnd = [MacrodeckForegroundWindow]::GetForegroundWindow()
$processId = 0
[MacrodeckForegroundWindow]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null
[pscustomobject]@{ hwnd = $hwnd.ToInt64(); processId = $processId } | ConvertTo-Json -Compress
`;

export async function getForegroundWindowInfo(): Promise<ForegroundWindowInfo | null> {
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", GET_FOREGROUND_SCRIPT],
      { windowsHide: true, timeout: 4_000 }
    );
    const parsed = JSON.parse(stdout.trim()) as ForegroundWindowInfo;

    if (!Number.isFinite(parsed.hwnd) || parsed.hwnd <= 0 || !Number.isFinite(parsed.processId)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export class ForegroundTracker {
  private lastExternalHwnd: number | null = null;
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly window: BrowserWindow) {}

  start(): void {
    this.sample();
    this.interval = setInterval(() => {
      if (!this.window.isDestroyed() && !this.window.isFocused()) {
        this.sample();
      }
    }, 1_200);

    this.window.on("blur", () => {
      setTimeout(() => this.sample(), 120);
    });
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getLastExternalHwnd(): number | null {
    return this.lastExternalHwnd;
  }

  private async sample(): Promise<void> {
    const info = await getForegroundWindowInfo();

    if (!info || info.processId === process.pid) {
      return;
    }

    this.lastExternalHwnd = info.hwnd;
  }
}
