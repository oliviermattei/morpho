"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// research, "Client navigateur": createAuthClient() takes no arguments —
// baseURL falls back to "/api/auth" (better-auth/dist/client/config.mjs:11),
// so the browser only ever talks to this app's own proxied route (task 4),
// never a Neon URL directly. Safe to construct eagerly: unlike
// src/lib/auth.ts's createNeonAuth(), this never touches a secret and never
// throws for a missing config.
export const authClient = createAuthClient();
