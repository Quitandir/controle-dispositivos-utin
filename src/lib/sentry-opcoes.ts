// Opções do Sentry comuns a servidor e navegador.
// Sem NEXT_PUBLIC_SENTRY_DSN (ex.: desenvolvimento local), o Sentry fica desligado.
export const opcoesSentry = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  // Só erros: sem monitoramento de desempenho e sem gravação de sessão (Replay) —
  // as telas mostram e-mails de alunos, que não devem sair para um serviço externo.
  tracesSampleRate: 0,
  // Não envia IP, cookies nem cabeçalhos. O usuário é identificado só pelo e-mail
  // institucional da equipe, definido explicitamente (ver IdentificarUsuarioSentry e Header).
  sendDefaultPii: false,
};
