import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Plan s09 task 1 (deviation noted in the review): placed in
// src/components/, NOT src/components/ui/ as the plan's literal task 1
// text says — src/components/ui/ is CLI-generated only (AGENTS.md), and
// s07's own plan already caught and corrected this exact mistake for
// chart-container.smoke.test.tsx (its task 1, "⚠️ Placé dans
// src/components/, PAS dans src/components/ui/"). Same reasoning
// applies verbatim to alert-dialog: a hand-written test file has no
// business living in a CLI-owned directory.
//
// The named trap (plan task 1): AlertDialog is a Radix portal-based
// primitive — a naive smoke test that only asserts "no crash on render"
// would stay green even if the portal mounted nothing at all, which
// would make every "the dialog doesn't open" assertion in task 8 pass
// for the wrong reason. This test opens it (defaultOpen) and asserts the
// title is actually found in the document.
describe("AlertDialog — the portal actually mounts under jsdom", () => {
  it("renders its title and description when open", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogTrigger>Ouvrir</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Titre de test</AlertDialogTitle>
          <AlertDialogDescription>Description de test</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByText("Titre de test")).toBeInTheDocument();
    expect(screen.getByText("Description de test")).toBeInTheDocument();
  });
});
