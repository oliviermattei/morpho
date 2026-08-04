import { ResetPasswordScreen } from "@/components/auth/ResetPasswordScreen";

/**
 * Where the link in the reset mail lands. The auth server consumes its own
 * /reset-password/<token> URL first, then redirects here with `?token=` —
 * or, when the token is dead, with `?error=INVALID_TOKEN` and no token at
 * all. Both cases are handled by the screen below.
 *
 * The token is read here rather than with useSearchParams() in the client
 * component: same reason ADR 019 was glad to drop the Suspense boundary
 * from the sign-in screen. `searchParams` is a Promise in Next 16.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const singleToken = Array.isArray(token) ? token[0] : token;

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-6">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8">
        <span className="text-center text-4xl font-bold tracking-tight text-muted-foreground">
          morpho
        </span>
        <ResetPasswordScreen token={singleToken || null} />
      </div>
      <p className="mt-auto text-center text-xs text-muted-foreground">
        Vos mesures restent privées, visibles de vous seul.
      </p>
    </main>
  );
}
