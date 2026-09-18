"""Validated application records and wire contracts (Pydantic v2)."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Record(BaseModel):
    # Preserve extensions in old session files and dashboard enrichment.
    model_config = ConfigDict(extra="allow")


class Turn(BaseModel):
    turn_id: str
    student: str
    at: str = ""
    course_id: str = "LIVE"
    lecture_code: str = "LIVE"
    lecture_title: str = "Thử trực tiếp"
    part: str | None = None
    preset: bool = False
    q: str


class SessionSummary(BaseModel):
    course_id: str
    lecture_code: str
    lecture_title: str
    total: int
    preset: int
    real: int
    students: int
    days: list[str]


class Example(BaseModel):
    turn_id: str
    q: str


class AIInfo(BaseModel):
    model: str
    latency_ms: int
    tokens_in: int | None = None
    tokens_out: int | None = None


class CallMetadata(AIInfo):
    fell_back: bool = False
    attempts: int = 1
    raw_text: str = ""


class AISummary(Record):
    called: bool
    reason: str | None = None
    call_id: str | None = None
    model: str | None = None
    models_used: list[str] = Field(default_factory=list)
    model_per_call: list[str] = Field(default_factory=list)
    fell_back: bool = False
    n_calls: int = 0
    n_chunks: int = 0
    latency_ms: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    attempts: int = 0


class Repairs(Record):
    invented_ids: list[str] = Field(default_factory=list)
    duplicates: list[str] = Field(default_factory=list)
    unplaced_added_to_scatter: list[str] = Field(default_factory=list)
    protos_before_merge: int | None = None
    preset_dropped_here: int = 0


class Cluster(Record):
    name: str
    why: str = ""
    turn_ids: list[str]
    people_key: list[int] = Field(default_factory=list)
    turns: int
    people: int
    parts: list[str] = Field(default_factory=list)
    weak: bool
    skew: bool
    skew_top_share: float
    examples_withheld: bool = False
    examples: list[Example] = Field(default_factory=list)
    questions: list[Example] = Field(default_factory=list)


class Scatter(Record):
    turn_ids: list[str]
    turns: int
    from_model: list[str] | None = None
    examples_withheld: bool = False
    examples: list[Example] = Field(default_factory=list)


class ClusterResult(Record):
    sparse: bool
    sparse_reason: str = ""
    lecture: str
    days: list[str] = Field(default_factory=list)
    total_turns: int
    real_turns: int
    preset_removed: int
    students: int
    clusters: list[Cluster]
    scatter: Scatter
    repairs: Repairs = Field(default_factory=Repairs)
    ai_call: AISummary


# AI schemas deliberately validate shape, not membership: the repair stage
# must still see invented, duplicate, and missing references.
class ModelCluster(BaseModel):
    name: str = Field(description="Tên vấn đề, tiếng Việt, suy ra được từ chính các câu trong cụm")
    turn_ids: list[str] = Field(description="Số thứ tự của các câu trong cụm, lấy đúng từ danh sách đầu vào")
    evidence_turn_ids: list[str] = Field(description="2-3 số tiêu biểu nhất, phải là tập con của turn_ids")
    why: str = Field(description="Một câu: các câu này cùng kẹt ở chỗ nào")


class ClusteringOutput(BaseModel):
    sparse: bool = Field(description="true nếu không tìm được cụm vấn đề nào đáng tin trong tập câu hỏi này")
    sparse_reason: str = ""
    clusters: list[ModelCluster]
    scatter_turn_ids: list[str] = Field(description="Số thứ tự của câu quá ngắn, lạc đề, hoặc không quy được vào vấn đề nào")


class MergeGroup(BaseModel):
    name: str = Field(description="Tên vấn đề cuối cùng cho cả nhóm")
    proto_ids: list[str]
    why: str


class MergeOutput(BaseModel):
    groups: list[MergeGroup]


class GenerationOutput(BaseModel):
    questions: list[str]
    note: str | None = None


Confidence = Literal["cao", "vừa", "thấp"]


class AnswerOutput(BaseModel):
    misread: str = Field(description="Học viên đang hiểu sai ở chỗ nào, suy từ chính chữ họ viết")
    different: str = Field(description="Giảng lại theo đường KHÁC slide: đổi thứ tự, đổi chất liệu, hoặc đổi câu hỏi mở đầu")
    example: str = Field(description="Một ví dụ cụ thể, có con số hoặc tình huống")
    check: str = Field(description="Một câu kiểm tra phân biệt được hiểu thật với thuộc lòng")
    minutes: int | None = Field(default=None, description="Ước lượng số phút cần trên lớp")
    confidence: Confidence = Field(description="cao | vừa | thấp")
    caveat: str = Field(description="Chỗ nào Lab Coach phải tự kiểm lại trước khi dùng")


class FAQOutput(BaseModel):
    publishable: bool = Field(description="false nếu cụm này không phải câu hỏi kiến thức của bài học")
    refuse_reason: str | None = Field(default=None, description="nếu publishable=false thì vì sao")
    question: str = Field(description="Câu hỏi chuẩn hoá, viết như học viên sẽ gõ vào ô tìm")
    answer: str = Field(description="Câu trả lời cho HỌC VIÊN đọc một mình, không có giảng viên bên cạnh")
    variants: list[str] = Field(description="Các cách hỏi khác của chính học viên, để tìm kiếm khớp được")
    needs_review: str = Field(description="Chỗ Lab Coach phải kiểm trước khi đăng")
    confidence: Confidence = Field(description="cao | vừa | thấp")


class SelfTestOutput(BaseModel):
    echo: str
    sum: int


class QuestionInput(BaseModel):
    q: str = ""
    student: str | None = None
    turn_id: str | None = None


class ClusterRequest(BaseModel):
    questions: list[str | QuestionInput] = Field(default_factory=list)
    label: str | None = None


class GenerateRequest(BaseModel):
    topic: str | None = None
    n: int | None = None

    @field_validator("n")
    @classmethod
    def clamp_count(cls, value):
        return max(6, min(value or 14, 60))


class DraftRequest(BaseModel):
    lecture: str | None = None
    name: str | None = None
    why: str | None = None
    people: int | None = None
    turn_ids: list[str] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)


class LoginRequest(BaseModel):
    passcode: str = ""


class GenerateResponse(BaseModel):
    questions: list[str]
    topic: str
    ai: AIInfo


class AnswerResponse(AnswerOutput):
    ai: AIInfo
    cluster: str


class FAQResponse(FAQOutput):
    ai: AIInfo
    cluster: str | None
    people: int | None
    turns: int


class LiveClusterResult(ClusterResult):
    wall_ms: int
    input: list[Example]


class SessionResponse(BaseModel):
    need_passcode: bool
    authed: bool


class HealthResponse(BaseModel):
    ok: bool
    key: str
    model: str
    chatlog: int
    chatlog_error: str | None
    thresholds: dict[str, int | float]
    max_questions: int


class Sample(BaseModel):
    id: str
    title: str
    hint: str
    n: int
    items: list[QuestionInput]


class SamplesResponse(BaseModel):
    samples: list[Sample]
    have_chatlog: bool


class Proto(BaseModel):
    name: str
    why: str
    evidence: list[str]
    members: list[Turn]


class ResolvedGroup(BaseModel):
    name: str
    why: str
    proto_idx: list[int]


class DashboardSession(ClusterResult):
    key: str | None = None
    lecture_title: str | None = None
    first_day: str | None = None
    last_day: str | None = None
    per_day: list[dict] = Field(default_factory=list)
    per_student: dict = Field(default_factory=dict)
