import React from "react";
import { Group } from "@visx/group";
import { hierarchy, Tree } from "@visx/hierarchy";
import { LinearGradient } from "@visx/gradient";
import { LinkHorizontal } from "@visx/shape";

const peach = "#fd9b93";
const pink = "#fe6e9e";
const blue = "#03c0dc";
const green = "#26deb0";
const plum = "#71248e";
const lightpurple = "#374469";
const white = "#ffffff";
export const background = "#272b4d";

const TreeAnimation = () => {
  const data = {
    name: "Features",
    children: [
      {
        name: "RSI",
        children: [
          { name: "Period" },
          { name: "Average Gain" },
          { name: "Average Loss" },
        ],
      },
      {
        name: "MFI",
        children: [
          { name: "Period" },
          { name: "Typical Price" },
          { name: "Raw Money Flow" },
        ],
      },
      {
        name: "EMA",
        children: [
          { name: "Period" },
          { name: "Smoothing" },
          { name: "Initial SMA" },
        ],
      },
      {
        name: "SMA",
        children: [
          { name: "Period" },
          { name: "Average" },
          { name: "Weights" },
        ],
      },
    ],
  };

  return (
    <svg width="100%" height={550}>
      <LinearGradient id="lg" from={peach} to={pink} />
      <rect width="100%" height={550} rx={14} fill={background} />
      <Group top={20} left={200}>
        <Tree root={hierarchy(data)} size={[500, 300]}>
          {(tree) => (
            <Group>
              {tree.links().map((link, i) => (
                <LinkHorizontal
                  key={`link-${i}`}
                  data={link}
                  stroke="#ff7300"
                  strokeWidth="1"
                  fill="none"
                />
              ))}
              {tree.descendants().map((node, i) => (
                <Group key={`node-${i}`} top={node.x} left={node.y}>
                  <circle r={15} fill="#f300ff" />
                  <text
                    dy=".33em"
                    fontSize={12}
                    fontFamily="Arial"
                    textAnchor="middle"
                    style={{ pointerEvents: "none" }}
                    fill="#ffffff"
                  >
                    {node.data.name}
                  </text>
                </Group>
              ))}
            </Group>
          )}
        </Tree>
      </Group>
    </svg>
  );
};

export default TreeAnimation;
