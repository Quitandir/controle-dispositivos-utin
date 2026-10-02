export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|api/sync|entrar|_next/static|_next/image|favicon.ico).*)"],
};