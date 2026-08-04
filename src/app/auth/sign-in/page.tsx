import { SignInScreen } from "@/components/auth/SignInScreen";

// design, "Contraintes de gabarit (communes aux trois)": single column,
// content width min(100%, 24rem), centered, px-6 margins; wordmark top-left,
// centered content, footer pinned to the bottom without overlapping it at
// 375x667 (flex-1 + justify-center on the center zone, mt-auto on the
// footer).
//
// ADR 019: no Suspense boundary any more. It existed only because the
// magic-link screen read an `error` search param with useSearchParams(),
// which forces the route out of static prerendering unless it is wrapped.
// The email/password screen reads no search params.
export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-6">
      <div className="text-sm text-muted-foreground">morpho</div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4">
        <SignInScreen />
      </div>
      <p className="mt-auto text-center text-xs text-muted-foreground">
        Vos mesures restent privées, visibles de vous seul.
      </p>
    </main>
  );
}
