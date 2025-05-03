---

slug: nautilus-marketiftouched-validation
title: Contributing a Safer **MarketIfTouchedOrder** to Nautilus Trader — Hardening Conditional Orders in Rust
date: 2025-05-03
authors: \[nicolad]
-------------------

## Introduction

`MarketIfTouchedOrder` (MIT) is the *mirror image* of a stop-market order: it rests **inactive** until the market price *touches* a predefined **trigger**, then converts into a market order and executes immediately. Because it links a latent trigger straight into an **instant execution** path, airtight validation is non-negotiable—any silent mismatch can manifest as an unwanted trade in production.

Pull Request **#2577** delivers exactly that hardening. It was merged into `develop` on **May 1 2025** by @cjdsellers, landing **+159 / −13 across one file**. ([GitHub][1])

---

## Connection to Issue #2529 – “Standardise validations for orders”

The work originates from **Issue #2529**, a meta-ticket demanding uniform, fail-fast checks across _all_ order types. PR #2577 is the first concrete deliverable and automatically closed the item via a “Fixes #2529” footer. ([GitHub][2])

---

## Why the Change Was Needed

| Problem                                                                   | Consequence                                                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| _Partial_ positivity checks on `quantity`, `trigger_price`, `display_qty` | Invalid values slipped through and only triggered panics deep in matching or persistence layers |
| `TimeInForce::Gtd` accepted `expire_time = None`                          | A “good-til-date” order silently degraded into “good-til-cancel”                                |
| Iceberg abuse — no rule that `display_qty ≤ quantity`                     | Traders could expose more liquidity than they actually had                                      |
| Legacy `new` constructor could only **panic**                             | Callers had no graceful error-handling path                                                     |

---

## Key Enhancements in PR #2577

| Area              | Before (`v0`)              | After (`v1`)                                                            |
| ----------------- | -------------------------- | ----------------------------------------------------------------------- |
| Constructor API   | `new` → **panic on error** | **`new_checked`** returns `anyhow::Result<Self>`; legacy `new` wraps it |
| Positivity checks | Partial                    | Guaranteed for `quantity`, `trigger_price`, optional `display_qty`      |
| GTD orders        | `expire_time` optional     | **Required** when `TIF == GTD`                                          |
| Iceberg rule      | None                       | `display_qty ≤ quantity` enforced                                       |
| Error semantics   | Opaque panics              | Rich `anyhow::Error` with domain text                                   |
| Tests             | None                       | 4 rstest cases prove happy-path and three failure modes                 |

---

## Walking Through the File

1. **Header & Licence**
   The usual LGPL 3.0 banner plus a 2015-2025 copyright line.

2. **Imports**
   _Domain helpers_ (`UUID4`, `UnixNanos`), numerical types (`rust_decimal::Decimal`), serde for (de)serialisation, and the big `crate::{ … }` prelude bringing in enums, identifiers, and strongly-typed finance primitives.

3. **`MarketIfTouchedOrder` struct**

   ```rust
   pub struct MarketIfTouchedOrder {
       pub trigger_price: Price,
       pub trigger_type: TriggerType,
       pub expire_time: Option<UnixNanos>,
       pub display_qty: Option<Quantity>,
       pub trigger_instrument_id: Option<InstrumentId>,
       pub is_triggered: bool,
       pub ts_triggered: Option<UnixNanos>,
       core: OrderCore,
   }
   ```

   - **`core`** is a flattened composition holding all common order fields (side, status, quantities, timestamps, events, etc.).
   - Booleans and `Option`s track the state of the latent trigger.

