import type { MacrodeckApi } from "../shared/types";

declare global {
  interface Window {
    macrodeck: MacrodeckApi;
  }
}

export {};
