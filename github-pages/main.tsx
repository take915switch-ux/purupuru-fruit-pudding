import React from "react";
import { createRoot } from "react-dom/client";
import FruitPuddingGame from "../app/FruitPuddingGame";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FruitPuddingGame />
  </React.StrictMode>,
);
