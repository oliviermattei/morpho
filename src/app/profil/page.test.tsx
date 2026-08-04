import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getAuthMock } = vi.hoisted(() => ({ getAuthMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuth: getAuthMock }));

// Same motif as src/app/historique/page.test.tsx: a Server Component
// wrapped in <Suspense> is never resolved by Testing Library's render()
// — stubbing ProfileContent synchronously is what makes this page
// renderable in a test at all, not just what the isolation assertion
// below needs.
const { profileContentMock } = vi.hoisted(() => ({
  profileContentMock: vi.fn((props: { userId: string }) => {
    void props;
    return <div data-testid="profile-content-stub" />;
  }),
}));
vi.mock("@/components/ProfileContent", () => ({
  ProfileContent: profileContentMock,
}));

// ADR 020: the page now mounts BottomNav (usePathname) and LogoutButton
// (useRouter). Neither has an app-router context in this jsdom render.
// redirect() is deliberately left REAL — the session guard throws it and
// its digest is what the first test asserts on.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/profil",
  };
});

describe("ProfilPage", () => {
  it("redirects to /auth/sign-in when there is no session", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const { default: ProfilPage } = await import("./page");

    let digest: string | undefined;
    try {
      await ProfilPage();
    } catch (thrown) {
      digest = (thrown as { digest?: string }).digest;
    }

    expect(digest).toMatch(/^NEXT_REDIRECT;.*\/auth\/sign-in/);
  });

  it("renders the header, the nav bar and ProfileContent — without waiting on the database", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "a@b.test" }, session: { id: "s1" } },
        error: null,
      }),
    });
    const { default: ProfilPage } = await import("./page");

    const element = await ProfilPage();
    render(element);

    expect(screen.getByRole("heading", { name: "Profil" })).toBeInTheDocument();

    // ADR 020 replaced the page's own back arrow with the permanent
    // BottomNav — "go home" is still one tap, from the bar's Accueil
    // entry, and no longer duplicated in the page header.
    expect(screen.queryByRole("link", { name: "Retour" })).toBeNull();
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute(
      "href",
      "/",
    );

    // Sign-out moved here from AppHeader's dropdown, which no longer
    // exists.
    expect(
      screen.getByRole("button", { name: /se déconnecter/i }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("profile-content-stub")).toBeInTheDocument();
  });

  it("passes only the verified userId to ProfileContent, wrapped in Suspense", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "a@b.test" }, session: { id: "s1" } },
        error: null,
      }),
    });
    const { default: ProfilPage } = await import("./page");

    const element = await ProfilPage();
    render(element);

    // The email joins the userId — both from the verified session, never
    // from anything on the request. toEqual still fails on any extra prop.
    expect(profileContentMock.mock.calls[0]?.[0]).toEqual({
      userId: "user-1",
      email: "a@b.test",
    });
  });

  it("exports dynamic = 'force-dynamic'", async () => {
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const pageModule = await import("./page");

    expect(pageModule.dynamic).toBe("force-dynamic");
  });

  // s10 plan task 7, criterion 6: the ONLY way to tell deployment A from
  // deployment B on the device during the cold-launch protocol.
  it("shows the short sha version marker in --muted-foreground at the bottom of the screen", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc1234567890");
    getAuthMock.mockReturnValue({
      getSession: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "a@b.test" }, session: { id: "s1" } },
        error: null,
      }),
    });
    const { default: ProfilPage } = await import("./page");

    const element = await ProfilPage();
    render(element);

    const marker = screen.getByText(/abc1234/);
    expect(marker.className).toMatch(/text-muted-foreground/);

    vi.unstubAllEnvs();
  });
});