4. **`new_checked` (added by the PR)**
   _All_ invariants live here:

   ```rust
   check_positive_quantity(quantity, "quantity")?;
   check_positive_price(trigger_price, "trigger_price")?;
   if let Some(disp) = display_qty {
       check_positive_quantity(disp, "display_qty")?;
       check_predicate_false(disp > quantity, "`display_qty` may not exceed `quantity`")?;
   }
   if time_in_force == TimeInForce::Gtd {
       check_predicate_false(
           expire_time.unwrap_or_default() == 0,
           "Condition failed: `expire_time` is required for `GTD` order",
       )?;
   }
   ```

   The function then builds an `OrderInitialized` event, wraps it in `OrderCore`, and returns `Ok(Self)`.

5. **Legacy `new`**
   A thin wrapper that calls `new_checked(...).expect(FAILED)`, so existing test-code that _expects_ a panic still works, while production code can migrate to the `Result` API.

6. **`impl Order for MarketIfTouchedOrder`**
   Implements \~60 methods required by the `Order` trait. Highlights:

   - `trigger_price()` and `trigger_type()` return `Some(..)` instead of `None`.
   - `apply(&mut self, event: OrderEventAny)` recomputes slippage immediately after an order is filled.
   - Setter helpers (`set_position_id`, `set_quantity`, etc.) mutate the inner `OrderCore` safely.

7. **`impl From<OrderInitialized> for MarketIfTouchedOrder`**
   Enables ergonomic `.into()` conversions from the event stream back to a _typed_ order, ensuring reconstruction is safe and validated.

8. **Tests (new)**
   _rstest_ module with four cases:

   - `ok` (happy path)
   - `quantity_zero` (**should panic**)
   - `gtd_without_expire` (**should panic**)
   - `display_qty_gt_quantity` (**should panic**)

---

## Mermaid – Order Lifecycle

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Initialized
    Initialized -->|submit()| Submitted
    Submitted -->|accepted()| Resting
    Resting -->|price touches trigger_price| Triggered
    Triggered -->|auto-converts| MarketOrder
    MarketOrder --> Filled
    Resting -->|cancel()| Cancelled
    Triggered -->|cancel()| Cancelled
    Filled --> [*]
    Cancelled --> [*]
```

---

## Practical Usage Example

```rust
let mit = MarketIfTouchedOrder::new_checked(
    trader_id,
    strategy_id,
    instrument_id,
    client_order_id,
    OrderSide::Sell,
    qty,
    trigger_price,
    TriggerType::LastPrice,
    TimeInForce::Gtc,
    None,          // expire_time
    false, false,  // reduce_only, quote_quantity
    None, None,    // display_qty, emulation_trigger
    None, None,    // trigger_instrument_id, contingency_type
    None, None,    // order_list_id, linked_order_ids
    None,          // parent_order_id
    None, None,    // exec_algorithm_id, params
    None,          // exec_spawn_id
    None,          // tags
    init_id,
    ts_init,
)?;
```

If you prefer the old behaviour, continue using `MarketIfTouchedOrder::new`; you’ll simply get clearer panic messages if you pass invalid data.

---

## Conclusion

By centralising all MIT invariants in a single, auditable constructor—and tying the work back to the broader **“Standardise validations”** initiative—PR #2577 gives Nautilus Trader users _fail-fast safety_ without breaking existing code.
Adopt `new_checked`, propagate the `Result`, and trade with confidence.

---

### URLs

- PR #2577 – “Improve validations for MarketIfTouchedOrder”
  [https://github.com/nautechsystems/nautilus_trader/pull/2577](https://github.com/nautechsystems/nautilus_trader/pull/2577)
- Issue #2529 – “Standardise validations for orders”
  [https://github.com/nautechsystems/nautilus_trader/issues/2529](https://github.com/nautechsystems/nautilus_trader/issues/2529)

[1]: https://github.com/nautechsystems/nautilus_trader/pull/2577 "Improve validations for MarketIfTouchedOrder by nicolad · Pull Request #2577 · nautechsystems/nautilus_trader · GitHub"
[2]: https://github.com/nautechsystems/nautilus_trader/issues/2529 "Standardize validations for orders · Issue #2529 · nautechsystems/nautilus_trader · GitHub"
