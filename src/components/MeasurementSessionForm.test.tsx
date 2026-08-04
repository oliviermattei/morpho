import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeasurementSessionForm } from "./MeasurementSessionForm";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Several tests below install fake timers and restore them on their LAST
// line. That works until one of them fails: the assertion throws, the
// restore never runs, and every later test in the file inherits frozen
// timers — userEvent then waits forever on a setTimeout that will never
// fire, so a single real failure surfaced as five unrelated 5-second
// timeouts (observed, while the date field was being migrated to the
// shadcn picker). This afterEach makes the restore unconditional; the
// per-test calls stay, harmlessly, since useRealTimers is idempotent.
afterEach(() => {
  vi.useRealTimers();
});

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

// s10 plan task 8, decision 20: the form's own network-failure path
// feeds the SAME probe the offline banner relies on.
const { reportNetworkFailureMock } = vi.hoisted(() => ({
  reportNetworkFailureMock: vi.fn(),
}));
vi.mock("@/lib/pwa/use-online-status", () => ({
  reportNetworkFailure: reportNetworkFailureMock,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// s04 criterion 4: BMI is derived on read, never entered — asserted on
// this real form, not a copy, so a future field added here fails this
// test rather than only s04's own components.
describe("MeasurementSessionForm — no BMI field (s04 criterion 4)", () => {
  it("never renders a field labeled or named after the BMI", () => {
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    expect(screen.queryByLabelText(/imc/i)).toBeNull();
    expect(document.querySelector('[name*="imc" i]')).toBeNull();
    expect(document.querySelector('[id*="imc" i]')).toBeNull();
  });
});

describe("MeasurementSessionForm — the 11 fields (criterion 1)", () => {
  it("renders the date field and the 10 measurement fields with their French labels", () => {
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Poids (kg)")).toBeInTheDocument();
    for (const label of [
      "Épaules",
      "Poitrine",
      "Biceps",
      "Taille",
      "Hanches",
      "Cuisse",
      "Mollet",
      "Masse grasse",
      "Masse musculaire",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('never renders a number input, a password input, or a unit selector (criterion 9 — no unit picker anywhere)', () => {
    const { container } = render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  it("shows no placeholder on any measurement field — an empty field must read as empty, not as a suggestion", () => {
    const { container } = render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    expect(container.querySelectorAll("[placeholder]")).toHaveLength(0);
  });

  it("fills the date field with the device's today date after mount, never a server-computed default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 2, 23, 0));

    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    // The native <input type="date"> is gone (its browser-drawn popup
    // ignored the design system): the field is now the shadcn picker's
    // trigger, which renders the same calendar day in long French.
    expect(screen.getByLabelText("Date")).toHaveTextContent("2 août 2026");

    vi.useRealTimers();
  });

  it("offers only the server's valid date window as a client-side courtesy — the server stays the authority", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 7, 2, 23, 0)));

    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    // Same window as before, read off the picker's own data-min/data-max
    // rather than an <input>'s min/max — a Popover trigger has no such
    // native attributes.
    const dateField = screen.getByLabelText("Date");
    expect(dateField).toHaveAttribute("data-min", "2000-01-01");
    expect(dateField).toHaveAttribute("data-max", "2026-08-03");

    vi.useRealTimers();
  });
});

describe("MeasurementSessionForm — vertical structure (Design, review finding 3)", () => {
  it("places a FieldSeparator both after the weight field and between the two FieldSets, matching the design's sketch", () => {
    const { container } = render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    expect(
      container.querySelectorAll('[data-slot="field-separator"]'),
    ).toHaveLength(2);
  });
});

describe("MeasurementSessionForm — touch targets (decision 23)", () => {
  it("gives every field and the submit button h-11", () => {
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    const labels = [
      "Date",
      "Poids (kg)",
      "Épaules",
      "Poitrine",
      "Biceps",
      "Taille",
      "Hanches",
      "Cuisse",
      "Mollet",
      "Masse grasse",
      "Masse musculaire",
    ];
    for (const label of labels) {
      expect(screen.getByLabelText(label).className).toMatch(/\bh-11\b/);
    }
    expect(
      screen.getByRole("button", { name: /Enregistrer la session/ })
        .className,
    ).toMatch(/\bh-11\b/);
  });
});

// Plan task 4: exactly the seven provided kinds carry the marker and the
// formatted value; the three absent ones stay empty, unmarked, and never
// show a placeholder or a fabricated "0". input.value (not just the
// marker's presence) is asserted — that's what makes this test red if
// defaultValue were used on a controlled field (decision N7).
describe("MeasurementSessionForm — initial values (task 4, criteria 1-3)", () => {
  const PROVIDED_VALUES = {
    weight_kg: 82.4,
    shoulders_cm: 118,
    chest_cm: 104,
    biceps_cm: 34.5,
    waist_cm: 96,
    hips_cm: 101,
    thigh_cm: 58,
  };
  const ABSENT_KINDS = ["calf_cm", "body_fat_pct", "muscle_pct"] as const;
  const KIND_TO_LABEL: Record<string, string> = {
    weight_kg: "Poids (kg)",
    shoulders_cm: "Épaules",
    chest_cm: "Poitrine",
    biceps_cm: "Biceps",
    waist_cm: "Taille",
    hips_cm: "Hanches",
    thigh_cm: "Cuisse",
    calf_cm: "Mollet",
    body_fat_pct: "Masse grasse",
    muscle_pct: "Masse musculaire",
  };

  it("marks exactly the seven provided kinds data-prefilled, with their exact rendered value", () => {
    const { container } = render(
      <MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />,
    );

    const prefilledInputs = container.querySelectorAll(
      'input[data-prefilled="true"]',
    );
    expect(prefilledInputs).toHaveLength(7);

    for (const [kind, value] of Object.entries(PROVIDED_VALUES)) {
      const input = screen.getByLabelText(
        KIND_TO_LABEL[kind],
      ) as HTMLInputElement;
      expect(input).toHaveAttribute("data-prefilled", "true");
      expect(input.value).toBe(String(value).replace(".", ","));
    }
  });

  it("leaves the three absent kinds empty, unmarked, with no placeholder, and never '0'", () => {
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);

    for (const kind of ABSENT_KINDS) {
      const input = screen.getByLabelText(
        KIND_TO_LABEL[kind],
      ) as HTMLInputElement;
      expect(input).not.toHaveAttribute("data-prefilled");
      expect(input).not.toHaveAttribute("placeholder");
      expect(input.value).toBe("");
      expect(input.value).not.toBe("0");
    }
  });
});

// Plan task 5, decision N4: onInput (not onChange, whose name invites a
// future reader to "correct" it toward the native change/blur semantics),
// guarded (no setState if the field already lost its marker) and
// irreversible (retyping the original value never restores it).
describe("MeasurementSessionForm — marker removal on first modification (task 5, criterion 3)", () => {
  const PROVIDED_VALUES = { weight_kg: 82.4, biceps_cm: 34.5 };

  it("removes the marker on a keystroke", async () => {
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText("Poids (kg)");
    expect(weightInput).toHaveAttribute("data-prefilled", "true");

    await user.type(weightInput, "1");

    expect(weightInput).not.toHaveAttribute("data-prefilled");
  });

  it("removes the marker on a paste", async () => {
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText("Poids (kg)");

    await user.click(weightInput);
    await user.paste("75,0");

    expect(weightInput).not.toHaveAttribute("data-prefilled");
  });

  it("removes the marker and empties the field when fully cleared", async () => {
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText(
      "Poids (kg)",
    ) as HTMLInputElement;

    await user.clear(weightInput);

    expect(weightInput).not.toHaveAttribute("data-prefilled");
    expect(weightInput.value).toBe("");
  });

  it("never restores the marker even if the user retypes the original value", async () => {
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText(
      "Poids (kg)",
    ) as HTMLInputElement;

    await user.clear(weightInput);
    await user.type(weightInput, "82,4");

    expect(weightInput.value).toBe("82,4");
    expect(weightInput).not.toHaveAttribute("data-prefilled");
  });

  it("leaves the other prefilled fields' marker untouched", async () => {
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText("Poids (kg)");
    const bicepsInput = screen.getByLabelText("Biceps");

    await user.type(weightInput, "1");

    expect(weightInput).not.toHaveAttribute("data-prefilled");
    expect(bicepsInput).toHaveAttribute("data-prefilled", "true");
  });
});

// Plan task 6, decision R5: focus on a prefilled field selects it
// synchronously, then reapplies once more a frame later (the iOS Safari
// repositioning workaround), guarded so the reapplication never fires on
// a field that's no longer focused or no longer prefilled by the time the
// frame runs.
describe("MeasurementSessionForm — selection on focus (task 6, criterion 6)", () => {
  const PROVIDED_VALUES = { weight_kg: 82.4, biceps_cm: 34.5 };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects the whole value synchronously on focus of a prefilled field", () => {
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText(
      "Poids (kg)",
    ) as HTMLInputElement;

    weightInput.focus();

    expect(weightInput.selectionStart).toBe(0);
    expect(weightInput.selectionEnd).toBe(weightInput.value.length);
  });

  it("reapplies the selection one frame later, undoing iOS's post-focus cursor repositioning", () => {
    vi.useFakeTimers();
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText(
      "Poids (kg)",
    ) as HTMLInputElement;

    weightInput.focus();
    // Simulate iOS Safari repositioning the cursor after the focus
    // handler ran — the known-unreliable case R5 exists to fix.
    weightInput.setSelectionRange(
      weightInput.value.length,
      weightInput.value.length,
    );
    vi.advanceTimersToNextFrame();

    expect(weightInput.selectionStart).toBe(0);
    expect(weightInput.selectionEnd).toBe(weightInput.value.length);
  });

  it("does not reapply the selection to a field that lost focus before the frame ran", () => {
    vi.useFakeTimers();
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText(
      "Poids (kg)",
    ) as HTMLInputElement;
    const bicepsInput = screen.getByLabelText("Biceps") as HTMLInputElement;

    weightInput.focus();
    bicepsInput.focus();
    weightInput.setSelectionRange(0, 0);

    expect(() => vi.advanceTimersToNextFrame()).not.toThrow();
    expect(weightInput.selectionStart).toBe(0);
    expect(weightInput.selectionEnd).toBe(0);
  });

  it("does not reapply the selection to a field the user started editing before the frame ran", () => {
    vi.useFakeTimers();
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const weightInput = screen.getByLabelText(
      "Poids (kg)",
    ) as HTMLInputElement;

    weightInput.focus();
    // A keystroke arrives before the deferred frame runs — this removes
    // the marker (task 5), which is the guard under test here.
    fireEvent.input(weightInput, { target: { value: "821,4" } });
    weightInput.setSelectionRange(0, 0);

    vi.advanceTimersToNextFrame();

    expect(weightInput).not.toHaveAttribute("data-prefilled");
    expect(weightInput.selectionStart).toBe(0);
    expect(weightInput.selectionEnd).toBe(0);
  });

  it("does not select on focus of a field that has already been touched", () => {
    render(<MeasurementSessionForm mode="create" suggestions={PROVIDED_VALUES} />);
    const bicepsInput = screen.getByLabelText("Biceps") as HTMLInputElement;
    fireEvent.input(bicepsInput, { target: { value: "341,5" } });
    bicepsInput.blur();
    bicepsInput.setSelectionRange(2, 2);

    bicepsInput.focus();

    expect(bicepsInput.selectionStart).toBe(2);
    expect(bicepsInput.selectionEnd).toBe(2);
  });
});

// Plan task 8, decisions N9 and gap 2: the legend that carries the
// non-color explanation of the grey/prefilled convention, the first-time
// message when there is no history at all, and the non-blocking
// read-failure line — the three are mutually exclusive.
describe("MeasurementSessionForm — legend, first use, prefill read failure (task 8)", () => {
  it("shows the prefilled legend when at least one field is prefilled", () => {
    render(<MeasurementSessionForm mode="create" suggestions={{ weight_kg: 82.4 }} />);

    expect(
      screen.getByText(
        "Les valeurs grisées sont vos dernières mesures. Touchez un champ pour le remplacer.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the first-time message instead of the prefilled legend when there is no history at all", () => {
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    expect(
      screen.getByText(
        "Première saisie : rien à reprendre. Les prochaines fois, vos valeurs seront déjà là.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Les valeurs grisées sont vos dernières mesures/),
    ).toBeNull();
  });

  it("shows the non-blocking read-failure line, all ten fields empty and enabled, when prefillFailed is set", () => {
    render(
      <MeasurementSessionForm mode="create" suggestions={{}} prefillFailed />,
    );

    expect(
      screen.getByText(
        "Vos dernières valeurs n'ont pas pu être chargées. Vous pouvez saisir directement.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Première saisie/)).toBeNull();
    expect(screen.queryByText(/Les valeurs grisées/)).toBeNull();

    for (const label of [
      "Poids (kg)",
      "Épaules",
      "Poitrine",
      "Biceps",
      "Taille",
      "Hanches",
      "Cuisse",
      "Mollet",
      "Masse grasse",
      "Masse musculaire",
    ]) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.value).toBe("");
      expect(input).not.toBeDisabled();
      expect(input).not.toHaveAttribute("data-prefilled");
    }
  });
});

describe("MeasurementSessionForm — submission", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onLineGetter: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    onLineGetter = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(true);
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    reportNetworkFailureMock.mockClear();
  });

  afterEach(() => {
    onLineGetter.mockRestore();
    vi.unstubAllGlobals();
  });

  it("tells the user their session expired on 401, instead of lying that it's a network failure, and offers a way to sign in again", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "unauthorized" }));
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    // The form now refuses an empty submission itself, before any fetch
    // — so reaching the server's 401 requires a submittable form.
    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/session a expiré/i);
    expect(alert).not.toHaveTextContent(
      "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.",
    );
    expect(
      screen.getByRole("link", { name: /se reconnecter/i }),
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  it("shows the server's form-level message in an Alert when the form is submitted empty", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        fieldErrors: {},
        formErrors: ["Renseignez au moins une mesure avant d'enregistrer."],
      }),
    );
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Renseignez au moins une mesure avant d'enregistrer.",
    );
  });

  it("shows a field error under the date field on 400, exactly like any other field", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        fieldErrors: {
          measuredOn: ["La date n'est pas reconnue."],
        },
        formErrors: [],
      }),
    );
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    // Same reason as the 401 test above: the client gate refuses an
    // empty form, so the server's own date verdict needs a submittable one.
    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    expect(
      await screen.findByText("La date n'est pas reconnue."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows a field error under the offending field on 400, and keeps the value the user typed", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        fieldErrors: {
          waist_cm: ["Taille doit être compris entre 40 et 200 cm."],
        },
        formErrors: [],
      }),
    );
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    const waistInput = screen.getByLabelText("Taille");
    await user.type(waistInput, "500");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    expect(
      await screen.findByText(
        "Taille doit être compris entre 40 et 200 cm.",
      ),
    ).toBeInTheDocument();
    expect(waistInput).toHaveAttribute("aria-invalid", "true");
    expect((waistInput as HTMLInputElement).value).toBe("500");
  });

  it("shows a toast then navigates to /historique on 201", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "session-1" }));
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/historique"));
    expect(toastSuccessMock).toHaveBeenCalledWith("Session enregistrée");
  });

  it("disables the submit button while the request is in flight, preventing a double submission", async () => {
    const user = userEvent.setup();
    let resolveFetch: (response: Response) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    const submitButton = screen.getByRole("button", {
      name: /Enregistrer la session/,
    });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(201, { id: "session-1" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalled());
  });

  it("sends the raw, unnormalized strings the user typed — the server is the authority (criterion 5)", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "session-1" }));
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.weight_kg).toBe("82,4");
  });

  // Plan task 7, criteria 2 and 4: submitting the plateau untouched sends
  // the prefilled kinds' exact displayed string and leaves the absent
  // kinds empty — the server (unmodified, decision N1) turns an empty
  // string into no row at all, never a fabricated "0".
  it("submits the plateau unmodified: prefilled kinds keep their exact displayed string, absent kinds stay empty", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "session-1" }));
    render(
      <MeasurementSessionForm
        mode="create"
        suggestions={{ weight_kg: 82.4, biceps_cm: 34.5 }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.weight_kg).toBe("82,4");
    expect(body.biceps_cm).toBe("34,5");
    expect(body.shoulders_cm).toBe("");
    expect(body.chest_cm).toBe("");
    expect(body.waist_cm).toBe("");
    expect(body.hips_cm).toBe("");
    expect(body.thigh_cm).toBe("");
    expect(body.calf_cm).toBe("");
    expect(body.body_fat_pct).toBe("");
    expect(body.muscle_pct).toBe("");
  });
});

