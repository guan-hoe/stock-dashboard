# Stock Dashboard

Investor dashboards, EN / 中文, light / dark:

- **Arm Holdings (ARM)** — `arm/index.html` → https://guan-hoe.github.io/stock-dashboard/arm/
- **Tesla (TSLA)** — `tesla/index.html` → https://guan-hoe.github.io/stock-dashboard/tesla/
- **Sandisk (SNDK)** — `sndk/index.html` → https://guan-hoe.github.io/stock-dashboard/sndk/
- **Intel (INTC)** — `intc/index.html` → https://guan-hoe.github.io/stock-dashboard/intc/
- **SpaceX (SPCX)** — `spcx/index.html` → https://guan-hoe.github.io/stock-dashboard/spcx/
- **Micron (MU)** — `mu/index.html` → https://guan-hoe.github.io/stock-dashboard/mu/
- **Lumentum (LITE)** — `lite/index.html` → https://guan-hoe.github.io/stock-dashboard/lite/
- **Coherent (COHR)** — `cohr/index.html` → https://guan-hoe.github.io/stock-dashboard/cohr/
- **Alphabet (GOOGL)** — `googl/index.html` → https://guan-hoe.github.io/stock-dashboard/googl/
- **Meta (META)** — `meta/index.html` → https://guan-hoe.github.io/stock-dashboard/meta/
- **NVIDIA (NVDA)** — `nvda/index.html` → https://guan-hoe.github.io/stock-dashboard/nvda/
- **Zscaler (ZS)** — `zs/index.html` → https://guan-hoe.github.io/stock-dashboard/zs/
- **Bloom Energy (BE)** — `be/index.html` → https://guan-hoe.github.io/stock-dashboard/be/
- **Applied Optoelectronics (AAOI)** — `aaoi/index.html` → https://guan-hoe.github.io/stock-dashboard/aaoi/
- **AMD (AMD)** — `amd/index.html` → https://guan-hoe.github.io/stock-dashboard/amd/
- **MP Materials (MP)** — `mp/index.html` → https://guan-hoe.github.io/stock-dashboard/mp/
- **Amazon (AMZN)** — `amzn/index.html` → https://guan-hoe.github.io/stock-dashboard/amzn/
- **Microsoft (MSFT)** — `msft/index.html` → https://guan-hoe.github.io/stock-dashboard/msft/
- **Marvell (MRVL)** — `mrvl/index.html` → https://guan-hoe.github.io/stock-dashboard/mrvl/
- **SK hynix (SKHY)** — `skhy/index.html` → https://guan-hoe.github.io/stock-dashboard/skhy/
- **TSMC (TSM)** — `tsm/index.html` → https://guan-hoe.github.io/stock-dashboard/tsm/
- **Broadcom (AVGO)** — `avgo/index.html` → https://guan-hoe.github.io/stock-dashboard/avgo/
- **Rockwell Automation (ROK)** — `rok/index.html` → https://guan-hoe.github.io/stock-dashboard/rok/
- **Applied Materials (AMAT)** — `amat/index.html` → https://guan-hoe.github.io/stock-dashboard/amat/
- **ASML (ASML)** — `asml/index.html` → https://guan-hoe.github.io/stock-dashboard/asml/
- **Palantir (PLTR)** — `pltr/index.html` → https://guan-hoe.github.io/stock-dashboard/pltr/
- **Corning (GLW)** — `glw/index.html` → https://guan-hoe.github.io/stock-dashboard/glw/
- **Teradyne (TER)** — `ter/index.html` → https://guan-hoe.github.io/stock-dashboard/ter/

