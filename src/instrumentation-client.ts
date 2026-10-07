import * as Sentry from "@sentry/nextjs";
import { opcoesSentry } from "@/lib/sentry-opcoes";

// Erros no navegador (tablets, notebooks).
Sentry.init(opcoesSentry);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
