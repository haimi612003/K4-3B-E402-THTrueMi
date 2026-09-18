/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // preflight TẮT: nó reset lại baseline mà MUI đã đặt (CssBaseline), bật cả hai
  // thì nút và chữ của MUI bị dội về mặc định trình duyệt.
  corePlugins: { preflight: false },
  // important:'#root' nâng mọi utility của Tailwind lên một bậc đặc hiệu, để nó
  // thắng class Emotion mà MUI sinh ra lúc chạy. Không có dòng này thì
  // className="p-4" trên một <Button> của MUI sẽ bị bỏ qua.
  important: "#root",
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0b0b0b", 2: "#4b5563", muted: "#8a8f98" },
        line: { DEFAULT: "#e3e7ec", 2: "#eef1f5" },
        sky: { soft: "#dff1fb", mid: "#b9e3f6" },
        // bảng màu dữ liệu ĐÃ KIỂM MÙ MÀU — không đổi, không thêm
        s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,11,11,.04), 0 8px 24px -12px rgba(11,11,11,.12)",
        float: "0 24px 70px -28px rgba(11,40,80,.38)",
      },
      borderRadius: { xl2: "14px", xl3: "20px" },
    },
  },
  plugins: [],
};