// s10 plan task 8, decision 11: two refusal paths, one message, the
// button never disabled BECAUSE of being offline, and — the most
// important tests in the story — no queue anywhere.
describe("MeasurementSessionForm — offline capture refusal (s10 task 8)", () => {
  const OFFLINE_MESSAGE =
    "Saisie impossible hors ligne. Vos valeurs sont conservées, réessayez une fois reconnecté.";

  let fetchMock: ReturnType<typeof vi.fn>;
  let onLineGetter: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    onLineGetter = vi.spyOn(window.navigator, "onLine", "get");
    toastErrorMock.mockClear();
    reportNetworkFailureMock.mockClear();
  });

  afterEach(() => {
    onLineGetter.mockRestore();
    vi.unstubAllGlobals();
  });

  // (a) navigator.onLine === false at submission time.
  it("(a) refuses immediately when offline — never calls the API", async () => {
    onLineGetter.mockReturnValue(false);
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(OFFLINE_MESSAGE);
  });

  // (b) onLine lies (true) but the fetch itself fails — the same message.
  it("(b) refuses with the SAME message when onLine is true but the request fails with a network error", async () => {
    onLineGetter.mockReturnValue(true);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(toastErrorMock).toHaveBeenCalledWith(OFFLINE_MESSAGE);
    // (b) alone feeds the probe — (a) never needs to, navigator.onLine
    // already told the banner everything it needs to know.
    expect(reportNetworkFailureMock).toHaveBeenCalledTimes(1);
  });

  it("does not call reportNetworkFailure() on path (a)", async () => {
    onLineGetter.mockReturnValue(false);
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    expect(reportNetworkFailureMock).not.toHaveBeenCalled();
  });

  // (c) criterion 5: the ten fields keep exactly what the user typed,
  // in BOTH refusal paths.
  it("(c) keeps every typed value unchanged after an offline refusal", async () => {
    onLineGetter.mockReturnValue(false);
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.type(screen.getByLabelText("Taille"), "90");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    expect(
      (screen.getByLabelText("Poids (kg)") as HTMLInputElement).value,
    ).toBe("82,4");
    expect(
      (screen.getByLabelText("Taille") as HTMLInputElement).value,
    ).toBe("90");
  });

  it("(c) keeps every typed value unchanged after a network-failure refusal", async () => {
    onLineGetter.mockReturnValue(true);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      (screen.getByLabelText("Poids (kg)") as HTMLInputElement).value,
    ).toBe("82,4");
  });

  // (d) the test that makes "rien n'est mis en file d'attente" a
  // property rather than a claim — the exact test that fails the day a
  // future story adds a "helpful" draft.
  it("(d) never touches localStorage, sessionStorage or indexedDB in either refusal path", async () => {
    // Storage.prototype is shared by window.localStorage AND
    // window.sessionStorage under jsdom — one spy covers both.
    const storageSetItemSpy = vi.spyOn(Storage.prototype, "setItem");
    // jsdom doesn't implement IndexedDB at all (window.indexedDB is
    // undefined) — which trivially satisfies "never calls .open()", but
    // guard explicitly rather than silently skipping the assertion if a
    // future jsdom version ever adds a stub.
    const indexedDbSpy = window.indexedDB
      ? vi.spyOn(window.indexedDB, "open").mockImplementation(() => {
          throw new Error("indexedDB.open must never be called");
        })
      : null;

    onLineGetter.mockReturnValue(false);
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);
    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    expect(storageSetItemSpy).not.toHaveBeenCalled();
    if (indexedDbSpy) {
      expect(indexedDbSpy).not.toHaveBeenCalled();
      indexedDbSpy.mockRestore();
    }

    storageSetItemSpy.mockRestore();
  });

  // (e) once the network is back, a submission succeeds and writes
  // exactly one session — no replay of the refused attempt.
  it("(e) a submission after the network returns succeeds and calls fetch exactly once", async () => {
    onLineGetter.mockReturnValue(false);
    const user = userEvent.setup();
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);
    await user.type(screen.getByLabelText("Poids (kg)"), "82,4");
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    onLineGetter.mockReturnValue(true);
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "session-1" }));
    await user.click(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("never disables the submit button because of being offline", async () => {
    onLineGetter.mockReturnValue(false);
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    expect(
      screen.getByRole("button", { name: /Enregistrer la session/ }),
    ).not.toBeDisabled();
  });
});

