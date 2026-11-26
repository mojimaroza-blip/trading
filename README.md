# MOJIMARO TRADING

A responsive, static market-analysis dashboard for personal research. It uses TradingView Lightweight Charts for rendering and optionally Twelve Data for candle data.

## Included
- Forex, XAU/USD and index symbol selector
- M1, M5, M15, M30, H1, H4 and D1 chart intervals
- Rule-based structure checks: basic BOS and liquidity-sweep heuristics
- Premium/discount range location
- Fibonacci 0.82 reference line
- 75% minimum confluence display filter
- Responsive desktop/mobile layout
- Demo candles when no API key is configured

## Important limitations
1. Demo candles are randomly generated and are NOT real market prices.
2. The SMC rules are simplified educational heuristics, not a complete institutional order-flow model.
3. H1/H4 labels in this starter build are approximations from the currently loaded candle series, not independently fetched higher-timeframe feeds.
4. The 75% score is a rule-based score, NOT a 75% chance of winning.
5. The app does not place trades or connect to a broker.
6. Free data plans have request, symbol, delay and redistribution limits. Check your provider's current terms.
7. A static GitHub Pages website cannot keep an API key secret. The key is entered by the user and saved in that browser's localStorage. Do not publish your own private key in source code or share a browser profile containing it.

## Run locally
Open `index.html` in a modern browser. For best results, use a local static server or GitHub Pages.

## Connect Twelve Data
1. Create an account at https://twelvedata.com/
2. Generate an API key in your account dashboard.
3. Open MOJIMARO TRADING and select **Data settings**.
4. Paste the key and choose **Save key**.
5. Select a symbol and timeframe, then press **Refresh**.

Some symbols (especially indices) may require a supported exchange-specific symbol or a paid data entitlement. If the provider rejects a symbol, try another supported symbol from your provider's symbol search.

## Deploy with GitHub Pages
1. Sign in to https://github.com/
2. Create a new public repository named `mojimaro-trading`.
3. Upload `index.html`, `style.css`, `app.js`, and `README.md` to the repository root (not inside another folder).
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Choose branch **main** and folder **/(root)**, then press **Save**.
7. Wait for GitHub Pages to publish. Your site address will look like:
   `https://YOUR-USERNAME.github.io/mojimaro-trading/`

## Updating
Edit the relevant file in GitHub, commit the change, and wait for Pages to redeploy.
