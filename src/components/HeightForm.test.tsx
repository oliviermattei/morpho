import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeightForm } from "./HeightForm";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const { toastSuccessMock } = vi.hoisted(() => ({ toastSuccessMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock } }));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// s08 task 6: the second FieldSet, same form, same button — added
// directly to this file rather than a new component, per "son form
// modifié (s04)" in the plan's Files touched.
describe("HeightForm — the target weight field (s08 task 6)", () => {
  it("renders an empty field when no target is persisted", () => {
    render(<HeightForm initialHeightCm={null} initialTargetWeightKg={null} />);

    expect(screen.getByLabelText("Poids cible (kg)")).toHaveValue("");
  });

  it("pre-fills the field with the persisted target, French comma", () => {
    render(<HeightForm initialHeightCm={null} initialTargetWeightKg={72.5} />);

    expect(screen.getByLabelText("Poids cible (kg)")).toHaveValue("72,5");
  });

  it("pre-fills a whole-number target without a trailing zero (72.0 -> '72')", () => {
    render(<HeightForm initialHeightCm={null} initialTargetWeightKg={72} />);

    expect(screen.getByLabelText("Poids cible (kg)")).toHaveValue("72");
  });

  it('is type="text" with inputMode="decimal", never type="number" (decision 19)', () => {
    render(<HeightForm initialHeightCm={null} initialTargetWeightKg={null} />);

    const input = screen.getByLabelText("Poids cible (kg)");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "decimal");
  });

  it("has h-11", () => {
    render(<HeightForm initialHeightCm={null} initialTargetWeightKg={null} />);

    expect(
      screen.getByLabelText("Poids cible (kg)").className,
    ).toMatch(/\bh-11\b/);
  });

  it("shares a single submit button with the height field — no second button for this section", () => {
    render(<HeightForm initialHeightCm={175} initialTargetWeightKg={72} />);

    expect(screen.getAllByRole("button", { name: /enregistr/i })).toHaveLength(1);
  });

  // Design, state "Vide": absence of a target is a normal state, not a
  // gap to fill — no invitation, no suggestion.
  it("shows no invitation to set a target when none is persisted", () => {
    render(<HeightForm initialHeightCm={null} initialTargetWeightKg={null} />);

    expect(screen.queryByText(/définissez une cible/i)).toBeNull();
  });
});

describe("HeightForm — the field (criterion 1, plan P4)", () => {
  it("pre-fills the field with the persisted value", () => {
    render(<HeightForm initialHeightCm={175} />);

    expect(screen.getByLabelText("Taille (cm)")).toHaveValue("175");
  });

  it("renders an empty field when no height is persisted yet", () => {
    render(<HeightForm initialHeightCm={null} />);

    expect(screen.getByLabelText("Taille (cm)")).toHaveValue("");
  });

  it('is type="text" with inputMode="decimal", never type="number" (P4)', () => {
    render(<HeightForm initialHeightCm={null} />);

    const input = screen.getByLabelText("Taille (cm)");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "decimal");
  });

  it("gives the field and the submit button h-11", () => {
    render(<HeightForm initialHeightCm={null} />);

    expect(screen.getByLabelText("Taille (cm)").className).toMatch(/\bh-11\b/);
    expect(
      screen.getByRole("button", { name: "Enregistrer" }).className,
    ).toMatch(/\bh-11\b/);
  });

  it("never renders a BMI field on this form", () => {
    render(<HeightForm initialHeightCm={175} />);

    expect(screen.queryByLabelText(/imc/i)).toBeNull();
  });

  // design-system.md §Do/Don't: scan the raw source, like
  // src/app/page.test.tsx's boilerplate-purge test — the rendered DOM
  // also carries src/components/ui/*'s own generated classes (e.g.
  // button.tsx's `not-aria-[haspopup]`), which are the preset's, not this
  // component's, and would make an innerHTML scan false-positive.
  it("contains no literal color class or arbitrary Tailwind value in its own source", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "HeightForm.tsx"),
      "utf8",
    );
    const literalColor =
      /\b(?:bg|text|border|fill|stroke)-(?:red|green|blue|yellow)-\d{2,3}\b/;
    const arbitraryValue = /-\[[^\]]+\]/;

    expect(source).not.toMatch(literalColor);
    expect(source).not.toMatch(arbitraryValue);
  });
});

describe("HeightForm — submission", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    refreshMock.mockClear();
    toastSuccessMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits the raw string the user typed, PUT to /api/profile", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(200, { heightCm: 175.5 }));
    render(<HeightForm initialHeightCm={null} />);

    await user.type(screen.getByLabelText("Taille (cm)"), "175,5");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/profile");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body.heightCm).toBe("175,5");
  });

  it("shows a success toast and refreshes the router on 200", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(200, { heightCm: 175 }));
    render(<HeightForm initialHeightCm={null} />);

    await user.type(screen.getByLabelText("Taille (cm)"), "175");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).toHaveBeenCalledWith("Taille enregistrée.");
  });

  it('shows the "Taille retirée." toast when the field is cleared and saved (R7)', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(200, { heightCm: null }));
    render(<HeightForm initialHeightCm={175} />);

    await user.clear(screen.getByLabelText("Taille (cm)"));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).toHaveBeenCalledWith("Taille retirée.");
  });

  it("shows a field error under the field on 400, and keeps the value the user typed", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        fieldErrors: { heightCm: ["Indiquez une taille entre 80 et 260 cm."] },
      }),
    );
    render(<HeightForm initialHeightCm={null} />);

    const input = screen.getByLabelText("Taille (cm)");
    await user.type(input, "300");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(
      await screen.findByText("Indiquez une taille entre 80 et 260 cm."),
    ).toBeInTheDocument();
    // The refused input, not the persisted value (there is none here) and
    // not blanked out.
    expect(input).toHaveValue("300");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  // Review finding 3, mirroring MeasurementSessionForm's own fix (s03
  // review finding 2, commit 47b66c9): a 401 is the normal shape of an
  // expired session (sessionDataTtl: 300), not a transport/server
  // failure — the generic OPERATION_FAILURE_MESSAGE would tell the user
  // to retry a save that can never succeed until they sign in again.
  it("tells the user their session expired on 401, instead of a generic operation failure, and offers a way to sign in again", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "unauthorized" }));
    render(<HeightForm initialHeightCm={null} />);

    await user.type(screen.getByLabelText("Taille (cm)"), "175");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/session a expiré/i);
    expect(alert).not.toHaveTextContent(
      "Enregistrement impossible pour l'instant. Réessayez.",
    );
    expect(
      screen.getByRole("link", { name: /se reconnecter/i }),
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  it("shows the operation-error message on a 503, and the button becomes actionable again", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(503, { error: "auth_unavailable" }));
    render(<HeightForm initialHeightCm={null} />);

    await user.type(screen.getByLabelText("Taille (cm)"), "175");
    const button = screen.getByRole("button", { name: "Enregistrer" });
    await user.click(button);

    expect(
      await screen.findByText(
        "Enregistrement impossible pour l'instant. Réessayez.",
      ),
    ).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("disables the button and shows a spinner while the request is in flight, without clearing or disabling the field", async () => {
    const user = userEvent.setup();
    let resolveFetch: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<HeightForm initialHeightCm={null} />);

    const input = screen.getByLabelText("Taille (cm)");
    await user.type(input, "175");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    const button = screen.getByRole("button", { name: /Enregistrement/ });
    expect(button).toBeDisabled();
    expect(input).not.toBeDisabled();
    expect(input).toHaveValue("175");

    resolveFetch(jsonResponse(200, { heightCm: 175 }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
