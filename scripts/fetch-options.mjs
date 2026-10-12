// Option data for every stock page.
//
//   node scripts/fetch-options.mjs chain [dir ...]
//     Option chain from Cboe's delayed quotes (15-minute delay, IV and greeks by Cboe), trimmed to
//     the nearest 6 expiries plus the monthlies out to ~13 months (18 at most) and strikes from 60% to 160% of the share price.
//     Writes <dir>/data/options.json. Run by the deploy workflow on every price refresh (no commit).
//
//   node scripts/fetch-options.mjs iv [dir ...]
//     Daily 30-day implied volatility. Merges two series into <dir>/vol.json, which is committed so
//     the history keeps growing:
//       aq   = 30-day IV (mean of calls and puts) from alphaquery, which serves the last ~3 months
//       cboe = Cboe's 30-day IV index for the stock, one reading per trading day from now on
//     Run once a day after the close by .github/workflows/vol.yml.
//
// Failures for one stock never stop the others, and existing files are left alone on failure.


// Option data for every stock page.
//
//   node scripts/fetch-options.mjs chain [dir ...]
//     Option chain from Cboe's delayed quotes (15-minute delay, IV and greeks by Cboe), trimmed to
//     the nearest 6 expiries plus the monthlies out to ~13 months (18 at most) and strikes from 60% to 160% of the share price.
//     Writes <dir>/data/options.json. Run by the deploy workflow on every price refresh (no commit).
//
//   node scripts/fetch-options.mjs iv [dir ...]
//     Daily 30-day implied volatility. Merges two series into <dir>/vol.json, which is committed so
//     the history keeps growing:
//       aq   = 30-day IV (mean of calls and puts) from alphaquery, which serves the last ~3 months
//       cboe = Cboe's 30-day IV index for the stock, one reading per trading day from now on
//     Run once a day after the close by .github/workflows/vol.yml.
//
//   node scripts/fetch-options.mjs gamma [dir ...]
//     Aggregates all multi-expiry contracts from Cboe, maps option positioning distributions via 
//     Black-Scholes, locates where net dealer positioning crosses zero, and updates <dir>/mgmt.json.
//
// Failures for one stock never stop the others, and existing files are left alone on failure.
import { writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";

const STOCKS = [
  ["arm", "ARM"], ["tesla", "TSLA"], ["sndk", "SNDK"], ["intc", "INTC"], ["spcx", "SPCX"], ["mu", "MU"],
  ["lite", "LITE"], ["cohr", "COHR"], ["googl", "GOOGL"], ["meta", "META"], ["nvda", "NVDA"], ["zs", "ZS"],
  ["be", "BE"], ["aaoi", "AAOI"], ["amd", "AMD"], ["mp", "MP"], ["amzn", "AMZN"], ["msft", "MSFT"],
  ["mrvl", "MRVL"], ["skhy", "SKHY"], ["tsm", "TSM"], ["avgo", "AVGO"], ["rok", "ROK"],
  ["amat", "AMAT"], ["asml", "ASML"], ["pltr", "PLTR"], ["glw", "GLW"], ["ter", "TER"],
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAX_EXP = 18, MAX_DAYS = 400, LO = 0.6, HI = 1.6;
const summary = (s) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + "\n"); };
const r4 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const r2 = (x) => (x == null || !isFinite(x) ? null : Math.round(x * 100) / 100);

async function getJSON(url, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(45000) });
      if (r.status === 403 || r.status === 404) throw Object.assign(new Error(`HTTP ${r.status}`), { fatal: true });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { err = e; if (e.fatal) break; await new Promise((s) => setTimeout(s, 2000 * (i + 1))); }
  }
  throw err;
}

const cboe = (t) => getJSON(`https://cboe.com{encodeURIComponent(t)}.json`);
// Cboe quotes IV either as a fraction or in percent depending on the field; return percent
const pctIV = (x) => (x == null || !isFinite(x) || x <= 0 ? null : x < 5 ? x * 100 : x);

