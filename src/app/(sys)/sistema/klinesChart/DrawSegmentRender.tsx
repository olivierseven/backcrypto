"use client";

/**
 * Render de um único segmento de desenho (fibonacci, channel, rectangle, horizontalLine, segment).
 * Extraído de KlinesChartSvg para reduzir tamanho e isolar responsabilidade.
 */
import { DEFAULT_SEGMENT_COLOR, FIB_STROKE_WIDTH_VALUES, HORIZONTAL_LINE_STROKE_STYLE_DASH, type DrawSegment, type FibStrokeWidth } from "../KlinesChartDrawing";
import { MS_PER_DAY } from "../KlinesChartConstants";

export interface DrawSegmentRenderProps {
  segment: DrawSegment;
  index: number;
  segmentToPixel: (index: number, price: number) => { x: number; y: number };
  isSelected: boolean;
  setDrawDragging: React.Dispatch<React.SetStateAction<{ segmentIndex: number; point: 0 | 1 | "extension" | "fibLevel1" | "channelMid" | "channelExtension" | "horizontalLineMove" } | null>>;
  formatYAxis: (v: number) => string;
  fullReversed: (number | string | null)[][];
  n: number;
  fontSize: number;
}

export function DrawSegmentRender({
  segment: seg,
  index: idx,
  segmentToPixel,
  isSelected,
  setDrawDragging,
  formatYAxis,
  fullReversed,
  n,
  fontSize,
}: DrawSegmentRenderProps) {
  const p1 = segmentToPixel(seg.index1, seg.price1);
  const p2 = segmentToPixel(seg.index2, seg.price2);
  const strokeColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
  const lineW = isSelected ? 2 : 1;

  if (seg.type === "fibonacci") {
    const range = seg.price1 - seg.price2;
    const priceTop = Math.max(seg.price1, seg.price2);
    const priceBottom = Math.min(seg.price1, seg.price2);
    const pct1Raw = Math.max(0, Math.min(50, seg.fibLevelPct1 ?? 33.33));
    const pct1 = Math.round(pct1Raw * 10000) / 10000;
    const fibLevels = [
      { k: pct1 / 100, label: `${Number(pct1.toFixed(2))}%` },
      { k: 0.5, label: "50%" },
      { k: 0.618, label: "61.8%" },
    ];
    const mainW = FIB_STROKE_WIDTH_VALUES[(seg.fibStrokeWidth as FibStrokeWidth) ?? "medium"];
    const w618 = FIB_STROKE_WIDTH_VALUES[(seg.fibLevel618StrokeWidth as FibStrokeWidth) ?? "thin"];
    const yTop = segmentToPixel(seg.index1, priceTop).y;
    const yBottom = segmentToPixel(seg.index1, priceBottom).y;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const arrowLen = 8;
    const arrowW = 4;
    const tip = p2;
    const backX = tip.x - arrowLen * ux;
    const backY = tip.y - arrowLen * uy;
    const leftX = backX - uy * arrowW;
    const leftY = backY + ux * arrowW;
    const rightX = backX + uy * arrowW;
    const rightY = backY - ux * arrowW;
    const fmt = (v: number) => formatYAxis(v);
    const valueLevels: { price: number; y: number; color: string }[] = [
      { price: priceTop, y: yTop, color: strokeColor },
      ...fibLevels.map(({ k }) => {
        const priceLevel = seg.price2 + range * k;
        const py = segmentToPixel(seg.index1, priceLevel).y;
        const levelColor = k === 0.618 ? (seg.fibLevel618Color ?? strokeColor) : strokeColor;
        return { price: priceLevel, y: py, color: levelColor };
      }),
      { price: priceBottom, y: yBottom, color: strokeColor },
    ];
    const valueLabelOffset = 6;
    const valuePadW = 42;
    const valuePadH = 10;
    const extendIndices = Math.max(0, seg.fibExtensionIndices ?? 0);
    const extendIndex = seg.index2 + extendIndices;
    const extendPx = segmentToPixel(extendIndex, seg.price2).x;
    const midY = (yTop + yBottom) / 2;
    const dashArray = "2 2";
    return (
      <g key={idx}>
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={strokeColor} strokeWidth={mainW} strokeDasharray="4 2" />
        <path d={`M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={Math.max(1, mainW - 1)} />
        <line x1={p1.x} y1={yTop} x2={p2.x} y2={yTop} stroke={strokeColor} strokeWidth={mainW} />
        <line x1={p1.x} y1={yBottom} x2={p2.x} y2={yBottom} stroke={strokeColor} strokeWidth={mainW} />
        {extendIndices > 0 && (
          <>
            <line x1={p2.x} y1={yTop} x2={extendPx} y2={yTop} stroke={strokeColor} strokeWidth={mainW} strokeDasharray={dashArray} />
            <line x1={p2.x} y1={yBottom} x2={extendPx} y2={yBottom} stroke={strokeColor} strokeWidth={mainW} strokeDasharray={dashArray} />
            {fibLevels.map(({ k, label }) => {
              const priceLevel = seg.price2 + range * k;
              const py = segmentToPixel(seg.index1, priceLevel).y;
              const levelColor = k === 0.618 ? (seg.fibLevel618Color ?? strokeColor) : strokeColor;
              const levelW = k === 0.618 ? w618 : mainW;
              return <line key={label} x1={p2.x} y1={py} x2={extendPx} y2={py} stroke={levelColor} strokeWidth={levelW} strokeDasharray={dashArray} />;
            })}
          </>
        )}
        {seg.showValues === true && valueLevels.map(({ price, y, color }, i) => (
          <g key={i}>
            <rect x={p1.x - valuePadW - valueLabelOffset} y={y - valuePadH / 2} width={valuePadW} height={valuePadH} rx={2} fill="#fff" fillOpacity={0.9} stroke={color} strokeWidth={1} />
            <text x={p1.x - valueLabelOffset} y={y} textAnchor="end" dominantBaseline="middle" fill={color} className="font-mono select-none" style={{ fontSize: 9 }}>{fmt(price)}</text>
          </g>
        ))}
        {fibLevels.map(({ k, label }) => {
          const priceLevel = seg.price2 + range * k;
          const py = segmentToPixel(seg.index1, priceLevel).y;
          const levelColor = k === 0.618 ? (seg.fibLevel618Color ?? strokeColor) : strokeColor;
          const levelW = k === 0.618 ? w618 : mainW;
          const midX = (p1.x + p2.x) / 2;
          const labelW = 36;
          const labelH = 12;
          return (
            <g key={label}>
              <line x1={p1.x} y1={py} x2={p2.x} y2={py} stroke={levelColor} strokeWidth={levelW} />
              {seg.showPercent !== false && (
                <>
                  <rect x={midX - labelW / 2} y={py - labelH - 4} width={labelW} height={labelH} rx={2} fill="#fff" fillOpacity={0.9} stroke={levelColor} strokeWidth={1} />
                  <text x={midX} y={py - labelH / 2 - 4} textAnchor="middle" dominantBaseline="middle" fill={levelColor} className="font-mono select-none" style={{ fontSize: 9 }}>{label}</text>
                </>
              )}
            </g>
          );
        })}
        <g
          pointerEvents="all"
          style={{ cursor: "grab" }}
          onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: idx, point: "extension" }); }}
          onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: idx, point: "extension" }); }}
          onClick={(e) => e.stopPropagation()}
        >
          <path d={`M ${extendPx + 5} ${midY} L ${extendPx - 2} ${midY - 4} L ${extendPx - 2} ${midY + 4} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />
        </g>
      </g>
    );
  }

  if (seg.type === "channel") {
    const offset = seg.channelOffset ?? 0;
    const midColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
    const extremityColor = seg.channelExtremityColor ?? midColor;
    const midW = FIB_STROKE_WIDTH_VALUES[(seg.channelMidStrokeWidth as FibStrokeWidth) ?? "medium"];
    const extremityW = FIB_STROKE_WIDTH_VALUES[(seg.channelExtremityStrokeWidth as FibStrokeWidth) ?? "medium"];
    const pa = segmentToPixel(seg.index1, seg.price1);
    const pb = segmentToPixel(seg.index2, seg.price2);
    const paUp = segmentToPixel(seg.index1, seg.price1 + offset);
    const pbUp = segmentToPixel(seg.index2, seg.price2 + offset);
    const paDn = segmentToPixel(seg.index1, seg.price1 - offset);
    const pbDn = segmentToPixel(seg.index2, seg.price2 - offset);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const arrowLen = 8;
    const arrowW = 4;
    const midDashArray = "6 3";
    const extensionDashArray = "2 5";
    const tipB = pb;
    const backXB = tipB.x - arrowLen * ux;
    const backYB = tipB.y - arrowLen * uy;
    const leftXB = backXB - uy * arrowW;
    const leftYB = backYB + ux * arrowW;
    const rightXB = backXB + uy * arrowW;
    const rightYB = backYB - ux * arrowW;
    const extendIndices = Math.max(0, seg.channelExtensionIndices ?? 0);
    const extendIndex = seg.index2 + extendIndices;
    const deltaIndex = seg.index2 - seg.index1;
    const deltaPrice = seg.price2 - seg.price1;
    const slope = deltaIndex !== 0 ? deltaPrice / deltaIndex : 0;
    const extendedPriceMid = seg.price2 + slope * extendIndices;
    const extendedPriceUp = seg.price2 + offset + slope * extendIndices;
    const extendedPriceDn = seg.price2 - offset + slope * extendIndices;
    const pe = segmentToPixel(extendIndex, extendedPriceMid);
    const pbUpExt = segmentToPixel(extendIndex, extendedPriceUp);
    const pbDnExt = segmentToPixel(extendIndex, extendedPriceDn);
    const topEnd = extendIndices > 0 ? pbUpExt : pbUp;
    const bottomEnd = extendIndices > 0 ? pbDnExt : pbDn;
    const extW = midW;
    const extEW = extremityW;
    return (
      <g key={idx}>
        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={midColor} strokeWidth={extW} strokeDasharray={midDashArray} />
        <path d={`M ${tipB.x} ${tipB.y} L ${leftXB} ${leftYB} L ${rightXB} ${rightYB} Z`} fill={midColor} stroke="none" />
        {extendIndices > 0 && (
          <line x1={pb.x} y1={pb.y} x2={pe.x} y2={pe.y} stroke={midColor} strokeWidth={midW} strokeDasharray={extensionDashArray} />
        )}
        <line x1={paUp.x} y1={paUp.y} x2={pbUp.x} y2={pbUp.y} stroke={extremityColor} strokeWidth={extEW} />
        <line x1={paDn.x} y1={paDn.y} x2={pbDn.x} y2={pbDn.y} stroke={extremityColor} strokeWidth={extEW} />
        {extendIndices > 0 && (
          <>
            <line x1={pbUp.x} y1={pbUp.y} x2={pbUpExt.x} y2={pbUpExt.y} stroke={extremityColor} strokeWidth={extremityW} strokeDasharray={extensionDashArray} />
            <line x1={pbDn.x} y1={pbDn.y} x2={pbDnExt.x} y2={pbDnExt.y} stroke={extremityColor} strokeWidth={extremityW} strokeDasharray={extensionDashArray} />
          </>
        )}
        <circle cx={topEnd.x} cy={topEnd.y} r={3} fill={extremityColor} stroke={extremityColor} strokeWidth={1} />
        <circle cx={bottomEnd.x} cy={bottomEnd.y} r={3} fill={extremityColor} stroke={extremityColor} strokeWidth={1} />
        {seg.showValues === true && (() => {
          const fmt = (v: number) => formatYAxis(v);
          const priceTop = extendIndices > 0 ? extendedPriceUp : seg.price2 + offset;
          const priceBottom = extendIndices > 0 ? extendedPriceDn : seg.price2 - offset;
          const vPadW = 34;
          const vHeight = 16;
          const offsetX = 6;
          return (
            <>
              <rect x={topEnd.x + offsetX} y={topEnd.y - vHeight / 2} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={extremityColor} strokeWidth={1} />
              <text x={topEnd.x + offsetX + vPadW} y={topEnd.y} textAnchor="middle" dominantBaseline="middle" fill={extremityColor} className="font-medium select-none font-mono" style={{ fontSize }}>{fmt(priceTop)}</text>
              <rect x={bottomEnd.x + offsetX} y={bottomEnd.y - vHeight / 2} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={extremityColor} strokeWidth={1} />
              <text x={bottomEnd.x + offsetX + vPadW} y={bottomEnd.y} textAnchor="middle" dominantBaseline="middle" fill={extremityColor} className="font-medium select-none font-mono" style={{ fontSize }}>{fmt(priceBottom)}</text>
            </>
          );
        })()}
      </g>
    );
  }

  if (seg.type === "horizontalLine") {
    const hp1 = segmentToPixel(seg.index1, seg.price1);
    const hp2 = segmentToPixel(seg.index2, seg.price1);
    const strokeW = FIB_STROKE_WIDTH_VALUES[(seg.horizontalLineStrokeWidth as FibStrokeWidth) ?? "medium"];
    const dashStyle = seg.horizontalLineStrokeStyle ?? "solid";
    const strokeDasharray = HORIZONTAL_LINE_STROKE_STYLE_DASH[dashStyle];
    return (
      <g key={idx}>
        <line x1={hp1.x} y1={hp1.y} x2={hp2.x} y2={hp2.y} stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={strokeDasharray} />
      </g>
    );
  }

  if (seg.type === "rectangle") {
    const minI = Math.min(seg.index1, seg.index2);
    const maxI = Math.max(seg.index1, seg.index2);
    const minP = Math.min(seg.price1, seg.price2);
    const maxP = Math.max(seg.price1, seg.price2);
    const tl = segmentToPixel(minI, maxP);
    const br = segmentToPixel(maxI, minP);
    const rx = tl.x;
    const ry = tl.y;
    const rw = Math.max(0, br.x - tl.x);
    const rh = Math.max(0, br.y - tl.y);
    const rectStrokeW = FIB_STROKE_WIDTH_VALUES[(seg.rectangleStrokeWidth as FibStrokeWidth) ?? "medium"];
    const filled = seg.rectangleFilled === true;
    return (
      <g key={idx}>
        <rect x={rx} y={ry} width={rw} height={rh} fill={filled ? strokeColor : "none"} fillOpacity={filled ? 0.3 : undefined} stroke={strokeColor} strokeWidth={rectStrokeW} />
      </g>
    );
  }

  // segment (line)
  const startCap = seg.startCap ?? "none";
  const endCap = seg.endCap ?? "none";
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const arrowLen = 8;
  const arrowW = 4;
  return (
    <g key={idx}>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={strokeColor} strokeWidth={lineW} />
      {startCap === "point" && <circle cx={p1.x} cy={p1.y} r={3} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />}
      {endCap === "point" && <circle cx={p2.x} cy={p2.y} r={3} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />}
      {startCap === "arrow" && (() => {
        const tip = p1;
        const u1 = (p1.x - p2.x) / len;
        const u2 = (p1.y - p2.y) / len;
        const backX = tip.x - arrowLen * u1;
        const backY = tip.y - arrowLen * u2;
        const leftX = backX - u2 * arrowW;
        const leftY = backY + u1 * arrowW;
        const rightX = backX + u2 * arrowW;
        const rightY = backY - u1 * arrowW;
        return <path d={`M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />;
      })()}
      {endCap === "arrow" && (() => {
        const tip = p2;
        const backX = tip.x - arrowLen * ux;
        const backY = tip.y - arrowLen * uy;
        const leftX = backX - uy * arrowW;
        const leftY = backY + ux * arrowW;
        const rightX = backX + uy * arrowW;
        const rightY = backY - ux * arrowW;
        return <path d={`M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />;
      })()}
      {seg.showPercent !== false && (() => {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const offset = 14;
        const labelX = midX;
        const labelY = midY - offset;
        const percent = seg.price1 !== 0 ? ((seg.price2 - seg.price1) / seg.price1) * 100 : 0;
        const percentStr = percent >= 0 ? `+${percent.toFixed(4)}%` : `${percent.toFixed(4)}%`;
        const i1 = Math.max(0, Math.min(seg.index1, n - 1));
        const i2 = Math.max(0, Math.min(seg.index2, n - 1));
        const openTime1 = fullReversed[i1]?.[0] ?? 0;
        const openTime2 = fullReversed[i2]?.[0] ?? 0;
        const days = Math.round((Number(openTime2) - Number(openTime1)) / MS_PER_DAY);
        const daysStr = `${days}d`;
        const textColor = percent >= 0 ? "#059669" : "#dc2626";
        const padW = 44;
        const padH = 14;
        return (
          <g>
            <rect x={labelX - padW} y={labelY - 12} width={padW * 2} height={padH * 2} rx={4} ry={4} fill="#ffffff" fillOpacity={0.8} stroke={textColor} strokeWidth={1} />
            <text x={labelX} y={labelY} textAnchor="middle" fill={textColor} className="font-medium select-none" style={{ fontSize }}>
              <tspan x={labelX} dy={0}>{percentStr}</tspan>
              <tspan x={labelX} dy={11}>{daysStr}</tspan>
            </text>
          </g>
        );
      })()}
      {seg.showValues === true && (() => {
        const fmt = (v: number) => formatYAxis(v);
        const v1 = fmt(seg.price1);
        const v2 = fmt(seg.price2);
        const vPadW = 34;
        const vHeight = 16;
        const textBaselineY = -6;
        const textCenterY = textBaselineY - 5;
        const rectY1 = p1.y + textCenterY - vHeight / 2;
        const rectY2 = p2.y + textCenterY - vHeight / 2;
        return (
          <>
            <rect x={p1.x - vPadW} y={rectY1} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={strokeColor} strokeWidth={1} />
            <text x={p1.x} y={p1.y - 6} textAnchor="middle" fill={strokeColor} className="font-medium select-none" style={{ fontSize }}>{v1}</text>
            <rect x={p2.x - vPadW} y={rectY2} width={vPadW * 2} height={vHeight} rx={3} ry={3} fill="#ffffff" fillOpacity={0.8} stroke={strokeColor} strokeWidth={1} />
            <text x={p2.x} y={p2.y - 6} textAnchor="middle" fill={strokeColor} className="font-medium select-none" style={{ fontSize }}>{v2}</text>
          </>
        );
      })()}
    </g>
  );
}
