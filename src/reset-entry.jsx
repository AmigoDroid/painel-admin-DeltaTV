import React from "react";
import { createRoot } from "react-dom/client";
import { ResetPassword } from "./PasswordReset.jsx";
import "./style.css";
import "./password-reset.css";

// O HTML removeu o token da URL antes de carregar qualquer bundle.
const token = window.__DELTA_PASSWORD_RESET_TOKEN__ || "";
window.__DELTA_PASSWORD_RESET_TOKEN__ = undefined;
createRoot(document.getElementById("root")).render(<ResetPassword token={token} />);
