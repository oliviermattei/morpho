"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DatePickerField } from "@/components/DatePickerField";
import { RequiredFieldLabel } from "@/components/RequiredMark";
import { cn } from "@/lib/utils";
import { todayIsoDate } from "@/lib/date";
import { focusFirstInvalidField } from "@/lib/form-focus";
import { routes } from "@/lib/routes";
import { reportNetworkFailure } from "@/lib/pwa/use-online-status";
import {
  EMPTY_SESSION_MESSAGE,
  MIN_MEASURED_ON,
  maxAllowedMeasuredOn,
} from "@/lib/measurement-session-input";
import {
  MEASUREMENT_CATALOG,
  formatMeasurementValueForInput,
  type MeasurementCatalogEntry,
  type MeasurementKind,
} from "@/lib/measurements";
import {
  createSession,
  updateSession,
  type MeasurementSessionPayload,
} from "@/lib/api/sessions";

function requiredCatalogEntry(kind: MeasurementKind): MeasurementCatalogEntry {
  const entry = MEASUREMENT_CATALOG.find((candidate) => candidate.kind === kind);
  if (!entry) {
    throw new Error(`Unreachable: ${kind} missing from MEASUREMENT_CATALOG`);
  }
  return entry;
}

const WEIGHT_ENTRY = requiredCatalogEntry("weight_kg");

const MENSURATIONS_ENTRIES = MEASUREMENT_CATALOG.filter(
  (entry) => entry.group === "mensurations",
);
const COMPOSITION_ENTRIES = MEASUREMENT_CATALOG.filter(
  (entry) => entry.group === "composition",
);

const NETWORK_FAILURE_MESSAGE =
  "L'enregistrement a échoué. Vérifiez votre connexion et réessayez.";

// s10 plan task 8, decision 11, docs/design-system.md § Textes hors
// ligne: the ONE message for both refusal paths — (a) navigator.onLine
// already false at submission, (b) onLine lied and the request itself
// failed with a network error. Distinct from NETWORK_FAILURE_MESSAGE
// above, which stays for a genuine server-side failure (a non-2xx/40x
// status while actually online) — a different class of problem.
const OFFLINE_CAPTURE_MESSAGE =
  "Saisie impossible hors ligne. Vos valeurs sont conservées, réessayez une fois reconnecté.";

// Review finding 2: a 401 here is the normal shape of an expired session
// (sessionDataTtl: 300, src/lib/auth.ts) — it is not a transport failure,
// and NETWORK_FAILURE_MESSAGE would tell the user to check their
// connection when the real fix is to sign in again. The proxy redirects
// on the next navigation anyway; this is about not lying, not recovery.
const SESSION_EXPIRED_MESSAGE = "Votre session a expiré.";

// Plan task 8, design system gap 2 and decision N9: the three mutually
// exclusive lines that sit above the value fields — never more than one
// at a time, and only in mode="create" (s09 D5). The color that marks a
// prefilled value (--muted-foreground) never carries the explanation
// alone (design, "la couleur ne porte pas l'information seule").
const PREFILLED_LEGEND =
  "Les valeurs grisées sont vos dernières mesures. Touchez un champ pour le remplacer.";
const FIRST_ENTRY_MESSAGE =
  "Première saisie : rien à reprendre. Les prochaines fois, vos valeurs seront déjà là.";
const PREFILL_READ_FAILURE_MESSAGE =
  "Vos dernières valeurs n'ont pas pu être chargées. Vous pouvez saisir directement.";

// s09 plan task 7(e)/D5: mode="edit"'s own header line, mutually exclusive
// with the three above — a recorded value is a confirmed fact, never a
// suggestion, so it never shares their wording.
const EDIT_HEADER_DESCRIPTION =
  "Vider un champ retire cette mesure de la session.";

// s09 plan task 7(d), design state 8: shown under a field that WAS
// recorded and is now empty — a plain fact, not an error (never rendered
// through FieldError, which is styled destructive).
const MEASUREMENT_WILL_BE_REMOVED_MESSAGE = "Cette mesure sera retirée.";

const CREATE_SUCCESS_MESSAGE = "Session enregistrée";
const EDIT_SUCCESS_MESSAGE = "Modifications enregistrées";

