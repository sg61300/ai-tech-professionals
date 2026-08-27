import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and gates the app.
 * IMPORTANT (per @supabase/ssr docs): do not run logic between creating the
 * client and calling getUser(), and always return the `response` object so the
 * refreshed auth cookies are propagated.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // First-touch referral capture: a landing with ?ref=CODE stashes the code in
  // a cookie that survives the OTP/OAuth round-trip. Resolved to `referred_by`
  // at first signup (app/actions/session.ts). First-touch wins — don't overwrite.
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && !request.cookies.get("rune_ref")) {
    response.cookies.set("rune_ref", ref, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/verify");
  const isPublic =
    isAuthRoute ||
    pathname.startsWith("/auth") || // OAuth/OTP callback
    pathname.startsWith("/api/cron") || // Vercel Cron invocations — the route self-guards with CRON_SECRET; without this the auth redirect below bounces the cron to /login and it never runs
    (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev-preview")) || // dev-only visual QA harness
    pathname === "/";

  // Unauthenticated users hitting an app route -> login.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users hitting the auth screens -> dashboard.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/learn";
    return NextResponse.redirect(url);
  }

  return response;
}
