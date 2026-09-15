// Pilot-Logbuch — live über die GsgLogbook-API (Tauri-Commands
// logbook_pireps / logbook_stats / logbook_pirep), nichts lokal gespeichert.
// Liste (Stats + Tabelle, keine Filter) → Klick → Detail mit geflogenem Track,
// 3-Linien-Höhenprofil (MSL/AGL/Gelände) und Fluglogbuch.
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { invoke } from "../lib/ipc";
import { FlightProfile } from "./FlightProfile";
import { kartenAnfrage, useKartengrundlage } from "./BasemapContext";

// Die Stil-Adressen kommen vom Server, damit ein Schluesselwechsel bei
// CARTO kein Release kostet — siehe `BasemapContext`. Die eingebauten
// Werte greifen, solange der Server nichts gesagt hat.
const PAGE = 25;

interface Stats {
  total_flights?: number; hours_flown?: number; distance_nm?: number;
  avg_landing_fpm?: number; rank?: string; rank_image?: string;
  flights_this_month?: number; hours_this_year?: number;
}
interface Item {
  id: string; date?: string; dep_icao?: string; arr_icao?: string; callsign?: string;
  aircraft_icao?: string; aircraft_reg?: string; status?: string;
  duration_min?: number; distance_nm?: number; landing_rate_fpm?: number;
}
interface RoutePt {
  lat: number; lon: number;
  /** Zeit seit Flugbeginn in ms. */
  t?: number;
  alt_ft?: number;
  /** Hoehe ueber Grund. Fehlte in der alten Stratos-API komplett. */
  agl_ft?: number;
  /** Gelaendehoehe, serverseitig als MSL-AGL gerechnet. `null` wenn eine
   *  der beiden Hoehen fehlt — dann darf NICHT 0 gezeichnet werden, das
   *  waere Meereshoehe unter einem Flugzeug ueber den Alpen. */
  gnd_ft?: number | null;
  ias_kt?: number | null;
  vs_fpm?: number | null;
  fuel?: number | null;
  ff?: number | null;
}
interface Detail extends Item {
  route?: RoutePt[];
  log?: { t: number; level?: string; message: string }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const dur = (m?: number) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : `0h ${pad(m)}m`);
const elapsed = (ms: number) => { const t = Math.round(ms / 60000); return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };
/** v0.19.x FIX: was a hand-rolled German-only month-abbreviation array
 *  (JAN..DEZ), shown regardless of locale. `toLocaleDateString` gives the
 *  same "12 AUG 2026"-style layout while actually respecting `locale`. */
const fmtDate = (iso: string | undefined, locale: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = pad(d.getDate());
  const month = d.toLocaleDateString(locale, { month: "short" }).toUpperCase().replace(/\.$/, "");
  return `${day} ${month} ${d.getFullYear()}`;
};
/** Der Pilot braucht keinen Stacktrace, aber wir dürfen die Ursache auch
 *  nicht verschlucken — Klartext vorn, technisches Detail dahinter. */
const errText = (e: unknown, t: TFunction): string => {
  const raw = String((e as { message?: string })?.message ?? e ?? "").trim();
  if (/network|fetch|connect|timeout|dns/i.test(raw)) {
    return t("logbook_view.error_network", { detail: raw });
  }
  if (/401|403|unauth|forbidden|api.?key/i.test(raw)) {
    return t("logbook_view.error_unauthorized", { detail: raw });
  }
  if (/404|not found/i.test(raw)) {
    return t("logbook_view.error_not_found", { detail: raw });
  }
  return raw || t("logbook_view.error_unknown");
};

/** Distanz gross genug fuer eine Kachel, aber ohne zu luegen.
 *  Vorher stand hier `(n/1000).toFixed(0)+"k"` — das machte aus den
 *  300 nm eines frischen Piloten ein glattes "0k". */
export const fmtNm = (n?: number) => {
  if (n == null) return "—";
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
};
// Field feedback (2026-08-03): a transient phpVMS hiccup showed a bare
// error with zero recovery — one failed request, no retry, no manual
// affordance. Retries only what LOOKS transient (same network/timeout
// pattern `errText` above already detects) — retrying an auth or 404
// error endlessly wouldn't help, just delays showing the real cause.
export const RETRY_DELAYS_MS = [800, 2000]; // 3 attempts total: immediate + 2 retries
export async function invokeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e ?? "");
      if (attempt >= RETRY_DELAYS_MS.length || !/network|fetch|connect|timeout|dns/i.test(msg)) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

