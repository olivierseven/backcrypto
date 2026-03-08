"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useCryptoLang } from "../contexts/CryptoLangContext";
import { getCryptoT } from "../lib/translations";
import { API_BASE } from "../constants";
import { LineChart, type ChartPoint } from "../graficos/ChartComponents";

type SaveItem = { id: string; name: string };

const iconClass =
  "flex items-center justify-center w-12 h-12 rounded-lg border-2 border-neutral-300 bg-white transition-colors text-3xl hover:bg-neutral-50 hover:border-neutral-400 text-neutral-800 hover:text-black cursor-pointer";

const STATE_ID = "__state__";

export default function BioChartMenu() {
  const lang = useCryptoLang();
  const tSistema = getCryptoT(lang).sistema;
  const t = getCryptoT(lang).graficos;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const [open, setOpen] = useState(false);
  const [saves, setSaves] = useState<SaveItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>(STATE_ID);
  const [loadingSaves, setLoadingSaves] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[] | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ chart: string; year: number; value: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      const w = 220;
      const pad = 12;
      let left = r.left;
      if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
      if (left < pad) left = pad;
      setDropdownPos({ top: r.bottom + 4, left: Math.round(left) });
    }
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      const portal = document.getElementById("bio-chart-menu-portal");
      if (portal?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      setDropdownPos(null);
    };
  }, [open]);

  useEffect(() => {
    const load = async () => {
      setLoadingSaves(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/saved-config`, { credentials: "include" });
        if (!res.ok) throw new Error(t.errorLoad);
        const data = (await res.json()) as { items?: { id: string; name: string }[] };
        setSaves(data.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.errorLoad);
      } finally {
        setLoadingSaves(false);
      }
    };
    load();
  }, [t.errorLoad]);

  const generateChart = useCallback(async () => {
    if (!selectedId) return;
    setLoadingChart(true);
    setChartData(null);
    setTooltip(null);
    setError(null);
    try {
      const url =
        selectedId === STATE_ID
          ? `${API_BASE}/simulacao/state`
          : `${API_BASE}/saved-config/${selectedId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(t.errorLoad);
      const data = (await res.json()) as { mapDisplayByYear?: Record<string, number[]> };
      const raw = data.mapDisplayByYear;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        setChartData([]);
        setOpen(false);
        return;
      }
      const sortedRaw = Object.entries(raw)
        .map(([yearStr, arr]) => {
          const year = parseInt(yearStr, 10);
          const births = Array.isArray(arr) && typeof arr[0] === "number" ? arr[0] : 0;
          const deaths = Array.isArray(arr) && typeof arr[1] === "number" ? arr[1] : 0;
          const population = Array.isArray(arr) && typeof arr[4] === "number" ? arr[4] : 0;
          return { year, births, deaths, population };
        })
        .filter((p) => Number.isFinite(p.year))
        .sort((a, b) => a.year - b.year);
      let deathsAccum = 0;
      const all: ChartPoint[] = sortedRaw.map((p) => {
        deathsAccum += p.deaths;
        return { ...p, deathsAccum };
      });
      const MAX_POINTS = 40;
      const step = Math.max(1, Math.ceil(all.length / MAX_POINTS));
      const points =
        all.length <= MAX_POINTS
          ? all
          : all.filter((_, i) => i % step === 0 || i === all.length - 1);
      setChartData(points);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorLoad);
    } finally {
      setLoadingChart(false);
    }
  }, [selectedId, t.errorLoad]);

  const maxBirths = chartData?.length ? Math.max(...chartData.map((p) => p.births), 1) : 1;
  const maxDeaths = chartData?.length ? Math.max(...chartData.map((p) => p.deaths), 1) : 1;
  const maxDeathsAccum = chartData?.length ? Math.max(...chartData.map((p) => p.deathsAccum), 1) : 1;
  const maxPopulation = chartData?.length ? Math.max(...chartData.map((p) => p.population), 1) : 1;

  const dropdownContent =
    open && dropdownPos && typeof document !== "undefined"
      ? createPortal(
          <div
            id="bio-chart-menu-portal"
            className="fixed z-[200] w-auto min-w-[160px] max-w-[min(220px,calc(100vw-24px))] rounded-xl border border-neutral-200 bg-white/80 backdrop-blur p-4 shadow-xl"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
            }}
          >
          <p className="mb-2 text-sm font-medium text-zinc-700">{t.selectSave}</p>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setChartData(null);
              setTooltip(null);
            }}
            disabled={loadingSaves}
            className="mb-3 w-full min-w-0 max-w-full rounded-lg border border-zinc-400 bg-zinc-100 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-60"
          >
            {loadingSaves ? (
              <option value="">{t.loading}</option>
            ) : (
              <>
                <option value={STATE_ID}>{t.defaultState}</option>
                <option value="">—</option>
                {saves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </>
            )}
          </select>
          <button
            type="button"
            onClick={generateChart}
            disabled={loadingSaves || !selectedId || loadingChart}
            className="w-full rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {loadingChart ? t.loading : t.generateChart}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>,
          document.body
        )
      : null;

  const chartOverlay =
    chartData !== null && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-b from-indigo-50 via-sky-50/95 to-white backdrop-blur overflow-auto">
          <div className="sticky top-0 z-[210] flex items-center justify-between border-b border-indigo-200/60 bg-indigo-50/90 backdrop-blur px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{t.chartsBy}</h2>
              <p className="text-xs text-zinc-500 mt-0.5 ml-3">{t.chartsSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setChartData(null);
                setTooltip(null);
              }}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-neutral-50"
            >
              {t.closeCharts}
            </button>
          </div>
          <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="min-w-0">
                <h3 className="mb-4 text-sm font-semibold text-zinc-800">{t.populationByYear}</h3>
                {chartData.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t.noData}</p>
                ) : (
                  <div className="w-full overflow-hidden">
                    <LineChart
                      data={chartData}
                      getVal={(p) => p.population}
                      maxVal={maxPopulation}
                      color="rgb(37,99,235)"
                      gradId="menuGradPop"
                      onPointClick={(year, value) =>
                        setTooltip((prev) =>
                          prev?.chart === "pop" && prev.year === year ? null : { chart: "pop", year, value }
                        )
                      }
                      selectedPoint={tooltip?.chart === "pop" ? { year: tooltip.year, value: tooltip.value } : null}
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="mb-4 text-sm font-semibold text-zinc-800">{t.birthsByYear}</h3>
                {chartData.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t.noData}</p>
                ) : (
                  <div className="w-full overflow-hidden">
                    <LineChart
                      data={chartData}
                      getVal={(p) => p.births}
                      maxVal={maxBirths}
                      color="rgb(16,185,129)"
                      gradId="menuGradBirths"
                      onPointClick={(year, value) =>
                        setTooltip((prev) =>
                          prev?.chart === "births" && prev.year === year
                            ? null
                            : { chart: "births", year, value }
                        )
                      }
                      selectedPoint={
                        tooltip?.chart === "births" ? { year: tooltip.year, value: tooltip.value } : null
                      }
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="mb-4 text-sm font-semibold text-zinc-800">{t.deathsByYear}</h3>
                {chartData.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t.noData}</p>
                ) : (
                  <div className="w-full overflow-hidden">
                    <LineChart
                      data={chartData}
                      getVal={(p) => p.deaths}
                      maxVal={maxDeaths}
                      color="rgb(220,38,38)"
                      gradId="menuGradDeaths"
                      onPointClick={(year, value) =>
                        setTooltip((prev) =>
                          prev?.chart === "deaths" && prev.year === year
                            ? null
                            : { chart: "deaths", year, value }
                        )
                      }
                      selectedPoint={
                        tooltip?.chart === "deaths" ? { year: tooltip.year, value: tooltip.value } : null
                      }
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="mb-4 text-sm font-semibold text-zinc-800">{t.deathsAccumByYear}</h3>
                {chartData.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t.noData}</p>
                ) : (
                  <div className="w-full overflow-hidden">
                    <LineChart
                      data={chartData}
                      getVal={(p) => p.deathsAccum}
                      maxVal={maxDeathsAccum}
                      color="rgb(194,65,12)"
                      gradId="menuGradDeathsAccum"
                      onPointClick={(year, value) =>
                        setTooltip((prev) =>
                          prev?.chart === "deathsAccum" && prev.year === year
                            ? null
                            : { chart: "deathsAccum", year, value }
                        )
                      }
                      selectedPoint={
                        tooltip?.chart === "deathsAccum"
                          ? { year: tooltip.year, value: tooltip.value }
                          : null
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={iconClass}
        title={tSistema.chartsTitle}
      >
        📊
      </button>
      {dropdownContent}
      {chartOverlay}
    </>
  );
}
