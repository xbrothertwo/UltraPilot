import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "../src/components/theme-toggle";
import { getThemeInitScript } from "../src/lib/theme";

type MediaListener = (event: MediaQueryListEvent) => void;

function createMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<MediaListener>();
  const media = {
    get matches() { return matches; },
    addEventListener: vi.fn((_type: string, listener: MediaListener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: MediaListener) => listeners.delete(listener)),
    emit(next: boolean) {
      matches = next;
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
    },
    listenerCount: () => listeners.size,
  };
  return media;
}

function runInit(options: { stored?: string | null; storageError?: boolean; systemDark?: boolean; matchMediaError?: boolean }) {
  const attributes = new Map<string, string>();
  const root = {
    style: { colorScheme: "" },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  };
  const storage = {
    getItem: () => {
      if (options.storageError) throw new Error("blocked");
      return options.stored ?? null;
    },
  };
  const testWindow = {
    matchMedia: options.matchMediaError
      ? () => { throw new Error("unavailable"); }
      : () => ({ matches: options.systemDark ?? false }),
  };
  Function("localStorage", "window", "document", getThemeInitScript())(
    storage,
    testWindow,
    { documentElement: root },
  );
  return {
    preference: attributes.get("data-theme-preference"),
    theme: attributes.get("data-theme"),
    colorScheme: root.style.colorScheme,
  };
}

describe("early theme initialization", () => {
  it.each([
    [{ stored: "light" }, { preference: "light", theme: "light", colorScheme: "light" }],
    [{ stored: "dark" }, { preference: "dark", theme: "dark", colorScheme: "dark" }],
    [{ stored: "system", systemDark: true }, { preference: "system", theme: "dark", colorScheme: "dark" }],
    [{ stored: "invalid", systemDark: false }, { preference: "system", theme: "light", colorScheme: "light" }],
    [{ storageError: true, systemDark: true }, { preference: "system", theme: "dark", colorScheme: "dark" }],
    [{ storageError: true, systemDark: false }, { preference: "system", theme: "light", colorScheme: "light" }],
    [{ stored: "system", matchMediaError: true }, { preference: "system", theme: "light", colorScheme: "light" }],
  ] as const)("sets complete theme state for %o", (options, expected) => {
    expect(runInit(options)).toEqual(expected);
  });
});

describe("ThemeToggle client behavior", () => {
  let media: ReturnType<typeof createMedia>;
  let renderer: ReactTestRenderer;
  let mutationCallbacks: Set<MutationCallback>;
  let stored: Map<string, string>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    media = createMedia(false);
    mutationCallbacks = new Set();
    stored = new Map();
    const datasetTarget: Record<string, string> = { themePreference: "system", theme: "light" };
    const dataset = new Proxy(datasetTarget, {
      set(target, key, value) {
        target[String(key)] = String(value);
        for (const callback of mutationCallbacks) callback([], {} as MutationObserver);
        return true;
      },
    });
    vi.stubGlobal("window", { matchMedia: () => media });
    vi.stubGlobal("document", { documentElement: { dataset, style: { colorScheme: "light" } } });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    vi.stubGlobal("MutationObserver", class {
      constructor(private readonly callback: MutationCallback) {}
      observe() { mutationCallbacks.add(this.callback); }
      disconnect() { mutationCallbacks.delete(this.callback); }
    });
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    vi.unstubAllGlobals();
  });

  it("cycles Light, Dark and System and persists each preference", () => {
    act(() => { renderer = create(<ThemeToggle showLabel />); });
    const click = () => act(() => renderer.root.findByType("button").props.onClick());

    click();
    expect(document.documentElement.dataset).toMatchObject({ themePreference: "light", theme: "light" });
    expect(localStorage.getItem("ultrapilot-theme")).toBe("light");
    click();
    expect(document.documentElement.dataset).toMatchObject({ themePreference: "dark", theme: "dark" });
    expect(document.documentElement.style.colorScheme).toBe("dark");
    click();
    expect(document.documentElement.dataset.themePreference).toBe("system");
    expect(localStorage.getItem("ultrapilot-theme")).toBe("system");
  });

  it("tracks system changes only for System and removes its listener", () => {
    act(() => { renderer = create(<ThemeToggle />); });
    expect(media.listenerCount()).toBe(1);
    act(() => media.emit(true));
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => renderer.root.findByType("button").props.onClick());
    act(() => media.emit(false));
    expect(document.documentElement.dataset).toMatchObject({ themePreference: "light", theme: "light" });

    act(() => renderer.unmount());
    expect(media.listenerCount()).toBe(0);
  });

  it("remains accessible and usable when storage writes fail", () => {
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("blocked"); } });
    act(() => { renderer = create(<ThemeToggle />); });
    const button = renderer.root.findByType("button");
    expect(button.props.type).toBe("button");
    expect(button.props["aria-label"]).toContain("Darstellung: System");
    expect(() => act(() => button.props.onClick())).not.toThrow();
    expect(document.documentElement.dataset.themePreference).toBe("light");
  });
});
