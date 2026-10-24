import { NextRequest, NextResponse } from "next/server";
import { deploymentAccess, sameOriginWrite } from "@/lib/deployment-access";

function privateHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

function failure(request: NextRequest, status: number, message: string): NextResponse {
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ ok: false, message }, { status })
    : new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (status === 401) {
    response.headers.set("WWW-Authenticate", 'Basic realm="Track Your Sales", charset="UTF-8"');
  }
  return privateHeaders(response);
}

export function proxy(request: NextRequest) {
  let path: string;
  try {
    path = decodeURIComponent(request.nextUrl.pathname);
  } catch {
    return failure(request, 400, "عنوان الطلب مش صالح.");
  }

  // Old source archives aren't application features. Don't publish code snapshots,
  // which may be outdated or contain credentials, even behind the workspace gate.
  if (/\.zip(?:\/|$)/i.test(path)) return failure(request, 404, "الملف ده مش متاح من الرابط العام.");

  // Only the minimal health probe is intentionally public; it returns no user data.
  if (path === "/api/health" && ["GET", "HEAD"].includes(request.method)) {
    return privateHeaders(NextResponse.next());
  }

  const access = deploymentAccess(request.headers.get("authorization"));
  if (!access.allowed) return failure(request, access.status, access.message);
  if (access.protected && !sameOriginWrite(request)) {
    return failure(request, 403, "الطلب لازم يتبعت من نفس رابط التطبيق.");
  }

  const response = privateHeaders(NextResponse.next());
  if (access.protected) {
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
    response.headers.set("Referrer-Policy", "same-origin");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
