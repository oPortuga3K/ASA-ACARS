import { useEffect, useState } from "react";
import { invoke } from "../lib/ipc";
import { useTranslation } from "react-i18next";
import type { ActiveFlightInfo, FlightEndOutcome, SimSnapshot } from "../types";
import { formatRefreshError } from "../lib/refreshErrorFormatter";
import { resolveFlightIdent } from "../lib/callsign";
import { useConfirm } from "./ConfirmDialog";
// QS 2026-08-04: `fmtDistance` war hier lokal nochmal definiert — mit der
// Einheit "nmi", während die exportierte Variante (und damit PhaseCard +
// TripCard, direkt darunter auf demselben Bildschirm) "nm" schreibt. Zwei
// Schreibweisen derselben Einheit nebeneinander. Jetzt eine gemeinsame Quelle.
import { InfoStrip, fmtDistance } from "./InfoStrip";
import { LoadsheetMonitor } from "./LoadsheetMonitor";
import { ManualFileDialog } from "./ManualFileDialog";
import { PhaseCard } from "./PhaseCard";
import { WeatherBriefing } from "./WeatherBriefing";

interface Props {
  /** Active-flight info, owned by Dashboard. Pure display. */
  info: ActiveFlightInfo | null;
  /** Live sim telemetry — fed into the live-tapes strip. */
  simSnapshot?: SimSnapshot | null;
  /**
   * v0.12.5 (LE7): a real PIREP was concluded — normal flight-end, manual
   * file, or a cancel that resolved to filed/queued/cancelled. The parent
   * shows the matching banner. Replaces the overloaded `onEnded`.
   */
  onFiledSuccess: (outcome: FlightEndOutcome) => void;
  /**
   * v0.12.5 (LE7): just reload the active flight — used for `flight_forget`
   * and the disconnect-resume. No PIREP was filed → no success banner.
   */
  onRefreshActiveFlight: () => void;
  /** Field feedback (2026-08-03): the Wetter-Briefing button used to float
   *  in its own row above the whole Cockpit tab — visually disconnected
   *  from (and read as a confusing duplicate of) this panel's own action
   *  row. Owned by CockpitView (needed there too for the no-active-flight
   *  empty state); rendered here as a normal sibling of Route-Sync/OFP-
   *  Refresh instead. */
  onOpenWeatherBriefing: () => void;
  weatherLoadHint: boolean;
}

const EARTH_RADIUS_NM = 3440.065; // nautical miles

/** Great-circle distance in nautical miles between two lat/lon points —
 *  same formula/constant RouteMap.tsx uses for its own progress-bar math,
 *  computed independently here (see the header-distance fix below). */
function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_NM * c;
}

/**
 * #phase-v2 Cutover: bestimmt Label-Key + CSS-Klassen-Suffix des Phasen-Badges.
 * `phase` ist die (v2-)Flugphase; `shadowSegment` ist das ROHE Kinematik-Segment
 * der v2-Engine (`ground|climbing|level|descending|insufficient`).
 *
 * „Level" ist eine RESTRIKTION: ein Level-Off UNTER der Reiseflughöhe während
 * Steig- oder Sinkflug (ATC-Zwischenhöhe). Deshalb greift der „Level"-Override
 * NUR bei `climb`/`descent`. Im Reiseflug (`cruise`) fliegt der Flieger normal
 * level → `shadowSegment` ist dort dauerhaft `"level"`, aber das bleibt „Cruise",
 * NICHT „Level" (sonst zeigte das Badge den ganzen Reiseflug fälschlich „Level").
 *
 * v0.19.1: "Final" blieb nach dem Aufsetzen früher minutenlang stehen
 * (Rollout/Taxi-in/Shutdown), weil die v2-Engine im Boden-/Terminal-Band rein
 * auf die alte FSM 1:1 sync-te und die bei manchen Flügen selbst hängen blieb
 * (Field-Report GSG22 EDLN→EDDL). Behoben an der Quelle in `phase_v2.rs`
 * (`Final` promotet sich jetzt selbst auf `Landing`, sobald der Kinematik-
 * Segmenter `Ground` meldet) — `phase` hier ist dadurch bereits `"landing"`,
 * kein zusätzliches Label-Override in dieser rein UI-seitigen Funktion nötig.
 */
