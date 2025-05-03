---
slug: nautilus-limitiftouched-validation
title: Contributing a Safer `LimitIfTouchedOrder` to Nautilus Trader — A Small Open-Source Win for Rust Trading
date: 2025-05-03
authors: [nicolad]
---

## Introduction

`LimitIfTouchedOrder` (LIT) is a conditional order that sits between a simple limit order and a stop-limit order: it rests _inactive_ until a **trigger price** is touched, then converts into a plain limit at the specified **limit price**.
Because it straddles two distinct price levels and multiple conditional flags, _robust validation_ is critical—any silent mismatch can manifest as unwanted executions in live trading.

Pull Request [#2533](https://github.com/nautechsystems/nautilus_trader/pull/2533) standardises and hardens the validation logic for LIT orders, bringing it up to the same quality bar as `MarketOrder` and `LimitOrder`. The PR was merged into `develop` on **May 1 2025** by @cjdsellers (+207 / −9 across one file). ([GitHub][1], [GitHub][2])

---

## Why the Change Was Needed

- **Inconsistent invariants** – `quantity`, `price`, and `trigger_price` were _not_ always checked for positivity.
- **Edge-case foot-guns** – `TimeInForce::Gtd` could be set with a zero `expire_time`, silently turning a “good-til-date” order into “good-til-cancel”.
- **Side/trigger mismatch** – A BUY order with a trigger _above_ the limit price (or SELL with trigger _below_ limit) yielded undefined behaviour.
- **Developer frustration** – Consumers of the SDK had to replicate guard clauses externally; a single canonical constructor removes that burden.

---

## Key Enhancements

| Area              | Before                 | After                                                                           |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Constructor API   | `new` (panic-on-error) | `new_checked` (returns `Result`) + `new` now wraps it                           |
| Positivity checks | Only partial           | Guaranteed for `quantity`, `price`, `trigger_price`, and optional `display_qty` |
| Display quantity  | Not validated          | Must be ≤ `quantity`                                                            |
| GTD orders        | No expire validation   | Must supply `expire_time` when `TimeInForce::Gtd`                               |
| Side/trigger rule | Undefined              | `BUY ⇒ trigger ≤ price`, `SELL ⇒ trigger ≥ price`                               |
| Unit-tests        | 0 dedicated tests      | 5 focused tests (happy-path + 4 failure modes)                                  |

---

## Implementation Highlights

1. **`new_checked`** – a fallible constructor returning `anyhow::Result<Self>`. All invariants live here.
2. **Guard helpers** – leverages `check_positive_quantity`, `check_positive_price`, and `check_predicate_false` from `nautilus_core::correctness`.
3. **Legacy behaviour preserved** – the original `new` now calls `new_checked().expect("FAILED")`, so downstream crates that relied on panics keep working.
4. **Concise `Display` impl** – human-readable string that shows side, quantity, instrument, prices, trigger type, TIF, and status for quick debugging.
5. **Test suite** – written with _rstest_; covers `ok`, `quantity_zero`, `gtd_without_expire`, `buy_trigger_gt_price`, and `sell_trigger_lt_price`.

Code diff stats: **207 additions**, **9 deletions**, affecting `crates/model/src/orders/limit_if_touched.rs`. ([GitHub][2])

---

## Impact on Integrators

_If you only called_ `LimitIfTouchedOrder::new` **nothing breaks**—you’ll merely enjoy better error messages if you misuse the API.
For stricter compile-time safety, switch to the new `new_checked` constructor and handle `Result<T>` explicitly.

```rust
let order = LimitIfTouchedOrder::new_checked(
    trader_id,
    strategy_id,
    instrument_id,
    client_order_id,
    OrderSide::Buy,
    qty,
    limit_price,
    trigger_price,
    TriggerType::LastPrice,
    TimeInForce::Gtc,
    None,          // expire_time
    false, false,  // post_only, reduce_only
    false, None,   // quote_qty, display_qty
    None, None,    // emulation_trigger, trigger_instrument_id
    None, None,    // contingency_type, order_list_id
    None,          // linked_order_ids
    None,          // parent_order_id
    None, None,    // exec_algorithm_id, params
    None,          // exec_spawn_id
    None,          // tags
    init_id,
    ts_init,
)?;
```

---

## Conclusion

PR \[#2533] dramatically reduces the surface area for invalid LIT orders by centralising all domain rules in a single, auditable place.
Whether you’re building discretionary tooling or a fully automated strategy on top of **Nautilus Trader**, you now get _fail-fast_ behaviour with precise error semantics—no more mystery fills in production.

> **Next steps:** adopt `new_checked`, make your own wrappers return `Result`, and enjoy safer trading.

---

[1]: https://github.com/nautechsystems/nautilus_trader/pull/2533 "Improve validations for LimitIfTouchedOrder by nicolad · Pull Request #2533 · nautechsystems/nautilus_trader · GitHub"