// The two client-side refusals. Both were previously only enforced by
// the server, so the way a user discovered either was a round trip that
// came back with a message below the fold. Neither replaces the server
// check (AGENTS.md: every payload is validated server-side regardless) —
// they only stop a submission that is already known to be refused.
const DATE_REQUIRED_MESSAGE = "Indiquez la date de la session.";

// The id of the first field the "au moins une mesure" error points at.
// The weight is the one measurement every session in this app is
// expected to carry, so it is where the eye should land.
const FIRST_MEASUREMENT_FIELD_ID = WEIGHT_ENTRY.kind;

// Field ids in the order they appear ON SCREEN — what
// focusFirstInvalidField walks to decide which problem to scroll to.
// Derived from the same catalog slices the JSX renders, so a reordered
// form can never leave this list describing the previous layout.
const FIELD_ORDER: readonly string[] = [
  "measuredOn",
  WEIGHT_ENTRY.kind,
  ...MENSURATIONS_ENTRIES.map((entry) => entry.kind),
  ...COMPOSITION_ENTRIES.map((entry) => entry.kind),
];

type MeasurementValues = Record<MeasurementKind, string>;

function emptyMeasurementValues(): MeasurementValues {
  return Object.fromEntries(
    MEASUREMENT_CATALOG.map((entry) => [entry.kind, ""]),
  ) as MeasurementValues;
}

/**
 * Plan task 3/4, decision N7: the component is controlled (values live in
 * useState), so initialValues feed the useState lazy initializer directly
 * — never a useEffect that would resynchronize the field and destroy
 * whatever the user had already typed while the read was in flight.
 * `?? 0` never appears here: a kind absent from initialValues stays the
 * empty string emptyMeasurementValues() already gives it.
 */
function initialMeasurementValues(
  initialValues: Partial<Record<MeasurementKind, number>>,
): MeasurementValues {
  const values = emptyMeasurementValues();
  for (const entry of MEASUREMENT_CATALOG) {
    const value = initialValues[entry.kind];
    if (value !== undefined) {
      values[entry.kind] = formatMeasurementValueForInput(value);
    }
  }
  return values;
}

/**
 * Plan task 4, criterion 3: the kinds carrying the data-prefilled marker
 * at mount — exactly the kinds initialValues actually provided, never
 * every kind (which would mark the empty ones too) and never derived
 * from the value string (an empty string is never mistaken for "typed").
 */
function initialPrefilledKinds(
  initialValues: Partial<Record<MeasurementKind, number>>,
): Set<MeasurementKind> {
  return new Set(
    MEASUREMENT_CATALOG.filter(
      (entry) => initialValues[entry.kind] !== undefined,
    ).map((entry) => entry.kind),
  );
}

interface SubmissionErrors {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}

/**
 * s09 plan R16, the story's own named trap made impossible by typing
 * rather than merely observed: s05's "suggested" prefill (create) and
 * s09's "actually recorded" prefill (edit) are two DIFFERENT mechanics on
 * the same form, and this union has no default — TypeScript refuses a
 * caller that passes `suggestions` in edit mode, refuses one that omits
 * `mode` entirely, and refuses one that tries to grey a recorded value.
 * `prefillFailed` only exists on the "create" branch: edit mode's data
 * comes from the page's own server read (task 8), which has no client-
 * side "prefill fetch" to fail — a read failure there is the page's own
 * not-found/error state, never this component's concern.
 */
export type MeasurementSessionFormProps =
  | {
      mode: "create";
      suggestions: Partial<Record<MeasurementKind, number>>;
      prefillFailed?: boolean;
    }
  | {
      mode: "edit";
      sessionId: string;
      measuredOn: string;
      recorded: Partial<Record<MeasurementKind, number>>;
    };

/**
 * Design (docs/designs/s03-log-measurement-session.md): date + weight in
 * their own full-width Field, then two FieldSet groups (7 mensurations,
 * 2 percentages) in a 2-column grid whose row-major flow reproduces the
 * mockup's pairing exactly (shoulders/chest, biceps/waist, hips/thigh,
 * calf alone) without any manual pairing logic.
 *
 * type="text" + inputMode="decimal" on every measurement field, never
 * type="number" (research trap 2: it rejects the French comma and returns
 * "" on an invalid value, which reopens the empty-becomes-zero trap).
 * The date field is the one exception — <input type="date"> already
 * produces "YYYY-MM-DD", exactly z.iso.date()'s expected shape.
 */
