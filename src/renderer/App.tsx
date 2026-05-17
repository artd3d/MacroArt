import {
  AppWindow,
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  Circle,
  CircleDot,
  Command,
  CornerUpLeft,
  Download,
  Folder,
  Globe,
  Image as ImageIcon,
  Keyboard,
  Mic,
  Monitor,
  Music,
  Play,
  Plus,
  Power,
  RadioTower,
  Save,
  Settings,
  Square,
  Trash2,
  Upload,
  Zap,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GRID_BUTTON_COUNT,
  type AppSettings,
  type DialogPathResult,
  type DisplayInfo,
  type MacroAction,
  type MacroButton,
  type MacroPage,
  type MacroProfile,
  type ProfileState
} from "../shared/types";
import { ICON_OPTIONS, createDefaultPage, createDefaultProfile, createId } from "../shared/defaults";

const BUTTON_PRESS_SOUND_URL = new URL("./assets/button-press.mp3", import.meta.url).href;
const BUTTON_SOUND_POOL_SIZE = 5;

const ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  keyboard: Keyboard,
  "app-window": AppWindow,
  folder: Folder,
  globe: Globe,
  broadcast: RadioTower,
  "circle-dot": CircleDot,
  "corner-up-left": CornerUpLeft,
  play: Play,
  save: Save,
  camera: Camera,
  mic: Mic,
  monitor: Monitor,
  command: Command,
  music: Music,
  settings: Settings,
  square: Square,
  circle: Circle
};

const ACTION_LABELS: Record<MacroAction["type"], string> = {
  hotkey: "Hotkey",
  launch: "Launch app",
  openPath: "Open file/folder",
  openUrl: "Open URL",
  delay: "Delay"
};

function getActiveProfile(state: ProfileState | null): MacroProfile | null {
  return state?.profiles.find((profile) => profile.id === state.activeProfileId) ?? state?.profiles[0] ?? null;
}

function getActivePage(profile: MacroProfile | null): MacroPage | null {
  return profile?.pages.find((page) => page.id === profile.activePageId) ?? profile?.pages[0] ?? null;
}

function createAction(type: MacroAction["type"]): MacroAction {
  switch (type) {
    case "hotkey":
      return { type, keys: "Ctrl+S" };
    case "launch":
      return { type, path: "", args: [] };
    case "openPath":
      return { type, path: "" };
    case "openUrl":
      return { type, url: "https://" };
    case "delay":
      return { type, ms: 250 };
  }
}

