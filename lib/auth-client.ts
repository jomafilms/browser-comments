'use client';

import { createAuthClient } from 'better-auth/react';

// Browser-side Better Auth client. baseURL is inferred from the current origin
// (same-origin), so no config needed for the standard single-app deploy.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
