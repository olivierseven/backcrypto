export type ChartPoint = { year: number; births: number; deaths: number; deathsAccum: number; population: number };

export function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 10e9 ? 0 : 1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 10e6 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 10e3 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export function LineChart<T extends { year: number }>({
  data,
  getVal,
  maxVal,
  color,
  gradId,
  onPointClick,
  selectedPoint,
}: {
  data: T[];
  getVal: (p: T) => number;
  maxVal: number;
  color: string;
  gradId: string;
  onPointClick?: (year: number, value: number) => void;
  selectedPoint?: { year: number; value: number } | null;
}) {
  const chartLeft = 45;
  const chartRight = 385;
  const chartTop = 25;
  const chartBottom = 220;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;
  const xs = data.map((_, i) =>
    data.length > 1 ? chartLeft + (i / (data.length - 1)) * chartW : chartLeft + chartW / 2
  );
  const ys = data.map((p) => chartBottom - (maxVal > 0 ? (getVal(p) / maxVal) * chartH : 0));
  const pts = data.map((_, i) => `${xs[i]},${ys[i]}`).join(" ");
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet" className="w-full h-auto">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="1" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8].map((f) => (
        <line
          key={f}
          x1={45}
          y1={25 + (1 - f) * 195}
          x2={385}
          y2={25 + (1 - f) * 195}
          stroke="#e5e5e5"
          strokeWidth="1"
        />
      ))}
      <line x1={40} y1={20} x2={40} y2={220} stroke="#000" strokeWidth="1" />
      <line x1={40} y1={220} x2={390} y2={220} stroke="#000" strokeWidth="1" />
      <polygon
        points={`${chartLeft},${chartBottom} ${pts} ${xs[xs.length - 1]},${chartBottom}`}
        fill={`url(#${gradId})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((p, i) => {
        const v = getVal(p);
        const sel = selectedPoint?.year === p.year && selectedPoint?.value === v;
        return (
          <g key={p.year}>
            {sel && (() => {
              const rx = Math.max(50, Math.min(310, xs[i] - 40));
              const ry = Math.max(5, ys[i] - 36);
              return (
                <g>
                  <rect x={rx} y={ry} width={80} height={36} rx={4} fill="#1f2937" />
                  <text x={rx + 40} y={ry + 12} textAnchor="middle" fontSize="10" fill="white">
                    {p.year}
                  </text>
                  <text x={rx + 40} y={ry + 26} textAnchor="middle" fontSize="10" fill="white">
                    {formatCompact(v)}
                  </text>
                </g>
              );
            })()}
            <circle
              cx={xs[i]}
              cy={ys[i]}
              r={sel ? 5 : 3}
              fill={color}
              stroke={sel ? "#1f2937" : "none"}
              strokeWidth={sel ? 2 : 0}
              className="cursor-pointer"
              onClick={() => onPointClick?.(p.year, v)}
            />
          </g>
        );
      })}
      {data
        .filter((_, i) => i % 5 === 0 || i === data.length - 1)
        .map((p) => {
          const i = data.findIndex((x) => x.year === p.year);
          const x = data.length > 1 ? chartLeft + (i / (data.length - 1)) * chartW : chartLeft + chartW / 2;
          return (
            <text key={p.year} x={x} y={238} textAnchor="middle" fontSize="10" fill="#737373">
              {p.year}
            </text>
          );
        })}
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => (
        <text key={f} x={32} y={25 + (1 - f) * 195} textAnchor="end" fontSize="9" fill="#737373">
          {formatCompact(maxVal * f)}
        </text>
      ))}
    </svg>
  );
}
