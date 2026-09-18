/* ══════════ DỰNG FILE .doc CHO VLEARN ══════════
   Tách khỏi tab Cụm vấn đề để trang Đầu ra dùng LẠI đúng mã này chứ không chép
   một bản thứ hai — bản chép sẽ lệch khỏi bản gốc ngay lần sửa đầu tiên, và
   đây là thứ DUY NHẤT trong sản phẩm đi tới tay học viên.

   Word mở được HTML mang đuôi .doc, nên giữ được tiêu đề, in đậm, đường kẻ,
   khổ A4 mà không cần thư viện ngoài. Có BOM UTF-8 để Word đọc đúng tiếng Việt. */

/* Dựng bằng nối chuỗi chứ không viết thẳng "&amp;": chính file này từng bị một
   lần sửa tay "gỡ escape" làm hỏng, vì chuỗi thực thể trong mã nguồn trông y hệt
   thứ nó sinh ra. */
const AMP = "&" + "amp;", LT = "&" + "lt;", GT = "&" + "gt;", QUOT = "&" + "quot;";

export function esc(v) {
  return String(v == null ? "" : v)
    .split("&").join(AMP)
    .split("<").join(LT)
    .split(">").join(GT)
    .split('"').join(QUOT);
}

const fmtNum = (n) => (n == null ? "—" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."));

/**
 * @param items  [{name, people, turns, on, d:{question, answer, variants, publishable, refuse_reason}}]
 * @param s      buổi học (cần lecture, lecture_title, real_turns, students)
 */
export function buildFaqDoc(items, s) {
  const list = items || [];
  const on = list.filter((x) => x.on && x.d && x.d.publishable);
  const off = list.filter((x) => x.d && !x.d.publishable);
  const title = "Hỏi đáp thường gặp — " + ((s.lecture_title ? s.lecture_title + " · " : "") + s.lecture);

  let b = "<h1>" + esc(title) + "</h1>";
  b += '<p class="note">Tổng hợp từ câu hỏi thật của học viên khoá trước trong chính buổi học này. ' +
    "Bản nháp do AI soạn từ " + fmtNum(s.real_turns) + " lượt hỏi của " + s.students + " học viên, " +
    "<b>đã được Lab Coach đọc và duyệt</b> trước khi đăng. Thấy chỗ nào chưa đúng, báo lại để sửa.</p>";

  on.forEach((it, i) => {
    const d = it.d;
    b += "<h2>" + (i + 1) + ". " + esc(d.question) + "</h2>";
    b += "<p>" + esc(d.answer) + "</p>";
    if ((d.variants || []).length) {
      b += '<p class="alt"><i>Câu này còn hay được hỏi theo kiểu:</i> ' +
        d.variants.map((v) => "&ldquo;" + esc(v) + "&rdquo;").join(" &middot; ") + "</p>";
    }
    b += '<p class="meta">' + it.people + " học viên khoá trước đã hỏi chuyện này (" + it.turns + " lượt).</p>";
    if (i < on.length - 1) b += "<hr>";
  });

  if (off.length) {
    /* Nội dung này do model sinh ra: phải làm sạch trước khi đặt vào HTML
       comment, nếu không một dấu "--" hay ">" trong tên cụm sẽ làm vỡ comment và
       đẩy chữ ra file. */
    const safe = (x) => String(x == null ? "" : x).replace(/[<>]/g, " ").replace(/-{2,}/g, "-");
    b += "<!-- Hệ thống đã tự loại " + off.length + " cụm khỏi bản hỏi đáp này: " +
      off.map((it) => safe(it.name) + " — " + safe(it.d.refuse_reason)).join(" | ") + " -->";
  }

  return "﻿<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
    "xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>" +
    "<head><meta charset='utf-8'><title>" + esc(title) + "</title>" +
    "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom>" +
    "</w:WordDocument></xml><![endif]-->" +
    "<style>@page{size:A4;margin:2.2cm}" +
    "body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#111}" +
    "h1{font-family:Arial,sans-serif;font-size:19pt;margin:0 0 4pt}" +
    "h2{font-family:Arial,sans-serif;font-size:14pt;margin:18pt 0 5pt}" +
    "p{margin:0 0 9pt;text-align:justify}" +
    "p.note{font-size:10.5pt;color:#444;border-left:3pt solid #2563eb;padding-left:9pt;margin-bottom:16pt}" +
    "p.alt{font-size:11pt;color:#333}" +
    "p.meta{font-size:9.5pt;color:#666}" +
    "hr{border:0;border-top:1pt solid #ddd;margin:16pt 0}" +
    "</style></head><body>" + b + "</body></html>";
}

export function downloadFaqDoc(items, s) {
  const blob = new Blob([buildFaqDoc(items, s)], { type: "application/msword;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hoi-dap-" + s.key + ".doc";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