/** v1.5.5 Stand-Erkennung: Anzeigetext für die Standzeile unter der Route.
 *  "Stand" liest sich in beiden Sprachen; null = Zeile weglassen. Leere
 *  Strings zählen als "nicht erkannt" (Wire liefert null ODER nichts). */
export function standsLine(
  depGate: string | null | undefined,
  arrGate: string | null | undefined,
): string | null {
  const dep = depGate?.trim() || null;
  const arr = arrGate?.trim() || null;
  if (dep && arr) return `Stand ${dep} → ${arr}`;
  if (dep) return `Stand ${dep}`;
  if (arr) return `Stand → ${arr}`;
  return null;
}

export function phaseBadgeDisplay(
  phase: string,
  shadowSegment: string | undefined | null,
): { labelKey: string; className: string } {
  const inRestrictable = phase === "climb" || phase === "descent";
  const showLevel = shadowSegment === "level" && inRestrictable;
  const key = showLevel ? "level" : phase;
  return { labelKey: key, className: key };
}

/**
 * v0.7.18 (B-014): is_finalizable check for the file-first Cancel logic.
 * Spec §B-014 — once the flight is essentially done (LANDING/TaxiIn/
 * BLOCKS_ON/Arrived + a valid touchdown), Cancel must not discard directly;
 * a 3-button confirm offers "try filing instead" first. Pure + exported so
 * it's regression-testable without mounting the component (same reasoning
 * as `phaseBadgeDisplay`).
 */
export function isFlightFinalizable(phase: string, landingAt: string | null): boolean {
  const isTdPhase =
    phase === "landing" ||
    phase === "taxi_in" ||
    phase === "blocks_on" ||
    phase === "arrived";
  return isTdPhase && landingAt !== null;
}

