"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Associa os erros do navegador ao e-mail de quem está usando (só o e-mail da equipe).
export default function IdentificarUsuarioSentry({ email }: { email: string | null | undefined }) {
  useEffect(() => {
    Sentry.setUser(email ? { email } : null);
  }, [email]);
  return null;
}
