import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => <a {...props}>{children}</a>,
}));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));

import { AppNavigation } from "../src/components/app-navigation";

type MediaListener = () => void;

function createBreakpoint(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<MediaListener>();
  return {
    get matches() { return matches; },
    addEventListener: vi.fn((_type: string, listener: MediaListener) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: MediaListener) => listeners.delete(listener)),
    set(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

function navigationProps() {
  return {
    configured: false,
    userEmail: null,
    missionGoal: { eventName: null, targetYear: null, eventDistanceKm: null },
  };
}

describe("responsive Bloom navigation", () => {
  let renderer: ReactTestRenderer;
  let breakpoint: ReturnType<typeof createBreakpoint>;
  let themeMedia: ReturnType<typeof createBreakpoint>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    breakpoint = createBreakpoint(true);
    themeMedia = createBreakpoint(false);
    vi.stubGlobal("window", {
      matchMedia: (query: string) => query === "(min-width: 64rem)" ? breakpoint : themeMedia,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("document", {
      documentElement: {
        dataset: { themePreference: "system", theme: "light" },
        style: { colorScheme: "light" },
      },
      body: { style: { overflow: "" } },
    });
    vi.stubGlobal("localStorage", { setItem: vi.fn() });
    vi.stubGlobal("MutationObserver", class {
      observe() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    vi.unstubAllGlobals();
  });

  it("keeps only desktop navigation accessible on desktop", () => {
    navigation.pathname = "/activities/ride-1";
    act(() => { renderer = create(<AppNavigation {...navigationProps()} />); });
    const desktop = renderer.root.findByProps({ "data-testid": "desktop-navigation" });
    const mobile = renderer.root.findByProps({ "data-testid": "mobile-navigation" });
    expect(desktop.props).toMatchObject({ "aria-hidden": false, inert: false });
    expect(mobile.props).toMatchObject({ "aria-hidden": true, inert: true });
    expect(renderer.root.findAll((node) => node.type === "a" && node.props["aria-current"] === "page")).toHaveLength(1);
    expect(renderer.root.findAll((node) => node.type === "a" && node.props["aria-current"] === "page")[0].props.href).toBe("/activities");
  });

  it("switches accessibility to mobile navigation and cleans up the listener", () => {
    navigation.pathname = "/plan";
    act(() => { renderer = create(<AppNavigation {...navigationProps()} />); });
    expect(breakpoint.listenerCount()).toBe(1);
    act(() => breakpoint.set(false));
    const desktop = renderer.root.findByProps({ "data-testid": "desktop-navigation" });
    const mobile = renderer.root.findByProps({ "data-testid": "mobile-navigation" });
    expect(desktop.props).toMatchObject({ "aria-hidden": true, inert: true });
    expect(mobile.props).toMatchObject({ "aria-hidden": false, inert: false });
    expect(renderer.root.findAll((node) => node.type === "a" && node.props["aria-current"] === "page")).toHaveLength(1);
    expect(renderer.root.findAllByProps({ "aria-label": "Mobile Hauptnavigation" })).toHaveLength(1);

    act(() => renderer.unmount());
    expect(breakpoint.listenerCount()).toBe(0);
  });
});
