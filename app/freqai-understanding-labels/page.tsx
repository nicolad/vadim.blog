"use client";
import React from "react";
import Image from "next/image";
import { Icons } from "@/components/icons";
import Link from "next/link";
import BarChart from "./BarChart";

export default async function Post() {
  return (
    <article className="prose prose-sm md:prose-base lg:prose-lg prose-slate mx-auto pt-16 pb-16">
      <Link
        className="flex items-center gap-2 mb-2 decoration-transparent"
        href="/blog"
      >
        <Icons.ChevronLeft size={16} /> Posts
      </Link>

      <h1>Understanding Labels in FreqAI</h1>
      <span className="my-0 py-0 flex items-center gap-2">
        <Icons.Calendar size={16} />{" "}
        {new Date("2024-07-23T00:00:00.000Z").toLocaleString("en-US", {
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
        FreqAI is a powerful tool designed for automating machine learning tasks
        to generate market forecasts using a set of input signals. One of the
        core concepts in machine learning, and particularly in FreqAI, is the
        use of <strong>labels</strong>. This article will delve into the
        importance of labels, how they are defined in FreqAI, and how to
        effectively use them to enhance your trading strategies.
      </p>

      <h2>What Are Labels?</h2>
      <p>
        In the context of machine learning, <strong>labels</strong> are the
        target values that the model is trained to predict. Each feature vector
        (a set of parameters based on historical data) is associated with a
        single label. These labels intentionally look into the future and are
        what you train the model to predict.
      </p>
      <p>
        For instance, in a stock market prediction model, a label could be the
        future price of a stock. The model learns to predict this price based on
        past data such as moving averages, trading volume, and other technical
        indicators.
      </p>

      <h2>Defining Labels in FreqAI</h2>
      <p>
        In FreqAI, labels are defined within your strategy. The process involves
        setting target values that the model will predict based on the input
        features. Here's a high-level overview of how to define labels in
        FreqAI:
      </p>
      <ol>
        <li>
          <strong>Set Targets</strong>: Define the target values (labels) in the
          strategy using the <code>set_freqai_targets()</code> function. This
          function will determine what the model will learn to predict.
        </li>
        <li>
          <strong>Feature Engineering</strong>: Create a rich set of features
          that will be used as inputs for the model. These features can be
          technical indicators, time-based data, or custom indicators.
        </li>
        <li>
          <strong>Model Training</strong>: Train the model using the defined
          features and labels. The model will learn to map the features to the
          labels.
        </li>
      </ol>

      <h2>Example: Setting Labels in FreqAI</h2>
      <pre>
        <code>
          {`def set_freqai_targets(self, dataframe: DataFrame, metadata, **kwargs) -> DataFrame:
    """
    Required function to set the targets for the model.
    All targets must be prepended with '&' to be recognized by the FreqAI internals.

    :param dataframe: strategy dataframe which will receive the targets
    :param metadata: metadata of current pair
    usage example: dataframe["&-target"] = dataframe["close"].shift(-1) / dataframe["close"]
    """
    dataframe["&-s_close"] = (
        dataframe["close"]
        .shift(-self.freqai_info["feature_parameters"]["label_period_candles"])
        .rolling(self.freqai_info["feature_parameters"]["label_period_candles"])
        .mean()
        / dataframe["close"]
        - 1
    )

    return dataframe`}
        </code>
      </pre>

      <h2>Visualizing the Labeling Process</h2>
      <p>
        To help visualize the labeling process, we can use a hierarchical tree
        diagram. Here’s a component to illustrate the labeling structure:
      </p>
      <div>
        <BarChart />
      </div>

      <h2>Conclusion</h2>
      <p>
        Labels are a fundamental aspect of machine learning in FreqAI. By
        defining clear and relevant labels, you can train models that make
        accurate and useful predictions for your trading strategies. Remember to
        experiment with different types of labels and feature sets to find the
        most effective combinations for your specific needs.
      </p>
      <p>
        For more detailed information, visit the{" "}
        <a href="https://www.freqtrade.io/en/stable/freqai-feature-engineering/">
          FreqAI documentation
        </a>
        .
      </p>
    </article>
  );
}
