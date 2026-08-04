import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
// s10 plan task 6, ADR 018: the ordering is what matters (purge BEFORE
// signOut) — a shared call-order array, appended to by each mock, proves
// it directly, rather than two independent toHaveBeenCalled assertions
// that can't tell relative order apart.
const { callOrder, purgeUserCachesMock } = vi.hoisted(() => {
  const callOrder: string[] = [];
  return {
    callOrder,
    purgeUserCachesMock: vi.fn(async () => {
      callOrder.push("purge");
    }),
  };
});

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: signOutMock },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/pwa/cache-policy", () => ({
  purgeUserCaches: purgeUserCachesMock,
}));

import { LogoutButton } from "./LogoutButton";

// plan task 7: "la déconnexion appelle bien signOut". story AC 5: "l'écran
// suivant est celui de connexion" — asserted here by the navigation that
// follows a successful sign-out, not by re-rendering the guarded page
// (that's Home's job, covered by src/app/page.test.tsx).
describe("LogoutButton", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    pushMock.mockReset();
    purgeUserCachesMock.mockClear();
    callOrder.length = 0;
    signOutMock.mockImplementation(async () => {
      callOrder.push("signOut");
      return { data: { success: true }, error: null };
    });
  });

  it("calls authClient.signOut(), then navigates to the sign-in screen", async () => {
    signOutMock.mockResolvedValue({ data: { success: true }, error: null });
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith("/auth/sign-in");
  });

  // review finding 6: a failed signOut() must not be treated as a success.
  // Before the fix, the error branch was never read: isSigningOut stayed
  // true forever and the user was pushed to /auth/sign-in regardless — a
  // live session would look terminated (story AC 5) when it is not.
  // SignInScreen already handles its own operation errors this way (stay
  // on screen, show a destructive alert, let the user retry).
  it("shows an error and does not navigate when signOut() fails, leaving the button usable again", async () => {
    signOutMock.mockResolvedValue({
      data: null,
      error: { code: "NETWORK_ERROR", message: "fetch failed" },
    });
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(pushMock).not.toHaveBeenCalled();
    expect(await screen.findByText("La déconnexion a échoué")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se déconnecter" })).not.toBeDisabled();
  });

  // s10 plan task 6, ADR 018 decision 3: purge first — if signOut() then
  // fails (e.g. offline), the user stays signed in with an empty cache
  // (inert); the reverse would leave a signed-out device still serving
  // the previous account's data.
  it("purges the user caches BEFORE calling signOut() — asserted by relative order, not independent calls", async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    expect(purgeUserCachesMock).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["purge", "signOut"]);
  });

  it("still purges the caches even when signOut() itself fails — the cache is not left behind because sign-out failed", async () => {
    signOutMock.mockImplementation(async () => {
      callOrder.push("signOut");
      return {
        data: null,
        error: { code: "NETWORK_ERROR", message: "fetch failed" },
      };
    });
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));

    await waitFor(() => expect(purgeUserCachesMock).toHaveBeenCalledTimes(1));
    expect(callOrder[0]).toBe("purge");
  });

  it("passes the real global caches object to purgeUserCaches", async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));

    await waitFor(() => expect(purgeUserCachesMock).toHaveBeenCalledTimes(1));
    expect(purgeUserCachesMock).toHaveBeenCalledWith(globalThis.caches);
  });
});
