import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ActionRunner } from "./actionRunner";
import { ForegroundTracker } from "./foreground";
import { ConfigStore } from "./storage";
import type { AppSettings, DisplayInfo, ProfileState } from "../shared/types";
import { parseInternetShortcut } from "../shared/internetShortcut";
import { normalizeProfileState } from "../shared/validation";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const APP_NAME = "MacroArt";
const DEV_ICON_PATH = join(process.cwd(), "build", "icon.ico");

app.setName(APP_NAME);

let mainWindow: BrowserWindow | null = null;
let foregroundTracker: ForegroundTracker | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let store: ConfigStore;
let actionRunner: ActionRunner;

function getAppIconPath(): string {
  return app.isPackaged ? join(process.resourcesPath, "icon.ico") : DEV_ICON_PATH;
}

function serializeDisplays(): DisplayInfo[] {
  const primaryId = screen.getPrimaryDisplay().id;

  return screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: `${display.id === primaryId ? "Primary" : "Display"} ${index + 1}`,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    primary: display.id === primaryId
  }));
}

function getDisplayById(displayId?: string): Electron.Display | null {
  if (!displayId) {
    return null;
  }

  return screen.getAllDisplays().find((display) => String(display.id) === displayId) ?? null;
}

function chooseLaunchDisplayId(settings: AppSettings): string | undefined {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  const savedDisplay = getDisplayById(settings.selectedDisplayId);
  const preferred = displays[2] ?? savedDisplay ?? displays.find((display) => display.id !== primaryId) ?? displays[0];

  return preferred ? String(preferred.id) : undefined;
}

async function ensureInitialDisplaySelection(settings: AppSettings): Promise<AppSettings> {
  const selectedDisplayId = chooseLaunchDisplayId(settings);

  if (!selectedDisplayId || settings.selectedDisplayId === selectedDisplayId) {
    return settings;
  }

  return store.updateSettings({ selectedDisplayId });
}

function applyLoginItemSettings(settings: AppSettings): void {
  app.setLoginItemSettings({
    openAtLogin: settings.launchAtStartup,
    path: process.execPath
  });
}

async function showMainWindow(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const settings = await store.getSettings();
    mainWindow = await createWindow(settings);
    foregroundTracker = new ForegroundTracker(mainWindow);
    foregroundTracker.start();
    return;
  }

  const settings = await store.getSettings();

  if (settings.selectedDisplayId) {
    applyDisplaySelection(mainWindow, settings.selectedDisplayId);
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function quitFromTray(): void {
  isQuitting = true;
  foregroundTracker?.stop();
  tray?.destroy();
  tray = null;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }

  app.quit();
}

function createTray(): void {
  if (tray) {
    return;
  }

  const image = nativeImage.createFromPath(getAppIconPath());
  const trayIcon = image.isEmpty() ? getAppIconPath() : image.resize({ width: 16, height: 16, quality: "best" });

  tray = new Tray(trayIcon);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show MacroArt",
        click: () => {
          void showMainWindow();
        }
      },
      { type: "separator" },
      {
        label: "Exit",
        click: quitFromTray
      }
    ])
  );
  tray.on("click", () => {
    void showMainWindow();
  });
  tray.on("double-click", () => {
    void showMainWindow();
  });
}

async function getFileIconDataUrl(filePath: string): Promise<string | undefined> {
  try {
    const image = await app.getFileIcon(filePath, { size: "large" });
    if (image.isEmpty()) {
      return undefined;
    }

    return image.resize({ width: 96, height: 96, quality: "best" }).toDataURL();
  } catch {
    return undefined;
  }
}

function getImagePathDataUrl(filePath: string): string | undefined {
  try {
    const image = nativeImage.createFromPath(filePath);
    if (image.isEmpty()) {
      return undefined;
    }

    return image.resize({ width: 96, height: 96, quality: "best" }).toDataURL();
  } catch {
    return undefined;
  }
}

async function getInternetShortcutInfo(filePath: string): Promise<{
  shortcutUrl?: string;
  iconDataUrl?: string;
}> {
  if (extname(filePath).toLowerCase() !== ".url") {
    return {};
  }

  try {
    const shortcut = parseInternetShortcut(await readFile(filePath, "utf8"));
    const iconDataUrl = shortcut.iconFile ? getImagePathDataUrl(shortcut.iconFile) : undefined;

    return {
      shortcutUrl: shortcut.url,
      iconDataUrl
    };
  } catch {
    return {};
  }
}

async function getPngDataUrl(filePath: string): Promise<string | undefined> {
  try {
    const buffer = await readFile(filePath);
    const image = nativeImage.createFromBuffer(buffer);

    if (image.isEmpty()) {
      return undefined;
    }

    const size = image.getSize();
    const largestSide = Math.max(size.width, size.height);
    const normalized =
      largestSide > 256
        ? image.resize({
            width: size.width >= size.height ? 256 : undefined,
            height: size.height > size.width ? 256 : undefined,
            quality: "best"
          })
        : image;

    return normalized.toDataURL();
  } catch {
    return undefined;
  }
}

