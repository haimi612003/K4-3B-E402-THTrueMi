"""Shared typed action workflows for JSON endpoints and AG-UI streams."""
import time
from typing import Literal

from pydantic import BaseModel, Field
from ag_ui.core import StepFinishedEvent, StepStartedEvent

from . import cluster, pydantic_ai_client, loader
from .models import (
    AIInfo, AnswerOutput, AnswerResponse, ClusterRequest, DraftRequest,
    Example, FAQOutput, FAQResponse, GenerationOutput, GenerateRequest,
    GenerateResponse, LiveClusterResult, QuestionInput, Turn,
)
from .prompts import ANSWER_PROMPT, FAQ_PROMPT, GEN_PROMPT

MAX_QUESTIONS = 60
Operation = Literal["cluster", "generate", "answer", "faq"]
REQUEST_TYPES = {"cluster": ClusterRequest, "generate": GenerateRequest,
                 "answer": DraftRequest, "faq": DraftRequest}


class InputError(ValueError):
    """A validated request cannot be executed (HTTP 400)."""


class PreparedOperation(BaseModel):
    operation: Operation
    payload: ClusterRequest | GenerateRequest | DraftRequest
    records: list[Turn] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)


def question_records(items):
    records = []
    for i, item in enumerate(items, 1):
        item = QuestionInput(q=item) if isinstance(item, str) else item
        question = loader.redact(item.q.strip())
        if question:
            records.append(Turn(
                turn_id=item.turn_id or ("X%03d" % i),
                student=item.student or ("S9%03d" % i), q=question,
            ))
    return records


def prepare(operation, payload, chat_turns=()):
    """Resolve input and business errors before opening any stream."""
    prepared = PreparedOperation(operation=operation, payload=payload)
    if operation == "cluster":
        if len(payload.questions) > MAX_QUESTIONS:
            raise InputError("Tối đa %d câu một lần thử." % MAX_QUESTIONS)
        prepared.records = question_records(payload.questions)
        if not prepared.records:
            raise InputError("Chưa có câu hỏi nào.")
        ids = [t.turn_id for t in prepared.records]
        if len(set(ids)) != len(ids):
            raise InputError("Mã lượt hỏi không được trùng nhau.")
    elif operation in ("answer", "faq"):
        index = {t.turn_id: t for t in chat_turns}
        prepared.questions = [index[i].q for i in payload.turn_ids if i in index][:24]
        if not prepared.questions:
            prepared.questions = [loader.redact(q.strip()) for q in payload.questions if q.strip()][:24]
        if not prepared.questions:
            raise InputError("Cụm này không có câu hỏi nào" + (" để soạn." if operation == "answer" else "."))
    return prepared


def ai_info(meta):
    return AIInfo(model=meta.model, latency_ms=meta.latency_ms,
                  tokens_in=meta.tokens_in, tokens_out=meta.tokens_out)


async def execute(prepared, *, call_id, emit=None, thread_id=None, run_id=None):
    operation, payload = prepared.operation, prepared.payload
    ai_options = dict(emit=emit, thread_id=thread_id, run_id=run_id)
    if emit:
        await emit(StepStartedEvent(step_name=operation))
    started = time.monotonic()
    if operation == "cluster":
        result = await cluster.cluster_session_async(
            prepared.records, lecture_label=(payload.label or "Thử trực tiếp")[:80],
            call_id=call_id, **ai_options,
        )
        response = LiveClusterResult(
            **result.model_dump(exclude_unset=True),
            wall_ms=int((time.monotonic() - started) * 1000),
            input=[Example(turn_id=t.turn_id, q=t.q) for t in prepared.records],
        )
    elif operation == "generate":
        topic = (payload.topic or "AI Agent và ReAct").strip()[:120]
        n = payload.n or 14
        output, meta = await pydantic_ai_client.generate_json_async(
            GEN_PROMPT.format(n=n, topic=topic), GenerationOutput,
            call_id=call_id, temperature=1.0, **ai_options,
        )
        response = GenerateResponse(questions=[q for q in output.questions if q.strip()][:n],
                                    topic=topic, ai=ai_info(meta))
    else:
        qs = prepared.questions
        fields = dict(lecture=(payload.lecture or "buổi này")[:120],
                      n=len(qs), people=payload.people or "?",
                      questions="\n".join("- " + q[:300] for q in qs))
        if operation == "answer":
            name = (payload.name or "Cụm chưa đặt tên").strip()[:200]
            output, meta = await pydantic_ai_client.generate_json_async(
                ANSWER_PROMPT.format(**fields, name=name,
                    why=("Ghi chú khi gom cụm: " + payload.why[:300]) if payload.why else ""),
                AnswerOutput, call_id=call_id, temperature=0.4, **ai_options,
            )
            response = AnswerResponse(**output.model_dump(exclude_unset=True),
                                      ai=ai_info(meta), cluster=name)
        else:
            output, meta = await pydantic_ai_client.generate_json_async(
                FAQ_PROMPT.format(**fields, name=(payload.name or "").strip()[:200]),
                FAQOutput, call_id=call_id, temperature=0.3, **ai_options,
            )
            response = FAQResponse(**output.model_dump(exclude_unset=True), ai=ai_info(meta),
                                   cluster=payload.name, people=payload.people, turns=len(qs))
    if emit:
        await emit(StepFinishedEvent(step_name=operation))
    return response
