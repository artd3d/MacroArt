export const CONFIG_VERSION = 1;
export const GRID_COLUMNS = 5;
export const GRID_ROWS = 3;
export const GRID_BUTTON_COUNT = GRID_COLUMNS * GRID_ROWS;

export type MacroAction =
  | { type: "hotkey"; keys: string }
  | { type: "launch"; path: string; args?: string[] }
  | { type: "openPath"; path: string }
  | { type: "openUrl"; url: string }
  | { type: "delay"; ms: number };

export type MacroButton = {
  id: string;
  label: string;
  color: string;
  icon: string;
  imageDataUrl?: string;
  enabled: boolean;
  actions: MacroAction[];
};

export type MacroPage = {
  id: string;
  name: string;
  buttons: MacroButton[];
};

export type MacroProfile = {
  id: string;
  name: string;
  pages: MacroPage[];
  activePageId: string;
};

export type AppSettings = {
  selectedDisplayId?: string;
  launchAtStartup: boolean;
};

export type ProfileState = {
  activeProfileId: string;
  profiles: MacroProfile[];
};

export type MacroConfig = {
  version: typeof CONFIG_VERSION;
  settings: AppSettings;
  profileState: ProfileState;
};

export type DisplayInfo = {
  id: string;
  label: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
  primary: boolean;
};

export type TriggerResult = {
  ok: boolean;
  message: string;
};

export type DialogPathResult = {
  canceled: boolean;
  path?: string;
  shortcutUrl?: string;
  iconDataUrl?: string;
  appName?: string;
};

export type MacrodeckApi = {
  displays: {
    list: () => Promise<DisplayInfo[]>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  };
  profiles: {
    load: () => Promise<ProfileState>;
    save: (state: ProfileState) => Promise<ProfileState>;
    import: () => Promise<ProfileState | null>;
    export: () => Promise<boolean>;
  };
  actions: {
    triggerButton: (buttonId: string) => Promise<TriggerResult>;
  };
  dialogs: {
    pickExecutable: () => Promise<DialogPathResult>;
    pickImage: () => Promise<DialogPathResult>;
    pickPath: () => Promise<DialogPathResult>;
  };
};
