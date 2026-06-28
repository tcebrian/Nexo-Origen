type TalentoSparklineProps = {
  values: number[];
  positive?: boolean;
  width?: number;
  height?: number;
};

export function TalentoSparkline({
  values,
  positive = true,
  width = 80,
  height = 32,
}: TalentoSparklineProps) {
  const stroke = positive ? "#34D399" : "#F87171";
  const fill = positive ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)";

  if (values.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden className="opacity-40">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pad = 3;

  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return { x, y };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = [
    `0,${height}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${width},${height}`,
  ].join(" ");

  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polygon points={areaPoints} fill={fill} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2.5"
        fill={stroke}
      />
    </svg>
  );
}