// Math helper for normal probability distribution approximation
function normalPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Analytical Black-Scholes Gamma formula model engine
function calculateBSGamma(S, K, T, r, sigma) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + (sigma ** 2) / 2) * T) / (sigma * Math.sqrt(T));
  return normalPDF(d1) / (S * sigma * Math.sqrt(T));
}

async function gamma(dir, tick) {
  const j = await cboe(tick);
  const d = j.data || {};
  const spot = d.current_price || d.close || d.prev_day_close;
  if (!spot || !Array.isArray(d.options)) throw new Error("no chain");

  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  today.setHours(0, 0, 0, 0);

  // Generate price range scan steps to map out crossover profile points
  const scanPrices = [];
  const steps = 120;
  const minP = spot * 0.75;
  const maxP = spot * 1.25;
  for (let i = 0; i <= steps; i++) {
    scanPrices.push(minP + ((maxP - minP) * i) / steps);
  }

  const netGammas = new Array(scanPrices.length).fill(0);
  const riskFreeRate = 0.04; 

  // Process and compute aggregate multi-expiry positioning configurations
  for (const o of d.options) {
    const m = /^([A-Z.]+?)(\d{6})([CP])(\d{8})$/.exec(o.option || "");
    if (!m) continue;

    const exp = `20${m[2].slice(0, 2)}-${m[2].slice(2, 4)}-${m[2].slice(4, 6)}`;
    const days = (new Date(exp + "T00:00:00") - today) / 864e5;
    if (days < 0 || days > MAX_DAYS) continue;

    const K = +m[4] / 1000;
    const oi = o.open_interest || 0;
    let ivVal = pctIV(o.iv);
    
    if (oi <= 0 || !ivVal) continue;
    ivVal = ivVal / 100; // Scale back to decimals for BS metrics
    const T = days / 365.0;

    for (let i = 0; i < scanPrices.length; i++) {
      const S = scanPrices[i];
      const g = calculateBSGamma(S, K, T, riskFreeRate, ivVal);
      
      if (m[3] === "C") {
        // Dealer short calls rule profile impact
        netGammas[i] += g * oi * 100;
      } else if (m[3] === "P") {
        // Dealer short puts rule profile impact
        netGammas[i] -= g * oi * 100;
      }
    }
  }

  // Pinpoint zero crossing boundary zone index via linear interpolation
  let flipPrice = spot;
  for (let i = 1; i < netGammas.length; i++) {
    if (Math.sign(netGammas[i]) !== Math.sign(netGammas[i - 1])) {
      flipPrice = scanPrices[i - 1] + ((0 - netGammas[i - 1]) * (scanPrices[i] - scanPrices[i - 1])) / (netGammas[i] - netGammas[i - 1]);
      break;
    }
  }

  // Update localized metrics directly into mgmt.json files
  const mgmtFile = `${dir}/mgmt.json`;
  let M = {};
  if (existsSync(mgmtFile)) {
    try { M = JSON.parse(readFileSync(mgmtFile, "utf8")); } catch (e) {}
  }

  M.gammaFlipStrike = r2(flipPrice);
  M.marketState = spot > flipPrice ? "LONG_GAMMA" : "SHORT_GAMMA";
  M.gammaProfileAsOf = d.last_trade_time || j.timestamp || new Date().toISOString();
  
  writeFileSync(mgmtFile, JSON.stringify(M, null, 2) + "\n");
  return `Flip strike estimated at $${M.gammaFlipStrike} (${M.marketState})`;
}

