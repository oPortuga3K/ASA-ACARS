/**
 * Seitenleiste — ersetzt die horizontale Tab-Leiste (Redesign Stufe D).
 *
 * Gründe für den Wechsel:
 *   - Die alte `.tabs` war `display:flex` OHNE `flex-wrap` und OHNE
 *     `overflow-x`. Bei zehn Einträgen und 80 Zeichen deutscher
 *     Beschriftung passte das im 900-px-Minimum gerade so — ohne Reserve
 *     und ohne definiertes Verhalten beim Überlauf.
 *   - Die App war auf 1200 px gedeckelt; darüber entstanden tote Ränder.
 *     Mit der Seitenleiste darf der Inhalt mitwachsen.
 *   - Die drei Statusanzeigen (phpVMS, Simulator, Aufzeichnung) lagen in
 *     der Kopfzeile und konkurrierten dort mit dem Flugtitel.
 *
 * Einklappbar auf eine reine Symbolleiste (216 px ↔ 60 px), Zustand wird
 * gemerkt. Sämtliche Texte, Bedingungen und Zähler sind unverändert aus
 * App.tsx übernommen.
 */

import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type Tab =
  | "cockpit"
  | "map"
  | "cpdlc"
  | "chat"
  | "briefing"
  | "logbook"
  | "landing"
  | "news"
  | "log"
  | "settings"
  | "about"
  | "devpreview";

const STORAGE_KEY = "asa-acars.nav.collapsed";

export function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- Symbole */
/* Bewusst als Inline-SVG statt Emoji: Emoji rendern unter Windows und macOS
   unterschiedlich, lassen sich nicht einfärben und werden vom Screenreader
   vorgelesen. Strichstärke 1.6, currentColor. */

const I = {
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.5-.7L3 21l1.9-4.6A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4z" />
    </svg>
  ),
  cockpit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 4-6 3v13l6-3 6 3 6-3V4l-6 3-6-3z" /><path d="M9 4v13M15 7v13" />
    </svg>
  ),
  cpdlc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v11H8l-4 4V5z" /><path d="M8 9h8M8 12.5h5" />
    </svg>
  ),
  briefing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 12h7M9 16h5" />
    </svg>
  ),
  logbook: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v18H6.5A1.5 1.5 0 0 1 5 19.5v-15z" /><path d="M5 17h14M9 7h6" />
    </svg>
  ),
  landing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20h18" /><path d="M5 16.5 19.5 12a1.6 1.6 0 0 0-1-3L15 10 9 5 6.5 5.8 10 11l-4 1.3-2.5-1.8-1.3.5L5 16.5z" />
    </svg>
  ),
  news: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h13v12H3z" /><path d="M16 10h3l2 3v5h-5M6 10h7M6 13.5h5" />
    </svg>
  ),
  log: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" /><path d="M7.5 9h9M7.5 12h9M7.5 15h5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
    </svg>
  ),
  dev: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6.5L5.5 18A2 2 0 0 0 7.2 21h9.6a2 2 0 0 0 1.7-3L14 9.5V3" />
    </svg>
  ),
  collapse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v14H4z" /><path d="M10 5v14" />
    </svg>
  ),
  plane: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ Zeile */