Each page covers price, revenue mix, financials, free cash flow, watch list, calendar and sources. The root `index.html` (https://guan-hoe.github.io/stock-dashboard/) lists every stock with its latest price.

## Ranking on the main page
- The stock cards on `index.html` are ordered from most to least bullish (Claude's judgment as of Oct 11, 2026), with a rank, a tier (Bullish / Constructive / Neutral / Cautious) and a one-line reason on each card. Re-rank by reordering the cards and editing the `rk` and `why` lines.

## How the live price works
- A GitHub Action (`.github/workflows/deploy.yml`) runs every 10 minutes during US market hours, fetches each symbol's quote and daily closes from Yahoo Finance (`scripts/fetch-quote.mjs SYMBOL OUTDIR RANGE`), and redeploys the site. No commits are made.
  - ARM → `arm/data/quote.json`, `arm/data/history.json`
  - TSLA → `tesla/data/quote.json`, `tesla/data/history.json` (2 years of closes, so the 50-day average covers the full 1-year chart)
  - SNDK → `sndk/data/quote.json`, `sndk/data/history.json` (all closes since the Feb 2025 listing)
  - INTC → `intc/data/quote.json`, `intc/data/history.json` (2 years of closes)
- Each page reloads its quote every minute, so the price, change, market cap, YTD and chart update without a refresh.
- The TradingView box under the price is tick-by-tick real time.
- Fundamentals (revenue, guidance, watch list) are as of Oct 9, 2026 and are edited in each page's HTML.

## Technical analysis section
- `assets/technicals.js` adds a "Technical analysis" section (and a Technicals link in the page menu) to every stock page: interactive daily candlesticks with SMA 5/10/30/100, Parabolic SAR (0.02, 0.2) and the key levels, MACD (12, 26, 9) and RSI (14) panes, ranges 1M–2Y, and a live signal table with a bullish/bearish count. It draws from `data/history.json`, so it updates with each price refresh.
- The written read and support/resistance levels live in `<stock>/ta.json` (EN and 中文, dated). Refresh them by hand when the chart has moved enough to change the levels. SK hynix's `ta.json` has two series (Nasdaq ADS and the Seoul listing, `skhy/data/krx/history.json`), shown with a toggle.

## Top movers
- `assets/movers.js` shows the latest session's 5 biggest gainers on the left of the main page and the 5 biggest losers on the right (under the stock cards on smaller screens), each as a candlestick chart with 5/10/30/100-day moving averages, Parabolic SAR and MACD (12, 26, 9), drawn with TradingView Lightweight Charts. The lists re-rank with every price refresh (every 10 minutes in US market hours plus the closing print), so they follow each trading day and hold the last session outside market hours. Indicator and range buttons are remembered per browser.
- `scripts/fetch-quote.mjs` saves daily open/high/low as well as close in `history.json`.

## News feed
- `scripts/fetch-news.mjs` pulls the last 30 days of headlines for every stock from Google News RSS and Yahoo Finance RSS and writes `data/news.json` (newest first, up to 80 per stock, duplicates removed). The Action runs it every hour, every day, plus on every price refresh.
- `assets/news.js` shows the feed on the main page (with filter chips per stock) and on each stock page (that stock only). To add a stock, add it to `STOCKS` in the script and to `data-tickers` on the main page.

## Analyst ratings section
- `assets/analysts.js` adds an "Analyst ratings and price targets" section (and an Analysts link in the menu) after the holders: consensus rating, average / median / high / low target and upside from the live price, upgrades, downgrades and initiations in the last 90 days, the rating mix now vs. 3 months ago, each firm's latest target plotted against the price, and a table of every firm's rating, change and target (latest per firm or all actions; filter by upgrades, downgrades, initiations or target changes; 3 / 6 / 12 months). EN / 中文.
- Data: `node scripts/fetch-analysts.mjs` reads Yahoo Finance (upgrade/downgrade history, recommendation trend, financial data) into `<stock>/analysts.json`; `.github/workflows/analysts.yml` runs it before the open and after the close on weekdays and commits changes. If Yahoo's firm-level feed for a stock goes quiet, the page says so (META's stops in Sep 2024) while the consensus figures stay current.

## Management review and leadership sections
- `assets/mgmt.js` adds two sections (and Review / CEO & CFO links in the page menu) after the revenue charts on every stock page, in EN / 中文:
  - **Management's review of the quarter**: two short paragraphs, the latest quarter's results with management's view and direction, then how the stock traded during and after the report and what drove it. Three cells show the report date, the first-session move and the move since the report (computed live from `data/history.json` when available, otherwise the written figure).
  - **CEO and CFO**: a short background on each, with the year they took the role.
- Text lives in `<stock>/mgmt.json` (written Oct 11, 2026; each section is kept under 10 lines on desktop). Refresh it after each earnings report: update `reported`, `pre_close`, `react`, `since`, the two `review` paragraphs and `sources`, and the executives if either changes.

## Options and volatility section
- `assets/options.js` adds an "Options and volatility" section (and an Options link in the page menu) after the technicals: implied vs. realized volatility over 6 months (IV30, realized 10 and 30-day, and the IV − RV30 spread), summary cells (IV30, RV30, IV ÷ RV, IV rank, expected move, put/call open interest) and an option chain with an expiry picker and strike-range filter. EN / 中文.
- Chain: `node scripts/fetch-options.mjs chain` pulls Cboe's delayed quotes (15-minute delay; IV and delta are Cboe's) into `<stock>/data/options.json` on every price refresh, trimmed to the nearest 6 expiries plus the monthlies out to about 13 months and strikes 60–160% of the price.
- IV history: `node scripts/fetch-options.mjs iv` runs daily after the close (`.github/workflows/vol.yml`) and adds the day's 30-day IV to `<stock>/vol.json`, which is committed. The history was seeded from alphaquery, which serves about 3 months free (from Jul 10, 2026), so the IV line reaches the full 6 months in January 2027. Realized volatility is computed in the browser from `data/history.json`.

