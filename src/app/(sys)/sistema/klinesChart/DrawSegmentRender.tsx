"use client";

/**
 * Render de um único segmento de desenho (fibonacci, channel, rectangle, horizontalLine, segment).
 * Extraído de KlinesChartSvg para reduzir tamanho e isolar responsabilidade.
 */
import { DEFAULT_SEGMENT_COLOR, DEFAULT_TEXT_COLOR, FIB_STROKE_WIDTH_VALUES, HORIZONTAL_LINE_STROKE_STYLE_DASH, ARROW_OPACITY, getTextSegmentBox, type DrawSegment, type FibStrokeWidth, type ArrowSize, type TextSize } from "../KlinesChartDrawing";
const ARROW_EDIT_EXTEND_PX = 600;
import { MS_PER_DAY } from "../KlinesChartConstants";

export interface DrawSegmentRenderProps {
  segment: DrawSegment;
  index: number;
  segmentToPixel: (index: number, price: number) => { x: number; y: number };
  isSelected: boolean;
  setDrawDragging: React.Dispatch<React.SetStateAction<{ segmentIndex: number; point: 0 | 1 | "extension" | "fibLevel1" | "freeRetracementLevel1" | "freeRetracementLevel" | "freeRetracementLevelExt" | "channelMid" | "channelExtension" | "stopGainMid" | "stopGainMove" | "stopGainGainLine" | "stopGainStopLine" | "horizontalLineMove" | "verticalLineMove" | "arrowMove" | "textMove" } | null>>;
  formatYAxis: (v: number) => string;
  fullReversed: (number | string | null)[][];
  n: number;
  fontSize: number;
  /** Índice máximo visível (último candle à direita) para estender reta horizontal até o fim do gráfico. */
  maxVisibleIndex?: number;
  /** Limites Y (pixels) do gráfico principal para reta vertical ocupar toda a altura. */
  mainChartTopY?: number;
  mainChartBottomY?: number;
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
  maxVisibleIndex = n - 1,
  mainChartTopY = 0,
  mainChartBottomY = 0,
}: DrawSegmentRenderProps) {
  const p1 = segmentToPixel(seg.index1, seg.price1);
  const p2 = segmentToPixel(seg.index2, seg.price2);
  const strokeColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
  const lineW = isSelected ? 2 : 1;

  if (seg.type === "fibonacci" || seg.type === "freeRetracement") {
    const range = seg.price1 - seg.price2;
    const priceTop = Math.max(seg.price1, seg.price2);
    const priceBottom = Math.min(seg.price1, seg.price2);
    const mainW = FIB_STROKE_WIDTH_VALUES[(seg.fibStrokeWidth as FibStrokeWidth) ?? "medium"];
    const w618 = seg.type === "fibonacci" ? FIB_STROKE_WIDTH_VALUES[(seg.fibLevel618StrokeWidth as FibStrokeWidth) ?? "thin"] : mainW;
    const fibLevels: { k: number; label: string }[] =
      seg.type === "fibonacci"
        ? (() => {
            const pct1Raw = Math.max(0, Math.min(50, seg.fibLevelPct1 ?? 33.33));
            const pct1 = Math.round(pct1Raw * 10000) / 10000;
            const levels: { k: number; label: string }[] = [
              { k: pct1 / 100, label: `${Number(pct1.toFixed(2))}%` },
              { k: 0.5, label: "50%" },
              { k: 0.618, label: "61.8%" },
            ];
            if (seg.fibShow1618 === true) levels.push({ k: 1.618, label: "161.8%" });
            return levels;
          })()
        : (() => {
            const pct1Raw = Math.max(0, Math.min(50, seg.freeRetracementLevelPct1 ?? 33.33));
            const pct2Raw = Math.max(50, Math.min(100, seg.freeRetracementLevelPct ?? 61.8));
            const pctExtRaw = Math.max(100, Math.min(200, seg.freeRetracementLevelPctExt ?? 100));
            const pct1 = Math.round(pct1Raw * 10000) / 10000;
            const pct2 = Math.round(pct2Raw * 10000) / 10000;
            const pctExt = Math.round(pctExtRaw * 10000) / 10000;
            return [
              { k: pct1 / 100, label: `${Number(pct1.toFixed(2))}%` },
              { k: 0.5, label: "50%" },
              { k: pct2 / 100, label: `${Number(pct2.toFixed(2))}%` },
              { k: pctExt / 100, label: `${Number(pctExt.toFixed(2))}%` },
            ];
          })();
    const getLevelColor = (k: number) =>
      seg.type === "fibonacci" && (k === 0.618 || k === 1.618) ? (seg.fibLevel618Color ?? strokeColor) : strokeColor;
    const getLevelWidth = (k: number) => (seg.type === "fibonacci" && (k === 0.618 || k === 1.618) ? w618 : mainW);
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
    const extendIndices =
      seg.type === "fibonacci"
        ? Math.max(0, seg.fibExtensionIndices ?? 0)
        : Math.max(0, seg.freeRetracementExtensionIndices ?? 0);
    const extendPx = segmentToPixel(seg.index2 + extendIndices, seg.price2).x;
    const midY = (yTop + yBottom) / 2;
    const dashArray = "2 2";
    const fmt = (v: number) => formatYAxis(v);
    const valueLabelOffset = 6;
    const valuePadW = 42;
    const valuePadH = 10;
    const labelW = 36;
    const labelH = 12;
    const midX = (p1.x + p2.x) / 2;
    const valueLevels: { price: number; y: number; color: string }[] = [
      { price: priceTop, y: yTop, color: strokeColor },
      ...fibLevels.map(({ k }) => ({
        price: seg.price2 + range * k,
        y: segmentToPixel(seg.index1, seg.price2 + range * k).y,
        color: getLevelColor(k),
      })),
      { price: priceBottom, y: yBottom, color: strokeColor },
    ];
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
            {fibLevels.map(({ k, label }, levelIdx) => {
              const py = segmentToPixel(seg.index1, seg.price2 + range * k).y;
              return <line key={`ext-${levelIdx}`} x1={p2.x} y1={py} x2={extendPx} y2={py} stroke={getLevelColor(k)} strokeWidth={getLevelWidth(k)} strokeDasharray={dashArray} />;
            })}
          </>
        )}
        {seg.showValues === true && valueLevels.map(({ price, y, color }, i) => (
          <g key={i}>
            <rect x={p1.x - valuePadW - valueLabelOffset} y={y - valuePadH / 2} width={valuePadW} height={valuePadH} rx={2} fill="#fff" fillOpacity={0.9} stroke={color} strokeWidth={1} />
            <text x={p1.x - valueLabelOffset} y={y} textAnchor="end" dominantBaseline="middle" fill={color} className="font-mono select-none" style={{ fontSize: 9 }}>{fmt(price)}</text>
          </g>
        ))}
        {fibLevels.map(({ k, label }, levelIdx) => {
          const py = segmentToPixel(seg.index1, seg.price2 + range * k).y;
          const levelColor = getLevelColor(k);
          const levelW = getLevelWidth(k);
          return (
            <g key={`level-${levelIdx}`}>
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

  if (seg.type === "stopGain") {
    const midPrice = seg.price1;
    const ru = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioUp ?? 1) * 100) / 100));
    const rd = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioDown ?? 1) * 100) / 100));
    const openAmount = Math.max(0, seg.stopGainOpenAmount ?? 0);
    const gainOffset = openAmount * (ru / (ru + rd));
    const stopOffset = openAmount * (rd / (ru + rd));
    const priceTop = midPrice + gainOffset;
    const priceBottom = midPrice - stopOffset;
    const pa = segmentToPixel(seg.index1, midPrice);
    const pb = segmentToPixel(seg.index2, midPrice);
    const paUp = segmentToPixel(seg.index1, priceTop);
    const pbUp = segmentToPixel(seg.index2, priceTop);
    const paDn = segmentToPixel(seg.index1, priceBottom);
    const pbDn = segmentToPixel(seg.index2, priceBottom);
    const fillOpacity = Math.max(0.1, Math.min(0.7, seg.stopGainFillOpacity ?? 0.5));
    const green = "#059669";
    const red = "#dc2626";
    const midColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
    const strokeW = FIB_STROKE_WIDTH_VALUES[(seg.stopGainStrokeWidth === "thin" ? "thin" : "medium") as FibStrokeWidth];
    const showPercent = seg.stopGainShowPercent === true;
    const pctGain = midPrice > 0 ? (gainOffset / midPrice) * 100 : 0;
    const pctStop = midPrice > 0 ? (stopOffset / midPrice) * 100 : 0;
    const padH = Math.max(10, Math.ceil(fontSize * 1.1) + 4);
    const textGain = `+${pctGain.toFixed(2)}%`;
    const textStop = `-${pctStop.toFixed(2)}%`;
    const approxCharWidth = fontSize * 0.55;
    const padW = Math.max(36, Math.ceil(Math.max(textGain.length, textStop.length) * approxCharWidth) + 6);
    const midX = (pa.x + pb.x) / 2;
    const gainLineCenterY = (paUp.y + pbUp.y) / 2;
    const stopLineCenterY = (paDn.y + pbDn.y) / 2;
    const gap = 2;
    const dottedDash = HORIZONTAL_LINE_STROKE_STYLE_DASH.dotted;
    const rightEndMid = segmentToPixel(Math.max(seg.index2, maxVisibleIndex), midPrice);
    const showMidExtension = isSelected && pb.x < rightEndMid.x;
    return (
      <g key={idx}>
        <polygon points={`${pa.x},${pa.y} ${pb.x},${pb.y} ${pbUp.x},${pbUp.y} ${paUp.x},${paUp.y}`} fill={green} fillOpacity={fillOpacity} stroke="none" />
        <polygon points={`${pa.x},${pa.y} ${pb.x},${pb.y} ${pbDn.x},${pbDn.y} ${paDn.x},${paDn.y}`} fill={red} fillOpacity={fillOpacity} stroke="none" />
        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={midColor} strokeWidth={strokeW} />
        {showMidExtension && (
          <line x1={pb.x} y1={pb.y} x2={rightEndMid.x} y2={rightEndMid.y} stroke={midColor} strokeWidth={strokeW} strokeDasharray={dottedDash} />
        )}
        <line x1={paUp.x} y1={paUp.y} x2={pbUp.x} y2={pbUp.y} stroke={green} strokeWidth={strokeW} />
        <line x1={paDn.x} y1={paDn.y} x2={pbDn.x} y2={pbDn.y} stroke={red} strokeWidth={strokeW} />
        {showPercent && (
          <>
            <rect x={midX - padW / 2} y={gainLineCenterY - padH - gap} width={padW} height={padH} rx={2} fill="#fff" fillOpacity={0.9} stroke={green} strokeWidth={1} />
            <text x={midX} y={gainLineCenterY - gap - padH / 2} textAnchor="middle" dominantBaseline="middle" fill={green} className="font-mono select-none" style={{ fontSize }}>{textGain}</text>
            <rect x={midX - padW / 2} y={stopLineCenterY + gap} width={padW} height={padH} rx={2} fill="#fff" fillOpacity={0.9} stroke={red} strokeWidth={1} />
            <text x={midX} y={stopLineCenterY + gap + padH / 2} textAnchor="middle" dominantBaseline="middle" fill={red} className="font-mono select-none" style={{ fontSize }}>{textStop}</text>
          </>
        )}
      </g>
    );
  }

  if (seg.type === "horizontalLine") {
    const hp1 = segmentToPixel(seg.index1, seg.price1);
    const hp2 = segmentToPixel(seg.index2, seg.price1);
    const strokeW = FIB_STROKE_WIDTH_VALUES[(seg.horizontalLineStrokeWidth as FibStrokeWidth) ?? "medium"];
    const dashStyle = seg.horizontalLineStrokeStyle ?? "solid";
    const strokeDasharray = HORIZONTAL_LINE_STROKE_STYLE_DASH[dashStyle];
    const showValue = seg.horizontalLineShowValue === true;
    const extendToEnd = seg.horizontalLineExtendToEnd === true;
    const rightEnd = extendToEnd ? segmentToPixel(Math.max(seg.index2, maxVisibleIndex), seg.price1) : null;
    const dottedDash = HORIZONTAL_LINE_STROKE_STYLE_DASH.dotted;
    const midX = (hp1.x + hp2.x) / 2;
    const valueOffset = 2;
    const valuePadW = 42;
    const valuePadH = 10;
    return (
      <g key={idx}>
        <line x1={hp1.x} y1={hp1.y} x2={hp2.x} y2={hp2.y} stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={strokeDasharray} />
        {extendToEnd && rightEnd && hp2.x < rightEnd.x && (
          <line x1={hp2.x} y1={hp2.y} x2={rightEnd.x} y2={rightEnd.y} stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={dottedDash} />
        )}
        {showValue && (
          <g>
            <rect x={midX - valuePadW / 2} y={hp1.y - valuePadH - valueOffset} width={valuePadW} height={valuePadH} rx={2} fill="#fff" fillOpacity={0.9} stroke={strokeColor} strokeWidth={1} />
            <text x={midX} y={hp1.y - valueOffset - valuePadH / 2} textAnchor="middle" dominantBaseline="middle" fill={strokeColor} className="font-mono select-none" style={{ fontSize: 9 }}>{formatYAxis(seg.price1)}</text>
          </g>
        )}
      </g>
    );
  }

  if (seg.type === "verticalLine") {
    const vx = segmentToPixel(seg.index1, seg.price1).x;
    const strokeW = FIB_STROKE_WIDTH_VALUES[(seg.verticalLineStrokeWidth as FibStrokeWidth) ?? "medium"];
    const dashStyle = seg.verticalLineStrokeStyle ?? "solid";
    const strokeDasharray = HORIZONTAL_LINE_STROKE_STYLE_DASH[dashStyle];
    const topY = mainChartTopY ?? p1.y;
    const bottomY = mainChartBottomY ?? p2.y;
    const pointR = Math.max(2, strokeW + 1);
    return (
      <g key={idx}>
        <line x1={vx} y1={topY} x2={vx} y2={bottomY} stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={strokeDasharray} />
        <circle cx={vx} cy={topY} r={pointR} fill={strokeColor} stroke={strokeColor} strokeWidth={1} />
      </g>
    );
  }

  if (seg.type === "text") {
    const textColor = seg.color ?? DEFAULT_TEXT_COLOR;
    const lines = (seg.textContent ?? "").split("\n").filter(Boolean);
    const sizeKey = (seg.textSize as TextSize) ?? "small";
    const { wrappedLines, boxW, boxH, lineHeight, textFontSize } = getTextSegmentBox(lines, sizeKey, fontSize);
    const padX = 4;
    const padY = 4;
    const textX = p1.x + padX;
    const firstLineY = p1.y - boxH + padY + lineHeight / 2;
    const fontWeight = seg.textBold ? "bold" : "normal";
    return (
      <g key={idx}>
        <rect x={p1.x} y={p1.y - boxH} width={boxW} height={boxH} rx={4} ry={4} fill="#ffffff" fillOpacity={0.8} stroke={textColor} strokeWidth={1} />
        <text x={textX} y={firstLineY} textAnchor="start" fill={textColor} className="select-none" style={{ fontSize: textFontSize, fontWeight }} dominantBaseline="middle">
          {wrappedLines.map((line, i) => (
            <tspan key={i} x={textX} dy={i === 0 ? 0 : lineHeight}>{line}</tspan>
          ))}
        </text>
      </g>
    );
  }

  if (seg.type === "arrow") {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const size = (seg.arrowSize as ArrowSize) ?? "medium";
    const headLen = size === "small" ? 8 : size === "large" ? 14 : 10;
    const headW = size === "small" ? 6 : size === "large" ? 14 : 10;
    const backX = p2.x - headLen * ux;
    const backY = p2.y - headLen * uy;
    const leftX = backX - uy * headW;
    const leftY = backY + ux * headW;
    const rightX = backX + uy * headW;
    const rightY = backY - ux * headW;
    const ext = ARROW_EDIT_EXTEND_PX;
    const tailExtX = p1.x - ux * ext;
    const tailExtY = p1.y - uy * ext;
    const tipExtX = p2.x + ux * ext;
    const tipExtY = p2.y + uy * ext;
    return (
      <g key={idx}>
        {isSelected && (
          <>
            <line x1={p1.x} y1={p1.y} x2={tailExtX} y2={tailExtY} stroke={strokeColor} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.7} />
            <line x1={p2.x} y1={p2.y} x2={tipExtX} y2={tipExtY} stroke={strokeColor} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.7} />
          </>
        )}
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
        <path d={`M ${p2.x} ${p2.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`} fill={strokeColor} fillOpacity={ARROW_OPACITY} stroke={strokeColor} strokeWidth={1} />
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
        const candles = Math.abs(i2 - i1);
        const daysAndCandlesStr = `${days}d, ${candles}c`;
        const textColor = percent >= 0 ? "#059669" : "#dc2626";
        const padW = 48;
        const padH = 14;
        return (
          <g>
            <rect x={labelX - padW} y={labelY - 12} width={padW * 2} height={padH * 2} rx={4} ry={4} fill="#ffffff" fillOpacity={0.8} stroke={textColor} strokeWidth={1} />
            <text x={labelX} y={labelY} textAnchor="middle" fill={textColor} className="font-medium select-none" style={{ fontSize }}>
              <tspan x={labelX} dy={0}>{percentStr}</tspan>
              <tspan x={labelX} dy={11}>{daysAndCandlesStr}</tspan>
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
