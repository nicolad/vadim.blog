"use client";
import React from "react";
import Image from "next/image";
import { Icons } from "@/components/icons";
import Link from "next/link";
import { motion } from "framer-motion";

export default async function Post() {
  return (
    <article className="prose prose-sm md:prose-base lg:prose-lg prose-slate mx-auto pt-16 pb-16">
      <Link
        className="flex items-center gap-2 mb-2 decoration-transparent"
        href="/blog"
      >
        <Icons.ChevronLeft size={16} /> Posts
      </Link>
      <h1>
        Enhancing Trading Strategies with AI: A Deep Dive into FreqAI Hybrid
        Strategy
      </h1>
      <span className="my-0 py-0 flex items-center gap-2">
        <Icons.Calendar size={16} />{" "}
        {new Date("2024-07-25T00:00:00.000Z").toLocaleString("en-US", {
          dateStyle: "long",
        })}
      </span>
      {/* Author */}
      <span id="author" className="flex items-center">
        <Icons.UserCircleIcon size={16} />{" "}
        <span className="ml-2">{`Written by: Vadim Nicolai`}</span>
      </span>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <h2>Introduction</h2>
        <p>
          The integration of AI into trading strategies has revolutionized the
          way we approach market forecasts and trade executions. This article
          explores the{" "}
          <strong>
            <a
              href="https://github.com/freqtrade/freqtrade/blob/develop/freqtrade/templates/FreqaiExampleHybridStrategy.py"
              target="_blank"
              rel="noopener noreferrer"
            >
              FreqaiExampleHybridStrategy
            </a>
          </strong>
          , demonstrating how FreqAI can enhance a typical Freqtrade strategy by
          leveraging advanced machine learning techniques to make more informed
          trading decisions.
        </p>
      </motion.section>
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <h2>Configuring FreqAI for Enhanced Predictions</h2>
        <p>
          The strategy begins by configuring FreqAI, enabling it, and setting
          various parameters to define how the model should be trained and used.
          This configuration includes setting the training period, specifying
          feature parameters, and selecting the prediction model.
        </p>
        <pre>
          <code>
            {`"freqai": {
  "enabled": true,
  "purge_old_models": 2,
  "train_period_days": 15,
  "identifier": "unique-id",
  "feature_parameters": {
    "include_timeframes": ["3m", "15m", "1h"],
    "include_corr_pairlist": ["BTC/USDT", "ETH/USDT"],
    "label_period_candles": 20,
    "include_shifted_candles": 2,
    "DI_threshold": 0.9,
    "weight_factor": 0.9,
    "principal_component_analysis": false,
    "use_SVM_to_remove_outliers": true,
    "indicator_periods_candles": [10, 20]
  },
  "data_split_parameters": {
    "test_size": 0,
    "random_state": 1
  },
  "model_training_parameters": {
    "n_estimators": 800
  }
},`}
          </code>
        </pre>
      </motion.section>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <h2>Defining Features for Machine Learning</h2>
        <p>
          In machine learning, feature engineering is a critical step. The
          strategy defines a range of features that the AI model will use to
          make predictions. These features include various technical indicators
          like RSI, MFI, ADX, SMA, and EMA. These are calculated over different
          time periods to capture market dynamics comprehensively.
        </p>
        <pre>
          <code>
            {`def feature_engineering_expand_all(
  self, dataframe: DataFrame, period: int, metadata: Dict, **kwargs
) -> DataFrame {
  dataframe["%-rsi-period"] = ta.RSI(dataframe, timeperiod=period)
  dataframe["%-mfi-period"] = ta.MFI(dataframe, timeperiod=period)
  dataframe["%-adx-period"] = ta.ADX(dataframe, timeperiod=period)
  dataframe["%-sma-period"] = ta.SMA(dataframe, timeperiod=period)
  dataframe["%-ema-period"] = ta.EMA(dataframe, timeperiod=period)

  bollinger = qtpylib.bollinger_bands(qtpylib.typical_price(dataframe), window=period, stds=2.2)
  dataframe["bb_lowerband-period"] = bollinger["lower"]
  dataframe["bb_middleband-period"] = bollinger["mid"]
  dataframe["bb_upperband-period"] = bollinger["upper"]

  dataframe["%-bb_width-period"] = (
    dataframe["bb_upperband-period"] - dataframe["bb_lowerband-period"]
  ) / dataframe["bb_middleband-period"]
  dataframe["%-close-bb_lower-period"] = dataframe["close"] / dataframe["bb_lowerband-period"]

  dataframe["%-roc-period"] = ta.ROC(dataframe, timeperiod=period)
  dataframe["%-relative_volume-period"] = (
    dataframe["volume"] / dataframe["volume"].rolling(period).mean()
  )

  return dataframe
}`}
          </code>
        </pre>
      </motion.section>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <h2>Setting AI Model Targets</h2>
        <p>
          The <code>set_freqai_targets</code> function is crucial for defining
          what the AI model will learn to predict. Targets (labels) are the
          future values that the model tries to forecast. In this example, the
          strategy predicts whether the market will go up or down.
        </p>
        <pre>
          <code>
            {`def set_freqai_targets(self, dataframe: DataFrame, metadata: Dict, **kwargs) -> DataFrame {
  self.freqai.class_names = ["down", "up"]
  dataframe["&s-up_or_down"] = np.where(
    dataframe["close"].shift(-50) > dataframe["close"], "up", "down"
  )

  return dataframe
}`}
          </code>
        </pre>
      </motion.section>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <h2>Combining Technical Indicators with AI Predictions</h2>
        <p>
          The strategy calculates traditional technical indicators and combines
          them with the AI model's predictions. This dual approach helps in
          making more accurate trading decisions. The{" "}
          <code>populate_indicators</code> function is used to compute these
          indicators, while the <code>populate_entry_trend</code> and{" "}
          <code>populate_exit_trend</code> functions define the conditions for
          entering and exiting trades based on both technical and AI-based
          signals.
        </p>
        <pre>
          <code>
            {`def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame {
  dataframe = self.freqai.start(dataframe, metadata, self)

  dataframe["rsi"] = ta.RSI(dataframe)
  bollinger = qtpylib.bollinger_bands(qtpylib.typical_price(dataframe), window=20, stds=2)
  dataframe["bb_lowerband"] = bollinger["lower"]
  dataframe["bb_middleband"] = bollinger["mid"]
  dataframe["bb_upperband"] = bollinger["upper"]
  dataframe["bb_percent"] = (dataframe["close"] - dataframe["bb_lowerband"]) / (
    dataframe["bb_upperband"] - dataframe["bb_lowerband"]
  )
  dataframe["bb_width"] = (dataframe["bb_upperband"] - dataframe["bb_lowerband"]) / dataframe[
    "bb_middleband"
  ]
  dataframe["tema"] = ta.TEMA(dataframe, timeperiod=9)

  return dataframe
}

def populate_entry_trend(self, df: DataFrame, metadata: dict) -> DataFrame {
  df.loc[
    (
      (qtpylib.crossed_above(df["rsi"], self.buy_rsi.value))
      & (df["tema"] <= df["bb_middleband"])
      & (df["tema"] > df["tema"].shift(1))
      & (df["volume"] > 0)
      & (df["do_predict"] == 1)
      & (df["&s-up_or_down"] == "up")
    ),
    "enter_long",
  ] = 1

  df.loc[
    (
      (qtpylib.crossed_above(df["rsi"], self.short_rsi.value))
      & (df["tema"] > df["bb_middleband"])
      & (df["tema"] < df["tema"].shift(1))
      & (df["volume"] > 0)
      & (df["do_predict"] == 1)
      & (df["&s-up_or_down"] == "down")
    ),
    "enter_short",
  ] = 1

  return df
}

def populate_exit_trend(self, df: DataFrame, metadata: dict) -> DataFrame {
  df.loc[
    (
      (qtpylib.crossed_above(df["rsi"], self.sell_rsi.value))
      & (df["tema"] > df["bb_middleband"])
      & (df["tema"] < df["tema"].shift(1))
      & (df["volume"]

 > 0)
    ),
    "exit_long",
  ] = 1

  df.loc[
    (
      (qtpylib.crossed_above(df["rsi"], self.exit_short_rsi.value))
      & (df["tema"] <= df["bb_middleband"])
      & (df["tema"] > df["tema"].shift(1))
      & (df["volume"] > 0)
    ),
    "exit_short",
  ] = 1

  return df
}`}
          </code>
        </pre>
      </motion.section>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <h2>Conclusion</h2>
        <p>
          By integrating AI with traditional technical analysis, the
          FreqaiExampleHybridStrategy provides a robust framework for making
          data-driven trading decisions. This hybrid approach leverages the
          strengths of both AI and human-designed indicators, enhancing the
          overall performance of the trading strategy.
        </p>
        <p>
          For more details on how to implement and customize this strategy,
          refer to the{" "}
          <a href="https://www.freqtrade.io/en/latest/freqai-feature-engineering/">
            FreqAI documentation
          </a>
          .
        </p>
      </motion.section>
    </article>
  );
}
