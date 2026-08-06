import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { signInEmailMock, signUpEmailMock, requestPasswordResetMock } =
  vi.hoisted(() => ({
    signInEmailMock: vi.fn(),
    signUpEmailMock: vi.fn(),
    requestPasswordResetMock: vi.fn(),
  }));
const { replaceMock, refreshMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: signInEmailMock },
    signUp: { email: signUpEmailMock },
    requestPasswordReset: requestPasswordResetMock,
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

import { SignInScreen } from "./SignInScreen";

const EMAIL = "olivier@exemple.fr";
const PASSWORD = "motdepasse123";

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Adresse email"), EMAIL);
  await user.type(screen.getByLabelText("Mot de passe"), PASSWORD);
}

describe("SignInScreen", () => {
  beforeEach(() => {
    signInEmailMock.mockReset();
    signUpEmailMock.mockReset();
    requestPasswordResetMock.mockReset();
    replaceMock.mockReset();
    refreshMock.mockReset();
  });

  it("opens on the sign-in mode, with an email and a password field", () => {
    render(<SignInScreen />);

    expect(
      screen.getByRole("heading", { name: "Connexion" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse email")).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("rejects an invalid email and a short password without any network call", async () => {
    const user = userEvent.setup();
    render(<SignInScreen />);

    await user.type(screen.getByLabelText("Adresse email"), "not-an-email");
    await user.type(screen.getByLabelText("Mot de passe"), "court");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Cette adresse email n'est pas valide."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Le mot de passe doit faire au moins 8 caractères."),
    ).toBeInTheDocument();
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it("rejects an empty submission the same way, with no network call", async () => {
    const user = userEvent.setup();
    render(<SignInScreen />);

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Cette adresse email n'est pas valide."),
    ).toBeInTheDocument();
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it("signs in with the credentials and lands on the authenticated tree", async () => {
    signInEmailMock.mockResolvedValue({ data: { redirect: false }, error: null });
    const user = userEvent.setup();
    render(<SignInScreen />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => expect(signInEmailMock).toHaveBeenCalledTimes(1));
    expect(signInEmailMock.mock.calls[0][0]).toMatchObject({
      email: EMAIL,
      password: PASSWORD,
    });
    // replace(), not push(): the sign-in screen must not sit in the history
    // stack behind an authenticated page. refresh() re-runs the Server
    // Components with the freshly set session cookies.
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(refreshMock).toHaveBeenCalled();
  });

  // The credential provider's own failure code. The screen must not leak
  // whether the account exists — the same French message covers both.
  it("shows a French message for INVALID_EMAIL_OR_PASSWORD and stays on the form", async () => {
    signInEmailMock.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" },
    });
    const user = userEvent.setup();
    render(<SignInScreen />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Email ou mot de passe incorrect."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Adresse email")).toHaveValue(EMAIL);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  // The shape that actually happens against the live Neon Auth server: the
  // SDK normalizes the 401 into an AuthApiError and REJECTS, it does not
  // resolve with { error }. Regression test for the bug this replaced — the
  // rejection escaped, the pending flag was never cleared, and the button
  // stayed stuck on "Connexion…" with no message at all.
  it("handles a rejected sign-in: French message, button usable again", async () => {
    signInEmailMock.mockRejectedValue(
      Object.assign(new Error("Invalid email or password"), {
        name: "AuthApiError",
        status: 401,
        code: "invalid_credentials",
        __isAuthError: true,
      }),
    );
    const user = userEvent.setup();
    render(<SignInScreen />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Email ou mot de passe incorrect."),
    ).toBeInTheDocument();
    // Back to the idle label, not the pending one, and enabled.
    const button = screen.getByRole("button", { name: "Se connecter" });
    expect(button).toBeEnabled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("handles a rejected sign-up on an address already taken", async () => {
    signUpEmailMock.mockRejectedValue(
      Object.assign(new Error("User already exists"), {
        name: "AuthApiError",
        status: 409,
        code: "user_already_exists",
      }),
    );
    const user = userEvent.setup();
    render(<SignInScreen signUpEnabled />);

    await user.click(screen.getByRole("button", { name: "Créer un compte" }));
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));

    expect(
      await screen.findByText(
        "Un compte existe déjà avec cette adresse email.",
      ),
    ).toBeInTheDocument();
  });

  // A dropped connection rejects with a plain TypeError — no code anywhere.
  it("falls back to the retry message when the rejection carries no code", async () => {
    signInEmailMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<SignInScreen />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Vérifiez votre connexion et réessayez."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeEnabled();
  });

  it("falls back to the retry message for an unmapped error code", async () => {
    signInEmailMock.mockResolvedValue({
      data: null,
      error: { code: "NETWORK_ERROR", message: "fetch failed" },
    });
    const user = userEvent.setup();
    render(<SignInScreen />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(
      await screen.findByText("Vérifiez votre connexion et réessayez."),
    ).toBeInTheDocument();
  });

  // SIGNUP_ENABLED reaches the screen as this prop. Closed is the default:
  // the component takes no `signUpEnabled` here on purpose.
  it("hides the account-creation switch when sign-up is disabled", () => {
    render(<SignInScreen />);

    expect(
      screen.queryByRole("button", { name: "Créer un compte" }),
    ).toBeNull();
    expect(screen.queryByText("Pas encore de compte ?")).toBeNull();
  });

  it("shows the account-creation switch when sign-up is enabled", () => {
    render(<SignInScreen signUpEnabled />);

    expect(
      screen.getByRole("button", { name: "Créer un compte" }),
    ).toBeInTheDocument();
  });

  // Disabling sign-up must not strand anyone inside the reset detour: the
  // switch back to sign-in is not the one being gated.
  it("keeps the way back from the reset mode when sign-up is disabled", async () => {
    const user = userEvent.setup();
    render(<SignInScreen />);

    await user.click(
      screen.getByRole("button", { name: "Mot de passe oublié ?" }),
    );

    expect(
      screen.getByRole("button", { name: "Se connecter" }),
    ).toBeInTheDocument();
  });

  it("switches to sign-up and creates the account, deriving the name from the email", async () => {
    signUpEmailMock.mockResolvedValue({ data: { token: "t" }, error: null });
    const user = userEvent.setup();
    render(<SignInScreen signUpEnabled />);

    await user.click(screen.getByRole("button", { name: "Créer un compte" }));
    expect(
      screen.getByRole("heading", { name: "Créer un compte" }),
    ).toBeInTheDocument();

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));

    await waitFor(() => expect(signUpEmailMock).toHaveBeenCalledTimes(1));
    expect(signUpEmailMock.mock.calls[0][0]).toMatchObject({
      email: EMAIL,
      password: PASSWORD,
      name: "olivier",
    });
    expect(signInEmailMock).not.toHaveBeenCalled();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
  });

  it("maps the already-taken address to a French message on sign-up", async () => {
    signUpEmailMock.mockResolvedValue({
      data: null,
      error: {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "User already exists.",
      },
    });
    const user = userEvent.setup();
    render(<SignInScreen signUpEnabled />);

    await user.click(screen.getByRole("button", { name: "Créer un compte" }));
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));

    expect(
      await screen.findByText(
        "Un compte existe déjà avec cette adresse email.",
      ),
    ).toBeInTheDocument();
  });

  it("clears a pending error when switching mode", async () => {
    signInEmailMock.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" },
    });
    const user = userEvent.setup();
    render(<SignInScreen signUpEnabled />);

    await fill(user);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await screen.findByText("Email ou mot de passe incorrect.");

    await user.click(screen.getByRole("button", { name: "Créer un compte" }));

    expect(screen.queryByText("Email ou mot de passe incorrect.")).toBeNull();
  });

  describe("forgotten password", () => {
    async function openForgotMode(user: ReturnType<typeof userEvent.setup>) {
      await user.click(
        screen.getByRole("button", { name: "Mot de passe oublié ?" }),
      );
    }

    it("drops the password field: there is no password to give", async () => {
      const user = userEvent.setup();
      render(<SignInScreen />);

      await openForgotMode(user);

      expect(
        screen.getByRole("heading", { name: "Mot de passe oublié" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Adresse email")).toBeInTheDocument();
      expect(screen.queryByLabelText("Mot de passe")).toBeNull();
    });

    it("sends the request with the address and the reset screen as redirect", async () => {
      requestPasswordResetMock.mockResolvedValue({ data: {}, error: null });
      const user = userEvent.setup();
      render(<SignInScreen />);

      await openForgotMode(user);
      await user.type(screen.getByLabelText("Adresse email"), EMAIL);
      await user.click(screen.getByRole("button", { name: "Envoyer le lien" }));

      await waitFor(() =>
        expect(requestPasswordResetMock).toHaveBeenCalledWith({
          email: EMAIL,
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }),
      );
      // No session was opened: nothing to navigate to.
      expect(replaceMock).not.toHaveBeenCalled();
      expect(
        await screen.findByText("Vérifiez votre boîte mail"),
      ).toBeInTheDocument();
    });

    it("refuses an invalid address without calling the server", async () => {
      const user = userEvent.setup();
      render(<SignInScreen />);

      await openForgotMode(user);
      await user.type(screen.getByLabelText("Adresse email"), "not-an-email");
      await user.click(screen.getByRole("button", { name: "Envoyer le lien" }));

      expect(
        await screen.findByText("Cette adresse email n'est pas valide."),
      ).toBeInTheDocument();
      expect(requestPasswordResetMock).not.toHaveBeenCalled();
    });

    it("maps a rejected request to a French message", async () => {
      requestPasswordResetMock.mockRejectedValue({
        code: "over_request_rate_limit",
      });
      const user = userEvent.setup();
      render(<SignInScreen />);

      await openForgotMode(user);
      await user.type(screen.getByLabelText("Adresse email"), EMAIL);
      await user.click(screen.getByRole("button", { name: "Envoyer le lien" }));

      expect(
        await screen.findByText(
          "Trop de tentatives. Réessayez dans quelques minutes.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Vérifiez votre boîte mail")).toBeNull();
    });

    it("drops the confirmation when going back to sign-in", async () => {
      requestPasswordResetMock.mockResolvedValue({ data: {}, error: null });
      const user = userEvent.setup();
      render(<SignInScreen />);

      await openForgotMode(user);
      await user.type(screen.getByLabelText("Adresse email"), EMAIL);
      await user.click(screen.getByRole("button", { name: "Envoyer le lien" }));
      await screen.findByText("Vérifiez votre boîte mail");

      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      expect(screen.queryByText("Vérifiez votre boîte mail")).toBeNull();
      expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
    });
  });
});
