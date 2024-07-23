"use client";
import React from "react";
import Image from "next/image";
import { Icons } from "@/components/icons";
import Link from "next/link";
import TreeAnimation from "./TreeAnimation";

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
        Trading with FreqAI: Advanced Feature Engineering for Market Forecasting
      </h1>
      <span className="my-0 py-0 flex items-center gap-2">
        <Icons.Calendar size={16} />{" "}
        {new Date("2024-07-22T00:00:00.000Z").toLocaleString("en-US", {
          dateStyle: "long",
        })}
      </span>
      {/* Author */}
      <span id="author" className="flex items-center">
        <Icons.UserCircleIcon size={16} />{" "}
        <span className="ml-2">{`Written by: Vadim Nicolai`}</span>
      </span>
      <div>
        <Image
          src={`/images/freqai.svg`}
          alt="FreqAI"
          width="400"
          height="64"
        />
        <style jsx>{`
          div {
            display: flex;
            justify-content: center;
            align-items: center;
          }
        `}</style>
      </div>
      <h2>Introduction</h2>
      <p>
        FreqAI is an advanced tool for automated trading, leveraging machine
        learning to generate market forecasts based on a rich set of features.
        In this article, we'll delve into the feature engineering process in
        FreqAI, explaining how to define, expand, and utilize various features
        to improve your trading strategies.
      </p>

      <h2>Defining Base Features</h2>
      <p>
        The foundation of FreqAI’s feature engineering is defining the base
        features like RSI, MFI, EMA, SMA, and more. These features can be custom
        indicators or imported from technical analysis libraries.
      </p>

      <h3>Example Code</h3>
      <pre>
        <code>
          {`def feature_engineering_expand_all(self, dataframe: DataFrame, period, metadata, **kwargs) -> DataFrame:
    dataframe["%-rsi-period"] = ta.RSI(dataframe, timeperiod=period)
    dataframe["%-mfi-period"] = ta.MFI(dataframe, timeperiod=period)
    dataframe["%-adx-period"] = ta.ADX(dataframe, timeperiod=period)
    dataframe["%-sma-period"] = ta.SMA(dataframe, timeperiod=period)
    dataframe["%-ema-period"] = ta.EMA(dataframe, timeperiod=period)

    bollinger = qtpylib.bollinger_bands(qtpylib.typical_price(dataframe), window=period, stds=2.2)
    dataframe["bb_lowerband-period"] = bollinger["lower"]
    dataframe["bb_middleband-period"] = bollinger["mid"]
    dataframe["bb_upperband-period"] = bollinger["upper"]

    dataframe["%-bb_width-period"] = (dataframe["bb_upperband-period"] - dataframe["bb_lowerband-period"]) / dataframe["bb_middleband-period"]
    dataframe["%-close-bb_lower-period"] = dataframe["close"] / dataframe["bb_lowerband-period"]

    dataframe["%-roc-period"] = ta.ROC(dataframe, timeperiod=period)
    dataframe["%-relative_volume-period"] = dataframe["volume"] / dataframe["volume"].rolling(period).mean()

    return dataframe`}
        </code>
      </pre>

      <div>
        <h3>Defining Base Features Visualization</h3>
        <TreeAnimation />
      </div>

      <h2>Expanding Features</h2>
      <p>
        Once the base features are defined, you can expand upon them using the
        feature parameters in the FreqAI configuration file. This allows you to
        include multiple timeframes, correlated pairs, and shifted candles in
        your feature set.
      </p>

      <h3>Example Configuration</h3>
      <pre>
        <code>
          {`"freqai": {
    "feature_parameters" : {
        "include_timeframes": ["5m","15m","4h"],
        "include_corr_pairlist": ["ETH/USD", "LINK/USD", "BNB/USD"],
        "label_period_candles": 24,
        "include_shifted_candles": 2,
        "indicator_periods_candles": [10, 20]
    }
}`}
        </code>
      </pre>

      <h2>High-Level Concepts of Feature Engineering</h2>
      <h3>1. Defining the Features</h3>
      <p>
        Low-level feature engineering in FreqAI is performed within a set of
        functions called feature_engineering_*. These functions set the base
        features such as RSI, MFI, EMA, SMA, time of day, and volume. The base
        features can be custom indicators or imported from any
        technical-analysis library.
      </p>

      <h3>2. Expanding Features with Metadata</h3>
      <p>
        Gain finer control over feature engineering functions with metadata.
        Metadata allows blocking or reserving features for certain timeframes,
        periods, or pairs.
      </p>

      <h3>3. Returning Additional Information from Training</h3>
      <p>
        Important metrics can be returned to the strategy at the end of each
        model training by assigning them to a custom dictionary inside the
        prediction model class. These metrics can be used in your strategy to
        create dynamic target thresholds.
      </p>

      <h3>4. Weighting Features for Temporal Importance</h3>
      <p>
        FreqAI allows setting a weight factor to weight recent data more
        strongly than past data via an exponential function. This can help
        emphasize the importance of recent data points.
      </p>

      <h3>5. Building the Data Pipeline</h3>
      <p>
        By default, FreqAI builds a dynamic pipeline based on user configuration
        settings. The default settings include steps like MinMaxScaler and
        VarianceThreshold. Users can customize this pipeline further by adding
        steps like SVMOutlierExtractor or PrincipalComponentAnalysis.
      </p>

      <h3>6. Customizing the Pipeline</h3>
      <p>
        Users are encouraged to customize the data pipeline to their needs. This
        can be done by setting a custom pipeline object inside the IFreqaiModel
        train function or by overriding
        define_data_pipeline/define_label_pipeline functions.
      </p>

      <h3>7. Outlier Detection</h3>
      <p>
        Equity and crypto markets suffer from a high level of non-patterned
        noise in the form of outlier data points. FreqAI implements methods like
        Dissimilarity Index (DI), Support Vector Machine (SVM), and DBSCAN to
        identify and mitigate such outliers.
      </p>

      <h3>
        8. Data Dimensionality Reduction with Principal Component Analysis
      </h3>
      <p>
        You can reduce the dimensionality of your features by activating PCA in
        the config. This reduces the data set's dimensionality while retaining
        significant variance, making training faster and more efficient.
      </p>
      <div>
        For more information on feature engineering in FreqAI, check out the
        full documentation on{" "}
        <a href="https://www.freqtrade.io/en/stable/freqai-feature-engineering/">
          Freqtrade.io
        </a>
      </div>
    </article>
  );
}
