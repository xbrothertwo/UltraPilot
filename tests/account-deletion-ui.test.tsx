import { startTransition } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ requestAccountDeletion: vi.fn() }));
vi.mock("@/app/settings/account-deletion-actions", () => ({ requestAccountDeletion: actions.requestAccountDeletion }));

import { AccountDeletion } from "../src/components/account-deletion";

describe("account deletion UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("contains no identity field and prevents duplicate submits while pending", async () => {
    let resolveAction: (value: { status: "error"; message: string }) => void = () => undefined;
    actions.requestAccountDeletion.mockImplementation(() => new Promise((resolve) => { resolveAction = resolve; }));
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<AccountDeletion />); });
    let form = renderer.root.findByType("form");
    expect(renderer.root.findAllByProps({ name: "user_id" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ name: "email" })).toHaveLength(0);

    form.props.onSubmit({ preventDefault: vi.fn() });
    act(() => { startTransition(() => { void form.props.action(new FormData()); }); });
    form = renderer.root.findByType("form");
    expect(form.props["aria-busy"]).toBe(true);
    expect(renderer.root.findByType("button").props.disabled).toBe(true);

    const preventDefault = vi.fn();
    form.props.onSubmit({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(actions.requestAccountDeletion).toHaveBeenCalledOnce();

    await act(async () => { resolveAction({ status: "error", message: "Fester Fehler." }); });
    expect(renderer.root.findByProps({ role: "alert" }).children.join("")).toBe("Fester Fehler.");
  });
});
