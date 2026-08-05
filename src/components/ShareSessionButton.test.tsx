import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShareSessionButton } from "./ShareSessionButton";

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

const TEXT = "Mesures du dimanche 2 août 2026\nPoids : 82,4 kg";

// jsdom implements neither navigator.share nor navigator.clipboard — both
// are simply absent, which is also the real "old desktop browser" case.
// Each test declares the pair it wants and removes it afterwards, so no
// test inherits the previous one's platform.
function setNavigator(props: {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
  vi.clearAllMocks();
});

function clickShare() {
  fireEvent.click(screen.getByRole("button", { name: "Partager" }));
}

describe("ShareSessionButton — the native share sheet", () => {
  it("hands the text to navigator.share and never touches the clipboard", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, clipboard: { writeText } });

    render(<ShareSessionButton text={TEXT} label="Partager" />);
    clickShare();

    await waitFor(() => expect(share).toHaveBeenCalledWith({ text: TEXT }));
    expect(writeText).not.toHaveBeenCalled();
    // The sheet is its own confirmation — a toast on top of it would be
    // a second, redundant one.
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  // The classic bug of this API: a user who opens the sheet and backs out
  // gets an AbortError, which is a decision, not a failure.
  it("stays silent when the user cancels the sheet", async () => {
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    const share = vi.fn().mockRejectedValue(abort);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, clipboard: { writeText } });

    render(<ShareSessionButton text={TEXT} label="Partager" />);
    clickShare();

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    // Nor is the cancelled text quietly copied instead.
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard when the sheet fails for any other reason", async () => {
    const share = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("denied"), { name: "NotAllowedError" }),
      );
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, clipboard: { writeText } });

    render(<ShareSessionButton text={TEXT} label="Partager" />);
    clickShare();

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TEXT));
    expect(toastSuccess).toHaveBeenCalledWith("Mesures copiées");
  });
});

describe("ShareSessionButton — the clipboard fallback", () => {
  it("copies the text and confirms, when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator({ clipboard: { writeText } });

    render(<ShareSessionButton text={TEXT} label="Partager" />);
    clickShare();

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TEXT));
    expect(toastSuccess).toHaveBeenCalledWith("Mesures copiées");
  });

  it("reports a failure when neither path is available", async () => {
    render(<ShareSessionButton text={TEXT} label="Partager" />);
    clickShare();

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("reports a failure when the clipboard write itself is refused", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("refused"));
    setNavigator({ clipboard: { writeText } });

    render(<ShareSessionButton text={TEXT} label="Partager" />);
    clickShare();

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("ShareSessionButton — the control itself", () => {
  it("carries the label it was given as its accessible name", () => {
    render(
      <ShareSessionButton
        text={TEXT}
        label="Partager la session du dimanche 2 août 2026"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Partager la session du dimanche 2 août 2026",
      }),
    ).toBeInTheDocument();
  });

  // type="button", because this control can end up inside a form-bearing
  // screen and must never submit one.
  it("is a plain button, never a submit", () => {
    render(<ShareSessionButton text={TEXT} label="Partager" />);
    expect(screen.getByRole("button", { name: "Partager" })).toHaveAttribute(
      "type",
      "button",
    );
  });
});
