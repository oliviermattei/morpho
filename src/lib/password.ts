import { z } from "zod";

/**
 * Better Auth's own floor for the credential provider (its
 * `emailAndPassword.minPasswordLength` default). Declared client-side so
 * a form refuses before the round trip instead of surfacing the server's
 * English PASSWORD_TOO_SHORT — the server still enforces it either way.
 *
 * Lifted out of SignInScreen.tsx when the profile screen gained a
 * "changer mon mot de passe" form: two screens applying the same rule
 * from two copies of the number is exactly how they drift.
 */
export const MIN_PASSWORD_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  );
