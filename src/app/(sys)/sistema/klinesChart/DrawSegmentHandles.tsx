"use client";

/**
 * Handles do segmento selecionado: círculos nas pontas, canal (meio + extensão),
 * fibonacci (nível 1 + extensão), reta horizontal (arrastar para mover).
 * Extraído de KlinesChartSvg para reduzir tamanho e isolar responsabilidade.
 */
import { DEFAULT_SEGMENT_COLOR, getTextSegmentBox, type DrawSegment, type TextSize } from "../KlinesChartDrawing";

export type DrawDraggingPoint = 0 | 1 | "extension" | "fibLevel1" | "freeRetracementLevel1" | "freeRetracementLevel" | "freeRetracementLevelExt" | "channelMid" | "channelExtension" | "stopGainMid" | "stopGainMove" | "stopGainGainLine" | "stopGainStopLine" | "horizontalLineMove" | "verticalLineMove" | "arrowMove" | "textMove";

export interface DrawSegmentHandlesProps {
  segment: DrawSegment;
  selectedSegmentIndex: number;
  segmentToPixel: (index: number, price: number) => { x: number; y: number };
  setDrawDragging: React.Dispatch<React.SetStateAction<{ segmentIndex: number; point: DrawDraggingPoint } | null>>;
  t: Record<string, string>;
  /** Limites Y (px) do gráfico principal para handle da reta vertical. */
  mainChartTopY?: number;
  mainChartBottomY?: number;
}

