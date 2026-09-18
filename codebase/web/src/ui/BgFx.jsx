import { useEffect, useRef } from "react";

/* ══════════ NỀN ĐỘNG — bản chuyển từ giao diện cũ sang React ══════════

   Ba quy tắc giữ nguyên, vì đây là chỗ dễ làm rớt khung hình nhất trang:

   1. Nghe cuộn với {passive:true} — không passive thì trình duyệt phải đợi xem
      handler có gọi preventDefault không rồi mới cuộn được.
   2. Gộp vào ĐÚNG MỘT requestAnimationFrame mỗi khung hình. Sự kiện scroll bắn
      dày hơn khung hình rất nhiều.
   3. ĐỌC hết layout trước, GHI style sau. Đọc–ghi xen kẽ buộc trình duyệt tính
      lại layout đồng bộ ngay giữa khung hình.

   Mỗi khung hình ghi đúng 2 thuộc tính (transform, opacity) — cả hai chạy trên
   compositor nên không paint lại, không layout lại.

   CỐ Ý không làm mượt (không lerp, không quán tính): ánh xạ là hàm thuần tuý
   của scrollTop, nên cuộn ngược lên là nền đổi chiều ngay trong cùng khung hình
   đó, không trượt quá, không nảy. Giật khi đổi chiều là triệu chứng của làm
   mượt chứ không phải của đổi chiều.                                          */

const N = 48;
/* [tâm x, tâm y, số chấm, bán kính] — đều là tỉ lệ 0..1 của ô chứa, nên hình
   giữ nguyên tỉ lệ ở mọi bề rộng màn. Bốn cụm CỐ Ý không đều (18/12/9/6): bốn
   cụm bằng nhau đọc ra là trang trí, lệch nhau đọc ra là dữ liệu. */
const CL = [[0.735, 0.150, 18, 0.108], [0.845, 0.415, 12, 0.088],
            [0.715, 0.655, 9, 0.077], [0.855, 0.885, 6, 0.063]];
const STRAY = [5, 26, 41];        // 3 chấm KHÔNG vào cụm nào — "rải rác" có thật
const RATE = 0.09;                // lưới điểm đi 90px khi nội dung đi 1000px
const DEPTH_MIN = 0.55;           // độ mờ lớp sáng ở đỉnh trang
const DEPTH_MAX = 1.00;           // ở đáy trang

/* Bộ sinh có gieo hạt: hạt cố định nên ảnh chụp nộp giám khảo tái lập được y
   hệt trên mọi máy, mọi lần tải. */
const lcg = (s) => () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };

const motionOk = () =>
  !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* Chạy MỘT LẦN lúc gắn và mỗi lần đổi cỡ cửa sổ — KHÔNG chạy mỗi khung hình. */