async function chain(dir, tick) {
  const j = await cboe(tick);
  const d = j.data || {};
  const spot = d.current_price || d.close || d.prev_day_close;
  if (!spot || !Array.isArray(d.options)) throw new Error("no chain");
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  today.setHours(0, 0, 0, 0);
  const by = new Map();
  for (const o of d.options) {
    const m = /^([A-Z.]+?)(\d{6})([CP])(\d{8})$/.exec(o.option || "");
    if (!m) continue;
    const exp = `20${m[2].slice(0, 2)}-${m[2].slice(2, 4)}-${m[2].slice(4, 6)}`;
    const days = (new Date(exp + "T00:00:00") - today) / 864e5;
    if (days < 0 || days > MAX_DAYS) continue;
    const k = +m[4] / 1000;
    if (k < spot * LO || k > spot * HI) continue;
    if (!by.has(exp)) by.set(exp, new Map());
    const row = by.get(exp).get(k) || { k };
    row[m[3]] = [r2(o.bid), r2(o.ask), r2(o.last_trade_price), o.volume || 0, o.open_interest || 0, r2(pctIV(o.iv)), r4(o.delta)];
    by.get(exp).set(k, row);
  }
  // nearest 6 expiries (dailies and weeklies), then the monthly (3rd Friday) ones further out
  const isMonthly = (e) => { const x = new Date(e + "T12:00:00Z"); return x.getUTCDay() === 5 && x.getUTCDate() >= 15 && x.getUTCDate() <= 21; };
  const all = [...by.keys()].sort();
  const exps = [...new Set([...all.slice(0, 6), ...all.filter(isMonthly)])].sort().slice(0, MAX_EXP);
  const E = [null, null, null, 0, 0, null, null];
  const out = {
    symbol: tick, spot: r2(spot), asof: d.last_trade_time || j.timestamp || null, trade_date: String(d.last_trade_time || "").slice(0, 10) || null, fetched: new Date().toISOString(),
    iv30: r2(pctIV(d.iv30)), iv30_change: r2(d.iv30_change), source: "Cboe delayed quotes (15 min)",
    // rows: [strike, call: bid, ask, last, volume, OI, IV %, delta, put: same 7]
    expiries: exps.map((e) => ({ d: e, rows: [...by.get(e).values()].sort((a, b) => a.k - b.k).map((r) => [r.k, ...(r.C || E), ...(r.P || E)]) })),
  };
  if (!out.expiries.length) throw new Error("no listed expiries in range");
  writeFileSync(`${dir}/data/options.json`, JSON.stringify(out));
  return `${out.expiries.length} expiries, ${out.expiries.reduce((s, e) => s + e.rows.length, 0)} strikes, IV30 ${out.iv30}`;
}

async function iv(dir, tick) {
  const f = `${dir}/vol.json`;
  let V = { symbol: tick, aq: [], cboe: [] };
  try { if (existsSync(f)) V = { ...V, ...JSON.parse(readFileSync(f, "utf8")) }; } catch (e) {}
  const merge = (arr, pts) => {
    const m = new Map(arr);
    for (const [k, v] of pts) if (v != null && isFinite(v) && v > 0) m.set(k, Math.round(v * 100) / 100);
    return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  };
  const notes = [];
  try {
    const r = await fetch(`https://alphaquery.com{encodeURIComponent(tick)}&perType=30-Day&identifier=iv-mean`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    const a = r.ok ? await r.json() : [];
    const pts = (Array.isArray(a) ? a : []).map((p) => [String(p.x).slice(0, 10), p.value * 100]);
    V.aq = merge(V.aq, pts);
    notes.push(`aq ${pts.length}`);
  } catch (e) { notes.push("aq failed: " + e.message); }
  try {
    const j = await cboe(tick);
    const d = j.data || {};
    // the quote's own trading day (the fetch timestamp can fall on a weekend)
    const date = String(d.last_trade_time || j.timestamp || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const v = pctIV(d.iv30);
    if (v) V.cboe = merge(V.cboe, [[date, v]]);
    notes.push(`cboe ${v ? v.toFixed(1) : "n/a"}`);
  } catch (e) { notes.push("cboe failed: " + e.message); }