export function DrawSegmentHandles({
  segment: seg,
  selectedSegmentIndex,
  segmentToPixel,
  setDrawDragging,
  t,
  mainChartTopY = 0,
  mainChartBottomY = 0,
}: DrawSegmentHandlesProps) {
  const h1 = segmentToPixel(seg.index1, seg.price1);
  const h2 = segmentToPixel(seg.index2, seg.price2);
  const handleColor = seg.color ?? DEFAULT_SEGMENT_COLOR;
  const isFib = seg.type === "fibonacci";
  const isFreeRetracement = seg.type === "freeRetracement";
  const isChannel = seg.type === "channel";
  const isStopGain = seg.type === "stopGain";
  const isHorizontalLine = seg.type === "horizontalLine";
  const isVerticalLine = seg.type === "verticalLine";
  const isArrow = seg.type === "arrow";
  const isText = seg.type === "text";
  const channelMidPos = isChannel ? { x: (h1.x + h2.x) / 2, y: (h1.y + h2.y) / 2 } : { x: 0, y: 0 };
  const stopGainMidPos = isStopGain ? { x: (h1.x + h2.x) / 2, y: (h1.y + h2.y) / 2 } : { x: 0, y: 0 };
  const fibExtendPx = isFib ? segmentToPixel(seg.index2 + Math.max(0, seg.fibExtensionIndices ?? 0), seg.price2).x : 0;
  const fibMidY = isFib ? (segmentToPixel(seg.index1, Math.max(seg.price1, seg.price2)).y + segmentToPixel(seg.index1, Math.min(seg.price1, seg.price2)).y) / 2 : 0;
  const fibLevel1Pct = isFib ? Math.round(Math.max(0, Math.min(50, seg.fibLevelPct1 ?? 33.33)) * 10000) / 10000 : 0;
  const fibLevel1Price = isFib ? seg.price2 + (seg.price1 - seg.price2) * (fibLevel1Pct / 100) : 0;
  const fibLevel1Pos = isFib ? segmentToPixel(seg.index1, fibLevel1Price) : { x: 0, y: 0 };
  const fibLevel1MidX = isFib ? (h1.x + h2.x) / 2 : 0;
  const freeRetracementLevelPct1 = isFreeRetracement ? Math.round(Math.max(0, Math.min(50, seg.freeRetracementLevelPct1 ?? 33.33)) * 10000) / 10000 : 0;
  const freeRetracementLevelPct = isFreeRetracement ? Math.round(Math.max(50, Math.min(100, seg.freeRetracementLevelPct ?? 61.8)) * 10000) / 10000 : 0;
  const freeRetracementLevel1Price = isFreeRetracement ? seg.price2 + (seg.price1 - seg.price2) * (freeRetracementLevelPct1 / 100) : 0;
  const freeRetracementLevel1Pos = isFreeRetracement ? segmentToPixel(seg.index1, freeRetracementLevel1Price) : { x: 0, y: 0 };
  const freeRetracementLevel1MidX = isFreeRetracement ? (h1.x + h2.x) / 2 : 0;
  const freeRetracementLevelPrice = isFreeRetracement ? seg.price2 + (seg.price1 - seg.price2) * (freeRetracementLevelPct / 100) : 0;
  const freeRetracementLevelPos = isFreeRetracement ? segmentToPixel(seg.index1, freeRetracementLevelPrice) : { x: 0, y: 0 };
  const freeRetracementLevelMidX = isFreeRetracement ? (h1.x + h2.x) / 2 : 0;
  const freeRetracementLevelPctExt = isFreeRetracement ? Math.round(Math.max(100, Math.min(200, seg.freeRetracementLevelPctExt ?? 100)) * 10000) / 10000 : 0;
  const freeRetracementLevelExtPrice = isFreeRetracement ? seg.price2 + (seg.price1 - seg.price2) * (freeRetracementLevelPctExt / 100) : 0;
  const freeRetracementLevelExtPos = isFreeRetracement ? segmentToPixel(seg.index1, freeRetracementLevelExtPrice) : { x: 0, y: 0 };
  const freeRetracementLevelExtMidX = isFreeRetracement ? (h1.x + h2.x) / 2 : 0;
  const freeRetracementExtendPx = isFreeRetracement ? segmentToPixel(seg.index2 + Math.max(0, seg.freeRetracementExtensionIndices ?? 0), seg.price2).x : 0;
  const freeRetracementMidY = isFreeRetracement ? (segmentToPixel(seg.index1, Math.max(seg.price1, seg.price2)).y + segmentToPixel(seg.index1, Math.min(seg.price1, seg.price2)).y) / 2 : 0;

  return (
    <g pointerEvents="all">
      {isHorizontalLine && (
        <line
          x1={h1.x}
          y1={h1.y}
          x2={h2.x}
          y2={h2.y}
          stroke="transparent"
          strokeWidth={14}
          style={{ cursor: "grab" }}
          aria-label={(t as Record<string, string>).horizontalLineMove ?? "Arrastar para mover"}
          onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "horizontalLineMove" }); }}
          onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "horizontalLineMove" }); }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {isVerticalLine && (
        <line
          x1={h1.x}
          y1={mainChartTopY}
          x2={h1.x}
          y2={mainChartBottomY}
          stroke="transparent"
          strokeWidth={14}
          style={{ cursor: "grab" }}
          aria-label={(t as Record<string, string>).verticalLineMove ?? "Arrastar para mover"}
          onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "verticalLineMove" }); }}
          onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "verticalLineMove" }); }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {isArrow && (
        <line
          x1={h1.x}
          y1={h1.y}
          x2={h2.x}
          y2={h2.y}
          stroke="transparent"
          strokeWidth={14}
          style={{ cursor: "grab" }}
          aria-label={(t as Record<string, string>).arrowMove ?? "Arrastar para mover"}
          onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "arrowMove" }); }}
          onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "arrowMove" }); }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {isText && (() => {
        const lines = (seg.textContent ?? "").split("\n").filter(Boolean);
        const sizeKey = (seg.textSize as TextSize) ?? "small";
        const { boxW, boxH } = getTextSegmentBox(lines, sizeKey, 10);
        return (
          <>
            <rect
              x={h1.x}
              y={h1.y - boxH}
              width={boxW}
              height={boxH}
              fill="transparent"
              stroke="none"
              style={{ cursor: "grab" }}
              aria-label={(t as Record<string, string>).textMove ?? "Arrastar para mover"}
              onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "textMove" }); }}
              onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "textMove" }); }}
              onClick={(e) => e.stopPropagation()}
            />
            <circle cx={h1.x} cy={h1.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
          </>
        );
      })()}
      {isStopGain && (() => {
        const ru = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioUp ?? 1) * 100) / 100));
        const rd = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioDown ?? 1) * 100) / 100));
        const openAmount = Math.max(0, seg.stopGainOpenAmount ?? 0);
        const midPrice = seg.price1;
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
        const xMin = Math.min(pa.x, pb.x);
        const xMax = Math.max(pa.x, pb.x);
        const yMin = Math.min(paUp.y, pbUp.y, paDn.y, pbDn.y);
        const yMax = Math.max(paUp.y, pbUp.y, paDn.y, pbDn.y);
        const padding = 4;
        return (
          <rect
            x={xMin - padding}
            y={yMin - padding}
            width={xMax - xMin + 2 * padding}
            height={yMax - yMin + 2 * padding}
            fill="transparent"
            stroke="none"
            style={{ cursor: "grab" }}
            aria-label={(t as Record<string, string>).stopGainMove ?? "Arrastar para mover"}
            onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "stopGainMove" }); }}
            onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "stopGainMove" }); }}
            onClick={(e) => e.stopPropagation()}
          />
        );
      })()}
      {!isVerticalLine && !isArrow && !isText && (
        <>
          <circle
            cx={h1.x}
            cy={h1.y}
            r={5}
            fill="transparent"
            stroke="none"
            style={{ cursor: "grab" }}
            onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 0 }); }}
            onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 0 }); }}
            onClick={(e) => e.stopPropagation()}
          />
          <circle cx={h1.x} cy={h1.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
          <circle
            cx={h2.x}
            cy={h2.y}
            r={5}
            fill="transparent"
            stroke="none"
            style={{ cursor: "grab" }}
            onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 1 }); }}
            onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: 1 }); }}
            onClick={(e) => e.stopPropagation()}
          />
          {!isChannel && <circle cx={h2.x} cy={h2.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />}
        </>
      )}
      {isStopGain && (() => {
        const ru = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioUp ?? 1) * 100) / 100));
        const rd = Math.max(1, Math.min(10, Math.round((seg.stopGainRatioDown ?? 1) * 100) / 100));
        const openAmount = Math.max(0, seg.stopGainOpenAmount ?? 0);
        const midPrice = seg.price1;
        const gainOffset = openAmount * (ru / (ru + rd));
        const stopOffset = openAmount * (rd / (ru + rd));
        const priceTop = midPrice + gainOffset;
        const priceBottom = midPrice - stopOffset;
        const gainLineStart = segmentToPixel(seg.index1, priceTop);
        const stopLineStart = segmentToPixel(seg.index1, priceBottom);
        return (
          <>
            <circle
              cx={stopGainMidPos.x}
              cy={stopGainMidPos.y}
              r={5}
              fill="transparent"
              stroke="none"
              style={{ cursor: "ns-resize" }}
              aria-label={(t as Record<string, string>).stopGainMidDrag ?? "Arrastar para abrir ganho/perda"}
              onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "stopGainMid" }); }}
              onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "stopGainMid" }); }}
              onClick={(e) => e.stopPropagation()}
            />
            <circle cx={stopGainMidPos.x} cy={stopGainMidPos.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
            <circle
              cx={gainLineStart.x}
              cy={gainLineStart.y}
              r={5}
              fill="transparent"
              stroke="none"
              style={{ cursor: "ns-resize" }}
              aria-label={(t as Record<string, string>).stopGainGainLineDrag ?? "Arrastar para ajustar proporção ganho"}
              onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "stopGainGainLine" }); }}
              onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "stopGainGainLine" }); }}
              onClick={(e) => e.stopPropagation()}
            />
            <circle cx={gainLineStart.x} cy={gainLineStart.y} r={3} fill="#059669" stroke="#059669" strokeWidth={1} pointerEvents="none" />
            <circle
              cx={stopLineStart.x}
              cy={stopLineStart.y}
              r={5}
              fill="transparent"
              stroke="none"
              style={{ cursor: "ns-resize" }}
              aria-label={(t as Record<string, string>).stopGainStopLineDrag ?? "Arrastar para ajustar proporção perda"}
              onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "stopGainStopLine" }); }}
              onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "stopGainStopLine" }); }}
              onClick={(e) => e.stopPropagation()}
            />
            <circle cx={stopLineStart.x} cy={stopLineStart.y} r={3} fill="#dc2626" stroke="#dc2626" strokeWidth={1} pointerEvents="none" />
          </>
        );
      })()}
      {isChannel && (
        <>
          <circle
            cx={channelMidPos.x}
            cy={channelMidPos.y}
            r={5}
            fill="transparent"
            stroke="none"
            style={{ cursor: "ns-resize" }}
            aria-label={(t as Record<string, string>).channelMidDrag ?? "Arrastar para ajustar a linha paralela"}
            onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "channelMid" }); }}
            onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "channelMid" }); }}
            onClick={(e) => e.stopPropagation()}
          />
          <circle cx={channelMidPos.x} cy={channelMidPos.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
        </>
      )}
      {isChannel && (() => {
        const ext = Math.max(0, seg.channelExtensionIndices ?? 0);
        const extIdx = seg.index2 + ext;
        const deltaIdx = seg.index2 - seg.index1;
        const slopeCh = deltaIdx !== 0 ? (seg.price2 - seg.price1) / deltaIdx : 0;
        const off = seg.channelOffset ?? 0;
        const extPriceUp = seg.price2 + off + slopeCh * ext;
        const extPriceDn = seg.price2 - off + slopeCh * ext;
        const topEnd = segmentToPixel(extIdx, extPriceUp);
        const bottomEnd = segmentToPixel(extIdx, extPriceDn);
        const extendHitR = 10;
        const extendTitle = (t as Record<string, string>).channelExtensionDrag ?? t.fibExtensionDrag ?? "Arrastar para estender";
        return (
          <>
            <circle
              cx={topEnd.x}
              cy={topEnd.y}
              r={extendHitR}
              fill="transparent"
              stroke="none"
              style={{ cursor: "grab" }}
              aria-label={extendTitle}
              onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "channelExtension" }); }}
              onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "channelExtension" }); }}
              onClick={(e) => e.stopPropagation()}
            />
            <circle
              cx={bottomEnd.x}
              cy={bottomEnd.y}
              r={extendHitR}
              fill="transparent"
              stroke="none"
              style={{ cursor: "grab" }}
              aria-label={extendTitle}
              onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "channelExtension" }); }}
              onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "channelExtension" }); }}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        );
      })()}
      {isFib && (
        <>
          <circle
            cx={fibLevel1MidX}
            cy={fibLevel1Pos.y}
            r={5}
            fill="transparent"
            stroke="none"
            style={{ cursor: "ns-resize" }}
            aria-label={(t as Record<string, string>).fibLevel1Drag ?? "Arrastar para ajustar o primeiro nível"}
            onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "fibLevel1" }); }}
            onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "fibLevel1" }); }}
            onClick={(e) => e.stopPropagation()}
          />
          <circle cx={fibLevel1MidX} cy={fibLevel1Pos.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
        </>
      )}
      {isFib && (
        <g
          style={{ cursor: "grab" }}
          aria-label={t.fibExtensionDrag ?? "Arrastar para estender"}
          onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "extension" }); }}
          onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "extension" }); }}
          onClick={(e) => e.stopPropagation()}
        >
          <rect x={fibExtendPx - 12} y={fibMidY - 10} width={26} height={20} fill="transparent" stroke="none" />
          <path d={`M ${fibExtendPx + 5} ${fibMidY} L ${fibExtendPx - 2} ${fibMidY - 4} L ${fibExtendPx - 2} ${fibMidY + 4} Z`} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
        </g>
      )}
      {isFreeRetracement && (
        <>
          <circle
            cx={freeRetracementLevel1MidX}
            cy={freeRetracementLevel1Pos.y}
            r={5}
            fill="transparent"
            stroke="none"
            style={{ cursor: "ns-resize" }}
            aria-label={(t as Record<string, string>).freeRetracementLevel1Drag ?? "Arrastar nível 0–50%"}
            onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "freeRetracementLevel1" }); }}
            onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "freeRetracementLevel1" }); }}
            onClick={(e) => e.stopPropagation()}
          />
          <circle cx={freeRetracementLevel1MidX} cy={freeRetracementLevel1Pos.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
          <circle
            cx={freeRetracementLevelMidX}
            cy={freeRetracementLevelPos.y}
            r={5}
            fill="transparent"
            stroke="none"
            style={{ cursor: "ns-resize" }}
            aria-label={(t as Record<string, string>).freeRetracementLevelDrag ?? "Arrastar nível 50–100%"}
            onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "freeRetracementLevel" }); }}
            onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "freeRetracementLevel" }); }}
            onClick={(e) => e.stopPropagation()}
          />
          <circle cx={freeRetracementLevelMidX} cy={freeRetracementLevelPos.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
          <circle
            cx={freeRetracementLevelExtMidX}
            cy={freeRetracementLevelExtPos.y}
            r={5}
            fill="transparent"
            stroke="none"
            style={{ cursor: "ns-resize" }}
            aria-label={(t as Record<string, string>).freeRetracementLevelExtDrag ?? "Arrastar nível 100–200%"}
            onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "freeRetracementLevelExt" }); }}
            onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "freeRetracementLevelExt" }); }}
            onClick={(e) => e.stopPropagation()}
          />
          <circle cx={freeRetracementLevelExtMidX} cy={freeRetracementLevelExtPos.y} r={3} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
        </>
      )}
      {isFreeRetracement && (
        <g
          style={{ cursor: "grab" }}
          aria-label={t.fibExtensionDrag ?? "Arrastar para estender"}
          onMouseDown={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "extension" }); }}
          onTouchStart={(e) => { e.stopPropagation(); setDrawDragging({ segmentIndex: selectedSegmentIndex, point: "extension" }); }}
          onClick={(e) => e.stopPropagation()}
        >
          <rect x={freeRetracementExtendPx - 12} y={freeRetracementMidY - 10} width={26} height={20} fill="transparent" stroke="none" />
          <path d={`M ${freeRetracementExtendPx + 5} ${freeRetracementMidY} L ${freeRetracementExtendPx - 2} ${freeRetracementMidY - 4} L ${freeRetracementExtendPx - 2} ${freeRetracementMidY + 4} Z`} fill={handleColor} stroke={handleColor} strokeWidth={1} pointerEvents="none" />
        </g>
      )}
    </g>
  );
}
