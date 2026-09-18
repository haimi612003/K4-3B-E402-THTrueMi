import { createTheme } from "@mui/material/styles";

/* Theme MUI khớp với ngôn ngữ hình trong ảnh mẫu: bo góc mềm, bóng rất nhẹ,
   nút đen đặc, không dùng màu tím mặc định của MUI. Màu dữ liệu KHÔNG khai ở
   đây — chúng sống trong CSS variable vì bảng đó đã kiểm mù màu và dùng chung
   với phần vẽ biểu đồ bằng SVG. */
export const makeTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: mode === "dark" ? "#3987e5" : "#2563eb" },
      background: {
        default: mode === "dark" ? "#0d0d0d" : "#f4f6f8",
        paper: mode === "dark" ? "#151f1e" : "#ffffff",
      },
      text: {
        primary: mode === "dark" ? "#ffffff" : "#0b0b0b",
        secondary: mode === "dark" ? "#c3c2b7" : "#4b5563",
      },
      divider: mode === "dark" ? "#2b3138" : "#e3e7ec",
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h1: { fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.08 },
      h2: { fontWeight: 600, letterSpacing: "-0.02em" },
      h3: { fontWeight: 600, letterSpacing: "-0.01em" },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 999, paddingInline: 18 } },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiTooltip: { defaultProps: { arrow: true } },
    },
  });
