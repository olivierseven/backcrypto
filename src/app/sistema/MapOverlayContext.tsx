"use client";

import { createContext, useContext } from "react";

export const MapOverlayContext = createContext<{
  bottomRightOverlay?: React.ReactNode;
  setPanelHasContent?: (hasContent: boolean) => void;
  /** Ref que componentes filhos podem definir para receber o clique no botão de configuração (ex.: expandir menu de execução). */
  configClickExtraRef?: React.MutableRefObject<(() => void) | null>;
}>({});

export function useMapOverlay() {
  return useContext(MapOverlayContext);
}
