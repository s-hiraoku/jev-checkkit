import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { liveBridge } from "../../lib/bridge.js";
import { DetailsApp } from "../../ui/DetailsApp.js";
import "../../ui/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DetailsApp bridge={liveBridge()} />
  </StrictMode>,
);
