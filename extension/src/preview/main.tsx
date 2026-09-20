import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../ui/theme.css";
import { PreviewApp } from "./PreviewApp.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
);
