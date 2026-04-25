"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSistemaDebug } from "./SistemaDebugContext";

/** Long tasks abaixo disso ignoramos (ruído). */
const MIN_LONG_TASK_MS = 50;

function truncateUrl(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Chrome preenche `attribution` quando consegue (iframe, script); muitas vezes vem vazio → só "self".
 */
function formatLongTaskAttributions(entry: PerformanceEntry): string | null {
  const lt = entry as PerformanceEntry & {
    attribution?: ReadonlyArray<{
      name?: string;
      containerType?: string;
      containerName?: string;
      containerSrc?: string;
    }>;
  };
  const attrs = lt.attribution;
  if (!attrs || attrs.length === 0) return null;
  const parts: string[] = [];
  for (const a of attrs) {
    const bits: string[] = [];
    if (a.containerName) bits.push(String(a.containerName));
    if (a.containerType && a.containerType !== "window") bits.push(`[${a.containerType}]`);
    if (a.containerSrc) bits.push(truncateUrl(String(a.containerSrc), 72));
    if (a.name && !bits.includes(a.name)) bits.push(String(a.name));
    if (bits.length) parts.push(bits.join(" "));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Nome do long task (spec): self, multiple-contexts, unknown (cross-origin sem detalhe), etc. */
function longTaskEntryName(e: PerformanceEntry): string {
  const n = e.name;
  return typeof n === "string" && n.length > 0 ? n : "?";
}

/** Observa tarefas longas: um log por lote do observer (não uma linha por entrada). */
function NavPerfLongTaskObserver({ enabled }: { enabled: boolean }) {
  const { addNavPerfLog } = useSistemaDebug();

  useEffect(() => {
    if (!enabled || typeof PerformanceObserver === "undefined") return;
    let po: PerformanceObserver | undefined;
    try {
      po = new PerformanceObserver((list) => {
        const entries = list.getEntries().filter((e) => e.duration >= MIN_LONG_TASK_MS);
        if (entries.length === 0) return;

        const durations = entries.map((e) => Math.round(e.duration));
        const max = Math.max(...durations);
        const sum = durations.reduce((a, b) => a + b, 0);
        const names = entries.map(longTaskEntryName);
        const uniqNames = [...new Set(names)];
        const starts = entries.map((e) => Math.round(e.startTime));
        const uniqAttr = new Set<string>();
        for (const e of entries) {
          const f = formatLongTaskAttributions(e);
          if (f) uniqAttr.add(f);
        }
        const attrJoined = uniqAttr.size > 0 ? [...uniqAttr].join(" || ") : null;

        const vis =
          typeof document !== "undefined" ? (document.visibilityState === "hidden" ? "aba em 2.º plano" : "aba visível") : "";
        const detailParts: string[] = [];
        detailParts.push(`nomes [${names.join(", ")}]`);
        if (uniqNames.length === 1 && uniqNames[0] === "unknown") {
          detailParts.push(
            "«unknown» = origem opaca (iframe/extensão/outra origem); não é o teu bundle com nome"
          );
        }
        detailParts.push(`início(s) rel. à nav ~[${starts.join(", ")}]ms`);
        if (vis) detailParts.push(vis);

        const noAttrHint =
          "sem attribution ao script: use DevTools › Performance › gravar (flame na Main) ou React Profiler.";

        let line = `long tasks (${entries.length} no mesmo lote): ${durations.join("+")}ms total ~${sum}ms, pico ${max}ms · ${detailParts.join(" · ")} — ${attrJoined ?? noAttrHint}`;

        if (max >= 2000) {
          line +=
            " | AVISO: picos ≥2s costumam ser extensão do browser, aba em segundo plano, ou separador com DevTools aberto — testar janela anónima sem extensões.";
        }

        addNavPerfLog(line);
      });
      try {
        po.observe({ type: "longtask", buffered: true } as PerformanceObserverInit);
      } catch {
        po.observe({ entryTypes: ["longtask"] });
      }
    } catch {
      return;
    }
    return () => {
      try {
        po?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, addNavPerfLog]);

  return null;
}

function NavPerfRouteInner({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevKeyRef = useRef<string | null>(null);
  const { addNavPerfLog } = useSistemaDebug();

  useEffect(() => {
    if (!enabled) return;
    const key = `${pathname}?${searchParams.toString()}`;
    if (prevKeyRef.current === null) {
      prevKeyRef.current = key;
      addNavPerfLog(`rota inicial: ${key}`);
      return;
    }
    if (prevKeyRef.current === key) return;
    const from = prevKeyRef.current;
    prevKeyRef.current = key;
    const t0 = performance.now();

    requestAnimationFrame(() => {
      const ms1 = performance.now() - t0;
      requestAnimationFrame(() => {
        const ms2 = performance.now() - t0;
        const afterIdle = () => {
          const msIdle = performance.now() - t0;
          addNavPerfLog(
            `navegação: 1×rAF ${ms1.toFixed(1)}ms · 2×rAF ${ms2.toFixed(1)}ms · pós-idle ≈ ${msIdle.toFixed(1)}ms | ${from} → ${key}`
          );
        };
        if (typeof requestIdleCallback !== "undefined") {
          requestIdleCallback(afterIdle, { timeout: 2500 });
        } else {
          setTimeout(afterIdle, 0);
        }
      });
    });
  }, [pathname, searchParams, enabled, addNavPerfLog]);

  return null;
}

/** Ative em Admin › Debug › Inspecionar: «Performance navegação» — log no painel. */
export default function NavigationPerfDebug() {
  const { navPerfDebugEnabled } = useSistemaDebug();

  return (
    <>
      <NavPerfLongTaskObserver enabled={navPerfDebugEnabled} />
      {navPerfDebugEnabled ? (
        <Suspense fallback={null}>
          <NavPerfRouteInner enabled={navPerfDebugEnabled} />
        </Suspense>
      ) : null}
    </>
  );
}
