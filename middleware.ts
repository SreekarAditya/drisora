import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/dashboard",
  "/survey",
  "/report",
  "/onboarding",
  "/upload",
];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const refreshedCookies: Array<{
    name: string;
    value: string;
    options: Parameters<typeof response.cookies.set>[2];
  }> = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
          refreshedCookies.push({ name, value, options });
        });
      },
    },
  });

  function withRefreshedCookies(nextResponse: NextResponse) {
    refreshedCookies.forEach(({ name, value, options }) => {
      nextResponse.cookies.set(name, value, options);
    });
    return nextResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const hasReportToken =
    path.startsWith("/report/") &&
    request.nextUrl.searchParams.has("token");
  const needsAuth = protectedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (needsAuth && !user && !hasReportToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return withRefreshedCookies(NextResponse.redirect(redirectUrl));
  }

  if ((path === "/login" || path === "/signup") && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return withRefreshedCookies(NextResponse.redirect(redirectUrl));
  }

  return withRefreshedCookies(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
