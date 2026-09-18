"""Local FastAPI server for the existing dashboard and future AG-UI frontend.

    python codebase/serve.py
    uvicorn serve:app --app-dir codebase --host 127.0.0.1 --port 8765
"""
import collections
import os
import secrets
import sys
import threading
import time
import webbrowser

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
from pydantic_ai.ui.ag_ui import AGUIAdapter
from ag_ui.core import RunAgentInput
import uvicorn

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from class_pulse import config, pydantic_ai_client, loader  # noqa: E402
from class_pulse import ag_ui, service  # noqa: E402
from class_pulse.console import use_utf8  # noqa: E402
from class_pulse.models import (  # noqa: E402
    AnswerResponse, ClusterRequest, DraftRequest, FAQResponse, GenerateRequest,
    GenerateResponse, HealthResponse, LiveClusterResult, LoginRequest,
    SamplesResponse, SessionResponse,
)
from class_pulse.prompts import SAMPLES  # noqa: E402

use_utf8()
config.load_env()
_DIST = os.path.join(HERE, "web", "dist")
UI = _DIST if os.path.isfile(os.path.join(_DIST, "index.html")) else os.path.join(HERE, "ui")
PORT = int(os.environ.get("CLASS_PULSE_PORT", "8765"))
MAX_QUESTIONS = service.MAX_QUESTIONS
SESSION_COOKIE = "cp_session"
SESSIONS = set()
LOGIN_FAILS = collections.defaultdict(list)
LOCK_AFTER = 8
LOCK_WINDOW = 300
_cache = {"turns": None, "err": None}
_lock = threading.Lock()
_OPEN_EXACT = ("/", "/index.html", "/api/login", "/api/session",
               "/favicon.ico", "/favicon.svg")
_OPEN_ASSET_EXT = (".js", ".css", ".woff", ".woff2", ".ttf", ".svg", ".png", ".ico", ".map")


def passcode():
    config.load_env()
    return os.environ.get("CLASS_PULSE_PASSCODE", "").strip()


def new_session():
    token = secrets.token_urlsafe(32)
    SESSIONS.add(token)
    return token


def rate_limited(ip):
    now = time.time()
    LOGIN_FAILS[ip] = [t for t in LOGIN_FAILS[ip] if now - t < LOCK_WINDOW]
    return len(LOGIN_FAILS[ip]) >= LOCK_AFTER


def turns():
    """Load the external chatlog once; absence does not prevent startup."""
    with _lock:
        if _cache["turns"] is None and _cache["err"] is None:
            try:
                _cache["turns"] = loader.load_turns(config.DEFAULT_CHATLOG, cohort="K4")
            except Exception as error:
                _cache.update(err=str(error), turns=[])
    return _cache["turns"]


def authed(request):
    return not passcode() or request.cookies.get(SESSION_COOKIE) in SESSIONS


def needs_auth(path):
    if path in _OPEN_EXACT:
        return False
    return not (path.startswith("/assets/") and path.endswith(_OPEN_ASSET_EXT) and ".." not in path)