export function MeasurementSessionForm(props: MeasurementSessionFormProps) {
  const router = useRouter();
  const initialValuesSource =
    props.mode === "create" ? props.suggestions : props.recorded;

  // Edit mode's date comes from the session being edited (a server fact,
  // available synchronously) — never the client-only "today" default
  // below, and never a source of hydration mismatch, since it's the same
  // value on server and client.
  const [measuredOn, setMeasuredOn] = useState(
    props.mode === "edit" ? props.measuredOn : "",
  );
  const [values, setValues] = useState<MeasurementValues>(() =>
    initialMeasurementValues(initialValuesSource),
  );
  const [prefilledKinds, setPrefilledKinds] = useState<Set<MeasurementKind>>(
    () =>
      props.mode === "create"
        ? initialPrefilledKinds(props.suggestions)
        : new Set(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<SubmissionErrors | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Posed after mount, deliberately: a default computed at render time
  // (including useState's lazy initializer, which still runs during the
  // initial render on both server and client) would run on the server
  // (Vercel, UTC) and produce a hydration mismatch against the device's
  // own calendar date (plan decision 9). The ref guard exists only so
  // this reads as the one-time, client-only synchronization it is, not a
  // value derivable from props/state. Never runs in edit mode — that
  // date is already set above, from the session itself.
  const defaultDateSet = useRef(false);
  useEffect(() => {
    if (props.mode === "create" && !defaultDateSet.current) {
      defaultDateSet.current = true;
      setMeasuredOn(todayIsoDate());
    }
  }, [props.mode]);

  function updateValue(kind: MeasurementKind, value: string) {
    setValues((previous) => ({ ...previous, [kind]: value }));
  }

  /**
   * Plan task 5, decision N4: onInput, not onChange — a paste or an
   * autofill both fire the native "input" event, and onInput's name
   * doesn't invite a future reader to "correct" it toward change's
   * blur-only semantics. Guarded (no setState once the marker is already
   * gone, sparing a re-render per keystroke on the fields already
   * touched) and irreversible: nothing ever re-adds a kind here, so
   * retyping the original value never restores the marker.
   */
  function removePrefilledMarker(kind: MeasurementKind) {
    setPrefilledKinds((previous) => {
      if (!previous.has(kind)) {
        return previous;
      }
      const next = new Set(previous);
      next.delete(kind);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // s10 plan task 8, decision 11(a): checked BEFORE anything else, and
    // BEFORE setSubmitting(true) — the button is never disabled because
    // of being offline (a false negative from navigator.onLine would
    // otherwise block a user who really is connected, with no
    // explanation). Values are left exactly as typed: nothing is
    // cleared, nothing is queued.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error(OFFLINE_CAPTURE_MESSAGE);
      return;
    }

    // The client-side gate. Runs before the request, never instead of the
    // server's own validation (AGENTS.md) — it exists so the two refusals
    // the form can already see coming don't cost a round trip, and so the
    // problem is scrolled into view rather than left below the fold.
    // Errors are written into the SAME state the server's 400 populates,
    // so there is one rendering of "this field is wrong", not two.
    const clientFieldErrors: Record<string, string[]> = {};
    const clientFormErrors: string[] = [];

    if (measuredOn.trim() === "") {
      clientFieldErrors.measuredOn = [DATE_REQUIRED_MESSAGE];
    }
    const hasAnyMeasurement = MEASUREMENT_CATALOG.some(
      (entry) => values[entry.kind].trim() !== "",
    );
    if (!hasAnyMeasurement) {
      clientFormErrors.push(EMPTY_SESSION_MESSAGE);
    }

    if (
      Object.keys(clientFieldErrors).length > 0 ||
      clientFormErrors.length > 0
    ) {
      setErrors({
        fieldErrors: clientFieldErrors,
        formErrors: clientFormErrors,
      });
      focusFirstInvalidField(FIELD_ORDER, (fieldId) =>
        fieldId === "measuredOn"
          ? clientFieldErrors.measuredOn !== undefined
          : fieldId === FIRST_MEASUREMENT_FIELD_ID && clientFormErrors.length > 0,
      );
      return;
    }

    setSubmitting(true);
    setErrors(null);
    setSessionExpired(false);

    try {
      // Raw strings, no client-side normalization — the server is the
      // sole authority (criterion 5): it must refuse an out-of-range or
      // malformed value even if this client would have let it through.
      // P6: the fetch call itself lives in src/lib/api/sessions.ts, never
      // here — this only branches on which of the two to call.
      const payload: MeasurementSessionPayload = { measuredOn, ...values };
      const response =
        props.mode === "create"
          ? await createSession(payload)
          : await updateSession(props.sessionId, payload);

      const successStatus = props.mode === "create" ? 201 : 200;
      if (response.status === successStatus) {
        toast.success(
          props.mode === "create" ? CREATE_SUCCESS_MESSAGE : EDIT_SUCCESS_MESSAGE,
        );
        // R10: push after an update, same as after a create — only
        // DeleteSessionDialog (task 8) uses replace, after a deletion.
        router.push(routes.history);
        return;
      }

      if (response.status === 400) {
        const body = (await response.json()) as SubmissionErrors;
        setErrors(body);
        // Same treatment as a client-side refusal: the server's verdict
        // is no less worth scrolling to, and on a form this tall the
        // refused field is routinely off-screen when the button isn't.
        focusFirstInvalidField(
          FIELD_ORDER,
          (fieldId) => body.fieldErrors?.[fieldId] !== undefined,
        );
        return;
      }

      if (response.status === 401) {
        setSessionExpired(true);
        return;
      }

      setErrors({ fieldErrors: {}, formErrors: [NETWORK_FAILURE_MESSAGE] });
    } catch {
      // decision 11(b): the fetch itself failed — onLine lied. Same
      // message as (a), same toast, and this is the one path that feeds
      // the probe decision 20's banner relies on (reportNetworkFailure,
      // exported by src/lib/pwa/use-online-status.ts) — without this
      // call, that probe trigger would exist and never fire.
      toast.error(OFFLINE_CAPTURE_MESSAGE);
      reportNetworkFailure();
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Plan task 6, decision R5: select the whole value synchronously on
   * focus, then reapply once more a frame later — iOS Safari repositions
   * the cursor after the focus handler runs, and the deferred
   * requestAnimationFrame call is the known workaround. Guarded by
   * `input.dataset.prefilled`, read fresh at the time the frame actually
   * runs (never the boolean captured when the handler was created): the
   * marker is a rendered DOM attribute kept in sync by React on every
   * state change (criterion 3), so it reflects "still prefilled" exactly
   * — a keystroke that removed it (task 5) between the focus and the
   * frame must not have its cursor overwritten. `document.activeElement`
   * guards the symmetric case: the user has since moved on to another
   * field.
   */
  function handleMeasurementFieldFocus(event: FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (input.dataset.prefilled !== "true") {
      return;
    }
    input.select();
    requestAnimationFrame(() => {
      if (document.activeElement !== input) {
        return;
      }
      if (input.dataset.prefilled !== "true") {
        return;
      }
      input.select();
    });
  }

  function renderMeasurementField(kind: MeasurementKind, label: string) {
    const fieldErrors = errors?.fieldErrors[kind];
    // create mode only — s09 D5: a recorded value (edit) is a confirmed
    // fact, never a suggestion, so it is NEVER marked data-prefilled and
    // never rendered in --muted-foreground (the collision R16 exists to
    // make impossible by typing, reasserted here at the one place both
    // mechanics would otherwise touch the same DOM node).
    const isPrefilled = props.mode === "create" && prefilledKinds.has(kind);
    // edit mode only — task 7(d), design state 8: a kind that WAS
    // recorded (props.recorded) and is now empty in the live value.
    const willBeRemoved =
      props.mode === "edit" &&
      props.recorded[kind] !== undefined &&
      values[kind].trim() === "";
    return (
      <Field key={kind} data-invalid={fieldErrors ? true : undefined}>
        <FieldLabel htmlFor={kind}>{label}</FieldLabel>
        <Input
          id={kind}
          name={kind}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          // Design system gap 2 / docs/design-system.md §Formulaires: a
          // prefilled, untouched value reads in --muted-foreground, driven
          // by the data-prefilled marker (not a separate boolean state) so
          // the distinction is a DOM fact a test can assert (criterion 3),
          // not an invisible React flag.
          className={cn(
            "h-11 text-base md:text-sm",
            "data-[prefilled=true]:text-muted-foreground",
          )}
          data-prefilled={isPrefilled ? "true" : undefined}
          aria-invalid={fieldErrors ? true : undefined}
          value={values[kind]}
          onFocus={handleMeasurementFieldFocus}
          onInput={(event) => {
            updateValue(kind, event.currentTarget.value);
            removePrefilledMarker(kind);
          }}
        />
        {willBeRemoved && !fieldErrors && (
          <p className="text-sm text-muted-foreground">
            {MEASUREMENT_WILL_BE_REMOVED_MESSAGE}
          </p>
        )}
        <FieldError
          errors={fieldErrors?.map((message) => ({ message }))}
        />
      </Field>
    );
  }

  const formErrorMessage = errors?.formErrors[0];
  const dateFieldErrors = errors?.fieldErrors.measuredOn;

  // Plan task 8 (create) / task 7(e) (edit), s09 D5: the header line is
  // mode-exclusive — edit mode always shows EDIT_HEADER_DESCRIPTION and
  // NEVER the create-mode legend, which describes a mechanic (suggested
  // prefill) that doesn't exist in edit mode at all. In create mode, a
  // read failure takes priority (nothing to explain the grey styling of,
  // since prefillFailed never marks a field), then whether the initial
  // read actually found anything to suggest — read from the props
  // themselves, not the live prefilledKinds state, since the message
  // describes the load result, not whatever the user has since touched.
  const headerDescription =
    props.mode === "edit"
      ? EDIT_HEADER_DESCRIPTION
      : props.prefillFailed
        ? PREFILL_READ_FAILURE_MESSAGE
        : Object.keys(props.suggestions).length > 0
          ? PREFILLED_LEGEND
          : FIRST_ENTRY_MESSAGE;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
      noValidate
    >
      <Field data-invalid={dateFieldErrors ? true : undefined}>
        <RequiredFieldLabel htmlFor="measuredOn">Date</RequiredFieldLabel>
        <DatePickerField
          id="measuredOn"
          // Client-side courtesy only (review finding 1): the server
          // (src/lib/measurement-session-input.ts) stays the sole
          // authority on this window and re-validates it regardless.
          min={MIN_MEASURED_ON}
          max={maxAllowedMeasuredOn(new Date())}
          invalid={dateFieldErrors !== undefined}
          value={measuredOn}
          onChange={(isoDate) => {
            setMeasuredOn(isoDate);
            // Clear this field's error as soon as it's answered, the
            // same way every measurement field drops its prefill marker
            // on input — a stale red border under a now-valid value is
            // the form lying about its own state.
            setErrors((previous) => {
              if (previous?.fieldErrors.measuredOn === undefined) {
                return previous;
              }
              const fieldErrors = { ...previous.fieldErrors };
              delete fieldErrors.measuredOn;
              return { ...previous, fieldErrors };
            });
          }}
        />
        <FieldError
          errors={dateFieldErrors?.map((message) => ({ message }))}
        />
      </Field>

      {props.mode === "edit" ? (
        <FieldDescription>{headerDescription}</FieldDescription>
      ) : (
        <p className="text-sm text-muted-foreground">{headerDescription}</p>
      )}

      {renderMeasurementField(WEIGHT_ENTRY.kind, WEIGHT_ENTRY.label + " (kg)")}

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Mensurations (cm)</FieldLegend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {MENSURATIONS_ENTRIES.map((entry) =>
            renderMeasurementField(entry.kind, entry.label),
          )}
        </div>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Composition (%)</FieldLegend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {COMPOSITION_ENTRIES.map((entry) =>
            renderMeasurementField(entry.kind, entry.label),
          )}
        </div>
      </FieldSet>

      {sessionExpired && (
        <Alert variant="destructive">
          <AlertDescription>
            {SESSION_EXPIRED_MESSAGE}{" "}
            <Link href={routes.signIn}>Se reconnecter</Link>
          </AlertDescription>
        </Alert>
      )}

      {!sessionExpired && formErrorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{formErrorMessage}</AlertDescription>
        </Alert>
      )}

      {/* The label names what this submission actually does. It read
          "Enregistrer la session" in both modes, which on the edit screen
          described the wrong action — the session already exists. */}
      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Spinner aria-label="Chargement" /> Enregistrement…
          </>
        ) : props.mode === "create" ? (
          "Enregistrer la session"
        ) : (
          "Modifier la session"
        )}
      </Button>
    </form>
  );
}
