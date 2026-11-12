"use client";

/**
 * A night street where brand copy actually lives: shop signs, a billboard, Diwali lights.
 * It rises out of the footer in three layers that move at different speeds.
 */

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const SOOT = "#0f0f0f";
const SOOT3 = "#262626";
const CREAM = "#f1e9d6";
const LIME = "#dafa9c";
const W = 1200;
const H = 320;

// [x, width, height] for each layer; windows are generated from these.
const BACK = [
  [0, 90, 210], [80, 70, 250], [150, 110, 190], [250, 80, 270], [330, 120, 220], [450, 70, 290], [520, 110, 200],
  [630, 90, 260], [720, 120, 230], [840, 80, 280], [920, 110, 210], [1030, 90, 250], [1120, 80, 220],
] as const;
const MID = [
  [20, 130, 150], [170, 100, 180], [290, 150, 140], [470, 120, 190], [610, 160, 150], [790, 110, 175], [920, 140, 160], [1080, 120, 185],
] as const;

function Windows({ x, w, h, lit }: { x: number; w: number; h: number; lit: number }) {
  const cells = [];
  for (let row = 0; row * 22 + 26 < h - 20; row++) {
    for (let col = 0; col * 20 + 16 < w - 10; col++) {
      const on = (row * 7 + col * 3 + lit) % 5 === 0;
      cells.push(<rect key={`${row}-${col}`} x={x + 12 + col * 20} y={H - h + 20 + row * 22} width="9" height="12" rx="1" fill={on ? LIME : CREAM} opacity={on ? 1 : 0.18} />);
    }
  }
  return <>{cells}</>;
}

const SIGNS = [
  { x: 60, label: "Chai", fill: CREAM },
  { x: 300, label: "Mobile repair", fill: CREAM },
  { x: 640, label: "Sweets", fill: CREAM },
  { x: 950, label: "Tailor", fill: CREAM },
];

export function Skyline() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const back = useTransform(scrollYProgress, [0, 1], [70, 0]);
  const mid = useTransform(scrollYProgress, [0, 1], [130, 0]);
  const front = useTransform(scrollYProgress, [0, 1], [40, 0]);
  const moon = useTransform(scrollYProgress, [0, 1], [60, 0]);
  const s = (v: typeof back) => (reduce ? undefined : { y: v });

  return (
    <div ref={ref} className="-mx-[var(--margin)] -mb-px overflow-hidden" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" preserveAspectRatio="xMidYMax slice">
        <motion.g style={s(moon)}>
          <circle cx="980" cy="70" r="30" fill={LIME} />
          <circle cx="994" cy="62" r="26" fill="#ffffff" />
        </motion.g>

        <motion.g style={s(back)}>
          {BACK.map(([x, w, h]) => (
            <rect key={x} x={x} y={H - h} width={w} height={h} fill={SOOT3} />
          ))}
        </motion.g>

        <motion.g style={s(mid)}>
          {MID.map(([x, w, h], i) => (
            <g key={x}>
              <rect x={x} y={H - h} width={w} height={h} fill={SOOT} stroke={CREAM} strokeWidth="1.5" />
              <Windows x={x} w={w} h={h} lit={i} />
            </g>
          ))}
          {/* the billboard: a QuickKart post that has been approved */}
          <g transform="translate(470 92)">
            <path d="M40 38 L40 60 M80 38 L80 60" stroke={CREAM} strokeWidth="3" />
            <rect x="0" y="-20" width="120" height="60" rx="4" fill={CREAM} />
            <text x="12" y="6" fontSize="17" fontWeight="700" fill={SOOT} fontFamily="var(--font-bricolage), sans-serif">QuickKart</text>
            <text x="12" y="26" fontSize="11" fill={SOOT} fontFamily="var(--font-bricolage), sans-serif">Diwali sale, 40+ cities</text>
            <circle cx="114" cy="-18" r="13" fill={LIME} stroke={SOOT} strokeWidth="2" />
            <path d="M108 -18 l4 4 l8 -9" stroke={SOOT} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          {/* Diwali string lights between rooftops */}
          {[
            [150, 170, 290, 180],
            [610, 170, 790, 145],
            [920, 160, 1080, 135],
          ].map(([x1, y1, x2, y2]) => {
            const mx = (x1 + x2) / 2;
            const my = Math.max(y1, y2) + 28;
            return (
              <g key={x1}>
                <path d={`M${x1} ${y1} Q${mx} ${my + 14} ${x2} ${y2}`} stroke={CREAM} strokeWidth="1" fill="none" opacity="0.6" />
                {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((t) => {
                  const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
                  const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * (my + 14) + t * t * y2;
                  return <circle key={t} cx={bx} cy={by + 3} r="3.2" fill={LIME} />;
                })}
              </g>
            );
          })}
        </motion.g>

        <motion.g style={s(front)}>
          <rect x="-4" y={H - 46} width={W + 8} height="70" fill={SOOT} />
          {SIGNS.map((sg) => (
            <g key={sg.x} transform={`translate(${sg.x} ${H - 78})`}>
              <rect width={sg.label.length * 11 + 28} height="30" rx="3" fill={sg.fill} />
              <text x="14" y="20" fontSize="15" fontWeight="600" fill={SOOT} fontFamily="var(--font-bricolage), sans-serif">
                {sg.label}
              </text>
            </g>
          ))}
        </motion.g>
      </svg>
    </div>
  );
}
