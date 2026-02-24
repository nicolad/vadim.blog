---
slug: tokio-vs-tokio-stream-websocket-adapters
title: Tokio vs tokio-stream in WebSocket adapters - stream-first vs select!
description: "Compare Tokio primitives with tokio-stream combinators for Rust WebSocket adapters — when to use select! vs Stream-based fan-in, timeouts, and event pipelines."
date: 2025-09-05
authors: [nicolad]
tags: [rust, tokio, websocket, async, streaming]
---

## TL;DR

<!-- truncate -->

- **Tokio** is the runtime and low-level primitives (tasks, I/O, timers, channels, `tokio::select!`).
- **`tokio-stream`** is an *optional* companion that:
  - **wraps** Tokio primitives into `Stream`s (e.g., `ReceiverStream`, `BroadcastStream`, `IntervalStream`);
  - provides **combinators** (`map`, `filter`, `merge`, `timeout`, `throttle`, `chunks_timeout`, `StreamMap`) for declarative event pipelines.
- If your adapter **pulls** from channels with `recv().await` and coordinates with `select!`, you usually **don’t** need `tokio-stream`.
- If your adapter **exposes or composes Streams** (fan-in, time windows, per-item timeouts, etc.), you **do**.

---

## What each crate gives you

### Tokio (runtime + primitives)

- `#[tokio::main]`, `tokio::spawn`, `tokio::select!`
- Channels: `tokio::sync::{mpsc, broadcast, watch, oneshot}`
- Time: `tokio::time::{sleep, interval, timeout}`
- Signals: `tokio::signal`
- **Typical style:** “manual pump” with `recv().await` inside a `select!` loop.

### `tokio-stream` (adapters + combinators)

- **Wrappers** (Tokio → `Stream`):
  - `wrappers::ReceiverStream<T>` ← `mpsc::Receiver<T>`
  - `wrappers::UnboundedReceiverStream<T>`
  - `wrappers::BroadcastStream<T>` ← `broadcast::Receiver<T>`
  - `wrappers::WatchStream<T>` ← `watch::Receiver<T>`
  - `wrappers::IntervalStream` ← `tokio::time::Interval`
- **Combinators** via `StreamExt`: `next`, `map`, `filter`, `merge` (with `SelectAll`), `StreamMap` (keyed fan-in), and time-aware ops (`timeout`, `throttle`, `chunks_timeout`) when the crate’s `time` feature is enabled.

---

## Two idioms for adapters (with complete snippets)

### 1) Channel + `select!` (“manual pump”) — **no `tokio-stream` needed**

```rust
use tokio::{select, signal, sync::mpsc};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let (tx, mut rx) = mpsc::channel::<String>(1024);

    // Example producer
    tokio::spawn(async move {
        let _ = tx.send("hello".to_string()).await;
    });

    let mut sigint = signal::ctrl_c();

    loop {
        select! {
            maybe = rx.recv() => {
                match maybe {
                    Some(msg) => { tracing::info!("msg: {msg}"); }
                    None => break, // channel closed
                }
            }
            _ = &mut sigint => {
                tracing::info!("shutting down");
                break;
            }
            else => break,
        }
    }

    Ok(())
}
````

**Pros**

- Minimal dependencies, explicit control and shutdown.
- Clear backpressure semantics via channel capacity.

**Cons**

- Fan-in across many/dynamic sources is verbose.
- Transformations (map/filter/batch) are hand-rolled.

---

### 2) Stream-first (wrap & compose) — **`tokio-stream` recommended**

```rust
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::{
    wrappers::{ReceiverStream, IntervalStream},
    StreamExt, // for .next() and combinators
};

