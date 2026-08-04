import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { OnboardingForm } from "./OnboardingForm";

const EMPTY_PROPS = {
  initialHeightCm: null,
  initialSex: null,
  initialStartedOn: null,
  redirectTo: "/",
  submitLabel: "Commencer",
};

describe("OnboardingForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function fillAll(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Taille"), "175");
    await user.click(screen.getByRole("radio", { name: "Homme" }));
    const dateInput = screen.getByLabelText("Début de la transformation");
    await user.type(dateInput, "2026-06-23");
  }

  it("asks the three questions and nothing else", () => {
    render(<OnboardingForm {...EMPTY_PROPS} />);

    expect(screen.getByLabelText("Taille")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Sexe" })).toBeInTheDocument();
    expect(
      screen.getByLabelText("Début de la transformation"),
    ).toBeInTheDocument();
    // The onboarding never asks for a target weight — that stays a
    // preference, set later from /profil.
    expect(screen.queryByLabelText(/cible/i)).toBeNull();
  });

  // Sex has no empty string to send, so "not chosen" is the one rule
  // this component owns rather than delegating to the server.
  it("refuses to submit without a sex, and makes no request", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm {...EMPTY_PROPS} />);

    await user.type(screen.getByLabelText("Taille"), "175");
    await user.click(screen.getByRole("button", { name: "Commencer" }));

    expect(
      await screen.findByText("Choisissez homme ou femme."),
    ).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("PUTs the three answers, with an empty target weight", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<OnboardingForm {...EMPTY_PROPS} />);

    await fillAll(user);
    await user.click(screen.getByRole("button", { name: "Commencer" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/profile");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      heightCm: "175",
      targetWeightKg: "",
      sex: "male",
      transformationStartedOn: "2026-06-23",
    });
  });

  // refresh() before push(): the destination is gated on this very
  // profile, and a cached tree rendered while it was still incomplete
  // would bounce straight back here.
  it("refreshes the router before navigating on success", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<OnboardingForm {...EMPTY_PROPS} />);

    await fillAll(user);
    await user.click(screen.getByRole("button", { name: "Commencer" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
    expect(refreshMock).toHaveBeenCalled();
    expect(refreshMock.mock.invocationCallOrder[0]).toBeLessThan(
      pushMock.mock.invocationCallOrder[0],
    );
  });

  it("surfaces the server's field errors and stays on the form", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          fieldErrors: {
            transformationStartedOn: ["Cette date est dans le futur."],
          },
        }),
        { status: 400 },
      ),
    );
    const user = userEvent.setup();
    render(<OnboardingForm {...EMPTY_PROPS} />);

    await fillAll(user);
    await user.click(screen.getByRole("button", { name: "Commencer" }));

    expect(
      await screen.findByText("Cette date est dans le futur."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    // The typed height survives the rejection — nothing is re-typed.
    expect(screen.getByLabelText("Taille")).toHaveValue("175");
  });

  it("shows a retry message when the request itself fails", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError("offline"));
    const user = userEvent.setup();
    render(<OnboardingForm {...EMPTY_PROPS} />);

    await fillAll(user);
    await user.click(screen.getByRole("button", { name: "Commencer" }));

    expect(
      await screen.findByText("Vérifiez votre connexion et réessayez."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commencer" })).toBeEnabled();
  });

  // A half-finished onboarding must come back to its own answers, not to
  // an empty form.
  it("pre-fills from what is already stored", () => {
    render(
      <OnboardingForm
        {...EMPTY_PROPS}
        initialHeightCm={168}
        initialSex="female"
        initialStartedOn="2026-01-15"
      />,
    );

    expect(screen.getByLabelText("Taille")).toHaveValue("168");
    expect(screen.getByRole("radio", { name: "Femme" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Début de la transformation")).toHaveValue(
      "2026-01-15",
    );
  });
});
