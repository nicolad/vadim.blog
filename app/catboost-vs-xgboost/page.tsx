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
        Enhancing Trading Strategies with AI: Comparing CatBoost and XGBoost
      </h1>
      <span className="my-0 py-0 flex items-center gap-2">
        <Icons.Calendar size={16} />{" "}
        {new Date("2024-07-27T00:00:00.000Z").toLocaleString("en-US", {
          dateStyle: "long",
        })}
      </span>
      {/* Author */}
      <span id="author" className="flex items-center">
        <Icons.UserCircleIcon size={16} />{" "}
        <span className="ml-2">{`Written by: Vadim Nicolai`}</span>
      </span>

      <section>
        <h2>Introduction</h2>
        <p>
          The integration of AI into trading strategies has revolutionized the
          way we approach market forecasts and trade executions. This article
          explores the <strong>FreqaiExampleHybridStrategy</strong>,
          demonstrating how FreqAI can enhance a typical Freqtrade strategy by
          leveraging advanced machine learning techniques to make more informed
          trading decisions.
        </p>
      </section>

      <section>
        <h2>Comparing XGBoost and CatBoost</h2>
        <p>
          In our previous article, we discussed the use of CatBoost in the
          FreqaiExampleHybridStrategy. In this section, we compare CatBoost and
          XGBoost based on various metrics important for financial market
          modeling.
        </p>
        <h3>Performance Metrics</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>XGBoost</th>
              <th>CatBoost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Training Time</td>
              <td>Fast</td>
              <td>Slow</td>
            </tr>
            <tr>
              <td>Inference Time</td>
              <td>Fast</td>
              <td>Moderate</td>
            </tr>
            <tr>
              <td>CPU Utilization</td>
              <td>Moderate</td>
              <td>High</td>
            </tr>
            <tr>
              <td>RAM Consumption</td>
              <td>Moderate</td>
              <td>High</td>
            </tr>
            <tr>
              <td>Profitability</td>
              <td>High (7% profit)</td>
              <td>Moderate (2% profit)</td>
            </tr>
            <tr>
              <td>Accuracy</td>
              <td>High</td>
              <td>High</td>
            </tr>
            <tr>
              <td>Ease of Use</td>
              <td>Moderate</td>
              <td>High</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Experiment Details</h2>
        <p>
          To compare XGBoost and CatBoost, we ran a 3-week long experiment using
          FreqAI, focusing on the performance of both models in predicting
          financial market data. The experiment used live data from
          cryptocurrency markets and evaluated both training and inference
          times, CPU and RAM usage, and the accuracy and profitability of
          predictions.
        </p>
        <p>
          The key results showed that while XGBoost was significantly faster and
          more profitable, CatBoost provided high accuracy but at a higher
          computational cost. Detailed results and metrics from the experiment
          can be found in the original article.
        </p>
      </section>

      <section>
        <h2>Conclusion</h2>
        <p>
          By integrating AI with traditional technical analysis, the
          FreqaiExampleHybridStrategy provides a robust framework for making
          data-driven trading decisions. This hybrid approach leverages the
          strengths of both AI and human-designed indicators, enhancing the
          overall performance of the trading strategy.
        </p>
        <p>
          For more detailed information on the comparison and the experiment,
          refer to the{" "}
          <a href="https://emergentmethods.medium.com/real-time-head-to-head-adaptive-modeling-of-financial-market-data-using-xgboost-and-catboost-995a115a7495">
            full article on Medium
          </a>
          .
        </p>
      </section>
    </article>
  );
}
