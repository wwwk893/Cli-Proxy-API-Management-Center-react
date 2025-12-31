import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_COOKIE_NAME = "cpa_session";

function getCookieName() {
  const raw = process.env.AUTH_COOKIE_NAME;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed || DEFAULT_COOKIE_NAME;
}

function hasAuthCookie(req: NextRequest) {
  const token = req.cookies.get(getCookieName())?.value;
  return Boolean(token);
}

function isStaticAssetPath(pathname: string) {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  // Any file extension (e.g. .png/.css/.js)
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isStaticAssetPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const authenticated = hasAuthCookie(req);

  if (pathname.startsWith("/api/")) {
    if (authenticated) return NextResponse.next();
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 },
    );
  }

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (authenticated) {
    return NextResponse.next();
  }

  const nextPath = `${pathname}${search}`;
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/:path*"],
};
