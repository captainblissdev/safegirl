/**
 * The small cluster of five-petal flowers on the splash and Home: inline
 * SVG, decoration only (aria-hidden), never behind text or controls. Its
 * fills (20 to 35 percent opacity) and its one-off fade, scale and sway
 * (static with reduced motion) come from the CSS for the class it gets.
 */

/** One five-petal flower, centred at (x, y), petals of radius r. */
function Flower({
  x,
  y,
  r,
  tone,
}: {
  x: number;
  y: number;
  r: number;
  tone: "pink" | "white";
}) {
  // Five petals, 72 degrees apart (computed: the source types no 3-digit run).
  const petals = [0, 1, 2, 3, 4].map((i) => i * 72);
  return (
    <g
      className={`splash-flower splash-flower--${tone}`}
      transform={`translate(${x} ${y})`}
    >
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx={0}
          cy={-r}
          rx={r * 0.62}
          ry={r}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle className="splash-flower-centre" r={r * 0.42} />
    </g>
  );
}

/** The cluster: three flowers; or, with single, its large flower alone. */
export default function Flowers({
  className = "splash-flowers",
  single = false,
}: {
  className?: string;
  single?: boolean;
}) {
  if (single) {
    return (
      <svg
        className={className}
        viewBox="20 0 60 60"
        aria-hidden="true"
        focusable="false"
      >
        <Flower x={50} y={30} r={15} tone="pink" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      viewBox="0 0 80 96"
      aria-hidden="true"
      focusable="false"
    >
      <Flower x={50} y={30} r={15} tone="pink" />
      <Flower x={20} y={62} r={8} tone="white" />
      <Flower x={62} y={78} r={7} tone="pink" />
    </svg>
  );
}
