import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OFFEN = ["/login", "/api/webhooks", "/api/sync", "/api/cron", "/api/capi", "/api/reports", "/api/refresh-views", "/api/health", "/auth"];

export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  // Ohne vollständige Supabase-Konfiguration: Demo-Modus, kein Login (gleiche Bedingung wie supabaseKonfiguriert())
  if (!url || !key || !service) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const pfad = req.nextUrl.pathname;
  if (!data.user && !OFFEN.some((p) => pfad.startsWith(p))) {
    if (pfad.startsWith("/api/")) return NextResponse.json({ fehler: "nicht angemeldet" }, { status: 401 });
    const ziel = req.nextUrl.clone();
    ziel.pathname = "/login";
    ziel.search = pfad !== "/" ? `?weiter=${encodeURIComponent(pfad)}` : "";
    return NextResponse.redirect(ziel);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
