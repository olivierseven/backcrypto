"use client";

import SimuladorGenesisClient from "./SimuladorGenesisClient";
import { useMapOverlay } from "./MapOverlayContext";
import { API_BASE } from "../constants";

const CONFIG_SIDEBAR_ID = "bio-sistema-config-sidebar";
const CONFIG_PANEL_ID = "bio-sistema-config-panel";

/** Conteúdo principal: mapa ocupa a tela; formulário e estatísticas na sidebar/painel. */
export default function SistemaSimuladorCard() {
  const { bottomRightOverlay } = useMapOverlay();
  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      <SimuladorGenesisClient
        embedMode
        apiRun={`${API_BASE}/simulacao/run`}
        configSidebarId={CONFIG_SIDEBAR_ID}
        configPanelId={CONFIG_PANEL_ID}
        mapBottomRightOverlay={bottomRightOverlay}
      />
    </div>
  );
}
