import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/signin", "/signup", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (isPublicPath) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;
  const expiresAt = request.cookies.get("auth_expires_at")?.value;
  const isExpired = expiresAt ? Date.parse(expiresAt) <= Date.now() : true;

  if (!token || isExpired) {
    const loginUrl = new URL("/signin", request.url);
    loginUrl.searchParams.set("next", pathname);

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("auth_token");
    response.cookies.delete("auth_expires_at");

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|icons).*)"],
};