enum AdapterEvent { User(String), Order(String), Heartbeat }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let (tx_user, rx_user)   = mpsc::channel::<String>(1024);
    let (tx_order, rx_order) = mpsc::channel::<String>(1024);

    // Example producers
    tokio::spawn(async move { let _ = tx_user.send("u1".into()).await; });
    tokio::spawn(async move { let _ = tx_order.send("o1".into()).await; });

    let ticker  = tokio::time::interval(Duration::from_secs(1));

    let users   = ReceiverStream::new(rx_user).map(AdapterEvent::User);
    let orders  = ReceiverStream::new(rx_order).map(AdapterEvent::Order);
    let beats   = IntervalStream::new(ticker).map(|_| AdapterEvent::Heartbeat);

    // Compose: merge multiple sources and shape the flow
    let mut events =
        users.merge(orders)
             .merge(beats)
             .throttle(Duration::from_millis(20));

    while let Some(ev) = events.next().await {
        match ev {
            AdapterEvent::User(v)      => tracing::info!("user: {v}"),
            AdapterEvent::Order(v)     => tracing::info!("order: {v}"),
            AdapterEvent::Heartbeat    => tracing::debug!("tick"),
        }
    }

    Ok(())
}
```

**Pros**

- Concise fan-in and transforms (filter/map/batch/timeout).
- Natural fit when returning `impl Stream<Item = Event>` to consumers.

**Cons**

- Adds one dependency; slightly different ownership/lifetimes vs bare `Receiver`.

---

## Side-by-side: when to use which

| Aspect                  | Channel + `tokio::select!` (no `tokio-stream`)                    | Stream-first (uses `tokio-stream`)                                    | What the dependency implies                                      |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Why it’s used**       | Pull from channels via `recv().await`, coordinate with `select!`. | Wrap Tokio primitives as `Stream`s and/or use combinators.            | Presence of `tokio-stream` signals a stream-centric composition. |
| **Primary abstraction** | Futures + channels + `select!`.                                   | `Stream<Item = T>` + wrappers + `StreamExt`.                          | Stream API → extra crate.                                        |
| **Typical code**        | `while let Some(x) = rx.recv().await {}`, `select! { ... }`       | `ReceiverStream::new(rx).map(...).merge(...).next().await`            | Wrappers/combinators imply `tokio-stream`.                       |
| **Fan-in / merging**    | Manual `select!` arms; verbose for many/dynamic sources.          | `merge`, `SelectAll`, or `StreamMap` for succinct fan-in.             | `tokio-stream` buys tools for multiplexing.                      |
| **Timers / heartbeats** | `interval()` polled in loops.                                     | `IntervalStream` + `timeout`/`throttle`/`chunks_timeout`.             | Time-aware ops rely on `tokio-stream` + features.                |
| **Public API shape**    | Pull: `async fn next_event() -> Option<T>`.                       | Stream: `fn into_stream(self) -> impl Stream<Item = T>`.              | Exposing a stream often requires the crate.                      |
| **Composability**       | Hand-rolled transforms.                                           | One-liners with `StreamExt` (map/filter/batch).                       | Enables declarative pipelines.                                   |
| **Backpressure**        | Channel capacity governs it; explicit.                            | Same channels underneath; wrappers don’t change capacity.             | Neutral; it’s about ergonomics.                                  |
| **Fairness/ordering**   | `select!` randomizes fairness per iteration.                      | Per-stream order preserved; cross-stream order depends on combinator. | Document semantics either way.                                   |
| **Testability**         | Manual harnesses around loops.                                    | `.take(n)`, `.collect::<Vec<_>>()`, etc.                              | Stream APIs are often easier to test.                            |
| **Cost / deps**         | Lean; no extra crate.                                             | Adds `tokio-stream`; thin adapter overhead.                           | Main cost is dependency surface.                                 |

---

## Design recipes (complete, paste-ready)

### A) Channel-first everywhere (leanest; drop `tokio-stream`)

- Keep a pull API like `next_event()`.
- Use `tokio::time::timeout` for per-item deadlines.

```rust
use std::time::Duration;
use tokio::{sync::mpsc, time::timeout};

pub async fn pump_with_timeout(mut rx: mpsc::Receiver<String>) -> anyhow::Result<()> {
    loop {
        match timeout(Duration::from_secs(5), rx.recv()).await {
            Ok(Some(msg)) => tracing::info!("msg: {msg}"),
            Ok(None)      => break,  // channel closed
            Err(_)        => tracing::warn!("no event within 5s"),
        }
    }
    Ok(())
}
```

### B) Offer both (feature-gated Stream API)

**`Cargo.toml`**

```toml
[features]
default = []
stream-api = ["tokio-stream"]

[dependencies]
tokio = { version = "1", features = ["rt-multi-thread","macros","sync","time","signal"] }
tokio-stream = { version = "0.1", optional = true }
```

**Client**

```rust
#[cfg(feature = "stream-api")]
use tokio_stream::wrappers::ReceiverStream;

pub struct Client {
    rx_inbound: tokio::sync::mpsc::Receiver<MyEvent>,
}

impl Client {
    pub async fn next_event(&mut self) -> Option<MyEvent> {
        self.rx_inbound.recv().await
    }

