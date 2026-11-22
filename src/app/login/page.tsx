import { ZypernFlagge } from "@/components/flagge";
import { redirect } from "next/navigation";
import { nutzer, startseite } from "@/lib/auth";
import { LoginForm } from "./form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const n = await nutzer();
  const { weiter } = await searchParams;
  if (n) redirect(weiter || startseite(n.rolle));
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-12 place-items-center"><ZypernFlagge className="h-full w-full drop-shadow" /></span>
          <div><div className="font-semibold">Stefan Berns</div><div className="text-xs text-muted">Vertriebs-Cockpit · Auswanderung Zypern</div></div>
        </div>
        <LoginForm weiter={weiter} />
      </div>
    </div>
  );
}
