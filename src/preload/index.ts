import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, MacrodeckApi, ProfileState } from "../shared/types";

const api: MacrodeckApi = {
  displays: {
    list: () => ipcRenderer.invoke("displays:list")
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (settings: Partial<AppSettings>) => ipcRenderer.invoke("settings:update", settings)
  },
  profiles: {
    load: () => ipcRenderer.invoke("profiles:load"),
    save: (state: ProfileState) => ipcRenderer.invoke("profiles:save", state),
    import: () => ipcRenderer.invoke("profiles:import"),
    export: () => ipcRenderer.invoke("profiles:export")
  },
  actions: {
    triggerButton: (buttonId: string) => ipcRenderer.invoke("actions:triggerButton", buttonId)
  },
  dialogs: {
    pickExecutable: () => ipcRenderer.invoke("dialogs:pickExecutable"),
    pickImage: () => ipcRenderer.invoke("dialogs:pickImage"),
    pickPath: () => ipcRenderer.invoke("dialogs:pickPath")
  }
};

contextBridge.exposeInMainWorld("macrodeck", api);