export function ActiveFlightPanel({
  info,
  simSnapshot,
  onFiledSuccess,
  onRefreshActiveFlight,
  onOpenWeatherBriefing,
  weatherLoadHint,
}: Props) {
  const { t, i18n } = useTranslation();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [busy, setBusy] = useState<
    "end" | "cancel" | "forget" | "refresh" | "sync_route" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  // v0.3.2: short-lived inline message after a successful OFP refresh
  // ("Plan-Werte aktualisiert"). Cleared on the next action so it
  // doesn't linger forever.
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  /**
   * When `flight_end` fails with `flight_validation_failed`, the backend
   * sends back a list of i18n-keyed missing-field codes. We surface the
   * ManualFileDialog so the pilot can either cancel the flight or file it
   * as a manual PIREP (with optional divert + reason). Null = no dialog.
   */
  const [validationMissing, setValidationMissing] = useState<string[] | null>(
    null,
  );
  // Tick once a second so the elapsed-time display refreshes between polls.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Field feedback (2026-08-03): the header's route distance used to reuse
  // `info.distance_nm` — that field is the CUMULATIVE distance FLOWN so far
  // (ticks up from 0 server-side), correct for TripCard's own "Strecke"
  // cell (InfoStrip.tsx, left untouched), but wrong here: the header wants
  // the FIXED planned distance for the whole route, dep→arr, same
  // dpt/arr-airport-coords + haversine pattern RouteMap.tsx already uses
  // for its own progress-bar math — computed independently here so this
  // header doesn't depend on RouteMap/PhaseCard's internal state.
  const [routeDistanceNm, setRouteDistanceNm] = useState<number | null>(null);
  useEffect(() => {
    if (!info?.dpt_airport || !info?.arr_airport) return;
    let cancelled = false;
    void (async () => {
      try {
        const [dpt, arr] = await Promise.all([
          invoke<{ lat: number; lon: number } | null>("airport_get", { icao: info.dpt_airport }),
          invoke<{ lat: number; lon: number } | null>("airport_get", { icao: info.arr_airport }),
        ]);
        if (!cancelled && dpt?.lat != null && dpt?.lon != null && arr?.lat != null && arr?.lon != null) {
          setRouteDistanceNm(haversineNm(dpt.lat, dpt.lon, arr.lat, arr.lon));
        }
      } catch {
        // stays null — header falls back to the flown-so-far value below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [info?.dpt_airport, info?.arr_airport]);

  if (!info) return null;

  /**
   * v0.7.19 GAF-707 (QS-R1 Finding 3): wenn der aktive Flug einen
   * Accident-Latch hat, MUSS vor dem File-Versuch der Pilot bestaetigen
   * oder widersprechen. Spec §Active Flight / Flight End "War das ein
   * Absturz?". Drei Auswahlmoeglichkeiten plus Zurueck:
   *
   *   1. "Ja, Unfall einreichen"         → flight_end ohne Override.
   *   2. "Nein, als harte Landung filen" → flight_end mit
   *      accident_decision="as_hard_landing". Backend clearet den
   *      Accident-Latch und filed regulaer; Notes enthalten den
   *      Override-Eintrag fuer die VA-Admin-Spur.
   *   3. "Flug verwerfen & Cleanup"      → flight_cancel mit force=true.
   *   4. "Zurueck"                       → kein State-Change.
   */
  function isAccidentDetected(): boolean {
    if (!info) return false;
    return info.accident_detected === true
      || info.accident_confidence === "medium";
  }

  /** v0.12.5 (LE7): build the "filed" outcome from the current flight. */
  function filedOutcome(): FlightEndOutcome {
    return {
      kind: "filed",
      callsign: info!.airline_icao
        ? `${info!.airline_icao} ${resolveFlightIdent(info!.flight_number, info!.callsign)}`
        : resolveFlightIdent(info!.flight_number, info!.callsign),
      dpt: info!.dpt_airport,
      arr: info!.arr_airport,
    };
  }

  async function handleEndConfirmed(decision: "as_accident" | "as_hard_landing" | null) {
    setBusy("end");
    setError(null);
    try {
      // Tauri's #[tauri::command] looks up args in camelCase, so the Rust
      // `accident_decision` param is read as `accidentDecision`. Sending
      // snake_case here silently drops the pilot's override (it would file
      // as an accident regardless of the "harte Landung" choice).
      const payload = decision ? { accidentDecision: decision } : undefined;
      await invoke("flight_end", payload);
      onFiledSuccess(filedOutcome());
    } catch (err: unknown) {
      const e = err as {
        code?: string;
        message?: string;
        details?: { missing?: string[] };
      };
      if (e?.code === "flight_validation_failed") {
        setValidationMissing(e.details?.missing ?? []);
      } else {
        const msg =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: string }).message)
            : String(err);
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleEnd() {
    if (busy) return;

    // v0.7.19 GAF-707 (QS-R1 Finding 3): bei aktivem Accident-Latch erst
    // den 4-Optionen-Dialog zeigen, sonst direkt filen wie bisher.
    if (isAccidentDetected()) {
      const isConfirmed = info?.accident_detected === true;
      // Schritt 1: "War das wirklich ein Absturz?" (oder fuer suspected:
      // "Moeglicher Absturz erkannt — wie filen?")
      const reasonsText = (info?.accident_reasons ?? []).join("\n");
      const yes = await confirm({
        title: isConfirmed
          ? t("active_flight.accident.confirm_title")
          : t("active_flight.accident.suspected_title"),
        message: t("active_flight.accident.confirm_body", {
          reasons: reasonsText || "—",
        }),
        confirmLabel: t("active_flight.accident.file_as_accident"),
        cancelLabel: t("active_flight.accident.other_action"),
        destructive: true,
      });
      if (yes) {
        await handleEndConfirmed("as_accident");
        return;
      }

      // Schritt 2: "Andere Aktion" → was genau?
      const fileAsHard = await confirm({
        title: t("active_flight.accident.other_title"),
        message: t("active_flight.accident.other_body"),
        confirmLabel: t("active_flight.accident.file_as_hard"),
        cancelLabel: t("active_flight.accident.back_or_cancel"),
      });
      if (fileAsHard) {
        await handleEndConfirmed("as_hard_landing");
        return;
      }

      // Schritt 3: Pilot hat "Zurueck oder Cancel" gewaehlt — den
      // bestehenden Cancel-Flow anbieten.
      const reallyCancel = await confirm({
        title: t("active_flight.confirm_cancel_force_title"),
        message: t("active_flight.confirm_cancel_force_body"),
        confirmLabel: t("active_flight.confirm_cancel_force_yes"),
        cancelLabel: t("active_flight.confirm_cancel_force_back"),
        destructive: true,
      });
      if (reallyCancel) {
        await invokeCancelOrForce(true);
      }
      return;
    }

    setBusy("end");
    setError(null);
    try {
      await invoke("flight_end");
      onFiledSuccess(filedOutcome());
    } catch (err: unknown) {
      // Backend's UiError shape: { code, message, details? }. The validation
      // path puts `{ missing: ["distance", ...] }` into details so we can
      // render the dialog with the exact reasons the file was rejected.
      const e = err as {
        code?: string;
        message?: string;
        details?: { missing?: string[] };
      };
      if (e?.code === "flight_validation_failed") {
        setValidationMissing(e.details?.missing ?? []);
      } else {
        const msg =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: string }).message)
            : String(err);
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  // v0.7.18 (B-014): is_finalizable-Check fuer File-First-Logik.
  // Spec §B-014 — wenn der Flug fast fertig ist (LANDING/TaxiIn/
  // BLOCKS_ON/Arrived + valider TD), darf Cancel nicht direkt
  // verwerfen. Dann zeigen wir 3-Button-Confirm:
  //   - „Lieber filen versuchen" → flight_cancel ohne force
  //   - „Abbrechen" → kein Cancel, Dialog zu
  //   - „Trotzdem verwerfen" → flight_cancel mit force=true
  // See `isFlightFinalizable` (pure, exported, unit-tested) for the condition.
  function isFinalizable(): boolean {
    if (!info) return false;
    return isFlightFinalizable(info.phase, info.landing_at);
  }

  /** User accepted the cancel option from the validation dialog. */
  async function handleCancelFromDialog() {
    setValidationMissing(null);
    // Dieser Pfad ist „flight_end hat Validation-Failure geworfen,
    // Pilot wählt Cancel statt Korrektur". File-First wurde schon
    // implizit gemacht (via flight_end), also hier force=true setzen
    // damit der Backend nicht nochmal versucht zu filen.
    await invokeCancelOrForce(true);
  }

  async function invokeCancelOrForce(force: boolean) {
    setBusy("cancel");
    setError(null);
    try {
      const outcome = (await invoke("flight_cancel", { force })) as
        | { kind: "filed_instead"; pirep_id: string }
        | { kind: "queued"; pirep_id: string }
        | { kind: "cancelled"; pirep_id: string };
      // v0.12.5 (LE7): Outcome an den Parent durchreichen — CockpitView
      // entscheidet, welches Banner es zeigt:
      //   - filed_instead: PIREP direkt eingereicht (Erfolg).
      //   - queued:        Transient-Fehler, PIREP wartet in der Queue.
      //   - cancelled:     regulärer Cancel — KEIN Erfolgs-Banner.
      if (outcome.kind === "filed_instead") {
        onFiledSuccess({ kind: "filed_instead", pirep_id: outcome.pirep_id });
      } else if (outcome.kind === "queued") {
        onFiledSuccess({ kind: "queued", pirep_id: outcome.pirep_id });
      } else {
        onFiledSuccess({ kind: "cancelled" });
      }
    } catch (err: unknown) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: string }).code)
          : null;
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: string }).message)
          : String(err);
      if (code === "blocked") {
        setError(t("active_flight.cancel_blocked"));
      } else if (code === "file_first_failed") {
        // v0.7.18 (R2-1): File-First-Versuch ist hart fehlgeschlagen.
        // Backend hat NICHT automatisch gecancelt — Pilot hatte „filen
        // versuchen" gewaehlt, nicht „bei Fehler trotzdem verwerfen".
        // Wir zeigen jetzt explizit den zweiten Confirm: „Filen ist
        // gescheitert (Grund). Trotzdem verwerfen?"
        const really = await confirm({
          title: t("active_flight.confirm_cancel_after_file_failed_title"),
          message: t("active_flight.confirm_cancel_after_file_failed_body", {
            reason: msg,
          }),
          confirmLabel: t("active_flight.confirm_cancel_force_yes"),
          cancelLabel: t("active_flight.confirm_cancel_force_back"),
          destructive: true,
        });
        if (really) {
          // force=true bypasst File-First → direkter Cancel.
          await invokeCancelOrForce(true);
        }
      } else {
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (busy) return;

    if (isFinalizable()) {
      // 3-Button-Dialog: filen / abbrechen / trotzdem verwerfen.
      // useConfirm liefert nur 2 Buttons → wir machen es seriell:
      //   1. „Flug eigentlich fast fertig — lieber filen versuchen?"
      //      [Filen versuchen] vs [Abbrechen]
      //   2. Wenn „Abbrechen": zweiter Dialog „Wirklich verwerfen?"
      //      [Trotzdem verwerfen] vs [Zurück]
      const tryFile = await confirm({
        title: t("active_flight.confirm_cancel_finalizable_title"),
        message: t("active_flight.confirm_cancel_finalizable_body"),
        confirmLabel: t("active_flight.confirm_cancel_finalizable_file"),
        cancelLabel: t("active_flight.confirm_cancel_finalizable_other"),
      });
      if (tryFile) {
        // File-First: force=false. Backend versucht erst zu filen.
        // Outcomes:
        //   - Ok(filed_instead | queued | cancelled) → kein weiterer Dialog.
        //   - Err(blocked)            → Account-Sperre, Fehlertext.
        //   - Err(file_first_failed)  → invokeCancelOrForce zeigt
        //     zweiten Confirm-Dialog (R2-1). Kein Auto-Cancel mehr.
        await invokeCancelOrForce(false);
        return;
      }
      // Pilot will nicht filen — fragen ob „verwerfen" oder „doch zurueck".
      const really = await confirm({
        title: t("active_flight.confirm_cancel_force_title"),
        message: t("active_flight.confirm_cancel_force_body"),
        confirmLabel: t("active_flight.confirm_cancel_force_yes"),
        cancelLabel: t("active_flight.confirm_cancel_force_back"),
        destructive: true,
      });
      if (!really) return;
      await invokeCancelOrForce(true);
      return;
    }

    // Nicht finalisierbar → klassischer Cancel-Dialog mit single confirm.
    const ok = await confirm({
      message: t("active_flight.confirm_cancel"),
      destructive: true,
    });
    if (!ok) return;
    await invokeCancelOrForce(false);
  }

  /**
   * v0.3.2: Refresh the SimBrief OFP for the running flight without
   * having to discard & restart. Real-pilot workflow: pilot regenerates
   * the OFP on simbrief.com after ASA-ACARS already cached the previous
   * one at flight-start (e.g. pax/cargo/reserve changed). Click → backend
   * re-pulls the bid (which carries the latest OFP id), fetches the OFP,
   * and overwrites planned_block / planned_tow / planned_zfw / etc. on
   * the active flight. The Loadsheet then compares against the new plan.
   */
  async function handleRefreshOfp() {
    if (busy) return;
    setBusy("refresh");
    setError(null);
    setRefreshMsg(null);
    try {
      await invoke("flight_refresh_simbrief");
      setRefreshMsg(t("active_flight.refresh_ofp_done"));
    } catch (err: unknown) {
      // v0.7.8 v1.5.2: shared Helper formattiert Mismatch-JSON +
      // bekannte Error-Codes in lesbare Notices (Spec §8).
      // v1.5.3 (Thomas-QS): context="cockpit" damit phase_locked
      // + no_simbrief_link lesbare Texte bekommen (statt null →
      // String(err) → "[object Object]").
      const formatted = formatRefreshError(
        err as { code?: string; message?: string } | null,
        t,
        "cockpit",
      );
      setError(formatted?.text ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  /**
   * v0.16.23: Sync ONLY the planned route from the latest SimBrief OFP
   * and redraw it on the map — available in EVERY flight phase (unlike
   * the full OFP refresh above, which stays Preflight–TaxiOut to protect
   * the fuel/weight loadsheet baseline). Real-pilot workflow: ATC reroute
   * mid-flight, pilot regenerates the SimBrief route, clicks "Sync route".
   * The backend writes only planned_route / planned_waypoints / alternate
   * and re-posts the route to phpVMS — no scored field is touched.
   */
  async function handleSyncRoute() {
    if (busy) return;
    setBusy("sync_route");
    setError(null);
    setRefreshMsg(null);
    try {
      const res = (await invoke("flight_refresh_route_only")) as {
        waypoint_count: number;
        route_posted: boolean;
      };
      // Differenzierte Erfolgsmeldung: Route lokal aktualisiert immer,
      // aber das phpVMS-Upload kann fehlschlagen (Warning, kein Error)
      // oder es gab keine Wegpunkte zu syncen.
      if (res.waypoint_count === 0) {
        setRefreshMsg(t("active_flight.sync_route_no_waypoints"));
      } else if (res.route_posted) {
        setRefreshMsg(t("active_flight.sync_route_done"));
      } else {
        setRefreshMsg(t("active_flight.sync_route_done_local"));
      }
    } catch (err: unknown) {
      // Gleicher shared Formatter wie der OFP-Refresh — rendert
      // no_simbrief_identifier (actionable) + den DEP/ARR-Mismatch-
      // Hard-Block lesbar.
      const formatted = formatRefreshError(
        err as { code?: string; message?: string } | null,
        t,
        "cockpit",
      );
      setError(formatted?.text ?? String(err));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Force-discard local active-flight state without touching phpVMS. Useful
   * when the cancel call fails because the PIREP is already gone server-side
   * but our local state still thinks a flight is active.
   */
  async function handleForget() {
    if (busy) return;
    if (
      !(await confirm({
        message: t("active_flight.confirm_forget"),
        destructive: true,
      }))
    )
      return;
    setBusy("forget");
    setError(null);
    try {
      await invoke("flight_forget");
      onRefreshActiveFlight();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: string }).message)
          : String(err);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  // #phase-v2 Cutover: `info.phase` ist jetzt die v2-Phase. Die Badge-
  // Entscheidung (inkl. „Level" bei Höhen-Restriktion) steckt in der puren
  // `phaseBadgeDisplay`-Helper (unten, exportiert + unit-getestet).
  const { labelKey } = phaseBadgeDisplay(
    info.phase,
    info.shadow_segment,
  );
  const phaseLabel = t(`active_flight.phase.${labelKey}`, {
    defaultValue: info.phase,
  });

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(info.started_at).getTime()) / 60000),
  );

  // v0.3.0: Loadsheet nur in Preflight/Boarding sichtbar (siehe
  // LoadsheetMonitor) — die grid4-Karten-Reihe hat dann 4 statt 3
  // Spalten, sonst würde die letzte Spalte als Lücke stehen bleiben.
  const showLoadsheet = info.phase === "preflight" || info.phase === "boarding";

  // Fuel Calculation for ring
  const currentFuel = simSnapshot?.fuel_total_kg ?? 0;
  const usedFuel = simSnapshot?.fuel_used_kg ?? 0;
  const initialFuel = currentFuel + usedFuel;
  const fuelPercent = initialFuel > 0 ? (currentFuel / initialFuel) * 100 : 100;
  
  // Altitude / Speed / V/S / Heading
  const alt = simSnapshot?.altitude_indicated_ft ?? simSnapshot?.altitude_msl_ft ?? 0;
  const speed = simSnapshot?.indicated_airspeed_kt ?? 0;
  const mach = simSnapshot?.mach ?? 0;
  const vs = simSnapshot?.vertical_speed_fpm ?? 0;
  const heading = simSnapshot?.heading_deg_magnetic ?? 0;

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in pb-12">
      {confirmDialog}
      {info.paused_since && info.paused_last_known && (
        <DisconnectBanner
          pausedSince={info.paused_since}
          lastKnown={info.paused_last_known}
          onResumed={() => onRefreshActiveFlight()}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Card */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden relative shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-900/20 to-transparent"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-blue-600"></div>
            
            <div className="p-8 relative z-10">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-inner">
                    <span className="text-xl font-bold text-white">{info.dpt_airport}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Origin</span>
                    <span className="text-white font-medium">{standsLine(info.dep_gate, null) || "—"}</span>
                  </div>
                </div>

                <div className="flex-1 px-8 flex flex-col items-center">
                  <div className="w-full flex items-center gap-4">
                    <div className="h-px bg-zinc-700 flex-1 relative"></div>
                    <svg className="w-6 h-6 text-sky-400 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <div className="h-px bg-zinc-800 flex-1 relative"></div>
                  </div>
                  <div className="mt-3 flex gap-6 text-xs font-mono">
                    <span className="text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full">{fmtDistance(routeDistanceNm ?? info.distance_nm, i18n.language)}</span>
                    <span className="text-zinc-400">{phaseLabel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div className="flex flex-col">
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Destination</span>
                    <span className="text-white font-medium">{standsLine(null, info.arr_gate) || "—"}</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-inner">
                    <span className="text-xl font-bold text-white">{info.arr_airport}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest block mb-1">IAS / MACH</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{Math.round(speed)}</span>
                <span className="text-zinc-500 text-sm font-mono block mt-1">.{(mach * 100).toFixed(0)}</span>
              </div>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest block mb-1">Heading</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{Math.round(heading).toString().padStart(3, '0')}</span>
                <span className="text-zinc-500 text-sm font-mono block mt-1">MAG</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest block mb-1">Altitude</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{Math.round(alt).toLocaleString()}</span>
                <span className="text-zinc-500 text-sm font-mono block mt-1">FT</span>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest block mb-1">V/S</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${vs > 0 ? "text-emerald-400" : vs < 0 ? "text-sky-400" : "text-white"}`}>
                  {vs > 0 ? "+" : ""}{Math.round(vs)}
                </span>
              </div>
            </div>
          </div>

          <PhaseCard
            info={info}
            snapshot={simSnapshot ?? null}
            phaseLabel={phaseLabel}
            elapsedMinutes={elapsedMinutes}
          />

          <div
            className="grid4"
            style={{ gridTemplateColumns: showLoadsheet ? undefined : "repeat(3, 1fr)" }}
          >
            <InfoStrip
              info={info}
              snapshot={simSnapshot ?? null}
              elapsedMinutes={elapsedMinutes}
            />
            <LoadsheetMonitor info={info} />
          </div>

          <WeatherBriefing dptIcao={info.dpt_airport} arrIcao={info.arr_airport} />
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-6">Fuel Management</h3>
            <div className="flex items-center justify-center relative w-40 h-40 mx-auto">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="8" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="#38bdf8" strokeWidth="8" strokeDasharray="282.7" strokeDashoffset={282.7 - (282.7 * fuelPercent) / 100} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white font-mono">{Math.round(currentFuel).toLocaleString()}</span>
                <span className="text-[10px] text-zinc-500 font-bold tracking-widest mt-1">KG BLK</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-zinc-800/50">
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest block mb-1">Burned</span>
                <span className="text-white font-mono text-lg">{Math.round(usedFuel).toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest block mb-1">Flow</span>
                {/* Fuel flow is not in snapshot, so we omit or mock */}
                <span className="text-zinc-400 font-mono text-lg">—</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center justify-center gap-2 p-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              onClick={handleEnd}
              disabled={busy !== null}
            >
              {busy === "end" ? t("active_flight.filing") : t("active_flight.end")}
            </button>

            <button
              type="button"
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors disabled:opacity-50"
              onClick={handleSyncRoute}
              disabled={busy !== null}
              title={t("active_flight.sync_route_hint")}
            >
              {busy === "sync_route"
                ? t("active_flight.sync_route_busy")
                : t("active_flight.sync_route")}
            </button>

            {(info.phase === "preflight" ||
              info.phase === "boarding" ||
              info.phase === "pushback" ||
              info.phase === "taxi_out") && (
              <button
                type="button"
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors disabled:opacity-50"
                onClick={handleRefreshOfp}
                disabled={busy !== null}
                title={t("active_flight.refresh_ofp_hint")}
              >
                {busy === "refresh"
                  ? t("active_flight.refresh_ofp_busy")
                  : t("active_flight.refresh_ofp")}
              </button>
            )}

            <button
              type="button"
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sky-400 font-semibold transition-colors"
              onClick={onOpenWeatherBriefing}
              title={t("cockpit.weather_briefing_hint")}
            >
              🌦 {t("cockpit.weather_briefing")}
            </button>

            <div className="h-px bg-zinc-800 my-1 mx-2"></div>

            <button 
              type="button" 
              className="flex items-center justify-center gap-2 p-3 rounded-xl hover:bg-red-500/10 text-red-400 font-semibold transition-colors disabled:opacity-50"
              onClick={handleCancel} 
              disabled={busy !== null}
            >
              {busy === "cancel"
                ? t("active_flight.cancelling")
                : t("active_flight.cancel")}
            </button>

            <button
              type="button"
              className="flex items-center justify-center gap-2 p-3 rounded-xl hover:bg-zinc-800 text-zinc-500 text-sm transition-colors disabled:opacity-50"
              onClick={handleForget}
              disabled={busy !== null}
              title={t("active_flight.forget_hint")}
            >
              {busy === "forget"
                ? t("active_flight.forgetting")
                : t("active_flight.forget")}
            </button>
          </div>

          {refreshMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm font-medium" role="status">
              ✓ {refreshMsg}
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-medium" role="alert">
              {error}
            </div>
          )}
          {weatherLoadHint && (
            <div className="bg-sky-500/10 border border-sky-500/20 text-sky-400 p-4 rounded-xl text-sm font-medium" role="status">
              🌦 {t("cockpit.weather_briefing_load_hint")}
            </div>
          )}
        </div>
      </div>

      {validationMissing !== null && (
        <ManualFileDialog
          info={info}
          missing={validationMissing}
          onFiled={() => {
            setValidationMissing(null);
            onFiledSuccess(filedOutcome());
          }}
          onCancelFlight={() => void handleCancelFromDialog()}
          onClose={() => setValidationMissing(null)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// v0.4.1: Sim-Disconnect-Pause-Banner
// ===========================================================================
//
// Wenn der Streamer im Backend `paused_since` setzt (Sim wegbrach >30 s),
// rendert ActiveFlightPanel diese Component an oberster Stelle. Pilot
// sieht die letzten bekannten Werte (LAT/LON/HDG/ALT/Fuel/ZFW), kann
// damit das Flugzeug nach Sim-Restart auf die richtige Position setzen,
// und klickt dann „Flug wiederaufnehmen" — der Streamer macht weiter.
// Bewusst KEIN Auto-Resume — selbst wenn der Sim plötzlich wieder
// Daten liefert, wartet das Backend auf den expliziten Klick (siehe
// `flight_resume_after_disconnect` in lib.rs).

interface DisconnectBannerProps {
  pausedSince: string;
  lastKnown: import("../types").PausedSnapshot;
  onResumed: () => void;
}

function DisconnectBanner({
  pausedSince,
  lastKnown,
  onResumed,
}: DisconnectBannerProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pausedDate = new Date(pausedSince);
  const pausedTime = `${pausedDate.getHours().toString().padStart(2, "0")}:${pausedDate.getMinutes().toString().padStart(2, "0")}`;

  const fmtCoord = (val: number, isLat: boolean): string => {
    const hemi = isLat ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
    return `${Math.abs(val).toFixed(4)}° ${hemi}`;
  };

  async function handleResume() {
    setBusy(true);
    setError(null);
    try {
      await invoke("flight_resume_after_disconnect");
      onResumed();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: string }).message)
          : String(err);
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className="active-flight__paused-banner" role="alert">
      <div className="active-flight__paused-header">
        {/* Inline-SVG statt ⏸-Emoji — gleiche Begründung wie bei den
            Sidebar-Symbolen (Sidebar.tsx): Emoji rendern je nach OS
            unterschiedlich, lassen sich nicht einfärben und werden vom
            Screenreader vorgelesen. Strichstärke 1.6, currentColor. */}
        <span className="active-flight__paused-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M10 9v6M14 9v6" />
          </svg>
        </span>
        <div>
          <strong>{t("active_flight.paused.title")}</strong>
          <span className="active-flight__paused-since">
            {t("active_flight.paused.since", { time: pausedTime })}
          </span>
        </div>
      </div>
      <p className="active-flight__paused-instructions">
        {t("active_flight.paused.instructions")}
      </p>
      <div className="active-flight__paused-grid">
        <div>
          <span className="active-flight__paused-label">
            {t("active_flight.paused.position")}
          </span>
          <code>
            {fmtCoord(lastKnown.lat, true)} · {fmtCoord(lastKnown.lon, false)}
          </code>
        </div>
        <div>
          <span className="active-flight__paused-label">
            {t("active_flight.paused.heading_alt")}
          </span>
          <code>
            HDG {Math.round(lastKnown.heading_deg)}° · ALT{" "}
            {Math.round(lastKnown.altitude_ft).toLocaleString()} ft
          </code>
        </div>
        <div>
          <span className="active-flight__paused-label">
            {t("active_flight.paused.fuel")}
          </span>
          <code>
            {Math.round(lastKnown.fuel_total_kg).toLocaleString()} kg
          </code>
        </div>
        <div>
          <span className="active-flight__paused-label">
            {t("active_flight.paused.zfw")}
          </span>
          <code>
            {lastKnown.zfw_kg !== null
              ? `${Math.round(lastKnown.zfw_kg).toLocaleString()} kg`
              : "—"}
          </code>
        </div>
      </div>
      <div className="active-flight__paused-actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => void handleResume()}
          disabled={busy}
        >
          {busy
            ? t("active_flight.paused.resuming")
            : t("active_flight.paused.resume")}
        </button>
      </div>
      {error && (
        <p className="active-flight__paused-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
