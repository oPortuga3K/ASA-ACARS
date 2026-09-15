# ASA-ACARS

> Modern, open-source ACARS client for [phpVMS 7](https://phpvms.net) — Tauri 2 · Rust · React 19.  
> Built with ❤️ in Gifhorn — by Thomas Kant & Atlantic Star Airways.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-blue.svg)](#installation)
[![Platform: macOS](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)](#installation)
[![phpVMS 7](https://img.shields.io/badge/phpVMS-7-orange.svg)](https://phpvms.net)
[![Version](https://img.shields.io/badge/Version-1.7.22-blue.svg)](https://github.com/oPortuga3K/ASA-ACARS/releases/latest)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24c8d8.svg)](https://tauri.app)

---

## 📋 Table of Contents

- [What is ASA-ACARS?](#what-is-asa-acars)
- [Who can run ASA-ACARS?](#who-can-run-asa-acars)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Server Modules](#server-modules)
- [X-Plane Study-Level Add-ons](#x-plane-study-level-add-ons)
- [Development](#development)
- [Troubleshooting & Logs](#troubleshooting--logs)
- [Credits](#credits)
- [License](#license)

---

## What is ASA-ACARS?

**ASA-ACARS** is a modern, cross-platform ACARS (Aircraft Communications Addressing and Reporting System) desktop client for [phpVMS 7](https://phpvms.net). It connects directly to your flight simulator, captures high-fidelity telemetry, scores landings using industry-grade thresholds, correlates touchdowns to runway centerline accuracy, and submits clean PIREPs to your phpVMS server.

**Supported simulators:**

| Simulator | Method | Platform |
|---|---|---|
| ✅ **MSFS 2020 / MSFS 2024** | Raw SimConnect FFI (no FSUIPC needed) | Windows only |
| ✅ **X-Plane 11 / X-Plane 12** | Native UDP DataRefs + bundled `.xpl` plugin | Windows · macOS |

---

## Who can run ASA-ACARS?

### 🇬🇧 English

**The source is free — the official apps only run for Atlantic Star Airways.**

ASA-ACARS is open source (MIT). Any virtual airline is welcome to clone, adapt, and build the code for its **own** phpVMS 7 instance.

The **officially released builds** (installers in [GitHub Releases](https://github.com/oPortuga3K/ASA-ACARS/releases)) are hard-wired to Atlantic Star Airways: login, live tracking, and PIREP submission only work with an ASA pilot account. To use ASA-ACARS for a different VA, build your own client from source against your own infrastructure.

### 🇩🇪 Deutsch

**Der Quellcode ist frei — die offiziellen Apps laufen nur für die Atlantic Star Airways.**

ASA-ACARS ist Open Source (MIT-Lizenz). Jede Virtual Airline darf den Code klonen, anpassen und für ihre **eigene** phpVMS-7-Instanz selbst bauen.

Die **offiziell veröffentlichten Builds** sind fest auf die Atlantic Star Airways konfiguriert: Login, Live-Tracking und PIREP-Submission funktionieren ausschließlich mit einem ASA-Pilotenaccount. Wer ASA-ACARS für eine andere VA nutzen möchte, baut sich aus dem Quellcode einen eigenen Client.

---

## Features

### ✈️ Live Telemetry & Flight Tracking

- **16-phase Flight State Machine:** Boarding → Pushback → TaxiOut → TakeoffRoll → Climb → Cruise → Descent → Approach → Final → Landing → Rollout → TaxiIn → BlocksOn → Arrived → PIREPFiled
- Real-time position streaming to phpVMS with phase-adaptive cadence
- Offline position queue (SQLite-backed) — retries automatically with exponential backoff when connectivity drops
- METAR snapshots automatically captured at departure (Takeoff) and arrival (Final)
- Auto-start watcher: recording begins automatically when the aircraft is parked at the bid's departure airport

### 🛬 Industry-Grade Landing Analysis

ASA-ACARS outperforms competitors (Volanta, SimCARS) with a dedicated high-frequency touchdown sampler:

| Capability | Volanta | SimCARS | **ASA-ACARS** |
|---|---|---|---|
| Sample Rate | ~1 Hz event-driven | ~1 Hz event-driven | **50 Hz dedicated sampler** |
| V/S Buffer | None | 100 samples | **5 s × 50 Hz = 250 samples** |
| Touchdown detection | `on_ground` edge | `on_ground` edge | **AGL threshold + bounce arming** |
| Landing Rate source | Live tick V/S | Buffer max or random fallback ⚠️ | **Peak V/S over 5 s look-back buffer** |
| G-Force | Live tick | Post-touchdown peak | Peak in 5 s window (FOQA EMA-filtered) |
| Bounce detection | ❌ | ✅ (max 5) | ✅ Unlimited, AGL-based |
| Sideslip / Crab angle | ❌ | ❌ | ✅ Native `atan2` from body velocities |
| Random fallback | No | **Yes** ⚠️ | **Never** |
| Classification | Numeric only | Numeric only | 5-level: Smooth / Acceptable / Firm / Hard / Severe |

**Score thresholds validated against:** Boeing 737 FCOM, Airbus A320 FCOM, Lufthansa FOQA, BeatMyLanding calibration.

**Key measurements:**
- Vertical speed (fpm) — peak over 5 s look-back buffer, not first-tick
- G-force — FOQA-grade EMA-filtered peak (τ ≈ 100 ms), not raw 50 Hz spike
- Bounce count — AGL-based (35 ft → 5 ft re-arm threshold)
- Sideslip / crab angle — from `VEL_BODY_X/Z` (`atan2`)
- Headwind / crosswind — from airframe-relative wind components
- Rollout distance — finalized at 40 kt turnoff, not at standstill

### 🛫 Runway Correlation

- **OurAirports.com** dataset embedded: 47,681 runways, 4 MB
- Touchdown lat/lon → exact runway ident + centerline deviation (m) + threshold distance (m) + heading deviation (°)
- Overrun risk assessment on full runway length (unaffected by float tolerance)
- Runway utilization scoring with 15% LDA float tolerance (separates landing discipline from braking discipline)
- Missing runway crowdsource reporting back to the server

### 📄 Full PIREP Submission

- Complete notes block: `TIMES / TOUCHDOWN / RUNWAY / FUEL / DISTANCE / METAR`
- ~40 custom fields (Title-Case + snake_case for leaderboards)
- Score consistency: client is the single source of truth — no server-side re-computation
- Auto-file on `Arrived` phase with manual override option
- Bid cleanup via correct `/api/user/bids` endpoint

### 🔧 Comfort Features

- **Persistent activity log** with crash recovery (reset per flight)
- **Live Sim Inspector** in debug mode — MSFS SimVars/LVars + X-Plane DataRefs live
- **LAN remote control** — control the client from another device on the same network
- **Discord Rich Presence** — live flight status in Discord profile
- **MQTT / live tracking** — broadcast position to external dashboards
- **Hoppie ACARS** — datalink protocol support
- **Auto-updates** via Tauri plugin updater with Ed25519 signature verification (no code-signing/notarization required)
- **Single-instance protection** — prevents double PIREP submissions after sleep/wake cycles
- **Aircraft scan tool** (Settings → Aircraft Scan) — submit add-on packages for premium profile development
- **Logbook altitude profile** — MSL + AGL terrain line rendered in the correct draw order

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │  phpVMS 7 Site (web)                     │
                    │  ┌──────────────┐ ┌───────────────────┐  │
                    │  │  Core API    │ │  ASA phpVMS       │  │
                    │  │  (auth, bids,│ │  Modules          │  │
                    │  │  pireps, …)  │ │  AsaCore / Log-   │  │
                    │  │              │ │  book / News /    │  │
                    │  │              │ │  VATraffic        │  │
                    │  └──────────────┘ └───────────────────┘  │
                    └────────────────▲─────────────────────────┘
                                     │ HTTPS / JSON
                                     │ Bearer (API key)
                    ┌────────────────┴─────────────────────────┐
                    │  ASA-ACARS Desktop Client                │
                    │  Tauri 2 (Rust core + React 19 UI)       │
                    │  ┌───────────────────┐ ┌─────────────┐  │
                    │  │  phpVMS API Client│ │  React UI   │  │
                    │  │  (reqwest, retry) │ │  i18n DE/EN │  │
                    │  └───────────────────┘ └─────────────┘  │
                    │  ┌───────────────────┐ ┌─────────────┐  │
                    │  │  Sim Adapter      │ │  Flight FSM │  │
                    │  │  ├── MSFS         │ │  Recorder   │  │
                    │  │  └── X-Plane      │ │  Analyzer   │  │
                    │  └────────┬──────────┘ └─────────────┘  │
                    │           │                              │
                    │  ┌────────▼──────────┐ ┌─────────────┐  │
                    │  │  SQLite Queue     │ │  OS Keyring │  │
                    │  │  + Flight Logs    │ │  (API key)  │  │
                    │  └───────────────────┘ └─────────────┘  │
                    └──────┬────────────────────┬─────────────┘
                           │ SimConnect IPC      │ UDP loopback
                           ▼                    ▼
                    ┌─────────────┐    ┌──────────────────┐
                    │  MSFS       │    │  X-Plane 11/12   │
                    │  2020/2024  │    │  + .xpl plugin   │
                    └─────────────┘    └──────────────────┘
```

### Rust Crate Layout (`client/src-tauri/crates/`)

| Crate | Responsibility |
|---|---|
| `api-client` | phpVMS HTTPS client (reqwest), retry/backoff, offline queue |
| `sim-core` | `SimAdapter` trait, `SimSnapshot` model, phase FSM |
| `sim-msfs` | SimConnect FFI adapter (Windows only, feature-gated) |
| `sim-xplane` | X-Plane UDP listener, paired with xplane-plugin |
| `recorder` | Flight log, position history, landing analyzer, 50 Hz sampler |
| `landing-scoring` | Score algorithms (V/S, G, centerline, runway utilization) |
| `storage` | SQLite (rusqlite) — offline queue, logs, settings cache |
| `secrets` | Cross-platform OS keyring wrapper (keyring crate) |
| `geo` | Runway DB, great-circle math, centerline geometry |
| `metar` | METAR fetch + parse (aviationweather.gov) |
| `discord-presence` | Discord Rich Presence integration |
| `asa-acars-mqtt` | MQTT live tracking broadcast |
| `hoppie-protocol` | Hoppie ACARS datalink |

### Tech Stack

| Layer | Technology |
|---|---|
| **App framework** | [Tauri 2](https://tauri.app) |
| **Backend** | Rust (raw SimConnect FFI, tokio async, rustls) |
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| **State / IPC** | Tauri commands + events |
| **i18n** | `react-i18next` (DE + EN) |
| **Persistence** | SQLite via `rusqlite`, JSON sidecars |
| **Secrets** | OS Keyring (Windows Credential Manager / macOS Keychain) |
| **Networking** | `reqwest` + `rustls` (no OpenSSL) |
| **Crash reporting** | Sentry (`@sentry/react`) |
| **Updater** | `tauri-plugin-updater` with Ed25519 signature |
| **Tests** | Vitest (frontend), Rust unit tests |
| **CI** | GitHub Actions (build + test on every push) |

---

## Installation

Download the package for your platform from the [Latest Release](https://github.com/oPortuga3K/ASA-ACARS/releases/latest).

### Windows (10 / 11, x64)

1. Download `ASA-ACARS_<version>_x64-setup.exe` (NSIS installer) and run it
2. Dismiss the SmartScreen warning: **"More info" → "Run anyway"** — the app is not yet code-signed
3. ASA-ACARS launches automatically after installation
4. Log in with your phpVMS API key

### macOS (Apple Silicon — M1 / M2 / M3 / M4)

1. Download `ASA-ACARS_<version>_aarch64.dmg`
2. Open the DMG → drag the ASA-ACARS icon to Applications
3. **First launch — bypass Gatekeeper** (the app is not notarized):
   - **Right-click method:** In Finder, right-click ASA-ACARS → "Open" → confirm "Open" in the dialog. macOS will remember this permission.
   - **Terminal method** (if right-click doesn't show the option):
     ```bash
     xattr -dr com.apple.quarantine /Applications/ASA-ACARS.app
     ```
4. Log in with your phpVMS API key

> **Intel Macs:** Not officially built. Open an issue if needed — the Tauri build can be extended to `x86_64-apple-darwin` without major effort.

### Auto-Updates

From v0.1.0+, new versions appear as an update banner inside the app — no manual download required. Updates are verified with **Ed25519 signatures**, so they are secure even without platform code-signing.

---

## Server Modules

ASA-ACARS requires **4 phpVMS 7 modules** installed on your server. Drop the contents of `server-module/` into your `modules/` directory.

| Module | Purpose |
|---|---|
| **AsaCore** | Landing data storage (score, FPM, G-force), client version control, flight heartbeats, runway crowdsource |
| **AsaLogbook** | Extended logbook — pilot statistics and flight history with extra AsaCore data |
| **AsaNews** | News read-tracking system (marks news as read per pilot, serves unread counters) |
| **AsaVATraffic** | Real-time position of all active VA pilots for the client's live map |

### Server Installation

```bash
# 1. Copy the 4 module folders to your phpVMS 7 modules directory
cp -r server-module/AsaCore      /path/to/phpvms/modules/
cp -r server-module/AsaLogbook   /path/to/phpvms/modules/
cp -r server-module/AsaNews      /path/to/phpvms/modules/
cp -r server-module/AsaVATraffic /path/to/phpvms/modules/

# 2. Enable the modules
php artisan module:enable AsaCore
php artisan module:enable AsaLogbook
php artisan module:enable AsaNews
php artisan module:enable AsaVATraffic

# 3. Run migrations
php artisan module:migrate AsaCore
php artisan module:migrate AsaNews
```

### Server API Endpoints (provided by AsaCore)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/asaacars/config` | Client config: rules, intervals, custom fields, version gating |
| `GET` | `/api/asaacars/version` | Latest client version + download URLs |
| `POST` | `/api/asaacars/heartbeat` | Liveness ping, "last seen" for admin view |
| `POST` | `/api/asaacars/pirep/{id}/landing` | Submit landing analysis (centerline, heading, threshold, METAR) |
| `POST` | `/api/asaacars/runway-data/missing` | Telemetry: report runway not found in embedded DB |
| `GET` | `/api/asaacars/va-traffic` | Real-time pilot positions for the live map |

---

## X-Plane Study-Level Add-ons

Deep study-level aircraft in X-Plane (Hot-Start CL650, ToLiss, FlightFactor, PMDG…) control cockpit and system functions via **their own DataRefs** instead of the standard `sim/...` DataRefs. ASA-ACARS reads standard DataRefs by default — if an add-on doesn't update them, ASA-ACARS may not see flap position etc.

**From v0.12.1+**, unreadable values are treated fairly — shown as "not assessable" with **no score penalty**.

**From v0.12.2+**, ASA-ACARS has a **DataRef profile system**: it detects known study-level aircraft (by title or a signature DataRef probe) and subscribes to their add-on-specific DataRefs. Currently profiled aircraft:

- ✅ Hot-Start Challenger 650 (CL650) — flaps, battery master, beacon, taxi light
- ✅ Zibo / Laminar 737-800 — autopilot modes via `laminar/B738` DataRefs

**Want to add your aircraft?** Fill in the template:

→ **[docs/xplane-aircraft-dataref-overrides.md](docs/xplane-aircraft-dataref-overrides.md)**

1. Install [DataRefTool](https://datareftool.com/) (free X-Plane plugin)
2. Load your aircraft at the gate
3. In Plugins → DataRefTool → Show DataRefs, search for the add-on prefix (e.g. `CL650/`, `AirbusFBW/`, `1-sim/`)
4. Operate each control and note which DataRef changes
5. Submit the filled template via the [Issue Tracker](https://github.com/oPortuga3K/ASA-ACARS/issues)

---

## Development

### Prerequisites

- [Rust toolchain](https://rustup.rs/) (stable)
- [Node.js 20+](https://nodejs.org/)
- [MSFS 2024 SDK](https://docs.flightsimulator.com/) — only needed for the `sim-msfs` crate on Windows
- Tauri CLI v2: included in `devDependencies` via `@tauri-apps/cli`

### Getting Started

```bash
git clone https://github.com/oPortuga3K/ASA-ACARS.git
cd ASA-ACARS/client

# Install frontend dependencies
npm install

# Start dev mode with hot-reload (React + Tauri)
npm run tauri dev

# Run frontend unit tests
npm test

# Build release installer
npm run tauri build -- --bundles nsis     # Windows NSIS installer
npm run tauri build -- --bundles dmg      # macOS DMG
```

### Project Structure

```
ASA-ACARS/
├── client/                   # Tauri 2 desktop application
│   ├── src/                  # React 19 + TypeScript frontend
│   ├── src-tauri/
│   │   ├── crates/           # Rust crate workspace (see table above)
│   │   ├── src/              # Tauri main + command handlers
│   │   ├── tauri.conf.json   # App config (bundle, updater, CSP)
│   │   └── Cargo.toml        # Rust workspace manifest
│   ├── package.json
│   └── vite.config.ts
├── server-module/            # phpVMS 7 server modules
│   ├── AsaCore/
│   ├── AsaLogbook/
│   ├── AsaNews/
│   └── AsaVATraffic/
├── xplane-plugin/            # Native X-Plane .xpl plugin (Rust/XPLM)
├── shared/                   # JSON schemas + OpenAPI specs
├── docs/                     # Architecture, specs, decisions, release notes
├── scripts/                  # Build & tooling scripts
└── tools/                    # Developer utilities
```

### Environment Variables

```bash
# Control Rust tracing verbosity
RUST_LOG=info                       # Standard (default)
RUST_LOG=info,asa-acars=debug       # Full debug for our code, info for deps
```

### Running Logs Live (development)

```powershell
# Windows — launch from PowerShell to see tracing output
& "C:\Program Files\ASA-ACARS\ASA-ACARS.exe"
```

```bash
# macOS
/Applications/ASA-ACARS.app/Contents/MacOS/ASA-ACARS
```

---

## Troubleshooting & Logs

### Data Directory

All files are stored under the Tauri `app_data_dir` with bundle ID `com.asaacars.app`:

| Platform | Path |
|---|---|
| **Windows** | `%APPDATA%\com.asaacars.app\` (open with `Win+R` → `%APPDATA%\com.asaacars.app`) |
| **macOS** | `~/Library/Application Support/com.asaacars.app/` (Finder → `Cmd+Shift+G`) |

### Files Reference

| File | Description |
|---|---|
| `flight_logs/<pirep_id>.jsonl` | **Per-flight recorder** — one line per event (position, phase transition, touchdown score, METAR snapshot). Append-only JSONL. Best source for "why did flight X do Y?". |
| `activity_log.json` | **In-app activity feed** — exactly the lines shown in the Cockpit tab, persisted across restarts. |
| `active_flight.json` | Snapshot of the currently active flight for crash-resume. Exists only while a flight is running. |
| `landing_history.json` | Historical landings for the "Landing" tab. |
| `position_queue.bin` | Offline backlog: positions that couldn't be uploaded due to network issues. Drained automatically when back online. |
| `site.json`, `sim.json` | Local settings (phpVMS URL, selected sim). No API key — that lives in the OS keyring. |

> **Security note:** The API key is **never stored as a plaintext file**. It is stored exclusively in the OS Keyring (Windows Credential Manager / macOS Keychain).

### Reporting a Bug

The most useful information for a bug report:

1. The `flight_logs/<pirep_id>.jsonl` for the affected flight (zip and attach)
2. The relevant excerpt from `activity_log.json`
3. If reproducible: a few lines of tracing output via `RUST_LOG=info,asa-acars=debug` from a terminal run

Submit issues at → **[github.com/oPortuga3K/ASA-ACARS/issues](https://github.com/oPortuga3K/ASA-ACARS/issues)**

---

## Credits

ASA-ACARS stands on the shoulders of:

| Project | Contribution |
|---|---|
| **[OurAirports](https://ourairports.com/)** | Public-domain runway dataset (47,681 runways) |
| **[BeatMyLanding](https://beatmylanding.com/)** | Touchdown window calibration and bounce detection pattern |
| **GEES** | Open-source landing rate logger — reverse-engineered for V/S sign convention and native sideslip calculation |
| **LandingToast** | Live V/S-at-on-ground-edge pattern |
| **[Tauri](https://tauri.app/)** | App framework (Rust + native webview) |
| **[MSFS SDK](https://docs.flightsimulator.com/)** | SimConnect integration |
| **[X-Plane SDK](https://developer.x-plane.com/)** | XPLM plugin + DataRef access |
| **[phpVMS 7](https://phpvms.net/)** | Virtual airline management platform |

---

## License

MIT — see [LICENSE](LICENSE).

Copyright © 2026 Thomas Kant and ASA-ACARS contributors.

---

**Contact:** Thomas Kant · Atlantic Star Airways · [github.com/oPortuga3K](https://github.com/oPortuga3K)