function parseArgs(value: string): string[] {
  return value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function DisplayPicker({
  displays,
  onSelect
}: {
  displays: DisplayInfo[];
  onSelect: (displayId: string) => void;
}): JSX.Element {
  return (
    <div className="display-picker">
      <div className="display-picker__panel">
        <div>
          <p className="eyebrow">Display setup</p>
          <h1>Choose the macro screen</h1>
          <p className="muted">MacroArt will remember this display and reopen fullscreen there.</p>
        </div>
        <div className="display-list">
          {displays.map((display) => (
            <button className="display-option" key={display.id} onClick={() => onSelect(display.id)}>
              <Monitor size={24} />
              <span>
                <strong>{display.label}</strong>
                <small>
                  {display.bounds.width} x {display.bounds.height}
                  {display.primary ? " · primary" : ""}
                </small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeckButton({
  button,
  onEdit,
  onTrigger
}: {
  button: MacroButton;
  onEdit: () => void;
  onTrigger: () => void;
}): JSX.Element {
  const timer = useRef<number | null>(null);
  const longPress = useRef(false);
  const Icon = ICONS[button.icon] ?? Zap;
  const placeholder = !button.enabled && /^Button \d+$/.test(button.label);
  const visibleLabel = placeholder ? "" : button.label;
  const hasImportedIcon = Boolean(button.imageDataUrl && !placeholder);

  function clearTimer(): void {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  return (
    <button
      className={`deck-button${button.enabled ? "" : " deck-button--disabled"}`}
      style={{ "--button-color": button.color } as React.CSSProperties}
      onContextMenu={(event) => {
        event.preventDefault();
        onEdit();
      }}
      onPointerDown={() => {
        longPress.current = false;
        timer.current = window.setTimeout(() => {
          longPress.current = true;
          onEdit();
        }, 620);
      }}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
      onPointerUp={clearTimer}
      onClick={() => {
        if (longPress.current) {
          longPress.current = false;
          return;
        }
        onTrigger();
      }}
      title="Left click triggers. Right click or long press edits."
    >
      <span className="deck-button__glow" />
      {hasImportedIcon ? (
        <img className="deck-button__image" alt="" src={button.imageDataUrl} />
      ) : (
        !placeholder && <Icon size={30} strokeWidth={2.2} />
      )}
      <span className="deck-button__label">{visibleLabel}</span>
      <small>{button.actions.length === 0 ? "No actions" : `${button.actions.length} action${button.actions.length === 1 ? "" : "s"}`}</small>
    </button>
  );
}

function SettingsPanel({
  settings,
  displays,
  onClose,
  onSetDisplay,
  onStartupChange,
  onImport,
  onExport
}: {
  settings: AppSettings;
  displays: DisplayInfo[];
  onClose: () => void;
  onSetDisplay: (displayId: string) => void;
  onStartupChange: (enabled: boolean) => void;
  onImport: () => void;
  onExport: () => void;
}): JSX.Element {
  return (
    <aside className="side-panel side-panel--settings">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Workspace</h2>
        </div>
        <button className="icon-button" onClick={onClose} title="Close settings">
          <Check size={18} />
        </button>
      </header>

      <section className="panel-section">
        <h3>Macro display</h3>
        <div className="display-list display-list--compact">
          {displays.map((display) => (
            <button
              className={`display-option${settings.selectedDisplayId === display.id ? " display-option--active" : ""}`}
              key={display.id}
              onClick={() => onSetDisplay(display.id)}
            >
              <Monitor size={20} />
              <span>
                <strong>{display.label}</strong>
                <small>
                  {display.bounds.width} x {display.bounds.height}
                </small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Startup</h3>
        <label className="toggle-row">
          <span>
            <strong>Launch at startup</strong>
            <small>Open MacroArt when Windows starts.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.launchAtStartup}
            onChange={(event) => onStartupChange(event.currentTarget.checked)}
          />
        </label>
      </section>

      <section className="panel-section">
        <h3>Profiles</h3>
        <div className="button-row">
          <button className="text-button" onClick={onImport}>
            <Upload size={16} /> Import
          </button>
          <button className="text-button" onClick={onExport}>
            <Download size={16} /> Export
          </button>
        </div>
      </section>
    </aside>
  );
}

function ActionEditor({
  action,
  index,
  canMoveUp,
  canMoveDown,
  onChange,
  onExecutablePicked,
  onMoveUp,
  onMoveDown,
  onRemove
}: {
  action: MacroAction;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (action: MacroAction) => void;
  onExecutablePicked?: (result: DialogPathResult, action: MacroAction) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}): JSX.Element {
  async function pickExecutable(): Promise<void> {
    const result = await window.macrodeck.dialogs.pickExecutable();
    if (!result.canceled && result.path && action.type === "launch") {
      const nextAction: MacroAction = result.shortcutUrl
        ? { type: "openUrl", url: result.shortcutUrl }
        : { ...action, path: result.path };
      if (onExecutablePicked) {
        onExecutablePicked(result, nextAction);
      } else {
        onChange(nextAction);
      }
    }
  }

  async function pickPath(): Promise<void> {
    const result = await window.macrodeck.dialogs.pickPath();
    if (!result.canceled && result.path && action.type === "openPath") {
      onChange({ ...action, path: result.path });
    }
  }

  return (
    <div className="action-row">
      <div className="action-row__top">
        <span>{index + 1}. {ACTION_LABELS[action.type]}</span>
        <div className="action-tools">
          <button className="icon-button" disabled={!canMoveUp} onClick={onMoveUp} title="Move up">
            <ArrowUp size={15} />
          </button>
          <button className="icon-button" disabled={!canMoveDown} onClick={onMoveDown} title="Move down">
            <ArrowDown size={15} />
          </button>
          <button className="icon-button danger" onClick={onRemove} title="Remove action">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {action.type === "hotkey" && (
        <label className="field">
          <span>Keys</span>
          <input value={action.keys} onChange={(event) => onChange({ ...action, keys: event.currentTarget.value })} />
        </label>
      )}

      {action.type === "launch" && (
        <>
          <label className="field">
            <span>App path</span>
            <div className="inline-field">
              <input value={action.path} onChange={(event) => onChange({ ...action, path: event.currentTarget.value })} />
              <button className="icon-button" onClick={pickExecutable} title="Choose app">
                <Folder size={16} />
              </button>
            </div>
          </label>
          <label className="field">
            <span>Arguments</span>
            <input
              value={(action.args ?? []).join(" ")}
              onChange={(event) => onChange({ ...action, args: parseArgs(event.currentTarget.value) })}
            />
          </label>
        </>
      )}

      {action.type === "openPath" && (
        <label className="field">
          <span>Path</span>
          <div className="inline-field">
            <input value={action.path} onChange={(event) => onChange({ ...action, path: event.currentTarget.value })} />
            <button className="icon-button" onClick={pickPath} title="Choose path">
              <Folder size={16} />
            </button>
          </div>
        </label>
      )}

      {action.type === "openUrl" && (
        <label className="field">
          <span>URL</span>
          <input value={action.url} onChange={(event) => onChange({ ...action, url: event.currentTarget.value })} />
        </label>
      )}

      {action.type === "delay" && (
        <label className="field">
          <span>Milliseconds</span>
          <input
            type="number"
            min={0}
            max={600000}
            value={action.ms}
            onChange={(event) => onChange({ ...action, ms: Number(event.currentTarget.value) })}
          />
        </label>
      )}
    </div>
  );
}

function EditorPanel({
  button,
  onClose,
  onUpdate
}: {
  button: MacroButton;
  onClose: () => void;
  onUpdate: (button: MacroButton) => void;
}): JSX.Element {
  function updateAction(index: number, action: MacroAction): void {
    onUpdate({
      ...button,
      actions: button.actions.map((item, itemIndex) => (itemIndex === index ? action : item))
    });
  }

  function moveAction(index: number, direction: -1 | 1): void {
    const next = [...button.actions];
    const targetIndex = index + direction;
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    onUpdate({ ...button, actions: next });
  }

  function applyExecutableMetadata(
    index: number,
    result: DialogPathResult,
    nextAction: MacroAction
  ): void {
    const shouldRename = button.label.trim().length === 0 || /^Button \d+$/.test(button.label);

    onUpdate({
      ...button,
      label: shouldRename && result.appName ? result.appName : button.label,
      imageDataUrl: result.iconDataUrl ?? button.imageDataUrl,
      actions: button.actions.map((item, itemIndex) => (itemIndex === index ? nextAction : item))
    });
  }

  async function pickCustomIcon(): Promise<void> {
    const result = await window.macrodeck.dialogs.pickImage();

    if (!result.canceled && result.iconDataUrl) {
      onUpdate({
        ...button,
        imageDataUrl: result.iconDataUrl
      });
    }
  }

  return (
    <aside className="side-panel">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Button editor</p>
          <h2>{button.label}</h2>
        </div>
        <button className="icon-button" onClick={onClose} title="Close editor">
          <Check size={18} />
        </button>
      </header>

      <section className="panel-section panel-section--grid">
        <label className="field">
          <span>Label</span>
          <input value={button.label} onChange={(event) => onUpdate({ ...button, label: event.currentTarget.value })} />
        </label>
        <label className="field">
          <span>Color</span>
          <input type="color" value={button.color} onChange={(event) => onUpdate({ ...button, color: event.currentTarget.value })} />
        </label>
        <label className="field">
          <span>Icon</span>
          <select value={button.icon} onChange={(event) => onUpdate({ ...button, icon: event.currentTarget.value })}>
            {ICON_OPTIONS.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
        </label>
        <div className="imported-icon">
          {button.imageDataUrl && <img alt="" src={button.imageDataUrl} />}
          <div className="button-row">
            <button className="text-button" onClick={pickCustomIcon}>
              <ImageIcon size={16} /> {button.imageDataUrl ? "Change PNG icon" : "Use PNG icon"}
            </button>
            {button.imageDataUrl && (
              <button className="text-button" onClick={() => onUpdate({ ...button, imageDataUrl: undefined })}>
                Remove icon
              </button>
            )}
          </div>
        </div>
        <label className="toggle-row toggle-row--compact">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={button.enabled}
            onChange={(event) => onUpdate({ ...button, enabled: event.currentTarget.checked })}
          />
        </label>
      </section>

      <section className="panel-section">
        <div className="section-title-row">
          <h3>Action sequence</h3>
          <Plus size={16} />
        </div>
        <div className="action-add-grid">
          {Object.keys(ACTION_LABELS).map((type) => (
            <button
              className="text-button"
              key={type}
              onClick={() => onUpdate({ ...button, actions: [...button.actions, createAction(type as MacroAction["type"])] })}
            >
              {ACTION_LABELS[type as MacroAction["type"]]}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section action-list">
        {button.actions.length === 0 ? (
          <p className="empty-copy">Add an action to make this button live.</p>
        ) : (
          button.actions.map((action, index) => (
            <ActionEditor
              action={action}
              canMoveDown={index < button.actions.length - 1}
              canMoveUp={index > 0}
              index={index}
              key={`${action.type}-${index}`}
              onChange={(nextAction) => updateAction(index, nextAction)}
              onMoveDown={() => moveAction(index, 1)}
              onMoveUp={() => moveAction(index, -1)}
              onExecutablePicked={(result, nextAction) => applyExecutableMetadata(index, result, nextAction)}
              onRemove={() =>
                onUpdate({
                  ...button,
                  actions: button.actions.filter((_, itemIndex) => itemIndex !== index)
                })
              }
            />
          ))
        )}
      </section>
    </aside>
  );
}

export function App(): JSX.Element {
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("Loading");
  const [saveState, setSaveState] = useState("Saved");
  const buttonAudioPool = useRef<HTMLAudioElement[]>([]);
  const buttonAudioCursor = useRef(0);

  const activeProfile = useMemo(() => getActiveProfile(profileState), [profileState]);
  const activePage = useMemo(() => getActivePage(activeProfile), [activeProfile]);
  const selectedButton = activePage?.buttons.find((button) => button.id === selectedButtonId) ?? null;
  const selectedDisplayKnown = Boolean(settings?.selectedDisplayId && displays.some((display) => display.id === settings.selectedDisplayId));
  const needsDisplaySelection = Boolean(settings && displays.length > 0 && !selectedDisplayKnown);

  useEffect(() => {
    let mounted = true;

    if (!window.macrodeck) {
      setStatus("Desktop bridge failed to load. Rebuild the app and reopen it.");
      return () => {
        mounted = false;
      };
    }

    Promise.all([window.macrodeck.profiles.load(), window.macrodeck.settings.get(), window.macrodeck.displays.list()])
      .then(([profiles, appSettings, displayList]) => {
        if (!mounted) {
          return;
        }

        setProfileState(profiles);
        setSettings(appSettings);
        setDisplays(displayList);
        setStatus("Ready");
        setLoaded(true);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Startup failed");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    buttonAudioPool.current = Array.from({ length: BUTTON_SOUND_POOL_SIZE }, () => {
      const audio = new Audio(BUTTON_PRESS_SOUND_URL);
      audio.preload = "auto";
      audio.volume = 0.55;
      return audio;
    });

    return () => {
      buttonAudioPool.current.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      buttonAudioPool.current = [];
    };
  }, []);

  useEffect(() => {
    if (!loaded || !profileState) {
      return;
    }

    setSaveState("Saving");
    const timer = window.setTimeout(() => {
      window.macrodeck.profiles
        .save(profileState)
        .then(() => {
          setSaveState("Saved");
        })
        .catch((error) => {
          setSaveState("Save failed");
          setStatus(error instanceof Error ? error.message : "Save failed");
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [profileState, loaded]);

  function updateProfileState(updater: (state: ProfileState) => ProfileState): void {
    setProfileState((current) => (current ? updater(current) : current));
  }

  function updateActiveProfile(updater: (profile: MacroProfile) => MacroProfile): void {
    updateProfileState((state) => ({
      ...state,
      profiles: state.profiles.map((profile) => (profile.id === state.activeProfileId ? updater(profile) : profile))
    }));
  }

  function updateActivePage(updater: (page: MacroPage) => MacroPage): void {
    updateActiveProfile((profile) => ({
      ...profile,
      pages: profile.pages.map((page) => (page.id === profile.activePageId ? updater(page) : page))
    }));
  }

  function updateButton(button: MacroButton): void {
    updateActivePage((page) => ({
      ...page,
      buttons: page.buttons.map((item) => (item.id === button.id ? button : item))
    }));
  }

  async function chooseDisplay(displayId: string): Promise<void> {
    const next = await window.macrodeck.settings.update({ selectedDisplayId: displayId });
    const nextDisplays = await window.macrodeck.displays.list();
    setSettings(next);
    setDisplays(nextDisplays);
    setStatus("Display saved");
  }

  async function setStartup(enabled: boolean): Promise<void> {
    const next = await window.macrodeck.settings.update({ launchAtStartup: enabled });
    setSettings(next);
    setStatus(enabled ? "Startup enabled" : "Startup disabled");
  }

  async function triggerButton(button: MacroButton): Promise<void> {
    playButtonFeedback();
    setStatus(`Running ${button.label}`);
    const result = await window.macrodeck.actions.triggerButton(button.id);
    setStatus(result.message);
  }

  function playButtonFeedback(): void {
    const pool = buttonAudioPool.current;

    if (pool.length === 0) {
      return;
    }

    const audio = pool[buttonAudioCursor.current % pool.length];
    buttonAudioCursor.current += 1;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  function addPage(): void {
    updateActiveProfile((profile) => {
      const page = createDefaultPage(`Page ${profile.pages.length + 1}`);
      return {
        ...profile,
        pages: [...profile.pages, page],
        activePageId: page.id
      };
    });
    setSelectedButtonId(null);
  }

  function deleteActivePage(): void {
    updateActiveProfile((profile) => {
      if (profile.pages.length <= 1) {
        return profile;
      }
      const pages = profile.pages.filter((page) => page.id !== profile.activePageId);
      return {
        ...profile,
        pages,
        activePageId: pages[0].id
      };
    });
    setSelectedButtonId(null);
  }

  function addProfile(): void {
    const profile = createDefaultProfile();
    profile.name = `Profile ${(profileState?.profiles.length ?? 0) + 1}`;
    updateProfileState((state) => ({
      activeProfileId: profile.id,
      profiles: [...state.profiles, profile]
    }));
    setSelectedButtonId(null);
  }

  function deleteActiveProfile(): void {
    updateProfileState((state) => {
      if (state.profiles.length <= 1) {
        return state;
      }
      const profiles = state.profiles.filter((profile) => profile.id !== state.activeProfileId);
      return {
        activeProfileId: profiles[0].id,
        profiles
      };
    });
    setSelectedButtonId(null);
  }

  async function importProfiles(): Promise<void> {
    const imported = await window.macrodeck.profiles.import();
    if (imported) {
      setProfileState(imported);
      setSelectedButtonId(null);
      setStatus("Profiles imported");
    }
  }

  async function exportProfiles(): Promise<void> {
    const exported = await window.macrodeck.profiles.export();
    setStatus(exported ? "Profiles exported" : "Export canceled");
  }

  if (!profileState || !settings || !activeProfile || !activePage) {
    return (
      <main className="app-shell app-shell--loading">
        <Zap size={32} />
        <span>{status}</span>
      </main>
    );
  }

  const gridButtons = Array.from({ length: GRID_BUTTON_COUNT }, (_, index) => activePage.buttons[index]).filter(
    (button): button is MacroButton => Boolean(button)
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Zap size={23} />
          <div>
            <strong>MacroArt</strong>
            <span>{saveState} · {status}</span>
          </div>
        </div>

        <div className="toolbar-group">
          <select
            value={activeProfile.id}
            onChange={(event) => {
              updateProfileState((state) => ({ ...state, activeProfileId: event.currentTarget.value }));
              setSelectedButtonId(null);
            }}
          >
            {profileState.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          <button className="icon-button" onClick={addProfile} title="Add profile">
            <Plus size={17} />
          </button>
          <button className="icon-button danger" disabled={profileState.profiles.length <= 1} onClick={deleteActiveProfile} title="Delete profile">
            <Trash2 size={17} />
          </button>
        </div>

        <div className="page-tabs">
          {activeProfile.pages.map((page) => (
            <button
              className={page.id === activePage.id ? "page-tab page-tab--active" : "page-tab"}
              key={page.id}
              onClick={() => {
                updateActiveProfile((profile) => ({ ...profile, activePageId: page.id }));
                setSelectedButtonId(null);
              }}
            >
              {page.name}
            </button>
          ))}
          <button className="icon-button" onClick={addPage} title="Add page">
            <Plus size={17} />
          </button>
          <button className="icon-button danger" disabled={activeProfile.pages.length <= 1} onClick={deleteActivePage} title="Delete page">
            <Trash2 size={17} />
          </button>
        </div>

        <button
          className="icon-button"
          onClick={() => {
            setSelectedButtonId(null);
            setSettingsOpen(true);
          }}
          title="Open settings"
        >
          <Settings size={18} />
        </button>
      </header>

      <section className={`workspace${selectedButton || settingsOpen ? " workspace--with-panel" : ""}`}>
        <div className="deck-grid">
          {gridButtons.map((button) => (
            <DeckButton
              button={button}
              key={button.id}
              onEdit={() => {
                setSettingsOpen(false);
                setSelectedButtonId(button.id);
              }}
              onTrigger={() => triggerButton(button)}
            />
          ))}
        </div>

        {selectedButton && <EditorPanel button={selectedButton} onClose={() => setSelectedButtonId(null)} onUpdate={updateButton} />}

        {settingsOpen && (
          <SettingsPanel
            displays={displays}
            settings={settings}
            onClose={() => setSettingsOpen(false)}
            onExport={exportProfiles}
            onImport={importProfiles}
            onSetDisplay={chooseDisplay}
            onStartupChange={setStartup}
          />
        )}
      </section>

      {needsDisplaySelection && <DisplayPicker displays={displays} onSelect={chooseDisplay} />}

      <footer className="statusbar">
        <span>
          <Power size={14} /> Tap to trigger
        </span>
        <span>Right click or long press to edit</span>
      </footer>
    </main>
  );
}
