"use client";

import { useMemo, useRef, useState, useEffect, memo } from "react";
import { clamp } from "@/lib/intervalo-taxa";
import type { GenesisIndividual } from "@/app/lib/simulacao-genesis";
import { REGIAO_KM, REGIAO_SIZE, kmToPx } from "@/app/lib/simulacao-genesis";
import { ASSET_PREFIX } from "@/app/constants";

/** Mapa 1: conteúdo visual é um retângulo central de 40k × 20k km no quadrado; ocultar faixas vazias topo/baixo. */
const MAPA_1_RECT_WIDTH_KM = 40000;
const MAPA_1_RECT_HEIGHT_KM = 20000;

export const GenesisPlot = memo(function GenesisPlot({
  vetor1,
  vetor2,
  imageUrl,
  mapNumber = 1,
  indiceBranco = 1,
  indiceGrid,
  getStartMode,
  onMapClick,
  className,
  statsOverlay,
  topMessage,
  bottomRightOverlay,
  /** Número de direções (2..8). Com menos direções há menos agrupamentos e qtde por grupo maior; escala o raio para manter 150 = 3.75M×(8/qtde_direcoes). */
  qtdeDirecoes = 8,
  /** Pontos de origem (tachinhas) desenhados no mapa, mesmo após execuções. */
  originMarkers = [],
  /** URL do ícone da tachinha (SVG ou PNG). Se não informado, usa o desenho vetorial embutido. Troque o arquivo ou use outro path para personalizar. */
  originMarkerIconUrl,
}: {
  vetor1: GenesisIndividual[];
  vetor2: GenesisIndividual[];
  imageUrl?: string;
  /** 1 = mapa.WEBP (visualização só retângulo 40k×20k central); 2+ = mapaN.WEBP */
  mapNumber?: number;
  /** Índice da cor branca (não plotar em pixel branco). */
  indiceBranco?: number;
  /** Grid de índices de cor por pixel (py*REGIAO_SIZE+px). Se definido, filtra por posição atual (evita plotar em área branca após dispersão). */
  indiceGrid?: number[];
  getStartMode?: boolean;
  onMapClick?: (x: number, y: number) => void;
  /** Classe CSS adicional para o container externo. Ex.: flex-1 min-h-0 w-full para ocupar espaço disponível. */
  className?: string;
  /** Estatísticas exibidas no canto inferior esquerdo do mapa. */
  statsOverlay?: { ano: number; populacao: number; nascimentos: number; mortesAnuais: number; mortesAcumuladas: number; totalIterations?: number } | null;
  /** Mensagem exibida no topo do mapa (ex.: população zerada). */
  topMessage?: React.ReactNode;
  /** Conteúdo exibido no canto inferior direito do mapa (ex.: botão expandir/recolher sidebar). */
  bottomRightOverlay?: React.ReactNode;
  /** Número de direções (2..8). Escala o raio: 150 corresponde a 3.75M quando 8, e ao dobro (7.5M) quando 4. */
  qtdeDirecoes?: number;
  /** Pontos de origem (coordenadas em km) desenhados como tachinhas no mapa. */
  originMarkers?: { x0_km: number; y0_km: number }[];
  /** URL do ícone (ex.: /assets/bio/tachinha.svg ou .webp). Não informado = usa desenho embutido. */
  originMarkerIconUrl?: string;
}) {
  /** Tamanho do ícone no mapa (em km, mesmo sistema do viewBox). A ponta da tachinha fica em (cx, cy). */
  const originIconWidthKm = 400;
  const originIconHeightKm = 600;
  /** URL absoluta do ícone para carregar corretamente dentro do SVG <image> (evita falha com path relativo). */
  const [resolvedIconUrl, setResolvedIconUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!originMarkerIconUrl) {
      setResolvedIconUrl(null);
      return;
    }
    if (typeof window === "undefined") return;
    if (originMarkerIconUrl.startsWith("http://") || originMarkerIconUrl.startsWith("https://") || originMarkerIconUrl.startsWith("data:")) {
      setResolvedIconUrl(originMarkerIconUrl);
      return;
    }
    setResolvedIconUrl(`${window.location.origin}${originMarkerIconUrl.startsWith("/") ? "" : "/"}${originMarkerIconUrl}`);
  }, [originMarkerIconUrl]);
  const originIconUrl = resolvedIconUrl ?? originMarkerIconUrl;
  const all = useMemo(() => [...vetor1, ...vetor2], [vetor1, vetor2]);
  /** ViewBox padrão: mapa 1 = só retângulo central 40k×20k km; outros = quadrado inteiro. */
  const viewBoxPadrao = useMemo(() => {
    if (mapNumber === 1) {
      const x = (REGIAO_KM - MAPA_1_RECT_WIDTH_KM) / 2;
      const y = (REGIAO_KM - MAPA_1_RECT_HEIGHT_KM) / 2;
      return { x, y, width: MAPA_1_RECT_WIDTH_KM, height: MAPA_1_RECT_HEIGHT_KM };
    }
    return { x: 0, y: 0, width: REGIAO_KM, height: REGIAO_KM };
  }, [mapNumber]);
  /** Só plotar: plotValido === 1 e posição atual não é branca. Se indiceGrid existe, usa pixel atual; senão usa cor de nascimento. */
  const allPlotaveis = useMemo(() => {
    return all.filter((ind) => {
      if ((ind.plotValido ?? 1) !== 1) return false;
      if (indiceGrid && indiceGrid.length > 0) {
        const px = Math.min(REGIAO_SIZE - 1, Math.max(0, kmToPx(ind.x)));
        const py = Math.min(REGIAO_SIZE - 1, Math.max(0, kmToPx(ind.y)));
        const idx = py * REGIAO_SIZE + px;
        if (idx < 0 || idx >= indiceGrid.length) return false;
        if (indiceGrid[idx] === indiceBranco) return false;
        return true;
      }
      return (ind.cor ?? 0) !== indiceBranco;
    });
  }, [all, indiceBranco, indiceGrid]);
  const maxQtde = useMemo(() => {
    if (all.length === 0) return 1;
    let max = 1;
    for (const ind of all) {
      if (ind.qtde > max) max = ind.qtde;
    }
    return max;
  }, [all]);
  /** Raio 150 quando qtde = 4_000_000 × (8 / qtde_direcoes). 150 = 4M / (divisor); divisor_ref = 4M/150 = (4M/(150×25))×25. */
  const divisorParaRaio = useMemo(() => {
    const n = Math.min(8, Math.max(2, Math.floor(qtdeDirecoes)));
    const divisorRef = (4_000_000 / (150 * 25)) * 25; // 4M/150 ≈ 26_666.67
    return divisorRef * (8 / n);
  }, [qtdeDirecoes]);
  /** Limiar em qtde acima do qual o ponto fica vermelho (acima do raio 150). */
  const limiarVermelho = useMemo(() => {
    const n = Math.min(8, Math.max(2, Math.floor(qtdeDirecoes)));
    return 4_000_000 * (8 / n);
  }, [qtdeDirecoes]);
  const pontosUnicos = useMemo(() => {
    const vistos = new Set<string>();
    return allPlotaveis.filter((ind) => {
      const key = `${ind.x.toFixed(1)},${ind.y.toFixed(1)}`;
      if (vistos.has(key)) return false;
      vistos.add(key);
      return true;
    });
  }, [allPlotaveis]);
  const useMapa = Boolean(imageUrl);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [containerClientSize, setContainerClientSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerClientSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setContainerClientSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const zoomMin = 0.1;
  const zoomMax = 10;
  const [viewBoxCustom, setViewBoxCustom] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [showAnoLabel, setShowAnoLabel] = useState(false);
  const viewBoxAtual = viewBoxCustom ?? viewBoxPadrao;

  /** Mapa 1 com viewBox retangular: container deve ter a mesma proporção para não sobrar faixa vazia em cima/baixo. */
  const containerSize = useMemo(() => {
    if (mapNumber === 1 && !viewBoxCustom) {
      const w = REGIAO_SIZE;
      const h = Math.round(REGIAO_SIZE * (MAPA_1_RECT_HEIGHT_KM / MAPA_1_RECT_WIDTH_KM));
      return { width: w, height: h };
    }
    return { width: REGIAO_SIZE, height: REGIAO_SIZE };
  }, [mapNumber, viewBoxCustom]);

  /** Vertical (portrait): ajusta pela altura, sem distorção; usuário rola horizontalmente. Horizontal (landscape): ajusta pela largura, sem distorção; altura proporcional; usuário rola para baixo se necessário. Desconta: p-2 do scroll (8px×2), borda do mapa (1px×2). */
  const PADDING_H = 16; // p-2 = 8px cada lado
  const PADDING_V = 16;
  const BORDER = 2; // borda 1px esq + 1px dir
  const { displaySize } = useMemo(() => {
    const availW = Math.max(0, containerClientSize.width - PADDING_H - BORDER);
    const availH = Math.max(0, containerClientSize.height - PADDING_V - BORDER);
    if (availW <= 0 || availH <= 0) {
      return { displaySize: containerSize };
    }
    const isLandscape = containerClientSize.width >= containerClientSize.height;
    if (isLandscape) {
      const scale = Math.min(1, availW / containerSize.width);
      return {
        displaySize: {
          width: Math.floor(containerSize.width * scale),
          height: Math.floor(containerSize.height * scale),
        },
      };
    }
    const scale = Math.min(1, availH / containerSize.height);
    return {
      displaySize: {
        width: Math.floor(containerSize.width * scale),
        height: Math.floor(containerSize.height * scale),
      },
    };
  }, [containerClientSize, containerSize]);

  const effectiveScale = zoom;
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!getStartMode || !onMapClick || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const x_km = viewBoxAtual.x + relX * viewBoxAtual.width;
    const y_km = viewBoxAtual.y + relY * viewBoxAtual.height;
    onMapClick(clamp(0, x_km, REGIAO_KM), clamp(0, y_km, REGIAO_KM));
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => clamp(zoomMin, z + delta, zoomMax));
    }
  };

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden bg-transparent ${className ?? ""}`.trim()}>
      <div ref={scrollContainerRef} className="flex-1 min-h-0 p-2 overflow-auto w-full flex items-start justify-start relative" onWheel={handleWheel}>
        <div
          ref={mapContainerRef}
          className="relative shrink-0 border-2 border-neutral-400 bg-white min-w-0 box-border"
          style={{
            width: displaySize.width,
            height: displaySize.height,
            transform: `scale(${effectiveScale})`,
            transformOrigin: "top left",
            cursor: getStartMode ? "crosshair" : "default",
          }}
          onClick={getStartMode ? handleMapClick : undefined}
          role={getStartMode ? "button" : undefined}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => (z >= 1.5 ? 1 : 1.5))}
            className={`absolute right-2 top-2 z-10 flex items-center justify-center w-12 h-12 rounded-lg border-2 shrink-0 transition-colors ${zoom >= 1.5 ? "border-amber-400 bg-amber-50/80" : "border-neutral-300 bg-white hover:bg-neutral-50 hover:border-neutral-400"} text-neutral-700`}
            style={{ padding: "0.25rem 0.5rem" }}
            title={zoom >= 1.5 ? "Voltar ao zoom normal (100%)" : "Zoom 150%"}
            aria-label={zoom >= 1.5 ? "Voltar ao zoom normal" : "Zoom 150%"}
          >
            <span className="text-xl leading-none" aria-hidden>🔍</span>
          </button>
          {bottomRightOverlay && (
            <div className="absolute left-2 top-2 z-10">
              {bottomRightOverlay}
            </div>
          )}
          {topMessage && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none" role="status">
              <div className="rounded-lg border border-amber-300 bg-amber-100/50 backdrop-blur-sm text-amber-900 text-sm font-medium shadow-lg max-w-[90%] text-center" style={{ padding: "0.5rem 1rem" }}>
                {topMessage}
              </div>
            </div>
          )}
          {statsOverlay && (
            <div
              className="absolute left-2 bottom-2 z-10 rounded bg-black/70 text-white text-sm font-medium tabular-nums flex flex-col gap-0.5 cursor-pointer select-none"
              style={{ padding: "0.375rem 0.75rem" }}
              onClick={(e) => { e.stopPropagation(); setShowAnoLabel((v) => !v); }}
            >
              <div>📅 {Math.round(statsOverlay.ano)}{showAnoLabel ? " (year)" : ""}</div>
              <div className="flex items-center gap-1.5">
                <img src={`${ASSET_PREFIX}/assets/bio/populacao.WEBP`} alt="" className="w-4 h-4 object-contain" aria-hidden />
                {statsOverlay.populacao.toLocaleString("de-DE", { maximumFractionDigits: 0 })}{showAnoLabel ? " (population)" : ""}
              </div>
              <div className="flex items-center gap-1.5">
                <img src={`${ASSET_PREFIX}/assets/bio/nascimentos.WEBP`} alt="" className="w-4 h-4 object-contain" aria-hidden />
                {statsOverlay.nascimentos.toLocaleString("de-DE", { maximumFractionDigits: 0 })}{showAnoLabel ? " (annual births)" : ""}
              </div>
              <div>☠️ {statsOverlay.mortesAnuais.toLocaleString("de-DE", { maximumFractionDigits: 0 })}{showAnoLabel ? " (annual deaths)" : ""}</div>
              <div className="flex items-center gap-1.5">
                <img src={`${ASSET_PREFIX}/assets/bio/cemiterio.WEBP`} alt="" className="w-4 h-4 object-contain" aria-hidden />
                {statsOverlay.mortesAcumuladas.toLocaleString("de-DE", { maximumFractionDigits: 0 })}{showAnoLabel ? " (cumulative deaths)" : ""}
              </div>
              <div className="flex items-center gap-1.5">
                ⏳ {typeof statsOverlay.totalIterations === "number" ? statsOverlay.totalIterations.toLocaleString("de-DE", { maximumFractionDigits: 0 }) : "0"}{showAnoLabel ? " (Total time)" : ""}
              </div>
            </div>
          )}
          <div className="absolute right-2 bottom-2 z-10 rounded bg-black/70 text-white text-xs font-medium tabular-nums flex items-center gap-2 pointer-events-none" style={{ padding: "0.25rem 0.5rem" }} aria-label="Legend: red dot indicates group with count greater than or equal to the individual threshold">
            <span className="shrink-0 w-3 h-3 rounded-full bg-[#ef4444] border border-[#b91c1c]" aria-hidden />
            <span>≥ {limiarVermelho >= 1_000_000 ? `${(limiarVermelho / 1_000_000).toFixed(1)}M` : limiarVermelho.toLocaleString("en-US", { maximumFractionDigits: 0 })} individuals</span>
          </div>
          {useMapa ? (
            <>
              <svg
                viewBox={`${viewBoxAtual.x} ${viewBoxAtual.y} ${viewBoxAtual.width} ${viewBoxAtual.height}`}
                className="absolute left-0 top-0 w-full h-full pointer-events-none"
                preserveAspectRatio="xMidYMid meet"
              >
                <image
                  href={imageUrl}
                  x="0"
                  y="0"
                  width={REGIAO_KM}
                  height={REGIAO_KM}
                  preserveAspectRatio="none"
                />
              </svg>
              <svg
                viewBox={`${viewBoxAtual.x} ${viewBoxAtual.y} ${viewBoxAtual.width} ${viewBoxAtual.height}`}
                className="absolute left-0 top-0 w-full h-full pointer-events-none"
                preserveAspectRatio="xMidYMid meet"
                style={{ willChange: "contents" }}
              >
                {pontosUnicos.map((ind, i) => {
                  const densidade = maxQtde <= 1 ? 1 : 0.45 + 0.55 * (ind.qtde / maxQtde);
                  const rRaw = Math.max(25, ind.qtde / divisorParaRaio);
                  const r = Math.min(150, rRaw);
                  const acimaLimite = rRaw >= 150;
                  const fill = acimaLimite ? "#ef4444" : "#3b82f6";
                  const stroke = "#000000";
                  const strokeW = r * 0.25;
                  return (
                    <circle
                      key={`${ind.id}-${i}`}
                      cx={ind.x}
                      cy={ind.y}
                      r={r}
                      fill={fill}
                      fillOpacity={densidade}
                      stroke={stroke}
                      strokeOpacity={densidade}
                      strokeWidth={strokeW}
                      style={{ willChange: "auto" }}
                    />
                  );
                })}
              </svg>
              {/* Tachinhas das origens (sempre visíveis) */}
              {originMarkers.length > 0 && (
                <svg
                  viewBox={`${viewBoxAtual.x} ${viewBoxAtual.y} ${viewBoxAtual.width} ${viewBoxAtual.height}`}
                  className="absolute left-0 top-0 w-full h-full pointer-events-none"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden
                >
                  {originMarkers.map((o, i) => {
                    const cx = o.x0_km;
                    const cy = o.y0_km;
                    if (originIconUrl) {
                      return (
                        <image
                          key={`origin-${i}`}
                          href={originIconUrl}
                          x={cx - originIconWidthKm / 2}
                          y={cy - originIconHeightKm}
                          width={originIconWidthKm}
                          height={originIconHeightKm}
                          preserveAspectRatio="xMidYMax meet"
                        />
                      );
                    }
                    const headR = 55;
                    const tipY = cy + headR + 50;
                    return (
                      <g key={`origin-${i}`}>
                        <circle cx={cx} cy={cy} r={headR} fill="#f59e0b" stroke="#b45309" strokeWidth={12} />
                        <path d={`M ${cx - 35} ${cy + headR} L ${cx + 35} ${cy + headR} L ${cx} ${tipY} Z`} fill="#f59e0b" stroke="#b45309" strokeWidth={10} />
                      </g>
                    );
                  })}
                </svg>
              )}
              {getStartMode && (
                <div
                  className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none"
                  aria-hidden
                >
                  <span className="text-sm font-medium text-white bg-black/70 px-3 py-1.5 rounded">Clique em um ponto válido (qualquer cor que não seja branca)</span>
                </div>
              )}
            </>
          ) : (
            <svg
              viewBox={`${viewBoxAtual.x} ${viewBoxAtual.y} ${viewBoxAtual.width} ${viewBoxAtual.height}`}
              className="block border border-neutral-300 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
              style={{ willChange: "contents" }}
            >
              <rect x={0} y={0} width={REGIAO_KM} height={REGIAO_KM} fill="#fafafa" stroke="#e5e5e5" strokeWidth={1} />
              {pontosUnicos.map((ind, i) => {
                const densidade = maxQtde <= 1 ? 1 : 0.45 + 0.55 * (ind.qtde / maxQtde);
                const rRaw = Math.max(25, ind.qtde / divisorParaRaio);
                const r = Math.min(150, rRaw);
                const acimaLimite = rRaw >= 150;
                const fill = acimaLimite ? "#ef4444" : "#3b82f6";
                const stroke = "#000000";
                const strokeW = r * 0.25;
                return (
                  <circle
                    key={`${ind.id}-${i}`}
                    cx={ind.x}
                    cy={ind.y}
                    r={r}
                    fill={fill}
                    fillOpacity={densidade}
                    stroke={stroke}
                    strokeOpacity={densidade}
                    strokeWidth={strokeW}
                    style={{ willChange: "auto" }}
                  />
                );
              })}
              {originMarkers.length > 0 && (
                <g aria-hidden>
                  {originMarkers.map((o, i) => {
                    const cx = o.x0_km;
                    const cy = o.y0_km;
                    if (originIconUrl) {
                      return (
                        <image
                          key={`origin-${i}`}
                          href={originIconUrl}
                          x={cx - originIconWidthKm / 2}
                          y={cy - originIconHeightKm}
                          width={originIconWidthKm}
                          height={originIconHeightKm}
                          preserveAspectRatio="xMidYMax meet"
                        />
                      );
                    }
                    const headR = 55;
                    const tipY = cy + headR + 50;
                    return (
                      <g key={`origin-${i}`}>
                        <circle cx={cx} cy={cy} r={headR} fill="#f59e0b" stroke="#b45309" strokeWidth={12} />
                        <path d={`M ${cx - 35} ${cy + headR} L ${cx + 35} ${cy + headR} L ${cx} ${tipY} Z`} fill="#f59e0b" stroke="#b45309" strokeWidth={10} />
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.vetor1 === nextProps.vetor1 &&
    prevProps.vetor2 === nextProps.vetor2 &&
    prevProps.imageUrl === nextProps.imageUrl &&
    prevProps.mapNumber === nextProps.mapNumber &&
    prevProps.indiceBranco === nextProps.indiceBranco &&
    prevProps.getStartMode === nextProps.getStartMode &&
    prevProps.onMapClick === nextProps.onMapClick &&
    prevProps.statsOverlay === nextProps.statsOverlay &&
    prevProps.qtdeDirecoes === nextProps.qtdeDirecoes &&
    prevProps.originMarkers === nextProps.originMarkers &&
    prevProps.originMarkerIconUrl === nextProps.originMarkerIconUrl
  );
});
