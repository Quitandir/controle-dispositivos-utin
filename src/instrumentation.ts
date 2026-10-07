import * as Sentry from "@sentry/nextjs";
import { opcoesSentry } from "@/lib/sentry-opcoes";

export function register() {
  Sentry.init(opcoesSentry);
}

// Erros não tratados em páginas, server actions, rotas e no proxy.
export const onRequestError = Sentry.captureRequestError;
