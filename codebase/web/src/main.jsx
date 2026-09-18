import React from "react";
import { createRoot } from "react-dom/client";
import { StyledEngineProvider } from "@mui/material/styles";
import App from "./App.jsx";
import "./index.css";

/* injectFirst: đẩy style của Emotion (MUI) lên TRƯỚC thẻ style của Tailwind
   trong head. Cùng với important trỏ vào #root trong tailwind.config, đây là
   hai nửa của cùng một điều kiện — thiếu một nửa là utility của Tailwind thua
   class MUI và im lặng không có tác dụng. */
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StyledEngineProvider injectFirst>
      <App />
    </StyledEngineProvider>
  </React.StrictMode>
);