class AuthMiddleware:
    """Pure ASGI guard: authenticate before parsing bodies or serving files."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request = Request(scope)
        if needs_auth(scope["path"]) and not authed(request):
            response = JSONResponse({"error": "Chưa đăng nhập.", "need_login": True}, 401,
                                    headers={"Cache-Control": "no-store"})
            return await response(scope, receive, send)

        async def no_cache(message):
            if message["type"] == "http.response.start" and scope["path"].startswith("/api/"):
                headers = list(message.get("headers", []))
                if not any(k.lower() == b"cache-control" for k, _ in headers):
                    headers.append((b"cache-control", b"no-store"))
                message = {**message, "headers": headers}
            await send(message)
        await self.app(scope, receive, no_cache)


app = FastAPI(title="Class Pulse", version="2.0", docs_url=None, redoc_url=None)
app.add_middleware(AuthMiddleware)


@app.exception_handler(RequestValidationError)
@app.exception_handler(ValidationError)
async def validation_error(request, error):
    details = "; ".join("%s: %s" % (".".join(map(str, e["loc"])), e["msg"])
                        for e in error.errors())
    return JSONResponse({"error": details}, status_code=422)


@app.exception_handler(service.InputError)
async def input_error(request, error):
    return JSONResponse({"error": str(error)}, status_code=400)


@app.exception_handler(Exception)
async def server_error(request, error):
    return JSONResponse({"error": pydantic_ai_client._safe_error(error)}, status_code=500,
                        headers={"Cache-Control": "no-store"})


@app.get("/api/session", response_model=SessionResponse)
async def session(request: Request):
    return SessionResponse(need_passcode=bool(passcode()), authed=authed(request))


@app.post("/api/login")
async def login(payload: LoginRequest, request: Request):
    ip = request.client.host if request.client else "local"
    if rate_limited(ip):
        return JSONResponse({"error": "Gõ sai quá nhiều lần. Đợi 5 phút rồi thử lại."}, 429)
    required = passcode()
    if not required:
        return {"ok": True, "note": "Máy chủ chưa đặt mã, đang chạy mở."}
    if not secrets.compare_digest(payload.passcode.encode("utf-8"), required.encode("utf-8")):
        LOGIN_FAILS[ip].append(time.time())
        left = max(0, LOCK_AFTER - len(LOGIN_FAILS[ip]))
        return JSONResponse({"error": "Mã không đúng. Còn %d lần thử." % left}, 403)
    LOGIN_FAILS.pop(ip, None)
    response = JSONResponse({"ok": True})
    response.set_cookie(SESSION_COOKIE, new_session(), httponly=True, samesite="strict", path="/")
    return response


@app.post("/api/logout")
async def logout(request: Request):
    SESSIONS.discard(request.cookies.get(SESSION_COOKIE))
    response = JSONResponse({"ok": True})
    response.delete_cookie(SESSION_COOKIE, httponly=True, samesite="strict", path="/")
    return response


@app.get("/api/health", response_model=HealthResponse)
def health():
    try:
        key_ok, key_hint = True, config.mask(config.api_key())
    except Exception as error:
        key_ok, key_hint = False, str(error)
    return HealthResponse(
        ok=key_ok, key=key_hint, model=config.model_name(), chatlog=len(turns()),
        chatlog_error=_cache["err"], max_questions=MAX_QUESTIONS,
        thresholds={
            "sparse_min_turns": config.SPARSE_MIN_TURNS, "chunk_size": config.CHUNK_SIZE,
            "weak_max_people": config.WEAK_MAX_PEOPLE, "skew_ratio": config.SKEW_RATIO,
            "skew_min_turns": config.SKEW_MIN_TURNS,
            "min_students_for_examples": config.MIN_STUDENTS_FOR_EXAMPLES,
        },
    )


@app.get("/api/samples", response_model=SamplesResponse, response_model_exclude_unset=True)
def samples():
    index = {t.turn_id: t for t in turns()}
    out = []
    for sample in SAMPLES:
        items = [{"turn_id": i, "student": index[i].student, "q": index[i].q}
                 for i in sample["ids"] if i in index]
        out.append({"id": sample["id"], "title": sample["title"], "hint": sample["hint"],
                    "n": len(items), "items": items})
    return SamplesResponse(samples=out, have_chatlog=bool(index))


async def run_json(operation, payload):
    prepared = service.prepare(operation, payload, turns() if operation in ("answer", "faq") else ())
    return await service.execute(prepared, call_id="live:%s" % operation)


@app.post("/api/cluster", response_model=LiveClusterResult, response_model_exclude_unset=True)
async def cluster_action(payload: ClusterRequest):
    return await run_json("cluster", payload)


@app.post("/api/generate", response_model=GenerateResponse, response_model_exclude_unset=True)
async def generate_action(payload: GenerateRequest):
    return await run_json("generate", payload)


@app.post("/api/answer", response_model=AnswerResponse, response_model_exclude_unset=True)
async def answer_action(payload: DraftRequest):
    return await run_json("answer", payload)


@app.post("/api/faq", response_model=FAQResponse, response_model_exclude_unset=True)
async def faq_action(payload: DraftRequest):
    return await run_json("faq", payload)


class ForwardedPayload(BaseModel):
    payload: dict


@app.post("/api/ag-ui/{operation}")
async def ag_ui_action(operation: service.Operation, run_input: RunAgentInput):
    # Use the integration's parser as well as FastAPI validation. Conversation,
    # state, context, and frontend tools never become action instructions.
    run_input = AGUIAdapter.build_run_input(run_input.model_dump_json(by_alias=True).encode())
    forwarded = ForwardedPayload.model_validate(run_input.forwarded_props)
    payload = service.REQUEST_TYPES[operation].model_validate(forwarded.payload)
    prepared = service.prepare(operation, payload, turns() if operation in ("answer", "faq") else ())
    return ag_ui.streaming_response(prepared, run_input)


# API routes must win before the root static mount.
app.mount("/", StaticFiles(directory=UI, html=True), name="dashboard")


def main():
    try:
        key_line = "khoá: %s · model: %s" % (config.mask(config.api_key()), config.model_name())
    except Exception as error:
        key_line = "CHƯA CÓ KHOÁ — %s" % error
    url = "http://127.0.0.1:%d/" % PORT
    print("Class Pulse — máy chủ cục bộ\n  %s" % key_line)
    print("  chatlog K4: %d lượt%s" % (len(turns()), (" (%s)" % _cache["err"]) if _cache["err"] else ""))
    print("  đăng nhập: %s" % ("BẬT" if passcode() else "TẮT — đặt CLASS_PULSE_PASSCODE trong .env để bật"))
    print("  %s\n  Ctrl+C để dừng.\n" % url)
    threading.Timer(0.6, lambda: webbrowser.open(url + "#live")).start()
    uvicorn.run(app, host="127.0.0.1", port=PORT)


if __name__ == "__main__":
    main()
