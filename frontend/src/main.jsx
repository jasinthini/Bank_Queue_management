import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App.jsx";
import { QueueProvider } from "./lib/queue-store.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <QueueProvider>
        <App />
        <Toaster position="top-right" richColors />
      </QueueProvider>
    </BrowserRouter>
  </StrictMode>
);