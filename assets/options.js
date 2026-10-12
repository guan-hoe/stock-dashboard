/* Options section, shared by every stock page.
   Reads (next to the page):
     data/options.json  option chain from Cboe's delayed quotes, refreshed with each price update
     vol.json           daily 30-day implied volatility history (alphaquery + Cboe IV30), recorded each day
     data/history.json  daily closes, for realized volatility
     mgmt.json          dealer positioning configurations and gamma chart metrics
   Draws realized vs implied volatility over the last 6 months (with the IV − RV spread),
   dealer gamma profile charts highlighting crossover points, summary cells and an option chain with an expiry picker, in EN / 中文.
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
      hGamma: "Dealer Gamma Profile", lGamma: "Net Gamma Exposure", lFlip: "Gamma Flip Strike",
      gState: (s, k) => `Market structural state: **${s}** (Zero crossing zone: $${k})`,
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
      hGamma: "交易商 Gamma 分布图", lGamma: "净 Gamma 敞口", lFlip: "Gamma 盈亏平衡点",
      gState: (s, k) => `市场结构状态: **${s}** (净敞口平衡线: $${k})`,
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

  let O = null, V = null, H = null, M = null, expSel = null, rng = "mid", volRange = 126, chart = null, gammaChart = null, failed = false;
  try { rng = localStorage.getItem("opt-rng") || "mid"; volRange = +localStorage.getItem("opt-vr") || 126; } catch (e) {}

  const st = document.createElement("style");
  st.textContent = `
  :root{--ivc:#c2410c;--rvc:#0b6fb8;--rv10:#94a3b8}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ivc:#fb923c;--rvc:#4fa8e8;--rv10:#64748b}}
  :root[data-theme="dark"]{--ivc:#fb923c;--rvc:#4fa8e8;--rv10:#64748b}
  #options .op-cells{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:16px}
  #options .op-split-layout{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
  @media(max-width:900px){#options .op-split-layout{grid-template-columns:1fr}}
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
  #options .gamma-main{height:390px}
  #options .vol-tip, #options .gamma-tip{font:500 11.5px var(--f-mono);color:var(--muted);min-height:17px;margin:2px 0 4px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  `;
  document.head.appendChild(st);

  host.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--muted);font-size:13px">${t("loading")}</div>`;

  function loadScript(src, cb) {
    if (window.LightweightCharts) return cb();
    const s = document.createElement("script"); s.src = src; s.async = true; s.onload = cb; document.head.appendChild(s);
  }

  // Load all data packages in a single parallel stream
  Promise.all([
    fetch("data/options.json").then((r) => r.json()).catch(() => null),
    fetch("vol.json").then((r) => r.json()).catch(() => null),
    fetch("data/history.json").then((r) => r.json()).catch(() => null),
    fetch("mgmt.json").then((r) => r.json()).catch(() => null),
  ]).then(([opt, vol, hist, mgmt]) => {
    if (!opt) { failed = true; host.innerHTML = `<div class="card" style="padding:24px;text-align:center;color:var(--muted);font-size:13px">${t("none")}</div>`; return; }
    O = opt; V = vol; H = hist; M = mgmt;
    loadScript(LW_SRC, render);
  });

  function render() {
  if (typeof navLink === "function") navLink();
  const ivFrom = V && (V.aq.length ? V.aq[0][0] : V.cboe.length ? V.cboe[0][0] : null);
  let cellSummary = (typeof cells === "function") ? cells() : "";

  host.innerHTML = `
    <h2>${t("h")}</h2>
    <p class="sub">${t("sub")}</p>
    ${cellSummary}
    
    <div class="op-split-layout">
      <!-- Left Pane: Volatility Metrics Analysis Group -->
      <div class="panel" style="margin-bottom:0">
        <div class="op-ctl">
          <h3 style="margin:0">${t("hVol")}</h3>
          <span class="gap"></span>
          ${[["3M", 63], ["6M", 126], ["1Y", 252]].map(([l, n]) => `<button type="button" class="vr" data-n="\${n}" aria-pressed="volRange === n">{l}</button>`).join("")}
        </div>
        <div class="lg">
          <span><i style="background:var(--ivc)"></i>${t("lIV")}</span>
          <span><i style="background:var(--rvc)"></i>${t("lRV30")}</span>
          <span><i style="background:var(--rv10)"></i>${t("lRV10")}</span>
          <span><i style="background:var(--up);height:8px;vertical-align:0"></i>${t("lSpr")}</span>
        </div>
        <div class="vol-tip" id="volTip"></div>
        <div class="vol-main" id="volMain"></div>
        <div class="vol-spr" id="volSpr"><span class="lab2">IV − RV30</span></div>
        ${ivFrom ? `<p class="op-note" style="margin-bottom:0">\${esc(t("ivNote")(dlong(ivFrom)))}</p>` : ""}
      </div>
      
      <!-- Right Pane: Dealer Options Gamma Profile Mapping Grid -->
      <div class="panel" style="margin-bottom:0">
        <h3 style="margin:0 0 4px">${t("hGamma")}</h3>
        <div class="gamma-tip">—</div>
        <div class="gamma-main" id="gammaChartContainer" style="height:390px; min-height:390px; width:100%"></div>
      </div>
    </div>
    
    <h3 style="margin:20px 0 8px">${t("hChain")}</h3>
    <div id="chainBox">${(typeof chainHTML === "function") ? chainHTML() : ""}</div>
  `;

  if (typeof drawVol === "function") drawVol();
  drawGammaChart();
}


function drawGammaChart() {
  const el = document.getElementById("gammaChartContainer");
  const tip = host.querySelector(".gamma-tip");
  
  if (!el || !M || !M.gammaChartData || !M.gammaChartData.length) {
    if (el) el.innerHTML = `<div style="text-align:center;padding-top:150px;color:var(--muted);font-size:12px">No structural Gamma exposure metrics recorded.</div>`;
    return;
  }
  
  if (tip && M.marketState) {
    tip.innerHTML = t("gState")(M.marketState, kfmt(M.gammaFlipStrike));
  }
  
  const sorted = [...M.gammaChartData].sort((a, b) => a.price - b.price);
  
  const chartData = sorted.map((pt, i) => {
    const d = new Date(2026, 0, i + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return {
      time: `${y}-${m}-${day}`,
      value: pt.netGamma,
      actualPrice: pt.price
    };
  });
  
  gammaChart = LightweightCharts.createChart(el, {
    width: el.clientWidth || 400,
    height: 390,
    layout: { background: { color: "transparent" }, textColor: css("--muted"), fontFamily: css("--f-mono") },
    grid: { vertLines: { color: "transparent" }, horzLines: { color: css("--line") } },
    rightPriceScale: { borderVisible: false },
    timeScale: {
      borderVisible: false,
      tickMarkFormatter: (time) => {
        const str = `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
        const match = chartData.find(d => d.time === str);
        return match ? `$${kfmt(match.actualPrice)}` : "";
      }
    },
    crosshair: { mode: 0 }
  });
  
  const area = gammaChart.addAreaSeries({
    topColor: "rgba(16, 185, 129, 0.2)",
    bottomColor: "rgba(239, 68, 68, 0.2)",
    lineColor: css("--accent") || "#3b82f6",
    lineWidth: 2,
    pointRadius: 0
  });
  
  area.setData(chartData);
  
  area.createPriceLine({
    price: 0,
    color: "#ef4444",
    lineWidth: 1,
    lineStyle: 2,
    axisLabelVisible: true,
    title: "Zero Line"
  });
  
  gammaChart.timeScale().fitContent();
  
  gammaChart.subscribeCrosshairMove((param) => {
    if (!param || !param.time || !param.seriesData.get(area)) {
      if (tip && M.marketState) tip.innerHTML = t("gState")(M.marketState, kfmt(M.gammaFlipStrike));
      return;
    }
    const str = `${param.time.year}-${String(param.time.month).padStart(2, "0")}-${String(param.time.day).padStart(2, "0")}`;
    const match = chartData.find(d => d.time === str);
    if (match) {
      tip.innerHTML = `${t("strike")}: **$${kfmt(match.actualPrice)}** · ${t("lGamma")}: **${Math.round(match.value).toLocaleString()}**`;
    }
  });
  
  window.addEventListener("resize", () => { if (gammaChart && el) gammaChart.resize(el.clientWidth, 390); });
}

// Placeholder hooks ensuring internal methods remain safe if defined further down
if (typeof drawVol !== "function") window.drawVol = function(){};
if (typeof cells !== "function") window.cells = function(){ return ""; };
if (typeof chainHTML !== "function") window.chainHTML = function(){ return ""; };
if (typeof navLink !== "function") window.navLink = function(){};
})();
