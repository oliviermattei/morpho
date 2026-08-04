import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { resetPasswordMock } = vi.hoisted(() => ({
  resetPasswordMock: vi.fn(),
}));
const { replaceMock, refreshMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { resetPassword: resetPasswordMock },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

import { ResetPasswordScreen } from "./ResetPasswordScreen";

const TOKEN = "a-reset-token";
const PASSWORD = "nouveaumotdepasse";

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  password = PASSWORD,
  confirmation = password,
) {
  await user.type(screen.getByLabelText("Nouveau mot de passe"), password);
  await user.type(screen.getByLabelText("Confirmation"), confirmation);
}

describe("ResetPasswordScreen", () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
    replaceMock.mockReset();
    refreshMock.mockReset();
  });

  it("shows no form at all without a token: there is nothing to submit", () => {
    render(<ResetPasswordScreen token={null} />);

    expect(screen.getByText("Lien expiré")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nouveau mot de passe")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Retour à la connexion" }),
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  it("sends the new password with the token, then returns to sign-in", async () => {
    resetPasswordMock.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordScreen token={TOKEN} />);

    await fill(user);
    await user.click(
      screen.getByRole("button", { name: "Enregistrer le mot de passe" }),
    );

    await waitFor(() =>
      expect(resetPasswordMock).toHaveBeenCalledWith({
        newPassword: PASSWORD,
        token: TOKEN,
      }),
    );
    expect(replaceMock).toHaveBeenCalledWith("/auth/sign-in");
  });

  it("refuses two passwords that differ, without any network call", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordScreen token={TOKEN} />);

    await fill(user, PASSWORD, "autrechosequeca");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer le mot de passe" }),
    );

    expect(
      await screen.findByText("Les deux mots de passe ne sont pas identiques."),
    ).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("refuses a password under the minimum length", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordScreen token={TOKEN} />);

    await fill(user, "court");
    await user.click(
      screen.getByRole("button", { name: "Enregistrer le mot de passe" }),
    );

    expect(
      await screen.findByText(
        "Le mot de passe doit faire au moins 8 caractères.",
      ),
    ).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  // The code below is what the SDK really hands over for a dead token —
  // `bad_jwt`, not the auth server's own `INVALID_TOKEN` (see
  // RESET_ERROR_MESSAGES). Read from a real browser, not from the docs: the
  // generic fallback ("Vérifiez votre connexion") is what the user saw
  // before this mapping existed.
  it("reads the SDK's bad_jwt as an expired link, not a network problem", async () => {
    resetPasswordMock.mockRejectedValue({
      __isAuthError: true,
      status: 401,
      code: "bad_jwt",
    });
    const user = userEvent.setup();
    render(<ResetPasswordScreen token={TOKEN} />);

    await fill(user);
    await user.click(
      screen.getByRole("button", { name: "Enregistrer le mot de passe" }),
    );

    expect(
      await screen.findByText(
        "Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
      ),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("releases the button after a failure instead of spinning forever", async () => {
    resetPasswordMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<ResetPasswordScreen token={TOKEN} />);

    await fill(user);
    const button = screen.getByRole("button", {
      name: "Enregistrer le mot de passe",
    });
    await user.click(button);

    expect(
      await screen.findByText("Vérifiez votre connexion et réessayez."),
    ).toBeInTheDocument();
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