## Top 20 shareholders section
- `assets/holders.js` adds a "Top 20 shareholders" section (and a Holders link in the page menu) after the cash flow section on every stock page: the 20 largest institutional holders with their shares at the last three 13F quarter ends (6 months), % of the company, the 6-month change and a status (new / added / trimmed / steady), plus who left the top 20. EN / 中文.
- Data: `scripts/fetch-holders.py` reads the SEC Form 13F data sets and writes `<stock>/holders.json`. `.github/workflows/holders.yml` runs it every Monday (and on demand from the Actions tab), commits any change and redeploys. A new 13F quarter appears about 45 days after each quarter end.
- The SEC asks automated downloads to identify a contact. Set it once under Settings → Secrets and variables → Actions → Variables as `SEC_USER_AGENT` (e.g. `stock-dashboard you@example.com`).
- 13F covers US institutional managers only: founders, parent companies (SoftBank in Arm), foreign holders and retail are not included. CUSIPs are listed in the script; a new stock needs a line in `STOCKS` there.

## Free cash flow section
- `assets/fcf.js` renders the "Free cash flow, by quarter" section (chart, quarterly table, estimates, cash in/out analysis, cash bridge) into `<section id="cashflow">` on each page, in EN / 中文.
- Each stock's numbers and text live in `<stock>/fcf-data.js` (`hist` = reported quarters, `est` = estimates, as [quarter, ended, operating CF, capex, FCF] in US$M). After each earnings report, move the reported quarter from `est` to `hist` and roll the estimates forward.

Note: GitHub pauses scheduled workflows in a repo with no activity for 60 days. Re-enable it from the Actions tab if that happens.

## Publish on GitHub Pages
1. Create a public repo named `stock-dashboard`.
2. Upload everything in this repo.
3. Settings → Pages → Source: **GitHub Actions**.
4. Sites appear at `https://angcharles.github.io/stock-dashboard/` plus `/arm/`, `/tesla/`, `/sndk/` and `/intc/`.

For information only, not investment advice. Not affiliated with Arm Holdings plc, Tesla, Inc., Sandisk Corporation or Intel Corporation.

## Adding a stock
Newer pages (SPCX, MU, LITE, COHR, GOOGL, META, NVDA, ZS, BE, AAOI, AMD, MP, AMZN, MSFT, MRVL, SKHY, TSM, AVGO, ROK, AMAT, ASML, PLTR, GLW, TER) are generated: edit `specs/<stock>.json` and run `python3 scripts/make-stock-page.py specs/<stock>.json`. Shared code is in `assets/stock-page.js` and `assets/stock.css`; price cells (52-week range, moving averages, RSI, drawdown) are computed from the live price history. For a new stock, copy a spec, generate the page, then write `<stock>/ta.json`, add the fetch line and the folder name in the copy loop of `.github/workflows/deploy.yml`, a card to the root `index.html`, an entry to `STOCKS` in `scripts/fetch-news.mjs` and `assets/movers.js`. TSMC and SK hynix figures are converted to US$ from NT$ and won at each quarter's rate (see the specs).

Older pages: Copy a stock folder (e.g. `intc/`), edit its `index.html` and seed `data/`, add a fetch line and copy lines to `.github/workflows/deploy.yml`, and add a card to the root `index.html`.

## Share unlock schedule (SpaceX)
- `assets/unlocks.js` adds a "Share unlock schedule" section with a timeline chart (every released and upcoming tranche as shares, market value or days of volume, plus cumulative % unlocked and a today marker) (and an Unlocks link in the menu) to any page that has an `unlocks.json` next to it — currently `spcx/`. Each lock-up tranche shows its shares, % of shares outstanding, market value at the live price, and size as a % of the 20-session average daily volume (from the `v` volume array that `scripts/fetch-quote.mjs` now writes to `history.json`). Status (released / next / upcoming) follows today's date.
- Tranche dates and sizes come from the IPO prospectus (424B4). Earnings-linked tranches carry estimated dates; when SpaceX announces a results date, set that tranche's `date` to the second full trading day after it and `"fixed": true` in `spcx/unlocks.json`.
