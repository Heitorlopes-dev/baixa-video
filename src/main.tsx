import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AndroidSpike } from "./spike/AndroidSpike";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {navigator.userAgent.includes("Android") ? <AndroidSpike /> : <App />}
    </QueryClientProvider>
  </React.StrictMode>,
);
