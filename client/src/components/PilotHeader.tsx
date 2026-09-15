import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile } from "../types";

interface Props {
  profile: Profile;
  onLogout: () => void;
}

function formatZulu(now: number): { time: string; suffix: string } {
  const d = new Date(now);
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return { time: `${hh}:${mm}:${ss}`, suffix: "z" };
}

/**
 * Briefing-2a (README §2): Kopfzeile statt Karte. Das Airline-Logo lebt
 * jetzt an den Flügen selbst (BidsList main card), nicht mehr hier —
 * eine Kopfzeile identifiziert den PILOTEN, nicht die Airline.
 */
export function PilotHeader({ profile, onLogout }: Props) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const zulu = formatZulu(now);

  return (
    <header className="h-20 flex-shrink-0 flex items-center justify-between px-8 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-20 w-full mb-6">
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">{profile.name}</h2>
            {profile.ident && (
              <span className="text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded text-xs font-mono font-bold tracking-wider">{profile.ident}</span>
            )}
          </div>
          <span className="text-sm font-medium text-zinc-500 mt-0.5">
            {[profile.rank?.name, profile.airline?.name].filter(Boolean).join(" • ")}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-right">
          <div className="flex flex-col">
             <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest leading-none mb-1">{t("pilot_header.pos_label", "CURRENT POS")}</span>
             <span className="text-white font-mono font-bold text-sm">{profile.curr_airport ?? "—"}</span>
          </div>
          <div className="h-8 w-px bg-zinc-800"></div>
          <div className="flex flex-col">
             <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest leading-none mb-1">{t("pilot_header.basis_label", "BASE")}</span>
             <span className="text-white font-mono font-bold text-sm">{profile.home_airport ?? "—"}</span>
          </div>
        </div>
        
        <div className="h-8 w-px bg-zinc-800 mx-2"></div>
        
        <div className="flex items-center gap-2 font-mono text-zinc-300">
          <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-bold tracking-widest text-lg">{zulu.time}</span>
          <span className="text-sky-400 text-sm">{zulu.suffix}</span>
        </div>
        
        <button
          type="button"
          className="ml-4 flex items-center justify-center p-2.5 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
          onClick={onLogout}
          title={t("actions.logout")}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
