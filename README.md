# MOJIMARO TRADING — Demo Replay & Backtesting

A responsive, static trading practice terminal. It uses TradingView Lightweight Charts for chart rendering and optionally Twelve Data for historical/market candles. It is an independent manual-analysis simulator, not a broker and not affiliated with TradingView.

## Included
- Forex, XAU/USD and index symbol selector
- M1, M5, M15, M30, H1, H4 and D1 chart intervals
- Manual drawing tools: cursor, trendline, horizontal level and rectangle zone
- Undo/clear drawings and chart full-screen mode
- Bar Replay: select a historical candle, hide all later candles, play/pause, step forward/backward and change playback speed
- $1,000 virtual demo account
- Manual BUY/SELL tickets with lot size, optional stop loss and take profit
- Open positions, manual close and automatic simulated SL/TP checks during replay
- Trade history and notes/journal
- Performance statistics: balance, equity, net P/L, win rate, loss rate, profit factor, wins/losses and maximum drawdown
- Account and trade data saved in the current browser's localStorage
- Automatic data refresh every 2 minutes while not in replay mode and the page is visible

## Important limitations
1. Without an API key, the app creates random demo candles. These are only for practising the interface and are NOT real market history. Do not use them to judge a strategy's performance.
2. Replay is limited to the historical candles returned by the selected data provider and timeframe. The current Twelve Data request asks for up to 500 candles; provider plan limits may return fewer.
3. Demo trading is simulated locally. No orders are sent to a broker and no real money is used.
4. Profit/loss uses simplified contract-size estimates: 100,000 units per Forex lot, 100 ounces per XAU/USD lot, and one unit per index lot. Currency conversion (notably JPY quote pairs), spreads, commissions, swaps, slippage and broker-specific contract specifications are not modelled. Treat results as estimates, not broker-accurate statements.
5. When both stop loss and take profit are touched inside the same replay candle, the simulator assumes the stop loss happened first (conservative assumption).
6. Account data is saved only in this browser on this device. Clearing browser site data or using another device/browser will not carry the demo account over. Export/backup is not included yet.
7. A static GitHub Pages website cannot keep an API key secret. The key is entered by the user and saved in browser localStorage. Do not publish your private key in source code or share it.
8. Free data plans may have request, symbol, historical-depth and delay limits. Check your provider's current terms.

## Connect Twelve Data
1. Create an account at https://twelvedata.com/ and generate an API key.
2. Open MOJIMARO TRADING and choose **Data settings**.
3. Paste your API key and choose **Save key**.
4. Select a supported market and timeframe, then refresh.

Some symbols, especially indices, may require exchange-specific ticker names or a paid data entitlement. Use the provider's symbol search if a symbol is rejected.

## Deploy with GitHub Pages
1. Upload `index.html`, `style.css`, `app.js`, and `README.md` to the root of your GitHub repository.
2. Open **Settings → Pages**.
3. Select **Deploy from a branch**, branch `main`, folder `/(root)`, and save.
4. Wait for GitHub Pages to publish the site.

## How to backtest
1. Connect an API key and load the market/timeframe you want to study.
2. Use the replay slider to choose the candle where you want to begin.
3. Press **Enter replay**. Candles after that point are hidden.
4. Move one candle at a time or press Play. Analyse the chart and use your own drawing tools.
5. Open a BUY or SELL demo position. Choose lot size and optionally set a stop loss and take profit. Add your trade reason.
6. Close manually or let replay candles trigger your stop/target. Review your statistics and closed-trade journal.
7. Reset account returns the virtual account to $1,000 and permanently clears its locally stored trade history.
