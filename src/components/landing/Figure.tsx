/**
 * Line-drawn people for the landing page: cream line work on soot, with lime as the one accent.
 * Each figure is assembled from a few parts (hair, clothes, one prop) so the page can show many
 * different people in one consistent hand. They are illustrations, not likenesses.
 */

const SOOT = "#0f0f0f";
const CREAM = "#f1e9d6";
const LIME = "#dafa9c";
const LINE = { stroke: CREAM, strokeWidth: 2.2, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const INK = { stroke: SOOT, strokeWidth: 2.4, strokeLinejoin: "round", strokeLinecap: "round" } as const;

export type Hair = "short" | "wavy" | "bun" | "long" | "curly";
export type Wear = "hoodie" | "shirt" | "tee" | "kurta";
export type Prop = "phone" | "headphones" | "glasses" | "earrings" | "stole" | "magnifier" | "stamp" | "pen";

export interface Look {
  readonly hair: Hair;
  readonly wear: Wear;
  readonly props: readonly Prop[];
}

/** Hair drawn behind the face (only long hair has any). */
function BackHair({ hair }: { hair: Hair }) {
  if (hair !== "long") return null;
  return <path d="M52 110 C46 66 72 44 100 44 C128 44 154 66 148 110 L152 178 C142 186 128 182 124 172 L122 122 L78 122 L76 172 C72 182 58 186 48 178 Z" fill={SOOT} {...LINE} />;
}

const CURLS = [
  [64, 84, 14],
  [74, 64, 15],
  [94, 52, 16],
  [116, 54, 16],
  [134, 68, 15],
  [140, 88, 13],
  [60, 102, 9],
  [143, 104, 8],
] as const;

function FrontHair({ hair }: { hair: Hair }) {
  switch (hair) {
    case "short":
      return (
        <g>
          <path d="M58 106 C54 70 74 46 102 46 C130 46 148 68 142 106 C138 90 130 80 120 76 C108 86 86 88 70 82 C64 88 60 96 58 106 Z" fill={SOOT} {...LINE} />
          <path d="M78 60 q12 -7 26 -4 M108 55 q14 3 22 13 M70 72 q6 -6 14 -8" fill="none" {...LINE} strokeWidth={1.4} />
        </g>
      );
    case "wavy":
      return (
        <g>
          <path d="M56 104 C50 78 60 54 80 48 C86 38 104 36 114 44 C130 40 146 56 144 74 C150 86 146 98 142 106 C138 92 130 82 118 80 C112 88 98 88 92 80 C84 88 70 88 64 84 C60 90 58 98 56 104 Z" fill={SOOT} {...LINE} />
          <path d="M84 52 q8 6 4 16 M108 48 q10 6 6 18 M126 58 q6 8 2 16" fill="none" {...LINE} strokeWidth={1.4} />
        </g>
      );
    case "curly":
      return (
        <g fill={SOOT} {...LINE}>
          {CURLS.map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
          ))}
          <path d="M70 88 C84 74 118 72 132 88 C120 82 84 82 70 88 Z" />
        </g>
      );
    case "bun":
      return (
        <g>
          <circle cx="100" cy="36" r="16" fill={SOOT} {...LINE} />
          <path d="M92 30 q8 -4 16 2" fill="none" {...LINE} strokeWidth={1.4} />
          <path d="M58 108 C54 70 74 48 100 48 C126 48 146 70 142 108 C140 92 128 76 100 74 C76 76 62 90 58 108 Z" fill={SOOT} {...LINE} />
          <path d="M100 50 L100 72 M82 56 q-10 10 -14 26 M118 56 q10 10 14 26" fill="none" {...LINE} strokeWidth={1.4} />
        </g>
      );
    case "long":
      return (
        <g>
          <path d="M58 106 C56 74 76 52 100 52 C124 52 144 74 142 106 C134 88 118 78 102 76 C88 84 72 92 58 106 Z" fill={SOOT} {...LINE} />
          <path d="M102 54 q-4 12 0 22 M78 66 q-6 10 -8 22" fill="none" {...LINE} strokeWidth={1.4} />
        </g>
      );
  }
}

function Clothes({ wear }: { wear: Wear }) {
  return (
    <g>
      <path d="M8 240 C14 196 52 178 86 176 Q100 190 114 176 C148 178 186 196 192 240 Z" fill={SOOT} {...LINE} />
      {wear === "hoodie" && (
        <g fill="none">
          <path d="M60 192 C62 172 78 162 88 168 M140 192 C138 172 122 162 112 168" {...LINE} />
          <path d="M92 188 L90 216 M108 188 L110 216" stroke={LIME} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx="90" cy="219" r="3" fill={LIME} />
          <circle cx="110" cy="219" r="3" fill={LIME} />
          <path d="M70 240 L72 226 Q100 232 128 226 L130 240" {...LINE} strokeWidth={1.6} />
        </g>
      )}
      {wear === "shirt" && (
        <g>
          <path d="M86 176 L74 198 L98 186 Z M114 176 L126 198 L102 186 Z" fill={SOOT} {...LINE} />
          <path d="M100 188 L100 240" fill="none" {...LINE} strokeWidth={1.6} />
          {[204, 222].map((y) => (
            <circle key={y} cx="100" cy={y} r="2.2" fill={CREAM} />
          ))}
        </g>
      )}
      {wear === "tee" && <path d="M82 178 Q100 198 118 178" fill="none" {...LINE} />}
      {wear === "kurta" && (
        <g fill="none">
          <path d="M88 180 L100 196 L112 180 M100 196 L100 236" {...LINE} />
          {[206, 218, 230].map((y) => (
            <circle key={y} cx="100" cy={y} r="2" fill={LIME} stroke="none" />
          ))}
        </g>
      )}
    </g>
  );
}

