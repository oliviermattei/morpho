import { SignInScreen } from "@/components/auth/SignInScreen";
import { isSignUpEnabled } from "@/lib/auth-signup";

// design, "Contraintes de gabarit (communes aux trois)": single column,
// content width min(100%, 24rem), centered, px-6 margins; app mark above
// the form.
//
// The privacy footer ("Vos mesures restent privées, visibles de vous
// seul") is gone: measurements are stored unencrypted, so anyone holding
// DATABASE_URL reads them. The session isolation the app enforces is real,
// but "visibles de vous seul" claimed more than the storage delivers, and
// a reassurance that is not true is worse than none.
//
// ADR 019: no Suspense boundary any more. It existed only because the
// magic-link screen read an `error` search param with useSearchParams(),
// which forces the route out of static prerendering unless it is wrapped.
// The email/password screen reads no search params.
export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-6">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        {/* The same wordmark HomeHeader shows once signed in, scaled up:
            it is the app's identity here, not a heading competing with
            "Connexion". The form keeps its vertical centering — the two
            flex-1 zones around it are what centre it — and the wordmark
            is centred inside the upper one, so it occupies the empty
            band rather than sitting glued above the form. */}
        <div className="flex flex-1 items-center justify-center">
          <span className="text-center text-4xl font-bold tracking-tight text-foreground">
            morpho
          </span>
        </div>
        <div className="flex flex-col gap-8">
          {/* This route stays statically prerendered (○ in the build
              output), which the offline shell depends on — so the flag
              read here is baked in at BUILD time. Flipping SIGNUP_ENABLED
              therefore needs a redeploy to change what this screen shows.
              That is the intended trade: the route handler enforces the
              same flag at runtime, so a stale UI can only ever be too
              permissive in appearance, never in effect. */}
          <SignInScreen signUpEnabled={isSignUpEnabled()} />
        </div>
        <div className="flex-1" aria-hidden />
      </div>
    </main>
  );
}
