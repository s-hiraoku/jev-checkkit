import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { liveBridge } from "../../lib/bridge.js";
import { OptionsApp } from "../../ui/OptionsApp.js";
import "../../ui/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OptionsApp bridge={liveBridge()} />
  </StrictMode>,
);
