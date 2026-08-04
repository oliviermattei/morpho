"use client";

import { useState } from "react";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  dateFromIsoDate,
  formatIsoDateLong,
  isoDateFromDate,
} from "@/lib/date";
import { cn } from "@/lib/utils";

export interface DatePickerFieldProps {
  id: string;
  /** "YYYY-MM-DD", or "" for no selection. */
  value: string;
  onChange: (isoDate: string) => void;
  /** Inclusive bounds, "YYYY-MM-DD". Courtesy only — the server re-validates. */
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Labels the trigger for assistive tech when the visible label is elsewhere. */
  "aria-describedby"?: string;
}

/**
 * Replaces `<input type="date">` everywhere in the app.
 *
 * The native control was not merely ugly: its popup is drawn by the
 * browser, so it ignored the design system entirely, and on a narrow
 * viewport Chrome's implementation renders an input wider than its own
 * container — which is what ate the right-hand padding on the session
 * edit screen. A Popover + Calendar is styled by the app and its trigger
 * is a plain `w-full` button, so it can't overflow.
 *
 * The value stays a "YYYY-MM-DD" string on the way in and on the way
 * out — never a Date in component state. Every consumer (the session
 * payload, the profile payload, Zod's `z.iso.date()`, Postgres's `date`
 * column) already speaks that string, and routing it through a Date
 * would reintroduce exactly the timezone shift src/lib/date.ts exists to
 * prevent. The two conversions happen at the boundary, in
 * dateFromIsoDate/isoDateFromDate, and nowhere else.
 */
export function DatePickerField({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  invalid,
  placeholder = "Choisir une date",
  "aria-describedby": ariaDescribedBy,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const selected = dateFromIsoDate(value);
  const minDate = min ? dateFromIsoDate(min) : undefined;
  const maxDate = max ? dateFromIsoDate(max) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={ariaDescribedBy}
          // The allowed window, as a DOM fact. `<input type="date">`
          // carried it in `min`/`max`, which is what the session form's
          // tests asserted on; a Popover trigger has nowhere to put it,
          // and the bound would otherwise only be observable by opening
          // the calendar and hunting for a disabled cell. Same motif as
          // the form's own `data-prefilled` marker: a rendered attribute
          // a test can read, kept in sync by React.
          data-min={min}
          data-max={max}
          // w-full + min-w-0 is the actual fix for the overflow report:
          // the button can never be wider than the column it sits in, so
          // the page keeps its right-hand padding at every viewport.
          className={cn(
            "h-11 w-full min-w-0 justify-start gap-2 px-3 text-base font-normal md:text-sm",
            value === "" && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {value === "" ? placeholder : formatIsoDateLong(value)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={fr}
          selected={selected}
          // Opens on the selected month, or on the last allowed month
          // when nothing is selected yet — never on today when today is
          // outside the allowed window.
          defaultMonth={selected ?? maxDate}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={
            minDate || maxDate
              ? { before: minDate as Date, after: maxDate as Date }
              : undefined
          }
          // captionLayout="dropdown" is what makes a start date years back
          // reachable without tapping "previous month" forty times.
          captionLayout="dropdown"
          // react-day-picker localizes the DATES from `locale`, but not
          // its own control labels — those stay English defaults ("Choose
          // the Month", "Go to the Next Month"), which a screen reader
          // would read out in the middle of an otherwise French form
          // (AGENTS.md: UI text in French). Overridden explicitly.
          labels={{
            labelMonthDropdown: () => "Choisir le mois",
            labelYearDropdown: () => "Choisir l'année",
            labelNext: () => "Mois suivant",
            labelPrevious: () => "Mois précédent",
          }}
          autoFocus
          onSelect={(date) => {
            // react-day-picker calls onSelect with undefined when the
            // user taps the already-selected day. Treated as "no change"
            // rather than "clear": every date field in this app is
            // required, so clearing one has no meaning here.
            if (date === undefined) return;
            onChange(isoDateFromDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
