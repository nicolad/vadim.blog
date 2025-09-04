---
slug: hyperliquid-gasless-trading-strategies
title: Hyperliquid Gasless Trading – Deep Comparison, Fees, and 20 Optimized Strategies
date: 2025-09-04
authors: [nicolad]
---

> **TL;DR**
> Hyperliquid runs its own **Layer-1** with two execution domains:
>
> * **HyperCore** — native on-chain central limit order book (CLOB), margin, funding, liquidations.
> * **HyperEVM** — standard EVM runtime (gas metered, paid in **HYPE**).
>
> Trading on **HyperCore is gasless**: orders, cancels, TP/SL, TWAP, Scale ladders, etc. are **signed actions** included in consensus, not EVM transactions.
>
> * You **don’t need HYPE** to place/cancel orders.
> * You **pay maker/taker fees and funding**, not gas.
> * Spam is mitigated with **address budgets, rate limits, open-order caps**.
> * If you need more throughput: **buy request weight** at **\$0.0005 per action**.
>
> The design enables **CEX-style strategies** (dense ladders, queue dancing, rebates, hourly hedging) without the friction of gas.
>
> **Official GitHub repos:**
>
> * Python SDK → [https://github.com/hyperliquid-dex/hyperliquid-python-sdk](https://github.com/hyperliquid-dex/hyperliquid-python-sdk)
> * Rust SDK → [https://github.com/hyperliquid-dex/hyperliquid-rust-sdk](https://github.com/hyperliquid-dex/hyperliquid-rust-sdk)
> * Node → [https://github.com/hyperliquid-dex/node](https://github.com/hyperliquid-dex/node)
> * Order Book Server (example) → [https://github.com/hyperliquid-dex/order\_book\_server](https://github.com/hyperliquid-dex/order_book_server)

---

## 1. How “gasless” works

### Order lifecycle

```text
Wallet signs payload  →  Exchange endpoint → Node → Validators (HyperBFT)
                        ↘ deterministic inclusion into HyperCore state
```

* **Signatures, not transactions.**
  Your wallet signs payloads (EIP-712 style). These are posted to the **Exchange endpoint**, gossiped to validators, ordered in consensus, and applied to HyperCore.
  → No gas, just signature.

* **Onboarding.**
  Enable trading = sign once.
  Withdrawals = **flat \$1 fee**, not a gas auction.
  [Docs → Onboarding](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading)

* **Spam protection.**

  * **Address budgets**: 10k starter buffer, then **1 action per 1 USDC lifetime fills**.
  * **Open-order cap**: base 1,000 → scales to 5,000.
  * **Congestion fairness**: max 2× maker-share per block.
  * **ReserveRequestWeight**: buy capacity at \$0.0005/action.
    [Docs → Rate limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits)

* **Safety rails.**

  * **scheduleCancel** (dead-man’s switch)
  * **expiresAfter** (time-box an action)
  * **noop** (nonce invalidation)

* **Order types.**
  Market, Limit, **ALO (post-only)**, **IOC**, **GTC**, **TWAP**, **Scale**, **TP/SL** (market or limit), **OCO**.
  [Docs → Order types](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/order-types)

* **Self-trade prevention.**
  **Expire-maker**: cancels resting maker side instead of self-fill.
  [Docs → STP](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/self-trade-prevention)

---

## 2. Fees: Hyperliquid vs DEXes & CEXes

### Perps (base tiers)

| Venue           |      Maker |      Taker | Notes                                                               |
| --------------- | ---------: | ---------: | ------------------------------------------------------------------- |
| Hyperliquid     |     0.015% |     0.045% | Gasless actions; staking discounts up to 40%; rebates up to –0.003% |
| dYdX v4         |      0.01% |      0.05% | Gasless submits/cancels; fills only                                 |
| GMX v2 (perps)  | 0.04–0.06% | 0.04–0.06% | Round-trip 0.08–0.12% + funding/borrow + L2 gas                     |
| Binance Futures |   \~0.018% |   \~0.045% | VIP/BNB discounts; USDC-M can hit 0% maker                          |
| Bybit Perps     |     0.020% |     0.055% | Tiered; VIP reductions                                              |
| OKX Futures     |     0.020% |     0.050% | VIP can reach –0.005% / 0.015%                                      |
| Kraken Futures  |     0.020% |     0.050% | Down to 0% / 0.01% at scale                                         |

### Spot

| Venue       |   Maker |      Taker | Gas                                      |
| ----------- | ------: | ---------: | ---------------------------------------- |
| Hyperliquid |  0.040% |     0.070% | Gasless actions; \$1 withdraw            |
| Uniswap v3  | 0.01–1% |    0.01–1% | User pays gas; or solver embeds in price |
| Bybit Spot  |   0.15% | 0.10–0.20% | CEX; no gas                              |
| OKX Spot    |   0.08% |      0.10% | VIP/OKB discounts                        |

---

## 3. Funding models

* **Hyperliquid**: 8h rate **paid hourly** (1/8 each hour). Hyperps use **EMA mark** (oracle-light).
* **dYdX v4**: hourly funding; standard premium/interest.
* **GMX v2**: continuous borrow vs pool imbalance.

---

## 4. What gasless enables (tactically)

* **Dense ladders + queue dancing**: cheap to modify/cancel 1000s of levels.
* **Granular hedging**: rebalance perps/spot hedges hourly without friction.
* **CEX-style STP + ALO**: protect queue priority.
* **Deterministic inclusion**: HyperBFT ensures one global order sequence.
* **Predictable scaling**: buy request weight explicitly instead of gas auction.

---

## 5. Ten **core strategies**

1. **Passive Maker Ladder (ALO + STP)**
   Build dense post-only ladders, earn spread + rebates, cancel/repost gas-free.
   [Python SDK example](https://github.com/hyperliquid-dex/hyperliquid-python-sdk/tree/main/examples)

2. **Rebate Farming (maker-share)**
   Hit ≥0.5%, 1.5%, 3% maker volume shares to unlock –0.001%/–0.002%/–0.003%.

3. **Funding-Arb / Cash-and-Carry**
   Long spot vs short perp; rebalance hourly gas-free.

4. **TWAP Execution**
   Use native 30s slice TWAP with slippage caps; gasless param tweaks.

5. **Scale Order Grids**
   Deploy wide grids with up to 5k resting orders; adjust spacing by ATR.

6. **Latency-Aware MM**
   Run [node](https://github.com/hyperliquid-dex/node), use `noop` for stale nonces.

7. **OCO Risk-Boxing (TP/SL)**
   Parent-linked stops/targets; frequent adjustment gasless.

8. **Hyperps Momentum/Fade**
   Trade EMA-based hyperps; funding skew stabilizes.
   [Turnkey repo](https://github.com/elkadro/hyperliquid-turnkey)

9. **Dead-Man’s Switch Hygiene**
   Always use `scheduleCancel`; pair with `expiresAfter`.

10. **Throughput Budgeting**
    Add logic to purchase `reserveRequestWeight` at spikes.

---

## 6. Ten **advanced strategies**

11. **Maker-Skewed Basis Harvest**
    Hedge legs passively, collect rebates + funding.

12. **Adaptive Spread Ladder**
    Contract/expand quotes with realized vol; keep order count fixed.

13. **Queue-Position Arbitrage**
    Gasless `modify` to overtake by 1 tick; requires local queue estimation.

14. **Stale-Quote Punisher**
    Flip passive→taker when off-chain anchors are stale.

15. **Rebate-Neutral Market Impact Hedger**
    Pre-compute edge ≈ (S/2 − A − f\_m); trade only when ≥0.

16. **Funding Skew Swing-Trader**
    Switch between mean-revert & trend based on funding drift.

17. **Dead-Man Sessioner**
    Each session starts with `scheduleCancel(t)` to avoid zombie orders.

18. **Liquidity Layer Splitter**
    Spread ladders across accounts; use STP to avoid self-trades.

19. **Cross-Venue Micro-Arb**
    HL vs CEX/DEX; taker on mispriced side, maker on the other.

20. **Event-Mode Capacity Burst**
    Pre-buy request weight pre-CPI/FOMC; change ladder parameters.

---

## 7. Cost sanity check (\$100k notional)

* **Hyperliquid**: 0.015% maker (\$15) + 0.045% taker (\$45) = **\$60** (+ funding).
* **dYdX v4**: 0.01% + 0.05% = **\$60**.
* **GMX v2**: 0.04–0.06% open + 0.04–0.06% close = **\$80–120** (+ borrow + gas).
* **Binance Futures**: 0.018% + 0.045% ≈ **\$63** (base VIP).

---

## 8. Implementation gotchas

* **Budgets & caps**: track in code; cancels have higher allowance; throttling needed.
* **Min sizes**: perps \$10 notional; spot 10 quote units.
* **ExpiresAfter**: avoid triggering (5× budget cost).
* **Node ops**: run Linux, open ports 4001/4002, colocate in Tokyo.
* **Nonces**: prefer `modify`; use `noop` if stuck.

---

## 9. Comparison snapshot

* **Hyperliquid & dYdX v4** — gasless trading actions, on-chain CLOB, deterministic finality.
* **UniswapX / CoW** — user-gasless via solver; solver pays gas, embeds in your price.
* **Uniswap v3/v4, GMX** — user pays gas + pool fee; MEV & slippage dominate costs.
* **CEXes** — no gas, lowest fees at VIP, fiat rails; but centralized custody.

---

## 10. GitHub Index

* Org: [https://github.com/hyperliquid-dex](https://github.com/hyperliquid-dex)
* Python SDK: [https://github.com/hyperliquid-dex/hyperliquid-python-sdk](https://github.com/hyperliquid-dex/hyperliquid-python-sdk)
* Rust SDK: [https://github.com/hyperliquid-dex/hyperliquid-rust-sdk](https://github.com/hyperliquid-dex/hyperliquid-rust-sdk)
* Node: [https://github.com/hyperliquid-dex/node](https://github.com/hyperliquid-dex/node)
* Order-book server: [https://github.com/hyperliquid-dex/order\_book\_server](https://github.com/hyperliquid-dex/order_book_server)
* TypeScript SDKs: [https://github.com/nktkas/hyperliquid](https://github.com/nktkas/hyperliquid), [https://github.com/nomeida/hyperliquid](https://github.com/nomeida/hyperliquid)
* Go SDK: [https://github.com/sonirico/go-hyperliquid](https://github.com/sonirico/go-hyperliquid)
* .NET client: [https://github.com/JKorf/HyperLiquid.Net](https://github.com/JKorf/HyperLiquid.Net)
* Turnkey TS fork: [https://github.com/elkadro/hyperliquid-turnkey](https://github.com/elkadro/hyperliquid-turnkey)
* MCP servers: [https://github.com/kukapay/hyperliquid-info-mcp](https://github.com/kukapay/hyperliquid-info-mcp), [https://github.com/mektigboy/server-hyperliquid](https://github.com/mektigboy/server-hyperliquid)
* Stats starter: [https://github.com/thunderhead-labs/hyperliquid-stats](https://github.com/thunderhead-labs/hyperliquid-stats)

---

# Bottom Line

Hyperliquid takes **gas out of the trading loop**, letting traders focus on **fees, funding, latency, and inventory control**. The result: a **CEX-like experience with on-chain transparency**.

**Best use cases:**

* High-frequency maker strategies (queue-dancing, rebates).
* Funding arbitrage with fine-grained rebalancing.
* Event-driven hedging.
* Developers who want to build bots in Python/Rust/TS/Go without juggling gas balances.
