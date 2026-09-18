# -*- coding: utf-8 -*-
"""
Cho phép console in được tiếng Việt.

Vì sao phải có file này: mọi script trong repo đều in tiếng Việt, nhưng
`python x.py` trong PowerShell/cmd trên Windows mặc định lấy code page hệ
thống (cp1252 ở máy tiếng Anh, cp1258 ở máy tiếng Việt). Gặp chữ có dấu,
`print()` ném UnicodeEncodeError và **script chết ngay tại dòng print**.

Với serve.py thì hậu quả là máy chủ không bao giờ được tạo — người dùng chỉ
thấy traceback và tưởng "không truy cập được web":

    print("Class Pulse — máy chủ cục bộ")
    UnicodeEncodeError: 'charmap' codec can't encode character '\u1ee7'

Đặt PYTHONUTF8=1 cũng chữa được, nhưng như thế là bắt người chạy phải nhớ một
biến môi trường mới dùng được sản phẩm. Sửa trong mã thì lệnh trong
HUONG-DAN-CHAY.md chạy đúng như đã ghi.
"""
import sys


def use_utf8():
    """Ép stdout/stderr sang UTF-8. Gọi ở đầu mỗi script chạy trực tiếp."""
    for stream in (sys.stdout, sys.stderr):
        # Python < 3.7 hoặc stdout đã bị thay bằng thứ khác (chạy trong test,
        # bị pipe qua wrapper) thì không có reconfigure — bỏ qua, không làm
        # hỏng script chỉ vì không đổi được encoding.
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass
