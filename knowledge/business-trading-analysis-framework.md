# Business & Trading Analysis Framework

Original content written for CyberTools AI. License: same as this repository.

## 1. Reading a Daily Sales Report

When analyzing a sales report, always extract and comment on:
- **Revenue vs. target**: absolute number and % of goal.
- **Trend**: compare to yesterday, same day last week, and the trailing 7/30-day average -- a single day means little in isolation.
- **Mix shift**: which products/categories drove the change (a flat total can hide a big shift underneath).
- **Anomalies**: any single order, customer, or channel disproportionately responsible for the number (a "whale" order can distort a small daily report).
- **Actionable takeaway**: end with 1-2 concrete recommendations, not just a description of the numbers.

## 2. Core Financial/Market Indicators

- **Moving Averages (MA/EMA)**: trend direction; crossovers (e.g. 50/200-day) are classic trend-change signals, not guarantees.
- **RSI (Relative Strength Index)**: overbought (>70) / oversold (<30) momentum signal; most useful combined with trend context, not alone.
- **MACD**: momentum and trend-following; signal-line crossovers indicate potential shifts.
- **Volume**: confirms or contradicts price moves -- a price move on low volume is weaker evidence than the same move on high volume.
- **Volatility (ATR, Bollinger Bands)**: sizes risk and stop distances; higher volatility requires wider risk tolerance or smaller position size.

## 3. KPI Reporting Structure (recommended template)

1. **Headline number** (revenue, orders, active users) with period-over-period delta.
2. **Segment breakdown** (by product, region, channel).
3. **Notable outliers** and their explanation.
4. **Risks/watch-items** for the next period.
5. **Recommendation** -- what should change based on this data.

## 4. Risk Management Principles (trading context)

- Never risk more than a small, fixed percentage of capital on a single position.
- Define stop-loss and take-profit levels before entering, not after.
- Diversify across uncorrelated instruments; concentration risk is the most common cause of large drawdowns.
- Track realized vs. unrealized P&L separately -- unrealized gains are not profit until closed.
- Keep a trading journal: entry reason, exit reason, and outcome, to identify systematic mistakes over time.

## 5. Communicating Analysis to Non-Technical Stakeholders

- Lead with the conclusion/recommendation, then the supporting data -- not the other way around.
- Use plain-language framing for statistical concepts (e.g. "3 out of the last 5 days" instead of raw percentages when the audience is non-technical).
- Always flag the confidence level and data limitations (sample size, time window, seasonality) explicitly.
