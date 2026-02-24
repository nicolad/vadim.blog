---
slug: qlib-ai-quant-workflow-pytorch-mlp
title: Powering Quant Finance with Qlib’s PyTorch MLP on Alpha360
date: 2024-12-22
description: "Run Qlib's PyTorch MLP model on Alpha360 features for stock prediction — end-to-end quant finance workflow with training, backtesting, and analysis."
authors: [nicolad]
tags:
  [
    python,
    platform,
    finance,
    machine-learning,
    research,
    deep-learning,
    paper,
    fintech,
    quant,
    quantitative-finance,
    investment,
    stock-data,
    algorithmic-trading,
    research-paper,
    quantitative-trading,
    quant-dataset,
    quant-models,
    auto-quant,
  ]
---

## Introduction

**Qlib** is an AI-oriented, open-source platform from Microsoft that simplifies the entire quantitative finance process. By leveraging **PyTorch**, **Qlib** can seamlessly integrate modern neural networks—like Multi-Layer Perceptrons (MLPs)—to process large datasets, engineer alpha factors, and run flexible backtests. In this post, we focus on a **PyTorch MLP** pipeline for **Alpha360** data in the US market, examining a single YAML configuration that unifies data ingestion, model training, and performance evaluation.

<!-- truncate -->

---

## PyTorch MLP on Alpha360: Overview