const statusSlug = (s?: string) => (s === "accepted" || s === "pending" || s === "rejected" ? s : "pending");
/** v0.19.x FIX: the badge text used to be the raw English status slug
 *  itself ("accepted"/"pending"/"rejected"), shown verbatim regardless
 *  of locale — the CSS class keeps the English slug (styling hook), only
 *  the visible label is now localized. */
const badge = (s: string | undefined, t: TFunction) =>
  `<span class="aa-lb-badge aa-lb-b-${statusSlug(s)}">${esc(t(`logbook_view.status_${statusSlug(s)}`))}</span>`;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function LogbookView() {
  const grundlage = useKartengrundlage();
  // Die Karte wird einmalig gebaut; der Schlüssel kommt erst danach vom
  // Server. Über diesen Verweis liest `kartenAnfrage` bei jeder Kachel
  // den aktuellen Stand — siehe dort.
  const grundlageRef = useRef(grundlage);
  grundlageRef.current = grundlage;
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  // Getrennt vom Listen-`loading`, und die ID statt eines Ja/Nein:
  // Ein Detailabruf dauert je nach Fluglänge 1,5–3 s (Langstrecke: 10.000
  // Streckenpunkte). Bisher zeigte nur der Blätterbalken ganz unten "lädt …"
  // — beim Klick auf eine Zeile passierte oben nichts, also klickt man
  // nochmal. Mit der ID kann genau die angeklickte Zeile antworten.
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Manual "Erneut versuchen" — bumped on click, included in the fetch
  // effect's deps below so a click re-runs it even when `page` didn't
  // change (all automatic retries in invokeWithRetry already exhausted).
  const [retryTick, setRetryTick] = useState(0);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);

  // Stats einmal laden
  useEffect(() => {
    invoke<Stats>("logbook_stats").then(setStats).catch(() => {});
  }, []);

  // Seite laden
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invokeWithRetry(() =>
      invoke<{ items?: Item[]; total?: number }>("logbook_pireps", { limit: PAGE, offset: page * PAGE }),
    )
      .then((r) => { if (!cancelled) { setItems(r.items ?? []); setTotal(r.total ?? 0); } })
      .catch((e) => { if (!cancelled) setError(errText(e, t)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, retryTick]);

  async function openDetail(id: string) {
    // Zweitklick verwerfen statt eine zweite Abfrage loszuschicken. Ohne das
    // holt ein ungeduldiger Doppelklick denselben Flug zweimal — beide
    // Abrufe laufen, der langsamere gewinnt.
    if (openingId) return;
    setOpeningId(id);
    setError(null);
    try {
      const d = await invoke<Detail>("logbook_pirep", { id });
      setDetail(d);
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setOpeningId(null);
    }
  }

  // Detail-Karte + Profil zeichnen
  useEffect(() => {
    if (!detail || !mapElRef.current) return;
    const route = (detail.route ?? []).filter((p) => typeof p.lat === "number" && typeof p.lon === "number");
    const dark = document.documentElement.dataset.theme === "dark";
    const map = new maplibregl.Map({
      container: mapElRef.current,
      style: dark ? grundlage.dunkel : grundlage.hell,
      center: route.length ? [route[Math.floor(route.length / 2)].lon, route[Math.floor(route.length / 2)].lat] : [6, 48],
      zoom: 5,
      attributionControl: { compact: true },
      // Der Schlüssel gehört an JEDE Anfrage, nicht nur an die
      // Stil-Adresse — die style.json verweist selbst weiter auf
      // TileJSON, Kacheln, Schriften und Sprites. Siehe `kartenAnfrage`.
      transformRequest: kartenAnfrage(() => grundlageRef.current.schluessel),
    });
    mapRef.current = map;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0a84ff";
    map.on("load", () => {
      if (route.length >= 2) {
        const coords = route.map((p) => [p.lon, p.lat] as [number, number]);
        map.addSource("trk", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } });
        map.addLayer({ id: "trk", type: "line", source: "trk", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": accent, "line-width": 3 } });
        const pin = (c: [number, number], col: string) => { const el = document.createElement("div"); el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${col};border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.5)`; new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map); };
        pin(coords[0], "#30d158");
        pin(coords[coords.length - 1], "#ff453a");
        const b = coords.reduce((acc, c) => acc.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
        map.fitBounds(b, { padding: 50, duration: 0 });
      }
    });
    return () => { map.remove(); mapRef.current = null; };
  }, [detail]);

  if (detail) {
    const route = detail.route ?? [];
    return (
      <section className="p-8 pb-32">
        <div className="bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-20 -mt-8 -mx-8 px-8 py-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              type="button"
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-bold"
              onClick={() => setDetail(null)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              {t("logbook_view.detail_back")}
            </button>
            <div className="h-6 w-px bg-zinc-800"></div>
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-white tracking-wide">{detail.callsign}</span>
              <span className="flex items-center gap-2 font-mono text-zinc-300">
                <span className="font-bold">{detail.dep_icao}</span>
                <svg className="w-4 h-4 text-zinc-600 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="font-bold">{detail.arr_icao}</span>
              </span>
              <span className="bg-sky-900/30 text-sky-400 px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider ml-2">
                {detail.aircraft_icao} · {detail.aircraft_reg}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex gap-6 text-sm font-medium">
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">{t("logbook_view.table_duration")}</span>
                <span className="font-mono text-white">{dur(detail.duration_min)}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">{t("logbook_view.table_distance")}</span>
                <span className="font-mono text-white">{detail.distance_nm} nm</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">{t("logbook_view.table_landing")}</span>
                <span className="font-mono text-white">{detail.landing_rate_fpm} fpm</span>
              </div>
            </div>
            <div className="h-6 w-px bg-zinc-800"></div>
            <span dangerouslySetInnerHTML={{ __html: badge(detail.status, t) }} className="text-sm font-bold" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden h-[500px]" ref={mapElRef} />
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col h-[500px]">
            <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-widest flex-shrink-0">{t("logbook_view.detail_log_title")}</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar text-sm" dangerouslySetInnerHTML={{
              __html: (detail.log ?? []).map((l) => {
                const phase = l.message.startsWith("Phase:");
                return `<div class="flex gap-4 py-2 border-b border-zinc-800/50 ${phase ? "text-sky-400 font-bold" : "text-zinc-400"}"><span class="font-mono text-zinc-500 w-16 flex-shrink-0">${elapsed(l.t)}</span><span>${phase ? '<span class="inline-block w-2 h-2 rounded-full bg-sky-500 mr-2"></span>' : ""}${esc(l.message)}</span></div>`;
              }).join(""),
            }} />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest">{t("logbook_view.detail_profile_title")}</h3>
          <div className="h-64">
            <FlightProfile route={route} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="p-8 pb-32">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t("logbook_view.section_title")}</h1>
        <p className="text-zinc-400">{t("logbook_view.section_subtitle")}</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase font-bold text-zinc-500 tracking-widest mb-1">{t("logbook_view.stat_flights")}</span>
          <span className="text-2xl font-bold font-mono text-white">{stats?.total_flights ?? "—"}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase font-bold text-zinc-500 tracking-widest mb-1">{t("logbook_view.stat_hours")}</span>
          <span className="text-2xl font-bold font-mono text-white">{stats?.hours_flown != null ? Math.round(stats.hours_flown) : "—"}<small className="text-sm font-normal text-zinc-500 ml-1">{t("logbook_view.unit_hours")}</small></span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase font-bold text-zinc-500 tracking-widest mb-1">{t("logbook_view.stat_distance")}</span>
          <span className="text-2xl font-bold font-mono text-white">{fmtNm(stats?.distance_nm)}<small className="text-sm font-normal text-zinc-500 ml-1">nm</small></span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase font-bold text-zinc-500 tracking-widest mb-1">{t("logbook_view.stat_avg_landing")}</span>
          <span className="text-2xl font-bold font-mono text-white">{stats?.avg_landing_fpm ?? "—"}<small className="text-sm font-normal text-zinc-500 ml-1">fpm</small></span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase font-bold text-zinc-500 tracking-widest mb-1">{t("logbook_view.stat_this_month")}</span>
          <span className="text-2xl font-bold font-mono text-white">{stats?.flights_this_month ?? "—"}<small className="text-sm font-normal text-zinc-500 ml-1">{t("logbook_view.unit_flights")}</small></span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase font-bold text-zinc-500 tracking-widest mb-1">{t("logbook_view.stat_this_year")}</span>
          <span className="text-2xl font-bold font-mono text-white">{stats?.hours_this_year != null ? Math.round(stats.hours_this_year) : "—"}<small className="text-sm font-normal text-zinc-500 ml-1">{t("logbook_view.unit_hours")}</small></span>
        </div>
        <div className="bg-gradient-to-br from-sky-900/40 to-blue-900/20 border border-sky-800/50 p-4 rounded-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
          {stats?.rank_image && <img src={stats.rank_image} alt="" className="absolute -right-4 -bottom-4 w-24 h-24 opacity-20" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          <span className="text-xs uppercase font-bold text-sky-400/80 tracking-widest mb-1 relative z-10">{t("logbook_view.stat_rank")}</span>
          <span className="text-xl font-bold text-white relative z-10">{stats?.rank ?? "—"}</span>
        </div>
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden relative">
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 p-4 flex items-center justify-between">
            <span className="font-bold text-sm">{t("logbook_view.error_prefix", { error })}</span>
            <button type="button" className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-lg text-sm transition-colors" onClick={() => setRetryTick((n) => n + 1)}>
              {t("logbook_view.retry")}
            </button>
          </div>
        )}
        
        {(loading || openingId) && <div className="h-1 w-full bg-zinc-800 overflow-hidden"><div className="h-full bg-sky-500 w-1/3 animate-[slide_1s_ease-in-out_infinite_alternate]"></div></div>}
        
        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse whitespace-nowrap ${openingId ? "opacity-50 pointer-events-none" : ""}`} aria-busy={openingId ? true : undefined}>
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-4 font-bold">{t("logbook_view.table_date")}</th>
                <th className="px-6 py-4 font-bold">{t("logbook_view.table_route")}</th>
                <th className="px-6 py-4 font-bold">{t("logbook_view.table_type")}</th>
                <th className="px-6 py-4 font-bold text-right">{t("logbook_view.table_duration")}</th>
                <th className="px-6 py-4 font-bold text-right">{t("logbook_view.table_distance")}</th>
                <th className="px-6 py-4 font-bold text-right">{t("logbook_view.table_landing")}</th>
                <th className="px-6 py-4 font-bold">{t("logbook_view.table_status")}</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {items.map((f) => {
                 const isOpening = openingId === f.id;
                 return (
                  <tr
                    key={f.id}
                    className={`group hover:bg-zinc-800/50 cursor-pointer transition-colors ${isOpening ? "bg-zinc-800" : ""}`}
                    onClick={() => openDetail(f.id)}
                  >
                    <td className="px-6 py-4 text-sm font-mono text-zinc-400">{fmtDate(f.date, i18n.language)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-mono text-sm text-zinc-300">
                        <span className="font-bold">{f.dep_icao}</span>
                        <svg className="w-3 h-3 text-zinc-600 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span className="font-bold">{f.arr_icao}</span>
                        <span className="ml-2 font-sans font-bold text-white bg-zinc-800 px-2 py-0.5 rounded text-xs">{f.callsign}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                        {f.aircraft_icao}
                        <span className="font-mono font-normal text-zinc-500">· {f.aircraft_reg}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-mono text-zinc-300">{dur(f.duration_min)}</td>
                    <td className="px-6 py-4 text-right text-sm font-mono text-zinc-300">{f.distance_nm} nm</td>
                    <td className="px-6 py-4 text-right text-sm font-mono">
                      <span className={`${f.landing_rate_fpm != null && f.landing_rate_fpm > -200 ? "text-emerald-400" : f.landing_rate_fpm != null && f.landing_rate_fpm < -500 ? "text-red-400" : "text-zinc-300"}`}>
                        {f.landing_rate_fpm} fpm
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                      <span dangerouslySetInnerHTML={{ __html: badge(f.status, t) }} />
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-500 group-hover:text-white transition-colors">
                      {isOpening ? (
                        <svg className="w-5 h-5 animate-spin ml-auto text-sky-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="bg-zinc-950/50 p-4 border-t border-zinc-800 flex items-center justify-between text-sm">
          <span className="text-zinc-500 font-bold uppercase tracking-widest">
            {loading
              ? t("logbook_view.loading")
              : t("logbook_view.pager_range", {
                  from: total ? page * PAGE + 1 : 0,
                  to: Math.min((page + 1) * PAGE, total),
                  total,
                })}
          </span>
          <div className="flex items-center gap-4">
            <button type="button" className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg font-bold text-zinc-300 hover:text-white hover:border-zinc-500 disabled:opacity-50 disabled:pointer-events-none transition-all" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>{t("logbook_view.pager_back")}</button>
            <span className="font-bold text-zinc-400">{t("logbook_view.pager_page", { page: page + 1, pages: Math.max(1, Math.ceil(total / PAGE)) })}</span>
            <button type="button" className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg font-bold text-zinc-300 hover:text-white hover:border-zinc-500 disabled:opacity-50 disabled:pointer-events-none transition-all" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>{t("logbook_view.pager_next")}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
