import React from "react";
import ReactDOM from "react-dom/client";
import { RouterContext } from "../contexts/RouterContext";
import type { AtriRouter } from "../router/AtriRouter";

/**
 *
 * @param atriRouter
 * @param App <html>...</html>
 */
export default function renderReactAppClientSide(
  atriRouter: AtriRouter,
  App: React.FC
) {
  ReactDOM.hydrateRoot(
    document.getElementById("__atri_app__")!,
    <React.StrictMode>
      <RouterContext.Provider value={atriRouter}>
        <App />
      </RouterContext.Provider>
    </React.StrictMode>
  );
}
