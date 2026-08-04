import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const { toastSuccessMock } = vi.hoisted(() => ({ toastSuccessMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock } }));

import { DeleteSessionDialog } from "./DeleteSessionDialog";

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// A 204 (No Content) response cannot carry a body — the real
// DELETE /api/sessions/[id] handler sends `new NextResponse(null, {
// status: 204 })` (task 6).
function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

// s09 plan task 8, D2/D9: the "zone dangereuse" island. State machine
// named in the plan's own words: nominal (closed), confirming (open,
// pristine), deleting (open, both buttons disabled — état 13b), failed
// (dialog CLOSED, Alert above the trigger, în the page).
describe("DeleteSessionDialog", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    pushMock.mockClear();
    replaceMock.mockClear();
    toastSuccessMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not open on its own", () => {
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("names the session's date in the dialog title and quantifies the measurements lost", async () => {
    const user = userEvent.setup();
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("1 août 2026");
    expect(dialog).toHaveTextContent("3");
  });

  it("Annuler closes the dialog without calling the API", async () => {
    const user = userEvent.setup();
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Échap closes the dialog without calling the API", async () => {
    const user = userEvent.setup();
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Supprimer calls DELETE /api/sessions/:id exactly once", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(noContentResponse());
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Supprimer" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/sessions/session-1", {
      method: "DELETE",
    });
  });

  it("disables both dialog buttons and keeps the dialog open while the deletion is in flight (état 13b)", async () => {
    const user = userEvent.setup();
    let resolveFetch: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Supprimer" }),
    );

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Supprimer" }),
    ).toBeDisabled();

    resolveFetch(noContentResponse());
    await waitFor(() => expect(replaceMock).toHaveBeenCalled());
  });

  it("on failure, closes the dialog and shows the Alert above the trigger, in the page — never behind the overlay", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(503));
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Supprimer" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/suppression a échoué/i);
    expect(replaceMock).not.toHaveBeenCalled();

    // The trigger button is still usable — the page hasn't lost anything.
    expect(
      screen.getByRole("button", { name: "Supprimer la session" }),
    ).not.toBeDisabled();
  });

  it("on failure via a network exception, also closes the dialog and shows the Alert", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("network error"));
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Supprimer" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /suppression a échoué/i,
    );
  });

  it("on success, replaces (not pushes) to /historique — back navigation must not reach the deleted session's screen", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(noContentResponse());
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Supprimer" }),
    );

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/historique"),
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Session supprimée");
  });

  it("gives both dialog buttons h-11", async () => {
    const user = userEvent.setup();
    render(
      <DeleteSessionDialog
        sessionId="session-1"
        measuredOn="2026-08-01"
        measurementCount={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Supprimer la session" }),
    );

    expect(
      screen.getByRole("button", { name: "Annuler" }).className,
    ).toMatch(/\bh-11\b/);
    expect(
      screen.getByRole("button", { name: "Supprimer" })
        .className,
    ).toMatch(/\bh-11\b/);
  });
});