function layoutDots(dots, w, h) {
  if (w < 40 || h < 40) return;
  const R = lcg(20260918), COLS = 8, ROWS = 6, cw = w / COLS, chh = h / ROWS;
  const slot = [];
  for (let k = 0; k < CL.length; k++) for (let j = 0; j < CL[k][2]; j++) slot.push([k, j]);
  /* Xáo bằng chính bộ sinh đã gieo hạt: không xáo thì cả băng trên cùng bay về
     cụm 1, trông máy móc. Xáo rồi vẫn tất định tuyệt đối. */
  for (let i = slot.length - 1; i > 0; i--) {
    const j = (R() * (i + 1)) | 0; const t = slot[i]; slot[i] = slot[j]; slot[j] = t;
  }
  let si = 0;
  const D = [4.6, 4.0, 3.7, 3.4];
  for (let i = 0; i < N; i++) {
    const x0 = ((i % COLS) + 0.5 + (R() - 0.5) * 0.68) * cw;      // lưới so le, phủ đều
    const y0 = (((i / COLS) | 0) + 0.5 + (R() - 0.5) * 0.68) * chh;
    /* VẠT MÉP TRÁI — hàng rào tương phản thứ hai sau hàng rào hình học. Chấm
       càng gần cột chữ càng mờ về 0. Là DỮ LIỆU nên không tốn gì lúc chạy. */
    const fade = Math.min(1, x0 / (w * 0.20));
    let ex, ey, a0, a1, d;
    if (STRAY.indexOf(i) >= 0) {
      ex = x0 + (w * 0.62 - x0) * 0.18; ey = y0 + (h * 0.50 - y0) * 0.18;   // đi 18% rồi mờ đi
      a0 = 0.46 * fade; a1 = 0.20; d = 3.2;
    } else {
      const sl = slot[si++], c = CL[sl[0]];
      const rr = c[3] * w * Math.sqrt((sl[1] + 0.5) / c[2]);
      const th = sl[1] * 2.39996323;                              // xoắn ốc góc vàng
      ex = c[0] * w + rr * Math.cos(th); ey = c[1] * h + rr * Math.sin(th) * 0.92;
      a0 = 0.46 * fade; a1 = 1; d = D[sl[0]];
    }
    ey -= 24;                                                     // cả đám nhích lên khi tụ xong
    /* Đường kính ghi thẳng giá trị CUỐI vì transform không còn scale(). */
    dots[i].style.cssText =
      "--x0:" + x0.toFixed(1) + "px;--y0:" + y0.toFixed(1) +
      "px;--dx:" + (ex - x0).toFixed(1) + "px;--dy:" + (ey - y0).toFixed(1) +
      "px;--a0:" + a0.toFixed(3) + ";--ad:" + (a1 - a0).toFixed(3) + ";--dd:" + d + "px";
  }
}

/* 48 chấm cho hero trang chủ. Bản thân lớp này position:fixed (xem .cpdots
   trong index.css) nên nó đứng yên trong khung nhìn như bản cũ — nhưng nó được
   render BÊN TRONG hero chứ không trong #bgfx. Lý do: #bgfx nằm dưới toàn bộ
   nội dung, mà hero có nền gradient đục (.sky), để ở đó là chấm bị che kín đúng
   vùng nó cần hiện. Đổi lại, lớp này phải tự mờ đi khi hero rời khung hình. */
export function HeroDots() {
  return (
    <div className="cpdots" aria-hidden="true">
      {Array.from({ length: N }, (_, i) => <span key={i} />)}
    </div>
  );
}