function applyDisplaySelection(window: BrowserWindow, displayId?: string): boolean {
  const display = getDisplayById(displayId);

  if (!display) {
    window.setFullScreen(false);
    if (!window.isVisible()) {
      window.show();
    }
    return false;
  }

  window.setFullScreen(false);
  window.setBounds(display.bounds, false);
  window.setMenuBarVisibility(false);
  window.setAlwaysOnTop(true, "screen-saver");
  window.setFullScreen(true);
  window.focus();
  window.show();
  return true;
}

async function createWindow(settings: AppSettings): Promise<BrowserWindow> {
  const targetDisplay = getDisplayById(settings.selectedDisplayId);
  const windowOptions: Electron.BrowserWindowConstructorOptions = targetDisplay
    ? {
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        width: targetDisplay.bounds.width,
        height: targetDisplay.bounds.height,
        fullscreen: true
      }
    : {
        width: 1220,
        height: 780,
        minWidth: 980,
        minHeight: 680
      };

  const window = new BrowserWindow({
    ...windowOptions,
    show: false,
    frame: false,
    fullscreenable: true,
    movable: false,
    title: APP_NAME,
    icon: existsSync(getAppIconPath()) ? getAppIconPath() : undefined,
    backgroundColor: "#111214",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once("ready-to-show", () => {
    if (targetDisplay) {
      applyDisplaySelection(window, settings.selectedDisplayId);
    } else {
      window.show();
    }
  });

  window.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    window.hide();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

function registerIpc(): void {
  ipcMain.handle("displays:list", () => serializeDisplays());

  ipcMain.handle("settings:get", async () => store.getSettings());

  ipcMain.handle("settings:update", async (_event, partial: Partial<AppSettings>) => {
    const settings = await store.updateSettings(partial);
    applyLoginItemSettings(settings);

    if (mainWindow && "selectedDisplayId" in partial) {
      applyDisplaySelection(mainWindow, settings.selectedDisplayId);
    }

    return settings;
  });

  ipcMain.handle("profiles:load", async () => store.getProfileState());

  ipcMain.handle("profiles:save", async (_event, state: ProfileState) => {
    return store.updateProfileState(state);
  });

  ipcMain.handle("profiles:import", async () => {
    if (!mainWindow) {
      return null;
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Import MacroArt profiles",
      properties: ["openFile"],
      filters: [
        { name: "MacroArt JSON", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const raw = await readFile(result.filePaths[0], "utf8");
    return store.importProfileState(JSON.parse(raw));
  });

  ipcMain.handle("profiles:export", async () => {
    if (!mainWindow) {
      return false;
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export MacroArt profiles",
      defaultPath: "macroart-profiles.json",
      filters: [{ name: "MacroArt JSON", extensions: ["json"] }]
    });

    if (result.canceled || !result.filePath) {
      return false;
    }

    const config = await store.exportConfig();
    const exportPayload = {
      version: config.version,
      profileState: normalizeProfileState(config.profileState)
    };
    await writeFile(result.filePath, `${JSON.stringify(exportPayload, null, 2)}\n`, "utf8");
    return true;
  });

  ipcMain.handle("actions:triggerButton", async (_event, buttonId: string) => {
    return actionRunner.triggerButton(buttonId);
  });

  ipcMain.handle("dialogs:pickExecutable", async () => {
    if (!mainWindow) {
      return { canceled: true };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose app or script",
      properties: ["openFile"],
      filters: [
        { name: "Programs, shortcuts, and scripts", extensions: ["exe", "bat", "cmd", "ps1", "lnk", "url"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const shortcutInfo = await getInternetShortcutInfo(filePath);
    return {
      canceled: false,
      path: filePath,
      shortcutUrl: shortcutInfo.shortcutUrl,
      iconDataUrl: shortcutInfo.iconDataUrl ?? (await getFileIconDataUrl(filePath)),
      appName: basename(filePath, extname(filePath))
    };
  });

  ipcMain.handle("dialogs:pickImage", async () => {
    if (!mainWindow) {
      return { canceled: true };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose PNG icon",
      properties: ["openFile"],
      filters: [
        { name: "PNG Images", extensions: ["png"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    return {
      canceled: false,
      path: filePath,
      iconDataUrl: await getPngDataUrl(filePath)
    };
  });

  ipcMain.handle("dialogs:pickPath", async () => {
    if (!mainWindow) {
      return { canceled: true };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose file or folder",
      properties: ["openFile", "openDirectory"]
    });

    return result.canceled || !result.filePaths[0]
      ? { canceled: true }
      : { canceled: false, path: result.filePaths[0] };
  });
}

app.whenReady().then(async () => {
  store = new ConfigStore();
  const config = await store.load();
  const settings = await ensureInitialDisplaySelection(config.settings);
  applyLoginItemSettings(settings);
  registerIpc();
  createTray();

  mainWindow = await createWindow(settings);
  foregroundTracker = new ForegroundTracker(mainWindow);
  foregroundTracker.start();
  actionRunner = new ActionRunner(store, () => foregroundTracker?.getLastExternalHwnd() ?? null);

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const settings = await store.getSettings();
      mainWindow = await createWindow(settings);
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  foregroundTracker?.stop();
  tray?.destroy();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});
