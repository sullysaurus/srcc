import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: values => { values.forEach(({name,value}) => request.cookies.set(name,value)); response = NextResponse.next({request}); values.forEach(({name,value,options}) => response.cookies.set(name,value,options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/auth/") || request.nextUrl.pathname.startsWith("/api/public/") || request.nextUrl.pathname.startsWith("/api/webhooks/") || request.nextUrl.pathname.startsWith("/api/cron/");
  if (!user && !isPublic) { const target = request.nextUrl.clone(); target.pathname = "/login"; return NextResponse.redirect(target); }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|attribution.js|southern-revelry-logo.png).*)",
  ],
};
