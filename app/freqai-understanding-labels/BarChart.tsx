"use client";
import React, { useMemo } from "react";
import { Arc } from "@visx/shape";
import { Group } from "@visx/group";
import { GradientLightgreenGreen } from "@visx/gradient";
import { scaleBand, scaleRadial } from "@visx/scale";
import { Text } from "@visx/text";

const data = [
  {
    label: "Short-Term Price Change",
    value: 30,
    description: "The percentage change in price over a short period.",
  },
  {
    label: "Medium-Term Price Change",
    value: 50,
    description: "The percentage change in price over a medium period.",
  },
  {
    label: "Long-Term Price Change",
    value: 70,
    description: "The percentage change in price over a long period.",
  },
  {
    label: "Short-Term Volatility",
    value: 60,
    description: "The fluctuation in price over a short period.",
  },
  {
    label: "Medium-Term Volatility",
    value: 80,
    description: "The fluctuation in price over a medium period.",
  },
  {
    label: "Short-Term Volume",
    value: 40,
    description: "The trading volume over a short period.",
  },
  {
    label: "Medium-Term Volume",
    value: 90,
    description: "The trading volume over a medium period.",
  },
];

const getLabel = (d) => d.label;
const getValue = (d) => d.value;

const alphabeticalSort = (a, b) => a.label.localeCompare(b.label);

const barColor = "#93F9B9";
const margin = { top: 20, bottom: 20, left: 20, right: 20 };

export default ({ width = 740, height = 800 }) => {
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;
  const radiusMax = Math.min(xMax, yMax) / 2;

  const innerRadius = radiusMax / 3;

  const xDomain = useMemo(() => data.sort(alphabeticalSort).map(getLabel), []);

  const xScale = useMemo(
    () =>
      scaleBand({
        range: [0, 2 * Math.PI],
        domain: xDomain,
        padding: 0.2,
      }),
    [xDomain]
  );

  const yScale = useMemo(
    () =>
      scaleRadial({
        range: [innerRadius, radiusMax],
        domain: [0, Math.max(...data.map(getValue))],
      }),
    [innerRadius, radiusMax]
  );

  return width < 10 ? null : (
    <div style={{ position: "relative" }}>
      <svg width={width} height={height}>
        <GradientLightgreenGreen id="radial-bars-green" />
        <rect
          width={width}
          height={height}
          fill="url(#radial-bars-green)"
          rx={14}
        />
        <Group top={yMax / 2 + margin.top} left={xMax / 2 + margin.left}>
          {data.map((d) => {
            const label = getLabel(d);
            const startAngle = xScale(label);
            const midAngle = startAngle + xScale.bandwidth() / 2;
            const endAngle = startAngle + xScale.bandwidth();

            const outerRadius = yScale(getValue(d)) ?? 0;

            const textRadius = outerRadius + 20; // Adjust this value to move the text further from the edge
            const textX = textRadius * Math.cos(midAngle - Math.PI / 2);
            const textY = textRadius * Math.sin(midAngle - Math.PI / 2);

            return (
              <g key={`bar-${label}`}>
                <Arc
                  cornerRadius={4}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  outerRadius={outerRadius}
                  innerRadius={innerRadius}
                  fill={barColor}
                />
                <Text
                  x={textX}
                  y={textY}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={20}
                  fill={barColor}
                  angle={(midAngle * 180) / Math.PI}
                >
                  {label}
                </Text>
                <Text
                  x={
                    ((innerRadius + textRadius) *
                      Math.cos(midAngle - Math.PI / 2)) /
                    2
                  }
                  y={
                    ((innerRadius + textRadius) *
                      Math.sin(midAngle - Math.PI / 2)) /
                    2
                  }
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={10}
                  fill="#ffffff"
                >
                  {d.value}
                </Text>
              </g>
            );
          })}
        </Group>
      </svg>
    </div>
  );
};
