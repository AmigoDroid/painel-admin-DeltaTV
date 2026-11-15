import PanelExperience from "../shared/PanelExperience.jsx";
import {api} from "./api.js";
import Boundary from "../shared/Boundary.jsx";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";

import "../shared/panel-theme.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Boundary><PanelExperience api={api} panel="admin"><App /></PanelExperience></Boundary>
  </React.StrictMode>,
);
