import { startTransition } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  requestPasswordRecovery: vi.fn(),
  updateRecoveredPassword: vi.fn(),
}));

vi.mock("@/app/auth/recovery-actions", () => ({
  requestPasswordRecovery: actions.requestPasswordRecovery,
  updateRecoveredPassword: actions.updateRecoveredPassword,
}));

import { ForgotPasswordForm } from "../src/components/forgot-password-form";
import { ResetPasswordForm } from "../src/components/reset-password-form";

type DeferredState = { resolve: (value: { status: "success" | "error"; message: string }) => void };

function deferredAction(action: ReturnType<typeof vi.fn>): DeferredState {
  let resolvePromise: DeferredState["resolve"] = () => undefined;
  action.mockImplementation(() => new Promise((resolve) => { resolvePromise = resolve; }));
  return { resolve: (value) => resolvePromise(value) };
}

function formNode(renderer: ReactTestRenderer): ReactTestInstance {
  return renderer.root.findByType("form");
}

describe("recovery form pending behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it.each([
    ["forgot password", ForgotPasswordForm, actions.requestPasswordRecovery, "Reset-Link wird versendet …", { status: "success" as const, message: "Erledigt." }, "status"],
    ["reset password", ResetPasswordForm, actions.updateRecoveredPassword, "Passwort wird geändert …", { status: "error" as const, message: "Fehlgeschlagen." }, "alert"],
  ] as const)("locks the %s form while the action is pending", async (_name, Component, action, pendingLabel, finalState, finalRole) => {
    const deferred = deferredAction(action);
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<Component />); });

    let form = formNode(renderer);
    const firstPreventDefault = vi.fn();
    form.props.onSubmit({ preventDefault: firstPreventDefault });
    expect(firstPreventDefault).not.toHaveBeenCalled();

    act(() => {
      startTransition(() => { void form.props.action(new FormData()); });
    });

    form = formNode(renderer);
    expect(form.props["aria-busy"]).toBe(true);
    expect(renderer.root.findByType("button").props.disabled).toBe(true);
    expect(renderer.root.findByType("button").children.join("")).toBe(pendingLabel);

    const secondPreventDefault = vi.fn();
    form.props.onSubmit({ preventDefault: secondPreventDefault });
    expect(secondPreventDefault).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();

    await act(async () => { deferred.resolve(finalState); });
    expect(renderer.root.findByProps({ role: finalRole }).children.join("")).toBe(finalState.message);
    expect(renderer.root.findByType("button").props.disabled).toBe(false);
  });
});