// Plan s09 task 7, R16: the story's own named trap, made impossible by the
// type union rather than merely observed — an "edit" props object has no
// `suggestions` field at all, so a caller cannot pass suggested values to
// an edit-mode form even by mistake. These tests prove the RUNTIME half:
// that mode="edit" never applies s05's grey/data-prefilled treatment to a
// value that is actually recorded.
describe("MeasurementSessionForm — mode='edit' (s09 task 7)", () => {
  const RECORDED_VALUES = { weight_kg: 82.4, waist_cm: 90 };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    pushMock.mockClear();
    toastSuccessMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // (a) a kind absent from `recorded` renders empty, in a scenario where
  // create mode would have filled it from a suggestion.
  it("renders a kind absent from `recorded` as an empty field", () => {
    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );

    const biceps = screen.getByLabelText("Biceps") as HTMLInputElement;
    expect(biceps.value).toBe("");
  });

  // (a) also: the date field is the session's OWN recorded date, not
  // today's — unlike create mode's client-only default.
  it("fills the date field with the session's own recorded date", () => {
    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );

    // The picker renders the recorded day as its trigger label, in long
    // French — there is no <input> to read a raw ISO `value` off any more.
    expect(screen.getByLabelText("Date")).toHaveTextContent("1 août 2026");
  });

  // (b) no data-prefilled anywhere, ever — at mount or after typing.
  it("never renders data-prefilled, at mount or after typing in another field", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );

    expect(container.querySelector("[data-prefilled]")).toBeNull();

    await user.type(screen.getByLabelText("Hanches"), "95");

    expect(container.querySelector("[data-prefilled]")).toBeNull();
  });

  // (c) no muted-foreground value styling, no "valeurs grisées" legend.
  it("carries no data-prefilled marker on a recorded value (the muted-foreground styling is entirely driven by it), and shows no grisées legend", () => {
    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );

    // The Input's className statically carries the CONDITIONAL Tailwind
    // utility `data-[prefilled=true]:text-muted-foreground` regardless of
    // mode (it's markup, not a computed style) — the real signal, tested
    // here, is that the attribute it's keyed on is simply never present.
    const weightInput = screen.getByLabelText("Poids (kg)");
    expect(weightInput).not.toHaveAttribute("data-prefilled");
    expect(
      screen.queryByText(/Les valeurs grisées sont vos dernières mesures/),
    ).toBeNull();
  });

  // (d) clearing a field that carried a value shows the removal notice;
  // retyping makes it disappear again.
  it('shows "Cette mesure sera retirée." under a cleared field that was recorded, and hides it again once retyped', async () => {
    const user = userEvent.setup();
    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );
    const weightInput = screen.getByLabelText("Poids (kg)");

    expect(screen.queryByText("Cette mesure sera retirée.")).toBeNull();

    await user.clear(weightInput);
    expect(
      screen.getByText("Cette mesure sera retirée."),
    ).toBeInTheDocument();

    await user.type(weightInput, "80");
    expect(screen.queryByText("Cette mesure sera retirée.")).toBeNull();
  });

  // Clearing a field that was NEVER recorded shows no removal notice —
  // there's nothing to remove.
  it('shows no removal notice for a field that was already empty', async () => {
    const user = userEvent.setup();
    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );
    const bicepsInput = screen.getByLabelText("Biceps");

    await user.click(bicepsInput);
    await user.click(document.body);

    expect(screen.queryByText("Cette mesure sera retirée.")).toBeNull();
  });

  // (e) the edit-mode header description, present only in edit mode.
  it("shows the edit-mode header description, never the create-mode legend", () => {
    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );

    expect(
      screen.getByText("Vider un champ retire cette mesure de la session."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Première saisie : rien à reprendre/),
    ).toBeNull();
    expect(
      screen.queryByText(/Les valeurs grisées sont vos dernières mesures/),
    ).toBeNull();
  });

  it("shows no edit-mode header description in create mode", () => {
    render(<MeasurementSessionForm mode="create" suggestions={{}} />);

    expect(
      screen.queryByText("Vider un champ retire cette mesure de la session."),
    ).toBeNull();
  });

  // (f) still type + inputMode=decimal + h-11 in edit mode.
  it("keeps every field type=text, inputMode=decimal and h-11 in edit mode", () => {
    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );

    const weightInput = screen.getByLabelText("Poids (kg)");
    expect(weightInput).toHaveAttribute("type", "text");
    expect(weightInput).toHaveAttribute("inputMode", "decimal");
    expect(weightInput.className).toMatch(/\bh-11\b/);
  });

  // (g) the round-trip: submitting untouched sends exactly the recorded
  // values, formatted for input — the aller-retour task 2's property test
  // guarantees never drifts them.
  it("submits exactly the recorded values, untouched, to PATCH /api/sessions/:id", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: "session-1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );

    // Edit mode names its own action: "Modifier la session", never
    // "Enregistrer la session" — the session already exists.
    await user.click(screen.getByRole("button", { name: /Modifier la session/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sessions/session-1");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.measuredOn).toBe("2026-08-01");
    expect(body.weight_kg).toBe("82,4");
    expect(body.waist_cm).toBe("90");
    expect(body.biceps_cm).toBe("");
  });

  it("shows a toast then navigates to /historique on a successful update", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: "session-1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MeasurementSessionForm
        mode="edit"
        sessionId="session-1"
        measuredOn="2026-08-01"
        recorded={RECORDED_VALUES}
      />,
    );

    // Edit mode names its own action: "Modifier la session", never
    // "Enregistrer la session" — the session already exists.
    await user.click(screen.getByRole("button", { name: /Modifier la session/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/historique"));
    expect(toastSuccessMock).toHaveBeenCalledWith("Modifications enregistrées");
  });
});
