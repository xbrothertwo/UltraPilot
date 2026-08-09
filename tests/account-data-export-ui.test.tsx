import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDataExport } from "../src/components/account-data-export";

const fetchMock = vi.fn();

describe("account data export UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("prevents parallel downloads while the first request is pending", async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise((_resolve, reject) => { rejectRequest = reject; }));
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<AccountDataExport />); });
    const button = renderer.root.findByType("button");

    act(() => { void button.props.onClick(); });
    expect(renderer.root.findByType("button").props.disabled).toBe(true);
    act(() => { void renderer.root.findByType("button").props.onClick(); });
    expect(fetchMock).toHaveBeenCalledOnce();

    await act(async () => { rejectRequest(new Error("network")); });
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toContain("Datenexport konnte nicht erstellt werden");
    expect(renderer.root.findByType("button").props.disabled).toBe(false);
  });
});