    #[cfg(feature = "stream-api")]
    pub fn into_stream(self) -> ReceiverStream<MyEvent> {
        ReceiverStream::new(self.rx_inbound)
    }
}
```

### C) Stream-first everywhere (plus pull convenience)

- Internally fan-out via `broadcast` so multiple consumers can subscribe.

```rust
use tokio::sync::{mpsc, broadcast};
use tokio_stream::wrappers::BroadcastStream;

pub struct Client {
    rx_inbound: mpsc::Receiver<Event>,     // pull path
    bus:        broadcast::Sender<Event>,  // stream path
    _reader:    tokio::task::JoinHandle<()>,
}

impl Client {
    pub async fn next_event(&mut self) -> Option<Event> {
        self.rx_inbound.recv().await
    }

    pub fn event_stream(&self) -> BroadcastStream<Event> {
        BroadcastStream::new(self.bus.subscribe())
    }
}
```

### D) Expose a `Stream` **without** `tokio-stream`

- Implement `Stream` directly over `mpsc::Receiver` via `poll_recv`.

```rust
use futures_core::Stream;
use pin_project_lite::pin_project;
use std::{pin::Pin, task::{Context, Poll}};
use tokio::sync::mpsc;

pin_project! {
    pub struct EventStream<T> {
        #[pin]
        rx: mpsc::Receiver<T>,
    }
}

impl<T> EventStream<T> {
    pub fn new(rx: mpsc::Receiver<T>) -> Self { Self { rx } }
}

impl<T> Stream for EventStream<T> {
    type Item = T;
    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.project().rx.poll_recv(cx)
    }
}
```

---

## Performance, backpressure, ordering

- **Overhead:** `ReceiverStream` is a thin adapter; hot-path costs are typically parsing/allocations, not the wrapper.
- **Backpressure:** unchanged—governed by channel boundedness and consumer speed.
- **Ordering:** per-stream order is preserved; **merged** streams don’t guarantee global order—timestamp if strict ordering matters.
- **Fairness:** `tokio::select!` randomizes branch polling; stream fan-in fairness depends on the specific combinator (`merge`, `SelectAll`, `StreamMap`).

---

## A quick decision checklist

- Need to **return** `impl Stream<Item = Event>` or use stream combinators? → **Use `tokio-stream`.**
- Only need a single event loop with `recv().await` and `select!`? → **Tokio alone is fine.**
- Want both ergonomics and lean defaults? → **Feature-gate** a stream view (`stream-api`).

---

## References (URLs)

- Tokio crate (runtime & primitives):
  [https://docs.rs/tokio/latest/tokio/](https://docs.rs/tokio/latest/tokio/)
- `tokio::select!` macro:
  [https://docs.rs/tokio/latest/tokio/macro.select.html](https://docs.rs/tokio/latest/tokio/macro.select.html)
- `tokio::sync::mpsc::Receiver`:
  [https://docs.rs/tokio/latest/tokio/sync/mpsc/struct.Receiver.html](https://docs.rs/tokio/latest/tokio/sync/mpsc/struct.Receiver.html)
- Tokio tutorial — Channels:
  [https://tokio.rs/tokio/tutorial/channels](https://tokio.rs/tokio/tutorial/channels)
- Tokio tutorial — Streams (overview of the pattern):
  [https://tokio.rs/tokio/tutorial/streams](https://tokio.rs/tokio/tutorial/streams)
- `tokio-stream` (overview):
  [https://docs.rs/tokio-stream](https://docs.rs/tokio-stream)
- `ReceiverStream`:
  [https://docs.rs/tokio-stream/latest/tokio\_stream/wrappers/struct.ReceiverStream.html](https://docs.rs/tokio-stream/latest/tokio_stream/wrappers/struct.ReceiverStream.html)
- `StreamMap`:
  [https://docs.rs/tokio-stream/latest/tokio\_stream/struct.StreamMap.html](https://docs.rs/tokio-stream/latest/tokio_stream/struct.StreamMap.html)
- Futures `Stream` trait:
  [https://docs.rs/futures-core/latest/futures\_core/stream/trait.Stream.html](https://docs.rs/futures-core/latest/futures_core/stream/trait.Stream.html)
- `tokio-tungstenite` WebSocketStream (`Stream` + `Sink`):
  [https://docs.rs/tokio-tungstenite/latest/tokio\_tungstenite/struct.WebSocketStream.html](https://docs.rs/tokio-tungstenite/latest/tokio_tungstenite/struct.WebSocketStream.html)