function Face() {
  return (
    <g>
      <path d="M86 148 L86 180 Q100 192 114 180 L114 148 Z" fill={CREAM} {...INK} />
      <ellipse cx="60" cy="110" rx="8" ry="12" fill={CREAM} {...INK} />
      <ellipse cx="140" cy="110" rx="8" ry="12" fill={CREAM} {...INK} />
      <path d="M60 104 C60 70 78 52 100 52 C122 52 140 70 140 104 C140 136 122 160 100 160 C78 160 60 136 60 104 Z" fill={CREAM} {...INK} />
      <path d="M74 99 q10 -6 20 -1 M106 98 q10 -5 20 1" fill="none" {...INK} strokeWidth={3} />
      <ellipse cx="84" cy="111" rx="3.4" ry="4.2" fill={SOOT} />
      <ellipse cx="116" cy="111" rx="3.4" ry="4.2" fill={SOOT} />
      <path d="M100 113 q-5 13 1 15" fill="none" {...INK} strokeWidth={2} />
      <path d="M86 135 q14 13 28 0 Z" fill={SOOT} {...INK} />
    </g>
  );
}

function FaceProps({ props }: { props: readonly Prop[] }) {
  return (
    <g>
      {props.includes("glasses") && (
        <g fill="none" {...INK} strokeWidth={3}>
          <rect x="71" y="100" width="25" height="20" rx="7" />
          <rect x="104" y="100" width="25" height="20" rx="7" />
          <path d="M96 108 q4 -3 8 0 M71 106 L62 102 M129 106 L138 102" />
        </g>
      )}
      {props.includes("earrings") && (
        <g fill={LIME} stroke={SOOT} strokeWidth={1.6}>
          <circle cx="58" cy="126" r="4.5" />
          <circle cx="142" cy="126" r="4.5" />
        </g>
      )}
    </g>
  );
}

function BodyProps({ props }: { props: readonly Prop[] }) {
  const has = (p: Prop) => props.includes(p);
  return (
    <g>
      {has("stole") && (
        <g>
          <path d="M116 176 C132 188 140 214 136 240 L118 240 C122 214 116 196 106 184 Z" fill={LIME} {...INK} strokeWidth={2} />
          {[196, 210, 224].map((y, i) => (
            <circle key={y} cx={124 + i * 2} cy={y} r="2.2" fill={SOOT} />
          ))}
        </g>
      )}
      {has("headphones") && (
        <g>
          <path d="M66 178 C70 198 130 198 134 178" fill="none" stroke={LIME} strokeWidth={6} strokeLinecap="round" />
          <rect x="54" y="166" width="17" height="24" rx="6" fill={LIME} stroke={SOOT} strokeWidth={2} />
          <rect x="129" y="166" width="17" height="24" rx="6" fill={LIME} stroke={SOOT} strokeWidth={2} />
        </g>
      )}
      {has("phone") && (
        <g>
          <rect x="142" y="186" width="28" height="46" rx="6" fill={SOOT} {...LINE} />
          <rect x="147" y="193" width="18" height="26" rx="2" fill={LIME} />
          <path d="M138 228 C134 214 146 208 152 214 L170 214 C178 216 178 230 168 234 L146 240 Z" fill={CREAM} {...INK} />
        </g>
      )}
      {has("magnifier") && (
        <g>
          <path d="M150 236 L166 210" stroke={CREAM} strokeWidth={7} strokeLinecap="round" />
          <circle cx="172" cy="198" r="16" fill="none" stroke={LIME} strokeWidth={5} />
        </g>
      )}
      {has("stamp") && (
        <g>
          <rect x="146" y="196" width="22" height="20" rx="4" fill={SOOT} {...LINE} />
          <rect x="140" y="216" width="34" height="10" rx="2" fill={LIME} stroke={SOOT} strokeWidth={2} />
          <path d="M136 238 C134 226 148 222 154 228 L172 228 C178 230 178 238 172 240 Z" fill={CREAM} {...INK} />
        </g>
      )}
      {has("pen") && (
        <g>
          <path d="M150 240 L172 196" stroke={LIME} strokeWidth={6} strokeLinecap="round" />
          <path d="M172 196 L176 188" stroke={CREAM} strokeWidth={6} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

/**
 * One person. `crop="head"` frames the face for a round avatar.
 * Decorative unless `label` is given.
 */
export function Figure({ look, crop = "full", label, className }: { look: Look; crop?: "full" | "head"; label?: string; className?: string }) {
  const viewBox = crop === "head" ? "34 22 132 132" : "0 0 200 240";
  return (
    <svg viewBox={viewBox} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Clothes wear={look.wear} />
      <BackHair hair={look.hair} />
      <Face />
      <FrontHair hair={look.hair} />
      <FaceProps props={look.props} />
      <BodyProps props={look.props} />
    </svg>
  );
}