function Item({
  icon,
  label,
  active,
  badge,
  badgeLabel,
  dot,
  title,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: ReactNode;
  badgeLabel?: string;
  dot?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-btn flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 relative w-full group overflow-hidden ${
        active 
          ? "bg-zinc-900 text-sky-400 border border-zinc-800 shadow-md" 
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      }`}
      aria-current={active ? "page" : undefined}
      title={title ?? label}
      onClick={onClick}
    >
      {active && (
        <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-3/5 w-1 bg-sky-400 rounded-r-md shadow-[0_0_10px_rgba(56,189,248,0.8)]" aria-hidden="true" />
      )}
      <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center relative" aria-hidden="true">
        {icon}
        {dot && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-zinc-900" aria-hidden="true" />
        )}
      </span>
      <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis text-left flex-1 transition-opacity duration-300 group-data-[nav=icon]:opacity-0">
        {label}
      </span>
      {badge != null && (
        <span className="flex-shrink-0 bg-sky-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full transition-opacity duration-300 group-data-[nav=icon]:opacity-0" aria-label={badgeLabel}>
          {badge}
        </span>
      )}
    </button>
  );
}

/* --------------------------------------------------------------- Sidebar */

export function Sidebar({
  tab,
  setTab,
  collapsed,
  onToggleCollapsed,
  cpdlcEnabled,
  cpdlcPendingCount,
  onCpdlcOpen,
  chatAn,
  chatUngelesen,
  onChatOpen,
  unreadNews,
  hasActiveFlight,
  phpvmsConnected,
  simConnected,
  simConnecting,
  simLabel,
  recording,
  updateButton,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  cpdlcEnabled: boolean;
  cpdlcPendingCount: number;
  onCpdlcOpen: () => void;
  chatAn: boolean;
  chatUngelesen: number;
  onChatOpen: () => void;
  unreadNews: number;
  hasActiveFlight: boolean;
  phpvmsConnected: boolean;
  simConnected: boolean;
  simConnecting: boolean;
  simLabel: string;
  recording?: ReactNode;
  updateButton?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <nav className="w-[260px] flex-shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950 p-4 relative z-10 h-full group" data-nav={collapsed ? "icon" : "wide"} aria-label={t("app.name")} style={{ width: collapsed ? '80px' : '260px', transition: 'width 0.3s ease' }}>
      <div className="flex items-center gap-3 px-2 mb-8 mt-2 overflow-hidden whitespace-nowrap">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1 .5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6 5-4 4-3-1-1 1 3 3 3 3 1-1-1-3 4-4 5 6l1.2-.7c.4-.2.7-.6.6-1.1z"/></svg>
        </div>
        <div className="flex flex-col justify-center transition-opacity duration-300 group-data-[nav=icon]:opacity-0">
          <h1 className="text-xl font-bold tracking-tight text-white leading-tight">ASA</h1>
          <h2 className="text-xs text-sky-400 font-semibold tracking-widest uppercase">ACARS V2</h2>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar flex flex-col">
        <Item icon={I.briefing} label={t("tabs.briefing")} active={tab === "briefing"} onClick={() => setTab("briefing")} />
        <Item
          icon={I.cockpit}
          label={t("tabs.cockpit")}
          active={tab === "cockpit"}
          dot={hasActiveFlight}
          onClick={() => setTab("cockpit")}
        />
        <Item icon={I.map} label={t("tabs.map")} active={tab === "map"} onClick={() => setTab("map")} />
        {cpdlcEnabled && (
          <Item
            icon={I.cpdlc}
            label={t("tabs.cpdlc")}
            active={tab === "cpdlc"}
            badge={
              cpdlcPendingCount > 0 ? (cpdlcPendingCount > 9 ? "9+" : cpdlcPendingCount) : undefined
            }
            badgeLabel={t("cpdlc.badge_pending", { count: cpdlcPendingCount })}
            onClick={onCpdlcOpen}
          />
        )}
        {chatAn && (
        <Item
          icon={I.chat}
          label={t("tabs.chat", "Chat")}
          active={tab === "chat"}
          badge={chatUngelesen > 0 ? (chatUngelesen > 9 ? "9+" : chatUngelesen) : undefined}
          badgeLabel={t("chat.ungelesen", { count: chatUngelesen, defaultValue: "{{count}} ungelesene Zurufe" })}
          onClick={onChatOpen}
        />
        )}
        <Item icon={I.logbook} label={t("tabs.logbook")} active={tab === "logbook"} onClick={() => setTab("logbook")} />
        <Item icon={I.landing} label={t("tabs.landing")} active={tab === "landing"} onClick={() => setTab("landing")} />
        
        <div className="my-2 border-t border-zinc-800/50 mx-2 flex-shrink-0"></div>

        <Item
          icon={I.news}
          label={t("nav.news")}
          active={tab === "news"}
          badge={unreadNews > 0 ? (unreadNews > 9 ? "9+" : unreadNews) : undefined}
          badgeLabel={t("news.new_badge")}
          onClick={() => setTab("news")}
        />
        <Item icon={I.log} label={t("tabs.log")} active={tab === "log"} onClick={() => setTab("log")} />
      </div>

      <div className="mt-auto pt-4 space-y-2 border-t border-zinc-800/50 flex flex-col">
        {updateButton}

        {/* Status Pill - Sim */}
        <div className="flex items-center gap-3 group-data-[nav=icon]:gap-0 group-data-[nav=icon]:justify-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden whitespace-nowrap transition-colors" title={t("status.tooltip", {
            service: simLabel,
            state: simConnected
              ? t("status.simulator_connected")
              : simConnecting
                ? t("status.simulator_connecting")
                : t("status.simulator_disconnected"),
          })}>
          <span className="flex-shrink-0 relative flex h-3 w-3">
            {simConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${simConnected ? "bg-emerald-500" : simConnecting ? "bg-amber-500 animate-pulse" : "bg-zinc-600"}`}></span>
          </span>
          <div className="flex flex-col transition-all duration-300 group-data-[nav=icon]:opacity-0 group-data-[nav=icon]:w-0">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider leading-none mb-1">Simulator</span>
            <span className="text-xs font-medium text-zinc-300 leading-none">{simConnected ? "Connected" : simConnecting ? "Connecting" : "Offline"}</span>
          </div>
        </div>

        {/* Status Pill - Network */}
        <div className="flex items-center gap-3 group-data-[nav=icon]:gap-0 group-data-[nav=icon]:justify-center p-3 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden whitespace-nowrap transition-colors" title={t("status.tooltip", {
            service: t("status.phpvms"),
            state: phpvmsConnected ? t("status.phpvms_connected") : t("status.phpvms_disconnected"),
          })}>
          <span className="flex-shrink-0 relative flex h-3 w-3">
             {phpvmsConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${phpvmsConnected ? "bg-emerald-500" : "bg-zinc-600"}`}></span>
          </span>
          <div className="flex flex-col transition-all duration-300 group-data-[nav=icon]:opacity-0 group-data-[nav=icon]:w-0">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider leading-none mb-1">Network</span>
            <span className="text-xs font-medium text-zinc-300 leading-none">{phpvmsConnected ? "Online" : "Offline"}</span>
          </div>
        </div>

        {recording}

        <Item icon={I.about} label={t("tabs.about")} active={tab === "about"} onClick={() => setTab("about")} />
        {import.meta.env.DEV && (
          <Item
            icon={I.dev}
            label="Preview"
            active={tab === "devpreview"}
            title="Dev-only: RunwayDiagram-Preview mit Mock-Daten"
            onClick={() => setTab("devpreview")}
          />
        )}
        <div className={`flex gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <div className="flex-1">
            <Item icon={I.settings} label={t("tabs.settings")} active={tab === "settings"} onClick={() => setTab("settings")} />
          </div>
          <button
            type="button"
            className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
            aria-pressed={collapsed}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
