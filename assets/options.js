/* Options section, shared by every stock page.
   Reads (next to the page):
     /data/options.json  option chain from Cboe's delayed quotes, refreshed with each price update
     /vol.json           daily 30-day implied volatility history (alphaquery + Cboe IV30), recorded each day
     /data/history.json  daily closes, for realized volatility
     /mgmt.json          dealer positioning configurations and gamma chart metrics
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
  const LW_SRC = "https://jsdelivr.net";

  const L = {
    en: {
      nav: "Options", h: "Options and volatility",
      sub: "Realized volatility is how much the stock has actually moved; implied volatility is what option prices expect over the next 30 days. When implied sits above realized, options are priced rich relative to recent moves.",
      kIV: "Implied vol (30-day)", sIV: (c) => `Cboe IV30 · ${c} today`,
      kRV: "Realized vol (30-day)", sRV: (x) => `close-to-close, annualized · 10-day ${x}`,
      kRatio: "IV ÷ RV", sRich: "options priced rich vs. recent moves", sCheap: "options priced cheap vs. recent moves", sFair: "in line with recent moves",
      kRank: "IV rank", sRank: (lo, hi, from) => `range ${lo}–${hi}% since ${from}`,
      kMove: "Expected move", sMove: (d, n) => `by ${d} (${n}d) · ATM straddle`,
      kPC: "Put / call open interest",
      kPCSub: "ratio of total open contracts",
      kGamma: "Net dealer gamma", sGamma: "aggregated exposure across all expirations",
      tExpiry: "Expiration", tStrike: "Strike", tCalls: "Calls", tPuts: "Puts",
      tBid: "Bid", tAsk: "Ask", tVol: "Vol", tOI: "OI"
    },
    zh: {
      nav: "期权", h: "期权与波动率",
      sub: "历史波动率（RV）反映股票实际的涨跌幅度；隐含波动率（IV）则体现期权价格对未来30天波动的预期。当IV高于RV时，意味着期权溢价相对近期走势偏高。",
      kIV: "隐含波动率 (30天)", sIV: (c) => `Cboe IV30 · 今日 ${c}`,
      kRV: "历史波动率 (30天)", sRV: (x) => `收盘价年化 · 10天 ${x}`,
      kRatio: "IV ÷ RV 比率", sRich: "期权估值偏高 (相对近期走势)", sCheap: "期权估值偏低 (相对近期走势)", sFair: "与近期走势基本持平",
      kRank: "IV 百分位 (Rank)", sRank: (lo, hi, from) => `自 ${from} 以来范围 ${lo}–${hi}%`,
      kMove: "预期波动范围", sMove: (d, n) => `${n}天内幅度 ${d} · 平值跨式期权`,
      kPC: "看跌/看涨未平仓比 (PCR)", kPCSub: "总未平仓合约比例",
      kGamma: "交易商净 Gamma 敞口", sGamma: "所有到期日聚合风险敞口",
      tExpiry: "到期日", tStrike: "行权价", tCalls: "看涨期权 (Calls)", tPuts: "看跌期权 (Puts)",
      tBid: "买入价", tAsk: "卖出价", tVol: "成交量", tOI: "持仓量"
    }
  };

  // Determine language (default to English)
  const lang = (navigator.language || navigator.userLanguage).startsWith("zh") ? "zh" : "en";
  const text = L[lang];

  // Helper to load external scripts asynchronously
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.LightweightCharts) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Create UI Structure
  host.innerHTML = `
    <style>
      #options { font-family: system-ui, -apple-system, sans-serif; padding: 20px 0; color: #333; }
      #options h2 { margin-bottom: 5px; font-size: 1.5rem; }
      #options .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 20px; line-height: 1.4; }
      .opt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px; }
      .opt-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; }
      .opt-card h4 { margin: 0 0 5px 0; font-size: 0.85rem; color: #6c757d; text-transform: uppercase; }
      .opt-card .val { font-size: 1.4rem; font-weight: bold; margin-bottom: 4px; }
      .opt-card .desc { font-size: 0.75rem; color: #6c757d; }
      .chart-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin-bottom: 25px; }
      .chart-box { border: 1px solid #e9ecef; border-radius: 6px; padding: 10px; background: #fff; height: 300px; position: relative; }
      .chain-controls { margin-bottom: 15px; display: flex; align-items: center; gap: 10px; }
      .chain-table-wrapper { overflow-x: auto; border: 1px solid #e9ecef; border-radius: 6px; }
      .chain-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: center; }
      .chain-table th { background: #f1f3f5; padding: 8px; font-weight: 600; border-bottom: 2px solid #dee2e6; }
      .chain-table td { padding: 8px; border-bottom: 1px solid #eee; }
      .chain-table tr:hover { background: #f8f9fa; }
      .strike-col { font-weight: bold; background: #f8f9fa; border-left: 1px solid #dee2e6; border-right: 1px solid #dee2e6; }
      .call-side { background: rgba(40, 167, 69, 0.02); }
      .put-side { background: rgba(220, 53, 69, 0.02); }
    </style>
    <h2>${text.h}</h2>
    <div class="subtitle">${text.sub}</div>
    <div class="opt-grid" id="opt-summary"></div>
    <div class="chart-container">
      <div>
        <h4 style="margin: 0 0 8px 0; font-size:0.9rem; color:#495057;">Volatility History (6M)</h4>
        <div class="chart-box" id="vol-chart"></div>
      </div>
      <div>
        <h4 style="margin: 0 0 8px 0; font-size:0.9rem; color:#495057;">Dealer Gamma Profile</h4>
        <div class="chart-box" id="gamma-chart"></div>
      </div>
    </div>
    <div class="chain-controls">
      <label for="expiry-select" style="font-size:0.9rem; font-weight:bold;">${text.tExpiry}:</label>
      <select id="expiry-select" style="padding:4px 8px; border-radius:4px; border:1px solid #ccc;"></select>
    </div>
    <div class="chain-table-wrapper" id="chain-wrapper"></div>
  `;

  // Fetch metrics data asynchronously from absolute paths
  async function init() {
    try {
      await loadScript(LW_SRC);
      
      const [optData, volData, histData, mgmtData] = await Promise.all([
        fetch("/data/options.json").then(res => res.json()).catch(() => ({})),
        fetch("/vol.json").then(res => res.json()).catch(() => []),
        fetch("/data/history.json").then(res => res.json()).catch(() => []),
        fetch("/mgmt.json").then(res => res.json()).catch(() => ({}))
      ]);

      renderSummary(optData, volData, histData, mgmtData);
      renderVolChart(volData, histData);
      renderGammaChart(mgmtData);
      renderOptionChain(optData);
    } catch (err) {
      console.error("Error initializing dashboard components: ", err);
    }
  }

  function renderSummary(options, vol, history, mgmt) {
    const summaryHost = document.getElementById("opt-summary");
    if (!summaryHost) return;
    
    const currentIV = vol.length ? vol[vol.length - 1].value : 0;
    const currentRV = mgmt.currentRV10d || 0; 
    const ivRvRatio = currentRV > 0 ? (currentIV / currentRV).toFixed(2) : "N/A";
    
    let ratioDesc = text.sFair;
    if (ivRvRatio !== "N/A") {
      if (parseFloat(ivRvRatio) > 1.1) ratioDesc = text.sRich;
      else if (parseFloat(ivRvRatio) < 0.9) ratioDesc = text.sCheap;
    }

    const ivRank = mgmt.ivRank !== undefined ? `${mgmt.ivRank}%` : "N/A";
    const expectedMove = mgmt.expectedMove ? `${mgmt.expectedMove}` : "N/A";

    summaryHost.innerHTML = `
      <div class="opt-card">
        <h4>${text.kIV}</h4>
        <div class="val">${currentIV ? (currentIV * 100).toFixed(1) + "%" : "N/A"}</div>
        <div class="desc">${text.sIV(currentIV ? "Realtime" : "N/A")}</div>
      </div>
      <div class="opt-card">
        <h4>${text.kRatio}</h4>
        <div class="val">${ivRvRatio}</div>
        <div class="desc">${ratioDesc}</div>
      </div>
      <div class="opt-card">
        <h4>${text.kRank}</h4>
        <div class="val">${ivRank}</div>
        <div class="desc">${text.sRank(0, 100, mgmt.ivRankPeriod || "6M")}</div>
      </div>
      <div class="opt-card">
        <h4>${text.kMove}</h4>
        <div class="val">${expectedMove}</div>
        <div class="desc">${text.sMove(expectedMove, mgmt.expectedMoveDays || 7)}</div>
      </div>
    `;
  }

  function renderVolChart(volHistory, priceHistory) {
    const container = document.getElementById("vol-chart");
    if (!container || !volHistory.length || !window.LightweightCharts) return;

    const chart = LightweightCharts.createChart(container, {
      layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#333' },
      grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
      timeScale: { borderVisible: false }
    });

    const ivLine = chart.addLineSeries({ color: '#007bff', lineWidth: 2, title: 'IV30' });
    const rvLine = chart.addLineSeries({ color: '#dc3545', lineWidth: 2, title: 'RV30' });

    ivLine.setData(volHistory.map(d => ({ time: d.date, value: d.value * 100 })));
    
    if (priceHistory.length) {
      const rvData = calculateRealizedVol(priceHistory);
      rvLine.setData(rvData);
    }
    
    chart.timeScale().fitContent();
  }

  function calculateRealizedVol(history) {
    let result = [];
    if (history.length < 21) return result;
    
    for (let i = 20; i < history.length; i++) {
      let logReturns = [];
      for (let j = i - 20; j < i; j++) {
        logReturns.push(Math.log(history[j + 1].close / history[j].close));
      }
      const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
            const variance = logReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (logReturns.length - 1);
      const annVol = Math.sqrt(variance * 252) * 100;
      result.push({ time: history[i].date, value: annVol });
    }
    return result;
  }

  function renderGammaChart(mgmtData) {
    const container = document.getElementById("gamma-chart");
    if (!container || !mgmtData.gammaProfile || !window.LightweightCharts) return;
    
    const chart = LightweightCharts.createChart(container, {
      layout: { background: { type: 'solid', color: '#ffffff' }, textColor: '#333' },
      grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
    });

    const gammaLine = chart.addAreaSeries({
      topColor: 'rgba(40, 167, 69, 0.4)',
      bottomColor: 'rgba(220, 53, 69, 0.4)',
      lineColor: '#28a745',
      lineWidth: 2
    });

    const formattedData = mgmtData.gammaProfile.map(pt => ({
      time: pt.strike,
      value: pt.netGamma
    })).sort((a, b) => a.time - b.time);

    gammaLine.setData(formattedData);
  }

  function renderOptionChain(data) {
    const select = document.getElementById("expiry-select");
    const wrapper = document.getElementById("chain-wrapper");
    if (!select || !wrapper || !data.expirations) return;

    const expDates = Object.keys(data.expirations);
    if (expDates.length === 0) return;

    select.innerHTML = "";
    expDates.forEach((exp, idx) => {
      const opt = document.createElement("option");
      opt.value = exp;
      opt.textContent = exp;
      if (idx === 0) opt.selected = true;
      select.appendChild(opt);
    });

    function updateChainTable(chosenExpiry) {
      const strikes = data.expirations[chosenExpiry];
      if (!strikes) return;

      let tableHtml = `
        <table class="chain-table">
          <thead>
            <tr>
              <th colspan="4" class="call-side">${text.tCalls}</th>
              <th>${text.tStrike}</th>
              <th colspan="4" class="put-side">${text.tPuts}</th>
            </tr>
            <tr>
              <th class="call-side">${text.tOI}</th>
              <th class="call-side">${text.tVol}</th>
              <th class="call-side">${text.tAsk}</th>
              <th class="call-side">${text.tBid}</th>
              <th></th>
              <th class="put-side">${text.tBid}</th>
              <th class="put-side">${text.tAsk}</th>
              <th class="put-side">${text.tVol}</th>
              <th class="put-side">${text.tOI}</th>
            </tr>
          </thead>
          <tbody>
      `;

      strikes.forEach(row => {
        const cOI = row.calls.oi !== undefined ? row.calls.oi : 0;
        const cVol = row.calls.vol !== undefined ? row.calls.vol : 0;
        const cAsk = row.calls.ask !== undefined ? row.calls.ask.toFixed(2) : "0.00";
        const cBid = row.calls.bid !== undefined ? row.calls.bid.toFixed(2) : "0.00";
        const pBid = row.puts.bid !== undefined ? row.puts.bid.toFixed(2) : "0.00";
        const pAsk = row.puts.ask !== undefined ? row.puts.ask.toFixed(2) : "0.00";
        const pVol = row.puts.vol !== undefined ? row.puts.vol : 0;
        const pOI = row.puts.oi !== undefined ? row.puts.oi : 0;

        tableHtml += `
          <tr>
            <td class="call-side">${cOI}</td>
            <td class="call-side">${cVol}</td>
            <td class="call-side">${cAsk}</td>
            <td class="call-side">${cBid}</td>
            <td class="strike-col">${row.strike}</td>
            <td class="put-side">${pBid}</td>
            <td class="put-side">${pAsk}</td>
            <td class="put-side">${pVol}</td>
            <td class="put-side">${pOI}</td>
          </tr>
        `;
      });

      tableHtml += `</tbody></table>`;
      wrapper.innerHTML = tableHtml;
    }

    select.addEventListener("change", (e) => updateChainTable(e.target.value));
    
    // Pass the first string item from the array rather than the array object
    updateChainTable(expDates[0]);
  }

  // Self execute inside client pipeline
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
