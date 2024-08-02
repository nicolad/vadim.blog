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
        Understanding the BaseRegressionModel in FreqAI: Training Explained
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
          The `BaseRegressionModel` class in the FreqAI framework is designed to
          facilitate the implementation and training of regression models for
          trading strategies. This article explains the key methods and
          functionalities of this class and how it integrates with the overall
          framework.
        </p>
      </section>

      <section>
        <h2>Training Process in BaseRegressionModel</h2>
        <p>
          The `BaseRegressionModel` class provides essential methods for
          training and predicting with regression models like CatBoost,
          LightGBM, and XGBoost. The main methods involved in the training
          process are `train` and `predict`. Here, we explain how the training
          process works step by step.
        </p>
      </section>

      <section>
        <h3>Step-by-Step Training Process</h3>
        <p>
          The `train` method is responsible for filtering the training data and
          training a model on it. This method makes heavy use of the
          `DataKitchen` for storing, saving, loading, and analyzing the data.
        </p>
        <h4>1. Start Training</h4>
        <p>
          The training process begins with logging the start of the training
          session and capturing the start time.
        </p>
        <pre>
          <code>
            {`logger.info(f"-------------------- Starting training {pair} --------------------");
start_time = time();`}
          </code>
        </pre>

        <h4>2. Filter Features</h4>
        <p>
          The features requested by the user in the configuration file are
          filtered, and NaNs are handled elegantly. This is done using the
          `filter_features` method from the `DataKitchen`.
        </p>
        <pre>
          <code>
            {`features_filtered, labels_filtered = dk.filter_features(
  unfiltered_df,
  dk.training_features_list,
  dk.label_list,
  training_filter=True,
);`}
          </code>
        </pre>

        <h4>3. Log Training Period</h4>
        <p>The training period is logged for reference.</p>
        <pre>
          <code>
            {`start_date = unfiltered_df["date"].iloc[0].strftime("%Y-%m-%d");
end_date = unfiltered_df["date"].iloc[-1].strftime("%Y-%m-%d");
logger.info(
  f"-------------------- Training on data from {start_date} to {end_date} --------------------"
);`}
          </code>
        </pre>

        <h4>4. Split Data into Train/Test</h4>
        <p>
          The data is split into training and testing datasets using the
          `make_train_test_datasets` method.
        </p>
        <pre>
          <code>
            {`dd = dk.make_train_test_datasets(features_filtered, labels_filtered);
if (!self.freqai_info.get("fit_live_predictions_candles", 0) || !self.live) {
  dk.fit_labels();
}`}
          </code>
        </pre>

        <h4>5. Define Data Pipelines</h4>
        <p>
          Data pipelines for features and labels are defined to handle
          transformations.
        </p>
        <pre>
          <code>
            {`dk.feature_pipeline = self.define_data_pipeline(threads=dk.thread_count);
dk.label_pipeline = self.define_label_pipeline(threads=dk.thread_count);`}
          </code>
        </pre>

        <h4>6. Transform Data</h4>
        <p>
          The training features, labels, and weights are transformed using the
          defined pipelines.
        </p>
        <pre>
          <code>
            {`dd["train_features"], dd["train_labels"], dd["train_weights"] = dk.feature_pipeline.fit_transform(
  dd["train_features"], dd["train_labels"], dd["train_weights"]
);
dd["train_labels"], _, _ = dk.label_pipeline.fit_transform(dd["train_labels"]);`}
          </code>
        </pre>

        <h4>7. Transform Test Data</h4>
        <p>
          If test data is available, it is also transformed using the feature
          and label pipelines.
        </p>
        <pre>
          <code>
            {`if (self.freqai_info.get("data_split_parameters", {}).get("test_size", 0.1) != 0) {
  dd["test_features"], dd["test_labels"], dd["test_weights"] = dk.feature_pipeline.transform(
    dd["test_features"], dd["test_labels"], dd["test_weights"]
  );
  dd["test_labels"], _, _ = dk.label_pipeline.transform(dd["test_labels"]);
}`}
          </code>
        </pre>

        <h4>8. Log Training Data</h4>
        <p>
          The number of features and data points used for training are logged.
        </p>
        <pre>
          <code>
            {`logger.info(
  f"Training model on {len(dk.data_dictionary['train_features'].columns)} features"
);
logger.info(f"Training model on {len(dd['train_features'])} data points");`}
          </code>
        </pre>

        <h4>9. Fit the Model</h4>
        <p>
          The actual fitting of the model is done using the `fit` method. This
          is where the model is trained on the provided data.
        </p>
        <pre>
          <code>{`model = self.fit(dd, dk);`}</code>
        </pre>

        <h4>10. End Training</h4>
        <p>
          The training process ends by logging the completion and the time taken
          for training.
        </p>
        <pre>
          <code>
            {`end_time = time();
logger.info(
  f"-------------------- Done training {pair} ({end_time - start_time:.2f} secs) --------------------"
);`}
          </code>
        </pre>
      </section>

      <section>
        <h2>Conclusion</h2>
        <p>
          The `BaseRegressionModel` class in FreqAI provides a comprehensive
          framework for training regression models. By following the structured
          steps outlined in the `train` method, you can ensure that your models
          are trained efficiently and effectively. Understanding this process is
          key to leveraging AI for trading strategies.
        </p>
        <p>
          For more detailed information on AI trading strategies and model
          training, refer to our{" "}
          <a href="https://emergentmethods.medium.com/real-time-head-to-head-adaptive-modeling-of-financial-market-data-using-xgboost-and-catboost-995a115a7495">
            full article on Medium
          </a>
          .
        </p>
      </section>
    </article>
  );
}