export default function BgFx({ page }) {
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    const host = document.querySelector("[data-scroll]");
    if (!el || !host) return;
    const l1 = el.querySelector(".l1"), l2 = el.querySelector(".l2");
    const wrap = document.querySelector(".cpdots");
    const dots = wrap ? Array.prototype.slice.call(wrap.children) : [];

    let tick = false, lw = 0, lh = 0, lastT = "", lastF = "", dotsBottom = 0;
    const MOTION = motionOk();
    const sky = document.querySelector(".sky");

    const frame = () => {
      tick = false;
      /* ── ĐỌC: mọi lần đọc layout nằm liền nhau, TRƯỚC mọi lần ghi ── */
      const y = host.scrollTop;
      const span = host.scrollHeight - host.clientHeight;
      const ch = host.clientHeight;
      let w = 0, h = 0, relay = false;
      /* Chắn bằng innerWidth/innerHeight (không chạm layout) nên clientWidth của
         ô chấm chỉ bị đọc khi cửa sổ THỰC SỰ đổi cỡ, không phải mỗi khung hình. */
      if (dots.length && (innerWidth !== lw || innerHeight !== lh)) {
        lw = innerWidth; lh = innerHeight; w = wrap.clientWidth; h = wrap.clientHeight; relay = true;
        dotsBottom = wrap.getBoundingClientRect().bottom;   // lớp fixed: không đổi khi cuộn
      }
      /* Mép dưới hero TRONG KHUNG NHÌN. Đọc thẳng mỗi khung hình chứ không cache
         theo lần đổi cỡ: bản trước cache offsetHeight ở khung hình đầu, lúc đó
         hero chưa dựng xong nên đo hụt ~580px và lớp chấm mờ hẳn ngay khi vừa
         bắt đầu cuộn. Một lần đọc rect trên MỘT phần tử, nằm trong pha ĐỌC. */
      const heroBottom = sky ? sky.getBoundingClientRect().bottom : Infinity;
      /* ── GHI ── */
      l1.style.transform = "translate3d(0," + (-y * RATE).toFixed(1) + "px,0)";
      const p = span > 0 ? Math.min(1, y / span) : 0;
      l2.style.opacity = (DEPTH_MIN + (DEPTH_MAX - DEPTH_MIN) * p).toFixed(3);

      if (!dots.length) return;
      if (relay) layoutDots(dots, w, h);
      /* Giảm chuyển động: CSS đã ghim --t:1!important nên ghi thêm không đổi
         được gì, chỉ làm bẩn style của 48 phần tử. layoutDots() vẫn phải chạy
         TRƯỚC dòng này để bản tĩnh dựng đúng chỗ. */
      if (!MOTION) return;
      /* span<=160 nghĩa là trang vừa lọt khung hình, không có gì để cuộn → hiện
         thẳng trạng thái đã tụ. Không có cung đường thì trạng thái nghỉ phải là
         CÂU TRẢ LỜI, không phải đống lộn xộn. */
      let t = 1;
      if (span > 160) {
        /* Bản cũ dùng ch*0.95. Ở đây phải ngắn hơn: lớp chấm nằm TRÊN hero nên
           nó phải mờ đi khi hero rời khung hình, và với ch*0.95 thì việc tụ cụm
           chỉ vừa xong đúng lúc bắt đầu mờ — người xem không bao giờ thấy trạng
           thái đã tụ, tức mất đúng câu mà hình định nói. Nửa khung hình thì tụ
           xong sớm, còn một quãng đứng yên rồi mới mờ. */
        t = Math.min(1, y / Math.max(240, Math.min(span, ch * 0.5)));
        t = t * t * (3 - 2 * t);      // smoothstep — VẪN là hàm thuần tuý của scrollTop
      }
      /* Chặn ghi trùng: t chạm 1 trước khi cuộn hết trang, nên quãng cuối sẽ ghi
         lại đúng con số cũ mỗi khung hình — mỗi lần ghi làm bẩn style 48 con. */
      const ts = t.toFixed(4);
      if (ts !== lastT) { lastT = ts; wrap.style.setProperty("--t", ts); }

      /* Mờ dần đúng lúc hero thôi che kín ô chấm — không sớm hơn, vì mờ sớm là
         mất phần thưởng; không muộn hơn, vì muộn là chấm lơ lửng đè lên thẻ. */
      const f = Math.max(0, Math.min(1, (heroBottom - dotsBottom) / 220));
      const fs = f.toFixed(3);
      if (fs !== lastF) { lastF = fs; wrap.style.setProperty("--fade", fs); }
    };

    const onScroll = () => { if (tick) return; tick = true; requestAnimationFrame(frame); };

    /* Giảm chuyển động: vẫn dựng bản TĨNH đúng chỗ, nhưng không gắn listener nào. */
    if (!MOTION) {
      if (dots.length) layoutDots(dots, wrap.clientWidth, wrap.clientHeight);
      l1.style.transform = "none";
      return undefined;
    }
    host.addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    frame();
    return () => {
      host.removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
    /* page nằm trong deps để mỗi lần đổi tab thì hiệu ứng chạy lại và tìm lại
       .cpdots — nó chỉ tồn tại khi trang chủ đang mở. */
  }, [page]);

  return (
    <div id="bgfx" ref={box} aria-hidden="true">
      <i className="l1" />
      <i className="l2"><b /></i>
    </div>
  );
}
