"use client";

/**
 * Handles do segmento selecionado: círculos nas pontas, canal (meio + extensão),
 * fibonacci (nível 1 + extensão), reta horizontal (arrastar para mover).
 * Extraído de KlinesChartSvg para reduzir tamanho e isolar responsabilidade.
 */
import { DEFAULT_SEGMENT_COLOR, type DrawSegment } from "../KlinesChartDrawing";

export type DrawDraggingPoint = 0 | 1 | "extension" | "fibLevel1" | "channelMid" | "channelExtension" | "horizontalLineMove" | "verticalLineMove";

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
  const isChannel = seg.type === "channel";
  const isHorizontalLine = seg.type === "horizontalLine";
  const isVerticalLine = seg.type === "verticalLine";
  const channelMidPos = isChannel ? { x: (h1.x + h2.x) / 2, y: (h1.y + h2.y) / 2 } : { x: 0, y: 0 };
  const fibExtendPx = isFib ? segmentToPixel(seg.index2 + Math.max(0, seg.fibExtensionIndices ?? 0), seg.price2).x : 0;
  const fibMidY = isFib ? (segmentToPixel(seg.index1, Math.max(seg.price1, seg.price2)).y + segmentToPixel(seg.index1, Math.min(seg.price1, seg.price2)).y) / 2 : 0;
  const fibLevel1Pct = isFib ? Math.round(Math.max(0, Math.min(50, seg.fibLevelPct1 ?? 33.33)) * 10000) / 10000 : 0;
  const fibLevel1Price = isFib ? seg.price2 + (seg.price1 - seg.price2) * (fibLevel1Pct / 100) : 0;
  const fibLevel1Pos = isFib ? segmentToPixel(seg.index1, fibLevel1Price) : { x: 0, y: 0 };
  const fibLevel1MidX = isFib ? (h1.x + h2.x) / 2 : 0;

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
      {!isVerticalLine && (
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
    </g>
  );
}
