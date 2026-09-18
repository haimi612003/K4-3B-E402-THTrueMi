# -*- coding: utf-8 -*-
"""
Kiểm cổng đăng nhập của serve.py — chạy thật, không mock.

    python codebase/test_serve.py

Vì sao có file này: cổng đăng nhập từng chặn NHẦM gói JavaScript của giao diện.
Màn hình đăng nhập nằm bên trong chính gói đó, nên chặn nó là người dùng thấy
TRANG TRẮNG và không còn đường nào đăng nhập. Lỗi im lặng — máy chủ vẫn trả 200
cho "/", log không có gì bất thường, chỉ người mở trình duyệt mới thấy.

Bài kiểm này dựng máy chủ thật trên một cổng trống rồi gọi HTTP thật, nên nó bắt
được đúng loại lỗi đó. Không cần mạng, không gọi model, không tốn tiền.
"""
import http.cookiejar
import json
import os
import socket
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# Cố tình đặt mã CÓ DẤU: compare_digest trên chuỗi ngoài ASCII ném TypeError
# và máy chủ trả 500 — đặt mã tiếng Việt trong .env thì không ai đăng nhập được.
PASSCODE = "mã-kiểm-thử-không-dùng-thật"
os.environ["CLASS_PULSE_PASSCODE"] = PASSCODE   # đặt TRƯỚC khi import serve

import serve  # noqa: E402
from class_pulse.console import use_utf8  # noqa: E402

use_utf8()

fails = []


def check(name, got, want):
    ok = got == want
    print("  %-46s %s  (%s)" % (name, "ĐẠT" if ok else "HỎNG", got))
    if not ok:
        fails.append("%s: nhận %s, đáng lẽ %s" % (name, got, want))


def status(opener, path):
    try:
        with opener.open("http://127.0.0.1:%d%s" % (PORT, path), timeout=5) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:                       # noqa: BLE001
        return "lỗi: %s" % e


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


PORT = free_port()
srv = ThreadingHTTPServer(("127.0.0.1", PORT), serve.Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

# Tên file gói JS đổi mỗi lần build (có hash), nên phải đọc từ dist chứ không
# viết cứng — viết cứng thì bài kiểm sẽ xanh giả sau lần build kế tiếp.
assets = os.path.join(HERE, "web", "dist", "assets")
bundle = next((f for f in sorted(os.listdir(assets)) if f.endswith(".js")), None) if os.path.isdir(assets) else None

print("Cổng đăng nhập — cổng thử %d\n" % PORT)

anon = urllib.request.build_opener()

print("Chưa đăng nhập — VỎ ỨNG DỤNG phải mở, nếu không thì trang trắng:")
check("GET /", status(anon, "/"), 200)
check("GET /index.html", status(anon, "/index.html"), 200)
check("GET /api/session", status(anon, "/api/session"), 200)
if bundle:
    check("GET /assets/%s" % bundle, status(anon, "/assets/" + bundle), 200)
else:
    print("  (chưa `npm run build` — bỏ qua phần gói JS)")

print("\nChưa đăng nhập — DỮ LIỆU phải chặn:")
check("GET /data.js", status(anon, "/data.js"), 401)
check("GET /api/health", status(anon, "/api/health"), 401)
check("GET /api/samples", status(anon, "/api/samples"), 401)
check("GET /assets/../data.js (đi vòng)", status(anon, "/assets/../data.js"), 401)

print("\nSai mã thì phải từ chối:")
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
req = urllib.request.Request("http://127.0.0.1:%d/api/login" % PORT,
                             data=json.dumps({"passcode": "sai-bét-nhè"}).encode("utf-8"),
                             headers={"Content-Type": "application/json"})
try:
    op.open(req, timeout=5)
    check("POST /api/login (mã sai)", 200, 403)
except urllib.error.HTTPError as e:
    check("POST /api/login (mã sai)", e.code, 403)

print("\nĐúng mã thì mở được dữ liệu:")
req = urllib.request.Request("http://127.0.0.1:%d/api/login" % PORT,
                             data=json.dumps({"passcode": PASSCODE}).encode("utf-8"),
                             headers={"Content-Type": "application/json"})
with op.open(req, timeout=5) as r:
    check("POST /api/login (mã đúng)", r.status, 200)
check("GET /data.js sau khi đăng nhập", status(op, "/data.js"), 200)
check("GET /api/health sau khi đăng nhập", status(op, "/api/health"), 200)

srv.shutdown()
print()
if fails:
    print("HỎNG %d chỗ:" % len(fails))
    for f in fails:
        print("  - %s" % f)
    sys.exit(1)
print("Tất cả đều đạt.")
