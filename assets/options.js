/* Options section, shared by every stock page.
   Reads (next to the page):
     data/options.json  option chain from Cboe's delayed quotes, refreshed with each price update
     vol.json           daily 30-day implied volatility history (alphaquery + Cboe IV30), recorded each day
     data/history.json  daily closes, for realized volatility
   Draws realized vs implied volatility over the last 6 months (with the IV − RV spread),
   summary cells and an option chain with an expiry picker, in EN / 中文.
   Uses a <section id="options"> if the page has one, otherwise adds it after the technicals section. */
(function () {
  let host = document.getElementById("options");
  if (!host) {
    host = document.createElement("section");
    host.id = "options";
    const after = document.getElementById("technicals") || document.getElementById("price");
    if (!after) return;
    after.after(host);
  }
  host.setAttribute("aria-label", "Options");
  const LW_SRC = "https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js";

  const L = {
    en: {
      nav: "Options", h: "Options and volatility",
      sub: "Realized volatility is how much the stock has actually moved; implied volatility is what option prices expect over the next 30 days. When implied sits above realized, options are priced rich relative to recent moves.",
      kIV: "Implied vol (30-day)", sIV: (c) => `Cboe IV30 · ${c} today`,
      kRV: "Realized vol (30-day)", sRV: (x) => `close-to-close, annualized · 10-day ${x}`,
      kRatio: "IV ÷ RV", sRich: "options priced rich vs. recent moves", sCheap: "options priced cheap vs. recent moves", sFair: "in line with recent moves",
      kRank: "IV rank", sRank: (lo, hi, from) => `range ${lo}–${hi}% since ${from}`,
      kMove: "Expected move", sMove: (d, n) => `by ${d} (${n}d) · ATM straddle`,
      kPC: "Put / call open interest", sPC: (p, c) => `${p} puts · ${c} calls`,
      hVol: "Realized vs. implied volatility", lRV30: "Realized 30-day", lRV10: "Realized 10-day", lIV: "Implied 30-day", lIVc: "Cboe IV30", lSpr: "IV − RV30 (lower pane)",
      ivNote: (from) => `Implied volatility history starts ${from}, the furthest back the free source goes; it is recorded every trading day from now on, so the chart fills to the full 6 months by itself. Realized volatility is computed from daily closes.`,
      hChain: "Option chain", exp: "Expiry", range: "Strikes", near: "±10%", mid: "±20%", all: "All",
      calls: "Calls", puts: "Puts", strike: "Strike", bid: "Bid", ask: "Ask", last: "Last", vol: "Vol", oi: "OI", iv: "IV", dl: "Δ",
      spot: (p) => `Share price ${p}`, dte: (n) => `${n}d`,
      asof: (t) => `Cboe delayed quotes, 15 minutes behind · ${t} ET. IV and delta are Cboe's. Shaded cells are in the money.`,
      none: "No listed options found for this stock yet.", loading: "Loading options…",
      note: "Option data is for information only, not a recommendation. Quotes are delayed and spreads can be wide away from the money.",
      monthly: "M",
    },
    zh: {
      nav: "期权", h: "期权与波动率",
      sub: "已实现波动率是股价实际的波动幅度；隐含波动率是期权价格所反映的未来 30 天预期波动。隐含高于已实现时，期权相对近期走势偏贵。",
      kIV: "隐含波动率（30日）", sIV: (c) => `Cboe IV30 · 今日 ${c}`,
      kRV: "已实现波动率（30日）", sRV: (x) => `收盘价计算，年化 · 10日 ${x}`,
      kRatio: "IV ÷ RV", sRich: "期权相对近期波动偏贵", sCheap: "期权相对近期波动偏便宜", sFair: "与近期波动相当",
      kRank: "IV 排位", sRank: (lo, hi, from) => `自 ${from} 区间 ${lo}–${hi}%`,
      kMove: "预期波动", sMove: (d, n) => `至 ${d}（${n} 天）· 平值跨式`,
      kPC: "认沽 / 认购 未平仓", sPC: (p, c) => `认沽 ${p} · 认购 ${c}`,
      hVol: "已实现与隐含波动率", lRV30: "30日已实现", lRV10: "10日已实现", lIV: "30日隐含", lIVc: "Cboe IV30", lSpr: "IV − RV30（下方）",
      ivNote: (from) => `隐含波动率历史始于 ${from}，为免费数据源可提供的最早日期；此后每个交易日自动记录，图表会自行补满 6 个月。已实现波动率按每日收盘价计算。`,
      hChain: "期权链", exp: "到期日", range: "行权价", near: "±10%", mid: "±20%", all: "全部",
      calls: "认购", puts: "认沽", strike: "行权价", bid: "买价", ask: "卖价", last: "最新", vol: "成交", oi: "未平仓", iv: "IV", dl: "Δ",
      spot: (p) => `股价 ${p}`, dte: (n) => `${n}天`,
      asof: (t) => `Cboe 延时报价，延迟 15 分钟 · 美东 ${t}。IV 与 Delta 由 Cboe 计算。阴影为价内。`,
      none: "暂未找到该股票的上市期权。", loading: "正在载入期权数据…",
      note: "期权数据仅供参考，不构成建议。报价有延迟，价外合约买卖价差可能较大。",
      monthly: "月",
    },
  };
  const lang = () => (document.documentElement.lang || "en").startsWith("zh") ? "zh" : "en";
  const t = (k) => L[lang()][k];
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dshort = (s) => { const [y, m, d] = s.split("-").map(Number); return lang() === "zh" ? `${m}月${d}日` : `${MON[m - 1]} ${d}`; };
  const dlong = (s) => { const [y, m, d] = s.split("-").map(Number); return lang() === "zh" ? `${y}年${m}月${d}日` : `${MON[m - 1]} ${d}, ${y}`; };
  const px = (v) => v == null || !isFinite(v) ? "—" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v >= 100 ? v.toFixed(1) : v.toFixed(2);
  const money = (v) => v == null ? "—" : "$" + (v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v.toFixed(2));
  const kfmt = (k) => k % 1 ? k.toFixed(k * 10 % 1 ? 2 : 1) : k.toLocaleString("en-US");
  const int = (v) => !v ? "—" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e4 ? Math.round(v / 1e3) + "K" : v.toLocaleString("en-US");
  const pctS = (v, dp = 1) => v == null || !isFinite(v) ? "—" : v.toFixed(dp) + "%";
  const daysTo = (s) => { const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" })); ny.setHours(0, 0, 0, 0); return Math.max(0, Math.round((new Date(s + "T00:00:00") - ny) / 864e5)); };
  const isMonthly = (s) => { const d = new Date(s + "T00:00:00"); return d.getDay() === 5 && d.getDate() >= 15 && d.getDate() <= 21; };

  let O = null, V = null, H = null, expSel = null, rng = "mid", volRange = 126, chart = null, failed = false;
  try { rng = localStorage.getItem("opt-rng") || "mid"; volRange = +localStorage.getItem("opt-vr") || 126; } catch (e) {}

  const st = document.createElement("style");
  st.textContent = `
  :root{--ivc:#c2410c;--rvc:#0b6fb8;--rv10:#94a3b8}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ivc:#fb923c;--rvc:#4fa8e8;--rv10:#64748b}}
  :root[data-theme="dark"]{--ivc:#fb923c;--rvc:#4fa8e8;--rv10:#64748b}
  #options .op-cells{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:16px}
  #options h3{font:600 15px var(--f-body);margin:0 0 8px}
  #options .op-ctl{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
  #options .op-ctl button{font:500 11.5px var(--f-mono);border:1px solid var(--line);background:transparent;color:var(--muted);padding:3px 8px;border-radius:4px;cursor:pointer;white-space:nowrap}
  #options .op-ctl button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
  #options .op-ctl button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
  #options .op-ctl .lab{white-space:nowrap;font:500 11px var(--f-mono);color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-right:4px}
  #options .op-ctl .gap{flex:1}
  #options .op-ctl button sup{font-size:8.5px;margin-left:2px;opacity:.8}
  #options .op-exp{overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;scrollbar-width:thin}
  #options .lg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-bottom:6px}
  #options .lg i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:3px;margin-right:5px}
  #options .vol-main{height:300px}#options .vol-spr{height:90px;border-top:1px dashed var(--line);position:relative}
  #options .vol-spr .lab2{position:absolute;left:4px;top:3px;z-index:2;font:600 10px var(--f-mono);color:var(--muted);letter-spacing:.06em;pointer-events:none}
  #options .vol-tip{font:500 11.5px var(--f-mono);color:var(--muted);min-height:17px;margin:2px 0 4px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #options .op-note{font-size:12px;color:var(--muted);margin:10px 0 0;max-width:100ch;line-height:1.55}
  #options table.chain{min-width:760px;font-size:12.5px}
  #options table.chain th,#options table.chain td{padding:5px 7px;text-align:right;white-space:nowrap}
  #options table.chain td.k,#options table.chain th.k{text-align:center;font-weight:600;background:color-mix(in srgb,var(--muted) 10%,transparent);position:sticky;left:0;z-index:1}
  #options table.chain td.k{background:var(--panel);box-shadow:inset 0 0 0 999px color-mix(in srgb,var(--muted) 10%,transparent)}
  #options table.chain td.itm{background:color-mix(in srgb,var(--accent) 8%,transparent)}
  #options table.chain tr.spot td{padding:0;height:0;border:0;position:relative;z-index:2}
  #options table.chain tr.spot td div{border-top:2px solid var(--copper);position:relative;height:0}
  #options table.chain tr.spot td.k div span{position:absolute;z-index:3;left:50%;transform:translate(-50%,-50%);background:var(--copper);color:#fff;font:600 10.5px var(--f-mono);padding:1px 6px;border-radius:3px;white-space:nowrap}
  #options table.chain thead tr.grp th{font:600 11px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink);text-align:center;border-bottom:none}
  #options table.chain .dim{color:var(--muted)}
  @media (max-width:700px){#options table.chain{min-width:0}#options table.chain .xm{display:none}#options table.chain th,#options table.chain td{padding:5px 4px}}
  @media (max-width:480px){#options table.chain .xs{display:none}}
  `;
  document.head.appendChild(st);

  // ---------- volatility math ----------
  function rv(c, n) {
    const r = c.map((x, i) => i ? Math.log(x / c[i - 1]) : null);
    const o = Array(c.length).fill(null);
    for (let i = n; i < c.length; i++) {
      const w = r.slice(i - n + 1, i + 1);
      const m = w.reduce((s, x) => s + x, 0) / n;
      o[i] = Math.sqrt(w.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1) * 252) * 100;
    }
    return o;
  }
  function chainStats() {
    if (!O || !O.expiries.length) return {};
    let poi = 0, coi = 0;
    O.expiries.forEach((e) => e.rows.forEach((r) => { coi += r[5] || 0; poi += r[12] || 0; }));
    // expected move to the first expiry at least 7 days out: ATM call + put mid
    const e = O.expiries.find((x) => daysTo(x.d) >= 7) || O.expiries[0];
    let atm = null;
    e.rows.forEach((r) => { if (!atm || Math.abs(r[0] - O.spot) < Math.abs(atm[0] - O.spot)) atm = r; });
    const mid = (b, a, l) => b > 0 && a > 0 ? (b + a) / 2 : l || null;
    const c = atm && mid(atm[1], atm[2], atm[3]), p = atm && mid(atm[8], atm[9], atm[10]);
    return { poi, coi, move: c && p ? c + p : null, moveExp: e.d };
  }

  // ---------- render ----------
  function navLink() {
    const nav = document.querySelector("nav.sec"); if (!nav) return;
    let a = nav.querySelector('a[href="#options"]');
    if (!a) {
      a = document.createElement("a"); a.href = "#options";
      const after = nav.querySelector('a[href="#technicals"]') || nav.querySelector('a[href="#price"]');
      after ? after.after(a) : nav.appendChild(a);
    }
    a.textContent = t("nav");
  }

  function cells() {
    const out = [];
    const ivNow = O && O.iv30 || (V && V.cboe && V.cboe.length ? V.cboe.at(-1)[1] : null) || (V && V.aq && V.aq.length ? V.aq.at(-1)[1] : null);
    const R30 = H ? rv(H.c, 30).at(-1) : null, R10 = H ? rv(H.c, 10).at(-1) : null;
    const chg = O && O.iv30_change;
    out.push([t("kIV"), pctS(ivNow), O && O.iv30 ? t("sIV")((chg > 0 ? "+" : "") + (chg ?? 0).toFixed(1)) : "", ""]);
    out.push([t("kRV"), pctS(R30), t("sRV")(pctS(R10)), ""]);
    if (ivNow && R30) {
      const x = ivNow / R30;
      out.push([t("kRatio"), x.toFixed(2) + "×", x > 1.1 ? t("sRich") : x < 0.9 ? t("sCheap") : t("sFair"), ""]);
    }
    const hist = V && (V.aq.length ? V.aq : V.cboe);
    if (hist && hist.length >= 10 && ivNow) {
      const vs = hist.map((p) => p[1]), lo = Math.min(...vs, ivNow), hi = Math.max(...vs, ivNow);
      out.push([t("kRank"), Math.round((ivNow - lo) / (hi - lo || 1) * 100) + "", t("sRank")(lo.toFixed(0), hi.toFixed(0), dshort(hist[0][0])), ""]);
    }
    const S = chainStats();
    if (S.move) out.push([t("kMove"), "±" + money(S.move), `±${(S.move / O.spot * 100).toFixed(1)}% · ` + t("sMove")(dshort(S.moveExp), daysTo(S.moveExp)), ""]);
    if (S.coi) out.push([t("kPC"), (S.poi / S.coi).toFixed(2), t("sPC")(int(S.poi), int(S.coi)), ""]);
    return `<div class="cells op-cells">${out.map(([k, v, s, c]) => `<div class="cell"><div class="k">${k}</div><div class="v ${c}">${v}</div><div class="s">${s}</div></div>`).join("")}</div>`;
  }

  function chainHTML() {
    if (!O || !O.expiries || !O.expiries.length) return `<div class="panel"><p class="sub" style="margin:0">${failed ? t("none") : t("loading")}</p></div>`;
    if (!expSel || !O.expiries.some((e) => e.d === expSel)) expSel = (O.expiries.find((e) => daysTo(e.d) >= 7 && isMonthly(e.d)) || O.expiries.find((e) => daysTo(e.d) >= 7) || O.expiries[0]).d;
    const e = O.expiries.find((x) => x.d === expSel);
    const w = rng === "near" ? 0.1 : rng === "mid" ? 0.2 : 9;
    const rows = e.rows.filter((r) => Math.abs(r[0] / O.spot - 1) <= w);
    const yr = new Date().getFullYear();
    const chips = O.expiries.map((x) => {
      const [y] = x.d.split("-").map(Number);
      return `<button type="button" class="ex" data-d="${x.d}" aria-pressed="${x.d === expSel}">${dshort(x.d)}${y !== yr ? " '" + String(y).slice(2) : ""} <span class="dim">${t("dte")(daysTo(x.d))}</span>${isMonthly(x.d) ? `<sup>${t("monthly")}</sup>` : ""}</button>`;
    }).join("");
    const cell = (v, f, itm, cls = "") => `<td class="${cls}${itm ? " itm" : ""}">${v == null ? "—" : f(v)}</td>`;
    const nc = innerWidth <= 480 ? 3 : innerWidth <= 700 ? 4 : 7; // visible columns per side (matches the CSS breakpoints)
    let body = "", placed = false;
    rows.forEach((r) => {
      if (!placed && r[0] >= O.spot) { body += `<tr class="spot"><td colspan="${nc}"><div></div></td><td class="k"><div><span>${esc(money(O.spot))}</span></div></td><td colspan="${nc}"><div></div></td></tr>`; placed = true; }
      const ci = r[0] < O.spot, pi = r[0] > O.spot;
      body += `<tr>
        ${cell(r[1], px, ci)}${cell(r[2], px, ci)}${cell(r[3], px, ci, "xm ")}${cell(r[4], int, ci, "xm ")}${cell(r[5], int, ci, "xs ")}${cell(r[6], (v) => v.toFixed(1), ci)}${cell(r[7], (v) => v.toFixed(2), ci, "xm ")}
        <td class="k">${kfmt(r[0])}</td>
        ${cell(r[14], (v) => v.toFixed(2), pi, "xm ")}${cell(r[13], (v) => v.toFixed(1), pi)}${cell(r[12], int, pi, "xs ")}${cell(r[11], int, pi, "xm ")}${cell(r[10], px, pi, "xm ")}${cell(r[8], px, pi)}${cell(r[9], px, pi)}
      </tr>`;
    });
    if (!placed) body += `<tr class="spot"><td colspan="${nc}"><div></div></td><td class="k"><div><span>${esc(money(O.spot))}</span></div></td><td colspan="${nc}"><div></div></td></tr>`;
    const asof = O.asof ? String(O.asof).replace("T", " ").slice(0, 16) : "";
    return `
      <div class="op-ctl op-exp" role="group" aria-label="${t("exp")}"><span class="lab">${t("exp")}</span>${chips}</div>
      <div class="op-ctl" role="group" aria-label="${t("range")}"><span class="lab">${t("range")}</span>
        ${["near", "mid", "all"].map((k) => `<button type="button" class="rg" data-r="${k}" aria-pressed="${rng === k}">${t(k)}</button>`).join("")}
      </div>
      <div class="panel tbl">
        <table class="chain">
          <thead>
            <tr class="grp"><th colspan="${nc}">${t("calls")}</th><th class="k"></th><th colspan="${nc}">${t("puts")}</th></tr>
            <tr><th>${t("bid")}</th><th>${t("ask")}</th><th class="xm">${t("last")}</th><th class="xm">${t("vol")}</th><th class="xs">${t("oi")}</th><th>${t("iv")}</th><th class="xm">${t("dl")}</th>
              <th class="k">${t("strike")}</th>
              <th class="xm">${t("dl")}</th><th>${t("iv")}</th><th class="xs">${t("oi")}</th><th class="xm">${t("vol")}</th><th class="xm">${t("last")}</th><th>${t("bid")}</th><th>${t("ask")}</th></tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <p class="op-note">${esc(t("asof")(asof))} ${esc(t("note"))}</p>`;
  }

  function render() {
    navLink();
    const ivFrom = V && (V.aq.length ? V.aq[0][0] : V.cboe.length ? V.cboe[0][0] : null);
    host.innerHTML = `
      <h2>${t("h")}</h2>
      <p class="sub">${t("sub")}</p>
      ${cells()}
      <div class="panel">
        <div class="op-ctl"><h3 style="margin:0">${t("hVol")}</h3><span class="gap"></span>
          ${[["3M", 63], ["6M", 126], ["1Y", 252]].map(([l, n]) => `<button type="button" class="vr" data-n="${n}" aria-pressed="${volRange === n}">${l}</button>`).join("")}
        </div>
        <div class="lg"><span><i style="background:var(--ivc)"></i>${t("lIV")}</span><span><i style="background:var(--rvc)"></i>${t("lRV30")}</span><span><i style="background:var(--rv10)"></i>${t("lRV10")}</span><span><i style="background:var(--up);height:8px;vertical-align:0"></i>${t("lSpr")}</span></div>
        <div class="vol-tip" id="volTip"></div>
        <div class="vol-main" id="volMain"></div>
        <div class="vol-spr" id="volSpr"><span class="lab2">IV − RV30</span></div>
        ${ivFrom ? `<p class="op-note">${esc(t("ivNote")(dlong(ivFrom)))}</p>` : ""}
      </div>
      <h3 style="margin:20px 0 8px">${t("hChain")}</h3>
      <div id="chainBox">${chainHTML()}</div>`;
    drawVol();
  }

  function rerenderChain() { const b = host.querySelector("#chainBox"); if (b) b.innerHTML = chainHTML(); }

  host.addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.classList.contains("ex")) { expSel = b.dataset.d; rerenderChain(); }
    else if (b.classList.contains("rg")) { rng = b.dataset.r; try { localStorage.setItem("opt-rng", rng); } catch (e) {} rerenderChain(); }
    else if (b.classList.contains("vr")) { volRange = +b.dataset.n; try { localStorage.setItem("opt-vr", String(volRange)); } catch (e) {} host.querySelectorAll(".vr").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.n === volRange)); drawVol(); }
  });

  function drawVol() {
    const LW = window.LightweightCharts, mb = host.querySelector("#volMain"), sb = host.querySelector("#volSpr"), tip = host.querySelector("#volTip");
    if (!LW || !mb || !H) return;
    if (chart) { chart.forEach((c) => c.remove()); chart = null; }
    mb.innerHTML = ""; sb.querySelectorAll("div.tv-lightweight-charts").forEach((x) => x.remove());
    const d = H.d, n = d.length, R30 = rv(H.c, 30), R10 = rv(H.c, 10);
    const ivMap = new Map(V && V.aq ? V.aq : []);
    const cbMap = new Map(V && V.cboe ? V.cboe : []);
    const iv = d.map((x) => ivMap.get(x) ?? cbMap.get(x) ?? null);
    if (O && O.iv30 && (O.trade_date || O.asof)) { const k = String(O.trade_date || O.asof).slice(0, 10); const i = d.indexOf(k); if (i >= 0 && iv[i] == null) iv[i] = O.iv30; }
    const from = Math.max(0, n - volRange);
    const ln = (arr) => arr.map((v, i) => i < from ? null : v == null ? { time: d[i] } : { time: d[i], value: Math.round(v * 10) / 10 }).filter(Boolean);
    const ink = css("--ink"), muted = css("--muted"), line = css("--line"), upC = css("--up"), dnC = css("--down");
    const base = {
      autoSize: true, layout: { background: { type: "solid", color: "transparent" }, textColor: muted, fontFamily: css("--f-mono") || "monospace", fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: line } }, rightPriceScale: { borderVisible: false }, crosshair: { mode: 0 },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true }, handleScroll: false, handleScale: false,
      localization: { locale: "en-US", priceFormatter: (v) => v.toFixed(0) + "%" },
    };
    const m = LW.createChart(mb, base);
    const sIV = m.addLineSeries({ color: css("--ivc"), lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    const sR30 = m.addLineSeries({ color: css("--rvc"), lineWidth: 2, priceLineVisible: false, lastValueVisible: true });
    const sR10 = m.addLineSeries({ color: css("--rv10"), lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    sR10.setData(ln(R10)); sR30.setData(ln(R30)); sIV.setData(ln(iv));
    const s = LW.createChart(sb, { ...base, timeScale: { ...base.timeScale, visible: false }, rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.15, bottom: 0.05 } } });
    const hs = s.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
    // one point per date (blank where IV is missing) so both panes share the same bar positions
    hs.setData(d.map((x, i) => i < from ? null : iv[i] == null || R30[i] == null ? { time: x } : { time: x, value: Math.round((iv[i] - R30[i]) * 10) / 10, color: (iv[i] >= R30[i] ? upC : dnC) + "aa" }).filter(Boolean));
    hs.createPriceLine({ price: 0, color: line, lineWidth: 1, axisLabelVisible: false });
    m.timeScale().fitContent(); s.timeScale().fitContent();
    chart = [m, s];
    let lock = false;
    chart.forEach((a) => a.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (lock || !r) return; lock = true; chart.forEach((b) => b !== a && b.timeScale().setVisibleLogicalRange(r)); lock = false; }));
    const show = (i) => {
      if (i == null || i < 0) i = n - 1;
      const f = (v) => v == null ? "—" : v.toFixed(1) + "%";
      const spr = iv[i] != null && R30[i] != null ? iv[i] - R30[i] : null;
      tip.innerHTML = `${esc(dlong(d[i]))} &nbsp; <span style="color:var(--ivc)">IV ${f(iv[i])}</span> &nbsp; <span style="color:var(--rvc)">RV30 ${f(R30[i])}</span> &nbsp; RV10 ${f(R10[i])}` + (spr != null ? ` &nbsp; <span class="${spr >= 0 ? "up" : "down"}">${spr >= 0 ? "+" : "−"}${Math.abs(spr).toFixed(1)}</span>` : "");
    };
    chart.forEach((c) => c.subscribeCrosshairMove((p) => show(p && p.time ? d.indexOf(p.time) : null)));
    show(null);
    void ink;
  }

  // ---------- data ----------
  async function getJSON(u) { try { const r = await fetch(u + (u.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
  function ensureLW() {
    if (window.LightweightCharts) return Promise.resolve();
    const ex = [...document.scripts].find((s) => s.src === LW_SRC);
    return new Promise((res) => {
      const s = ex || document.createElement("script");
      if (!ex) { s.src = LW_SRC; document.head.appendChild(s); }
      s.addEventListener("load", res); s.addEventListener("error", res);
      const iv = setInterval(() => { if (window.LightweightCharts) { clearInterval(iv); res(); } }, 200);
    });
  }
  async function load() {
    const [o, v, h] = await Promise.all([getJSON("data/options.json"), getJSON("vol.json"), getJSON("data/history.json")]);
    if (o && o.expiries) O = o; else failed = true;
    if (v) V = { aq: v.aq || [], cboe: v.cboe || [] };
    if (h && h.d && h.d.length > 40) H = { d: h.d, c: h.c };
  }

  (async () => {
    render();
    await Promise.all([ensureLW(), load()]);
    render();
    setInterval(async () => { if (document.hidden) return; await load(); const y = window.scrollY; render(); window.scrollTo(0, y); }, 300000);
    let lastLang = lang(), lastTheme = document.documentElement.getAttribute("data-theme");
    new MutationObserver(() => {
      const lg = lang(), th = document.documentElement.getAttribute("data-theme");
      if (lg !== lastLang) { lastLang = lg; render(); }
      else if (th !== lastTheme) { lastTheme = th; drawVol(); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang", "data-theme"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => drawVol());
  })();
})();