Below is the relevant YAML from [**workflow_config_mlp_Alpha360.yaml**](https://github.com/microsoft/qlib/blob/main/examples/benchmarks/MLP/workflow_config_mlp_Alpha360.yaml). A single `qrun` command triggers Qlib to:

1. **Initialize** a US market environment.
2. **Load and preprocess** daily data factors from **Alpha360** (2008–2020).
3. **Train** a PyTorch MLP (`DNNModelPytorch`) with around 360 input features.
4. **Backtest** a top-k strategy with transaction costs.
5. **Analyze** signals, rank IC, and other alpha metrics.

### The Command

```bash
qrun workflow_config_mlp_Alpha360.yaml
```

### YAML Breakdown

```yaml
qlib_init:
  provider_uri: "/Users/vadimnicolai/Public/work/qlib-cookbook/.data/us_data"
  region: us
  kernels: 1

market: &market sp500
benchmark: &benchmark ^GSPC

data_handler_config: &data_handler_config
  start_time: 2008-01-01
  end_time: 2020-08-01
  fit_start_time: 2008-01-01
  fit_end_time: 2014-12-31
  instruments: *market
  infer_processors:
    - class: RobustZScoreNorm
      kwargs:
        fields_group: feature
        clip_outlier: true
    - class: Fillna
      kwargs:
        fields_group: feature
  learn_processors:
    - class: DropnaLabel
    - class: CSRankNorm
      kwargs:
        fields_group: label
  label: ["Ref($close, -2) / Ref($close, -1) - 1"]

port_analysis_config: &port_analysis_config
  strategy:
    class: TopkDropoutStrategy
    module_path: qlib.contrib.strategy
    kwargs:
      signal: <PRED>
      topk: 50
      n_drop: 5
  backtest:
    start_time: 2017-01-01
    end_time: 2020-08-01
    account: 100000000
    benchmark: *benchmark
    exchange_kwargs:
      limit_threshold: 0.095
      deal_price: close
      open_cost: 0.0005
      close_cost: 0.0015
      min_cost: 5

task:
  model:
    class: DNNModelPytorch
    module_path: qlib.contrib.model.pytorch_nn
    kwargs:
      batch_size: 1024
      max_steps: 4000
      loss: mse
      lr: 0.002
      optimizer: adam
      GPU: 0
      pt_model_kwargs:
        input_dim: 360

  dataset:
    class: DatasetH
    module_path: qlib.data.dataset
    kwargs:
      handler:
        class: Alpha360
        module_path: qlib.contrib.data.handler
        kwargs: *data_handler_config
      segments:
        train: [2008-01-01, 2014-12-31]
        valid: [2015-01-01, 2016-12-31]
        test: [2017-01-01, 2020-08-01]

  record:
    - class: SignalRecord
      module_path: qlib.workflow.record_temp
      kwargs:
        model: <MODEL>
        dataset: <DATASET>

    - class: SigAnaRecord
      module_path: qlib.workflow.record_temp
      kwargs:
        ana_long_short: False
        ann_scaler: 252

    - class: PortAnaRecord
      module_path: qlib.workflow.record_temp
      kwargs:
        config: *port_analysis_config
```

---

## Detailed Explanation

1. **Initialization (`qlib_init`)**

   - `region: us` → Enforces US-like trading rules and cost assumptions.
   - `kernels: 1` → Minimizes concurrency confusion with PyTorch’s own parallelism.

2. **Data Handler**

   - **Alpha360**: A large factor set for daily bar data, typically 360 features.
   - **Time Windows**:
     - Full data: `start_time=2008-01-01` ~ `end_time=2020-08-01`
     - Fit set: `fit_start_time=2008-01-01` ~ `fit_end_time=2014-12-31`
   - **Infer Processors**:
     - `RobustZScoreNorm` → Scales features robustly (less sensitive to outliers).
     - `Fillna` → Eliminates missing data.
   - **Learn Processors**:
     - `DropnaLabel` → Removes rows if target is NaN.
     - `CSRankNorm` → Normalizes labels cross-sectionally.

3. **Task Model**: `DNNModelPytorch`

   - `loss: mse` → Minimizes mean squared error for next-day relative returns.
   - `batch_size: 1024, max_steps: 4000` → Medium-scale training loop.
   - `GPU: 0` → CPU usage only (helpful for debugging or Mac M1 contexts).
   - `pt_model_kwargs.input_dim=360` → Matches the factor dimension from Alpha360.

4. **Dataset**

   - Splits:
     - Train: 2008–2014
     - Valid: 2015–2016
     - Test: 2017–2020
   - This forward-time partition prevents look-ahead bias.

5. **Record**
   - `SignalRecord`: Saves the MLP’s predictions for further analysis.
   - `SigAnaRecord`: Analyzes correlation (IC, Rank IC) with real returns.
   - `PortAnaRecord`: Runs a top-50 “dropout” strategy with cost modeling.

---

## Running & Logs

When running:

```bash
qrun workflow_config_mlp_Alpha360.yaml
```

You might see logs like:

```
[8262:MainThread](...) INFO - qlib.Initialization - ...
ModuleNotFoundError. XGBModel...
[8262:MainThread](...) INFO - DNNModelPytorch - DNN parameters setting:
  lr : 0.002
  max_steps : 4000
  batch_size : 1024
  ...
Time cost: 114.175s | Loading data Done
RuntimeWarning: All-NaN slice encountered
RobustZScoreNorm Done
DropnaLabel Done
CSRankNorm Done
Time cost: 85.667s | fit & process data Done
Time cost: 199.844s | Init data Done
[1]  8262 segmentation fault  qrun ...
```

### Why Segfault?

- Possibly a concurrency/memory conflict:
  1. Large batch size and big factor set.
  2. Mac ARM + PyTorch concurrency issues.
  3. Minimizing concurrency (`kernels: 1`) sometimes fixes it, but you might still need to reduce `batch_size` or update drivers.

If it completes:

```
{'IC': 0.0045, 'ICIR': 0.0559, 'Rank IC': 0.0048, 'Rank ICIR': 0.0607}
'The following are analysis results of the excess return with cost(1day).'
mean              -0.000280
annualized_return -0.066664
information_ratio -0.940238
...
```

- **IC ~ 0.0045**: Very low predictive correlation → might need more advanced networks or features.
- **Negative annualized return**: Trading costs or frequent portfolio turnover can overshadow small alpha signals.

---

## Conclusion

Utilizing **Qlib**’s **PyTorch MLP** on **Alpha360** is a powerful demonstration of an end-to-end AI quant workflow—from robust data transformations to neural net training and a straightforward top-k backtest. The single YAML config (`workflow_config_mlp_Alpha360.yaml`) encapsulates every step, streamlining reproducibility and collaboration.

Despite potential concurrency hiccups or segmentation faults, this pipeline highlights how advanced deep-learning methods can be integrated into classical alpha factor strategies. By fine-tuning hyperparameters, expanding feature sets, and managing data concurrency, researchers can push the boundaries of machine-driven alpha discovery—and tackle real-world challenges in **quantitative finance** more effectively.

---

**Further Resources**:

1. [Qlib on GitHub](https://github.com/microsoft/qlib)
2. [PyTorch Neural Networks in Qlib Docs](https://qlib.readthedocs.io/en/latest/component/model.html#pytorch-model)
3. [Alpha360 Factor Library Explanation](https://qlib.readthedocs.io/en/latest/component/data.html#alpha360)
4. [Advanced Example: Rolling Training and Tuning](https://qlib.readthedocs.io/en/latest/component/workflow.html#rolling-trainer)

_Pro Tip_: If segmentation faults persist, consider installing PyTorch in a conda environment with pinned versions, or run with smaller subsets of data/batch sizes. This keeps your pipeline stable and ready for iteration on more complex deep-learning models.
