import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { liveBridge } from "../../lib/bridge.js";
import { SidePanelApp } from "../../ui/SidePanelApp.js";
import "../../ui/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanelApp bridge={liveBridge()} />
  </StrictMode>,
);
