"use client";

import { useState, useEffect } from "react";
import { useCryptoLang } from "@/app/contexts/CryptoLangContext";
import { useAppBarSafe } from "@/app/AppBarSafeContext";
import { getCryptoT } from "@/app/lib/translations";
import { useChartSaveLoad, type SaveLoadPanelView, type SaveLoadLayout } from "./ChartSaveLoadContext";

interface SaveLoadPanelProps {
  initialView: SaveLoadPanelView;
  onClose?: () => void;
}

export default function SaveLoadPanel({ initialView, onClose }: SaveLoadPanelProps) {
  const lang = useCryptoLang();
  const t = getCryptoT(lang).sistema.klines as Record<string, string>;
  const { hideStatusBar } = useAppBarSafe();
  const { saveLoadData, closePanel } = useChartSaveLoad();
  const [view, setView] = useState<SaveLoadPanelView>(initialView);
  const [editingLayoutSlot, setEditingLayoutSlot] = useState<number | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");

  useEffect(() => { setView(initialView); }, [initialView]);

  const data = saveLoadData;

  const getLayoutLabel = (layout: { slot: number; name?: string }) =>
    layout.name?.trim() || (layout.slot === 0 ? (t.defaultLayout ?? "Default") : (t.layoutName ?? "Layout {n}").replace("{n}", String(layout.slot)));

  const handleClose = () => {
    closePanel();
    onClose?.();
  };

  return (
    <div
      className={`fixed inset-y-0 left-0 z-[1301] flex flex-col bg-white border-r border-zinc-200 shadow-xl overflow-hidden w-[66.666vw] sm:w-[33.333vw] max-w-[400px] ${hideStatusBar === false ? "crypto-status-bar-reserve" : ""}`}
      role="dialog"
      aria-label={t.saveLayout ?? "Save / Load"}
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-200 bg-zinc-50">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setView("save")}
            className={`px-3 py-1.5 text-sm font-medium rounded ${view === "save" ? "bg-zinc-200 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {t.saveLayout ?? "Save"}
          </button>
          <button
            type="button"
            onClick={() => setView("load")}
            className={`px-3 py-1.5 text-sm font-medium rounded ${view === "load" ? "bg-zinc-200 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {t.loadLayout ?? "Load"}
          </button>
        </div>
        {onClose && (
          <button type="button" onClick={handleClose} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-600" aria-label="Close">
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>
      <div className="panel-scroll flex-1 min-h-0 overflow-auto p-3">
        {!data ? (
          <p className="text-sm text-zinc-500 py-4">{t.noSavedLayouts ?? "Open the chart to save or load layouts."}</p>
        ) : view === "save" ? (
          <>
            <div className="text-[10px] font-medium text-zinc-500 px-0 pb-2">{t.saveLayout}</div>
            {[1, 2, 3, 4, 5, 6, 7].map((slot) => {
              const layout = data.savedLayouts.find((l) => l.slot === slot);
              const locked = data.isFreeUser;
              const label = layout ? data.getLayoutLabel(layout) : (t.layoutName ?? "Layout {n}").replace("{n}", String(slot));
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => { if (locked) data.onUpgradeRequest?.(); else data.onSaveLayout(slot); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate flex items-center gap-1.5 mb-1 ${locked ? "opacity-60 cursor-not-allowed" : "hover:bg-zinc-100"}`}
                  title={locked ? (t.upgradePlanModalTitle ?? undefined) : (layout ? data.getLayoutLabel(layout) : undefined)}
                >
                  {locked ? "🔒 " : ""}{label}
                </button>
              );
            })}
          </>
        ) : (
          <>
            <div className="text-[10px] font-medium text-zinc-500 px-0 pb-2">{t.loadLayout}</div>
            {data.savedLayoutsError ? (
              <p className="px-0 py-2 text-sm text-red-600">{data.savedLayoutsError}</p>
            ) : data.savedLayouts.length === 0 ? (
              <p className="px-0 py-2 text-sm text-zinc-500">{t.noSavedLayouts}</p>
            ) : (
              <div className="space-y-1">
                {(() => {
                  const chartModelLayouts = data.savedLayouts.filter((l) => l.slot === 0);
                  const userLayouts = data.savedLayouts.filter((l) => l.slot >= 1);
                  const canRename = (layout: SaveLoadLayout) => layout.slot >= 1 || data.canRenameChartModels;
                  const renderLayoutRow = (layout: SaveLoadLayout) => {
                    const loadLocked = data.isFreeUser && layout.slot >= 1;
                    return (
                      <div key={layout.slot} className="flex items-center gap-1 py-1">
                        {editingLayoutSlot === layout.slot ? (
                          <>
                            <input
                              type="text"
                              maxLength={24}
                              value={renameInputValue}
                              onChange={(e) => setRenameInputValue(e.target.value)}
                              placeholder={t.layoutNamePlaceholder}
                              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-zinc-200 rounded"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const v = renameInputValue.trim().slice(0, 24);
                                data.onRenameLayout(layout, v);
                                setEditingLayoutSlot(null);
                                setRenameInputValue("");
                              }}
                              className="shrink-0 px-2 py-1 text-xs rounded bg-zinc-100 hover:bg-zinc-200"
                            >
                              {t.renameLayoutOk ?? "OK"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingLayoutSlot(null); setRenameInputValue(""); }}
                              className="shrink-0 px-2 py-1 text-xs rounded bg-zinc-100 hover:bg-zinc-200"
                            >
                              {t.renameLayoutCancel ?? "Cancel"}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => { if (loadLocked) data.onUpgradeRequest?.(); else data.onLoadLayout(layout); handleClose(); }}
                              className={`flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm truncate flex items-center gap-1.5 ${loadLocked ? "opacity-60 cursor-not-allowed" : "hover:bg-zinc-100"}`}
                              title={loadLocked ? (t.upgradePlanModalTitle ?? undefined) : undefined}
                            >
                              {loadLocked ? "🔒 " : ""}{data.getLayoutLabel(layout)}
                            </button>
                            {canRename(layout) && !loadLocked && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEditingLayoutSlot(layout.slot); setRenameInputValue(layout.name?.trim() ?? ""); }}
                                title={t.renameLayout}
                                className="shrink-0 p-1.5 rounded hover:bg-zinc-100"
                                aria-label={t.renameLayout}
                              >
                                ✏️
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  };
                  return (
                    <>
                      {chartModelLayouts.length > 0 && (
                        <>
                          <div className="text-[10px] font-medium text-zinc-400 px-0 pt-2 pb-0.5">{t.chartModelsSection ?? "Chart Models"}</div>
                          {chartModelLayouts.map(renderLayoutRow)}
                          <div className="border-t border-zinc-100 my-2" />
                        </>
                      )}
                      {userLayouts.length > 0 && (
                        <>
                          <div className="text-[10px] font-medium text-zinc-400 px-0 pt-0.5 pb-0.5">{t.myLayoutsSection ?? "My layouts"}</div>
                          {userLayouts.map(renderLayoutRow)}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
