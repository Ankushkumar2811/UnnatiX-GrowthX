"""UnnatiX GrowthX - AI Company OS backend."""
import os
import logging
import uuid
import asyncio
import json
import smtplib
import ssl
import re
import socket
import ipaddress
import hashlib
import base64
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Literal

import bcrypt
import certifi
import httpx
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from cryptography.fernet import Fernet, InvalidToken

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", SMTP_USER)
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "UnnatiX Technologies")
SMTP_SECURITY = os.environ.get("SMTP_SECURITY", "starttls").lower()
GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
HUNTER_API_KEY = os.environ.get("HUNTER_API_KEY", "")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "https://backend-zeta-seven-97.vercel.app/api/integrations/google/callback")
GOOGLE_OAUTH_ENCRYPTION_KEY = os.environ.get("GOOGLE_OAUTH_ENCRYPTION_KEY", "") or JWT_SECRET
LLM_PROVIDER_ORDER = [
    p.strip().lower()
    for p in os.environ.get("LLM_PROVIDER_ORDER", "openai,anthropic,gemini").split(",")
    if p.strip().lower() in {"openai", "anthropic", "gemini"}
]
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 24 * 7

client = AsyncIOMotorClient(
    MONGO_URL,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=10000,
    connectTimeoutMS=10000,
)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("unnatix")

app = FastAPI(title="UnnatiX GrowthX API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)


# ============================================================
# AI EMPLOYEE CATALOG
# ============================================================
AI_EMPLOYEES = [
    {
        "id": "ceo",
        "name": "Shri Nath",
        "role": "Agency CEO AI",
        "department": "Executive",
        "tagline": "Growth strategy & client delivery",
        "responsibilities": [
            "Turn client briefs into campaigns", "Delegate across agency departments",
            "Review deliverables", "Protect timelines and ROI", "Escalate approvals",
        ],
        "avatar_shape": "prism",
        "accent": "#FF4400",
    },
    {
        "id": "marketing",
        "name": "Harshita Gaur",
        "role": "Social & Content AI",
        "department": "Creative Marketing",
        "tagline": "Social, content, branding & engagement",
        "responsibilities": [
            "Social media calendars", "Reels and ad scripts", "Brand campaigns",
            "WhatsApp and email content", "Influencer plans", "Creative briefs",
        ],
        "avatar_shape": "wave",
        "accent": "#FF7300",
    },
    {
        "id": "seo",
        "name": "Ishaan Kapoor",
        "role": "SEO & Organic Growth AI",
        "department": "Organic Growth",
        "tagline": "Rankings, traffic & local visibility",
        "responsibilities": [
            "Keyword and intent research", "Technical and local SEO audits", "Content briefs",
            "On-page optimization", "Backlink and internal-link plans", "Ranking reports",
        ],
        "avatar_shape": "search",
        "accent": "#14B8A6",
    },
    {
        "id": "sales",
        "name": "Arjun Mehta",
        "role": "Sales Generation AI",
        "department": "Sales & Partnerships",
        "tagline": "Leads, offers, pitches & revenue pipeline",
        "responsibilities": [
            "Generate verified prospect lists", "Score leads by intent and fit",
            "Build service offers and proposals", "Write personalized pitches and follow-ups",
            "Handle objections and closing scripts", "Forecast sales pipeline and revenue",
        ],
        "avatar_shape": "spiral",
        "accent": "#00E676",
    },
    {
        "id": "research",
        "name": "Ananya Iyer",
        "role": "Market Intelligence AI",
        "department": "Strategy & Research",
        "tagline": "Client markets, audiences & competitors",
        "responsibilities": [
            "Client industry research", "Competitor and ad-library analysis", "Audience insights",
            "Platform trends", "Campaign opportunity reports",
        ],
        "avatar_shape": "orbit",
        "accent": "#00E5FF",
    },
    {
        "id": "developer",
        "name": "Rohan Verma",
        "role": "Web & App Development AI",
        "department": "Technology",
        "tagline": "Websites, landing pages, apps & tracking",
        "responsibilities": [
            "Responsive websites and landing pages", "Web and mobile app plans", "Analytics and pixels",
            "Technical SEO fixes", "APIs and automations", "Deployment documentation",
        ],
        "avatar_shape": "grid",
        "accent": "#A78BFA",
    },
    {
        "id": "operations",
        "name": "Kavya Sharma",
        "role": "Client Operations AI",
        "department": "Client Success",
        "tagline": "Onboarding, delivery & reporting",
        "responsibilities": [
            "Client onboarding", "Campaign timelines", "Assign deliverables",
            "Monitor deadlines", "Prepare review meetings and reports",
        ],
        "avatar_shape": "hex",
        "accent": "#FFC400",
    },
    {
        "id": "finance",
        "name": "Vikram Shah",
        "role": "Finance & ROI AI",
        "department": "Finance & Commercials",
        "tagline": "Pricing, ad spend, margins & ROI",
        "responsibilities": [
            "Service pricing and retainers", "Ad-spend allocation", "Revenue forecasting",
            "Campaign profitability", "ROI and ROAS reporting",
        ],
        "avatar_shape": "diamond",
        "accent": "#F59E0B",
    },
    {
        "id": "hr",
        "name": "Meera Joshi",
        "role": "People & SOP AI",
        "department": "People & Enablement",
        "tagline": "Hiring, SOPs, training & knowledge",
        "responsibilities": [
            "Agency SOPs", "Hire SEO, creative and media talent", "Training plans",
            "Role scorecards", "Knowledge base governance",
        ],
        "avatar_shape": "knot",
        "accent": "#EC4899",
    },
]


# ============================================================
# MODELS
# ============================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    organization: str
    created_at: datetime


class AuthOut(BaseModel):
    token: str
    user: UserOut


class GoalIn(BaseModel):
    objective: str = Field(min_length=4, max_length=500)


class Task(BaseModel):
    id: str
    goal_id: str
    user_id: str
    agent_id: str
    title: str
    description: str
    priority: Literal["low", "medium", "high"]
    status: Literal["pending", "planning", "running", "waiting_approval", "completed", "cancelled"]
    progress: int
    requires_approval: bool
    output: Optional[str] = None
    delivery_type: str = "document"
    execution_status: str = "queued"
    evidence: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class GoalOut(BaseModel):
    id: str
    user_id: str
    objective: str
    summary: str
    status: str
    created_at: datetime
    tasks: List[Task]


class Approval(BaseModel):
    id: str
    user_id: str
    task_id: str
    agent_id: str
    action: str
    impact: str
    payload_preview: str
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime


class TaskStatusIn(BaseModel):
    status: Literal["pending", "planning", "running", "waiting_approval", "completed", "cancelled"]


class ApprovalDecisionIn(BaseModel):
    decision: Literal["approved", "rejected"]


class TaskQuickIn(BaseModel):
    agent_id: str
    title: str = Field(min_length=2, max_length=140)
    description: str = Field(min_length=2, max_length=500)
    priority: Literal["low", "medium", "high"] = "medium"
    requires_approval: bool = False


class KnowledgeIn(BaseModel):
    kind: Literal["note", "file", "url"]
    title: str = Field(min_length=1, max_length=140)
    content: Optional[str] = None
    mime: Optional[str] = None


class IntegrationToggleIn(BaseModel):
    enabled: bool


class SMTPTestIn(BaseModel):
    to_email: Optional[EmailStr] = None


class LeadSearchIn(BaseModel):
    query: str = Field(min_length=2, max_length=160)
    location: str = Field(default="Delhi NCR", min_length=2, max_length=100)
    max_results: int = Field(default=10, ge=1, le=20)


class LeadEnrichIn(BaseModel):
    lead_id: Optional[str] = None
    limit: int = Field(default=1, ge=1, le=10)
    verify_email: bool = True


class KnowledgeFileIn(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    mime: str
    file_b64: str  # base64-encoded file bytes


class MeetingIn(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    participants: List[str] = Field(default_factory=list)
    start_time: datetime
    duration_min: int = Field(default=30, ge=10, le=480)
    description: str = ""
    requires_approval: bool = False


class AutomationIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    trigger: Literal["goal_created", "goal_completed", "approval_approved", "task_completed", "knowledge_added"]
    action: Literal["create_task", "add_knowledge_note", "log_only"]
    action_config: dict = Field(default_factory=dict)
    enabled: bool = True


class OrgInviteJoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class OrgMemberRoleIn(BaseModel):
    role: Literal["owner", "admin", "member"]


# ============================================================
# AUTH HELPERS
# ============================================================
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        decoded = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = decoded["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def user_to_out(u: dict) -> UserOut:
    return UserOut(
        id=u["id"], email=u["email"], name=u["name"],
        organization=u.get("organization", "Personal"), created_at=u["created_at"],
    )


# ============================================================
# ACTIVITY LOG
# ============================================================
async def log_activity(user_id: str, agent_id: str, message: str, kind: str = "info") -> None:
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "agent_id": agent_id,
        "message": message,
        "kind": kind,
        "created_at": datetime.now(timezone.utc),
    }
    await db.activity.insert_one(doc)


# ============================================================
# AI ORCHESTRATION
# ============================================================
def _clean_model_text(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```", 2)
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


def _configured_llm_providers() -> List[str]:
    keys = {
        "openai": OPENAI_API_KEY,
        "anthropic": ANTHROPIC_API_KEY,
        "gemini": GEMINI_API_KEY,
    }
    return [provider for provider in LLM_PROVIDER_ORDER if keys.get(provider)]


async def _call_openai(system_prompt: str, user_prompt: str) -> str:
    payload = {
        "model": OPENAI_MODEL,
        "instructions": system_prompt,
        "input": user_prompt,
        "max_output_tokens": 2400,
    }
    async with httpx.AsyncClient(timeout=45.0) as http:
        response = await http.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    if isinstance(data.get("output_text"), str) and data["output_text"].strip():
        return data["output_text"]
    chunks = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                chunks.append(content["text"])
    if not chunks:
        raise ValueError("OpenAI returned no output text")
    return "\n".join(chunks)


async def _call_anthropic(system_prompt: str, user_prompt: str) -> str:
    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 2400,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    async with httpx.AsyncClient(timeout=45.0) as http:
        response = await http.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    chunks = [block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"]
    text = "\n".join(chunk for chunk in chunks if chunk)
    if not text:
        raise ValueError("Anthropic returned no output text")
    return text


async def _call_gemini(system_prompt: str, user_prompt: str) -> str:
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {"maxOutputTokens": 2400},
    }
    async with httpx.AsyncClient(timeout=45.0) as http:
        response = await http.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            headers={"x-goog-api-key": GEMINI_API_KEY},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError("Gemini returned no candidates")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "") for part in parts if part.get("text"))
    if not text:
        raise ValueError("Gemini returned no output text")
    return text


async def llm_complete(system_prompt: str, user_prompt: str, expect_json: bool = False) -> str:
    providers = _configured_llm_providers()
    if not providers:
        raise HTTPException(
            status_code=503,
            detail="No AI provider configured. Add an OpenAI, Anthropic, or Gemini API key.",
        )

    callers = {
        "openai": _call_openai,
        "anthropic": _call_anthropic,
        "gemini": _call_gemini,
    }
    failures = []
    for provider in providers:
        for attempt in range(1, 4):
            try:
                raw = await callers[provider](system_prompt, user_prompt)
                cleaned = _clean_model_text(raw)
                if expect_json:
                    json.loads(cleaned)
                logger.info("LLM request completed via %s (attempt %s)", provider, attempt)
                return cleaned
            except Exception as exc:
                status_code = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
                transient = (
                    isinstance(exc, (httpx.TimeoutException, httpx.TransportError))
                    or status_code == 429
                    or (status_code is not None and status_code >= 500)
                )
                logger.warning(
                    "LLM provider %s attempt %s failed: %s%s",
                    provider,
                    attempt,
                    type(exc).__name__,
                    f" status={status_code}" if status_code else "",
                )
                if not transient or attempt == 3:
                    break
                await asyncio.sleep(2 ** (attempt - 1))
        failures.append(provider)

    raise HTTPException(
        status_code=502,
        detail=f"All configured AI providers failed: {', '.join(failures)}",
    )


ORCHESTRATION_PROMPT = """You are Shri Nath, the CEO AI of UnnatiX Technologies, a Delhi NCR digital marketing and technology agency.
The agency delivers SEO, social media marketing, Google/Meta/LinkedIn ads, branding, content, WhatsApp/email marketing, websites, apps, e-commerce management and performance analytics.
Your job: turn the founder's or client's objective into a precise, measurable agency execution plan and delegate it to your team.

Available AI employees (delegate ONLY to these):
- marketing (Harshita Gaur): social calendars, campaign concepts, ad/reel scripts, branding, influencer and messaging content
- seo (Ishaan Kapoor): keyword strategy, technical/local SEO, content briefs, on-page work, links and ranking reports
- sales (Arjun Mehta): verified agency prospects, lead scoring, offers, proposals, pitches, objection handling, follow-ups and revenue pipeline (REQUIRES APPROVAL before sending)
- research (Ananya Iyer): client markets, audiences, competitors, ad libraries and platform trends
- developer (Rohan Verma): websites, landing pages, apps, analytics pixels, technical SEO fixes and automations
- operations (Kavya Sharma): client onboarding, campaign workflows, deadlines, deliverables and reporting cadence
- finance (Vikram Shah): retainers, ad budgets, margins, revenue forecasts, ROI and ROAS
- hr (Meera Joshi): agency SOPs, hiring, role scorecards, training and knowledge base

Return ONLY a valid JSON object (no markdown, no prose) with this exact shape:
{
  "summary": "2-3 sentence executive summary of the plan",
  "tasks": [
    {
      "agent_id": "marketing",
      "title": "short task title",
      "description": "1-2 sentence concrete deliverable",
      "priority": "high",
      "requires_approval": false
    }
  ]
}

Rules:
- Generate 5 to 8 tasks across at least 4 different agents.
- Every task must name a concrete agency deliverable, owner outcome and measurable success signal.
- Prefer INR for budgets unless the objective explicitly uses another currency.
- Sales work must include ICP, qualification criteria, offer, next action and pipeline value; never fabricate contact details or claim a sale happened.
- Sales outreach tasks (sending emails, messages, publishing) MUST have requires_approval: true.
- Priorities allowed: "low", "medium", "high".
- agent_id MUST be one of: marketing, seo, sales, research, developer, operations, finance, hr.
- Output pure JSON only. No code fences."""


async def llm_orchestrate(objective: str) -> dict:
    """Build an execution plan through the configured provider failover chain."""
    text = await llm_complete(
        ORCHESTRATION_PROMPT,
        f"Business objective: {objective}",
        expect_json=True,
    )
    plan = json.loads(text)
    return _validate_plan(plan, objective)


def _validate_plan(plan: dict, objective: str) -> dict:
    valid_ids = {e["id"] for e in AI_EMPLOYEES if e["id"] != "ceo"}
    tasks = []
    for t in plan.get("tasks", []):
        if t.get("agent_id") not in valid_ids:
            continue
        priority = t.get("priority", "medium")
        if priority not in ("low", "medium", "high"):
            priority = "medium"
        tasks.append({
            "agent_id": t["agent_id"],
            "title": str(t.get("title", "Untitled"))[:140],
            "description": str(t.get("description", ""))[:500],
            "priority": priority,
            "requires_approval": bool(t.get("requires_approval", False)),
        })
    if not tasks:
        return _fallback_plan(objective)
    return {"summary": str(plan.get("summary", ""))[:600], "tasks": tasks}


def _fallback_plan(objective: str) -> dict:
    return {
        "summary": f"UnnatiX Technologies execution plan for: {objective}. A coordinated client-growth initiative across strategy, creative, SEO, sales, delivery and ROI.",
        "tasks": [
            {"agent_id": "research", "title": "Client market and competitor brief", "description": "Map the target audience, 5 competitors, their offers, ads and digital gaps.", "priority": "high", "requires_approval": False},
            {"agent_id": "marketing", "title": "30-day social and creative campaign", "description": "Create campaign angles, a channel calendar, reel/ad scripts and creative briefs.", "priority": "high", "requires_approval": False},
            {"agent_id": "seo", "title": "SEO opportunity and content map", "description": "Produce keyword clusters, local/technical audit actions and prioritized content briefs.", "priority": "high", "requires_approval": False},
            {"agent_id": "developer", "title": "Conversion and tracking implementation", "description": "Specify landing-page improvements, analytics events, pixels and technical SEO fixes.", "priority": "high", "requires_approval": False},
            {"agent_id": "sales", "title": "Qualified prospect and proposal pack", "description": "Build an ICP-matched lead list and a service proposal with outcome-led packages.", "priority": "medium", "requires_approval": False},
            {"agent_id": "sales", "title": "Founder-approved outreach sequence", "description": "Draft personalized email, LinkedIn and WhatsApp follow-ups for review before sending.", "priority": "medium", "requires_approval": True},
            {"agent_id": "operations", "title": "Client delivery plan", "description": "Set owners, dependencies, review dates, reporting cadence and a 30-day timeline.", "priority": "medium", "requires_approval": False},
            {"agent_id": "finance", "title": "Pricing, ad budget and ROI model", "description": "Recommend INR retainer, channel spend, margin assumptions and measurable ROI/ROAS targets.", "priority": "medium", "requires_approval": False},
        ],
    }


# ============================================================
# ROUTES: AUTH
# ============================================================
@api.get("/")
async def root():
    return {"app": "UnnatiX GrowthX", "status": "online"}


@api.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower(),
        "name": body.name,
        "password_hash": hash_password(body.password),
        "organization": f"{body.name}'s Company",
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    token = make_token(user_doc["id"])
    return AuthOut(token=token, user=user_to_out(user_doc))


@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_token(user["id"])
    return AuthOut(token=token, user=user_to_out(user))


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return user_to_out(user)


# ============================================================
# ROUTES: AGENTS
# ============================================================
@api.get("/agents")
async def list_agents(user: dict = Depends(current_user)):
    out = []
    for emp in AI_EMPLOYEES:
        completed = await db.tasks.count_documents({"user_id": user["id"], "agent_id": emp["id"], "status": "completed"})
        running = await db.tasks.count_documents({"user_id": user["id"], "agent_id": emp["id"], "status": {"$in": ["running", "planning"]}})
        current = await db.tasks.find_one(
            {"user_id": user["id"], "agent_id": emp["id"], "status": {"$in": ["running", "planning", "waiting_approval"]}},
            {"_id": 0, "title": 1}, sort=[("updated_at", -1)],
        )
        out.append({
            **emp,
            "status": "active" if running > 0 else "idle",
            "current_task": current["title"] if current else None,
            "completed_tasks": completed,
            "performance": min(100, 70 + completed * 3),
        })
    return out


# ============================================================
# ROUTES: GOALS / ORCHESTRATION
# ============================================================
@api.post("/goals", response_model=GoalOut)
async def create_goal(body: GoalIn, user: dict = Depends(current_user)):
    goal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    await log_activity(user["id"], "ceo", f"Received objective: {body.objective[:80]}", "goal")

    plan = await llm_orchestrate(body.objective)

    goal_doc = {
        "id": goal_id,
        "user_id": user["id"],
        "objective": body.objective,
        "summary": plan["summary"],
        "status": "running",
        "created_at": now,
    }
    await db.goals.insert_one(goal_doc)

    tasks: List[Task] = []
    for t in plan["tasks"]:
        task_doc = {
            "id": str(uuid.uuid4()),
            "goal_id": goal_id,
            "user_id": user["id"],
            "agent_id": t["agent_id"],
            "title": t["title"],
            "description": t["description"],
            "priority": t["priority"],
            "status": "waiting_approval" if t["requires_approval"] else "planning",
            "progress": 10 if t["requires_approval"] else 25,
            "requires_approval": t["requires_approval"],
            "output": None,
            "delivery_type": _delivery_type(t),
            "execution_status": "waiting_approval" if t["requires_approval"] else "queued",
            "evidence": [],
            "created_at": now,
            "updated_at": now,
        }
        await db.tasks.insert_one(task_doc)
        task_doc.pop("_id", None)
        tasks.append(Task(**task_doc))

        agent_name = next((e["name"] for e in AI_EMPLOYEES if e["id"] == t["agent_id"]), t["agent_id"])
        await log_activity(user["id"], t["agent_id"], f"{agent_name} accepted task: {t['title']}", "task")

        if t["requires_approval"]:
            approval = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "task_id": task_doc["id"],
                "agent_id": t["agent_id"],
                "action": t["title"],
                "impact": "Sensitive action — requires founder approval before execution.",
                "payload_preview": t["description"],
                "status": "pending",
                "created_at": now,
            }
            await db.approvals.insert_one(approval)
            await log_activity(user["id"], "ceo", f"Approval requested for: {t['title']}", "approval")

    await log_activity(user["id"], "ceo", f"Plan ready — {len(tasks)} tasks across {len({t.agent_id for t in tasks})} departments", "info")
    await fire_automations(user["id"], "goal_created", {"goal_id": goal_id, "objective": body.objective})

    return GoalOut(
        id=goal_id, user_id=user["id"], objective=body.objective,
        summary=plan["summary"], status="running", created_at=now, tasks=tasks,
    )


@api.get("/goals")
async def list_goals(user: dict = Depends(current_user)):
    goals = await db.goals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return goals


@api.get("/goals/{goal_id}", response_model=GoalOut)
async def get_goal(goal_id: str, user: dict = Depends(current_user)):
    goal = await db.goals.find_one({"id": goal_id, "user_id": user["id"]}, {"_id": 0})
    if not goal:
        raise HTTPException(404, "Goal not found")
    tasks_raw = await db.tasks.find({"goal_id": goal_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return GoalOut(**goal, tasks=[Task(**t) for t in tasks_raw])


# ============================================================
# ROUTES: TASKS
# ============================================================
@api.get("/tasks")
async def list_tasks(user: dict = Depends(current_user)):
    tasks = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return tasks


@api.patch("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskStatusIn, user: dict = Depends(current_user)):
    task = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    progress = 100 if body.status == "completed" else (75 if body.status == "running" else task["progress"])
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": body.status, "progress": progress, "updated_at": datetime.now(timezone.utc)}},
    )
    if body.status == "completed":
        await fire_automations(user["id"], "task_completed", {"task_id": task_id})
    return {"ok": True}


# ============================================================
# ROUTES: APPROVALS
# ============================================================
@api.get("/approvals")
async def list_approvals(user: dict = Depends(current_user)):
    items = await db.approvals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api.post("/approvals/{approval_id}/decision")
async def decide_approval(approval_id: str, body: ApprovalDecisionIn, user: dict = Depends(current_user)):
    appr = await db.approvals.find_one({"id": approval_id, "user_id": user["id"]}, {"_id": 0})
    if not appr:
        raise HTTPException(404, "Approval not found")
    now = datetime.now(timezone.utc)
    await db.approvals.update_one({"id": approval_id}, {"$set": {"status": body.decision, "decided_at": now}})

    new_task_status = "planning" if body.decision == "approved" else "cancelled"
    new_progress = 25 if body.decision == "approved" else 0
    await db.tasks.update_one(
        {"id": appr["task_id"]},
        {"$set": {"status": new_task_status, "progress": new_progress, "execution_status": "queued" if body.decision == "approved" else "cancelled", "updated_at": now}},
    )
    verb = "approved" if body.decision == "approved" else "rejected"
    await log_activity(user["id"], appr["agent_id"], f"Founder {verb}: {appr['action']}", "approval")
    if body.decision == "approved":
        meeting = await db.meetings.find_one({"id": appr["task_id"], "user_id": user["id"]}, {"_id": 0})
        if meeting:
            created = await _schedule_google_meeting(user["id"], meeting)
            await db.meetings.update_one({"id": meeting["id"]}, {"$set": {**created, "status": "scheduled"}})
        else:
            await fire_automations(user["id"], "approval_approved", {"approval_id": approval_id, "task_id": appr["task_id"]})
    else:
        await db.meetings.update_one({"id": appr["task_id"], "user_id": user["id"]}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


# ============================================================
# ROUTES: ACTIVITY + STATS
# ============================================================
@api.get("/activity")
async def list_activity(user: dict = Depends(current_user)):
    items = await db.activity.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(80)
    return items


@api.get("/stats/dashboard")
async def dashboard_stats(user: dict = Depends(current_user)):
    uid = user["id"]
    active = await db.tasks.count_documents({"user_id": uid, "status": {"$in": ["planning", "running"]}})
    completed = await db.tasks.count_documents({"user_id": uid, "status": "completed"})
    goals_running = await db.goals.count_documents({"user_id": uid, "status": "running"})
    approvals_pending = await db.approvals.count_documents({"user_id": uid, "status": "pending"})
    total_tasks = await db.tasks.count_documents({"user_id": uid})
    return {
        "total_agents": len(AI_EMPLOYEES),
        "active_tasks": active,
        "completed_tasks": completed,
        "goals_running": goals_running,
        "approvals_pending": approvals_pending,
        "reports_generated": completed,  # proxy
        "leads_researched": await db.tasks.count_documents({"user_id": uid, "agent_id": "sales"}),
        "content_created": await db.tasks.count_documents({"user_id": uid, "agent_id": "marketing"}),
        "projects_running": goals_running,
        "total_tasks": total_tasks,
        "system_status": "operational",
    }


# ============================================================
# PER-AGENT GENERATION
# ============================================================
AGENT_SYSTEM_PROMPTS = {
    "marketing": "You are Harshita Gaur, Social & Content AI at UnnatiX Technologies. Create channel-specific social calendars, campaign concepts, reel/ad scripts, branding briefs, influencer plans and WhatsApp/email content. Tie every deliverable to audience, CTA and measurable engagement or conversion goals.",
    "seo": "You are Ishaan Kapoor, SEO & Organic Growth AI at UnnatiX Technologies. Produce keyword clusters with intent, local and technical audits, content briefs, metadata, backlink/internal-link plans and ranking roadmaps. Never invent search volume; label estimates and assumptions. Prioritize actions by impact and effort.",
    "sales": "You are Arjun Mehta, Sales Generation AI at UnnatiX Technologies. Your goal is to create a practical path to revenue: define the ICP, produce source-backed prospect lists, score fit and buying intent, design outcome-led service packages, draft proposals and personalized email/LinkedIn/WhatsApp pitches, answer objections, create follow-up and closing scripts, and maintain a pipeline with stage, probability, next action and INR value. Never invent contact details, meetings, replies or closed sales. Clearly mark unverified data. Outbound actions require founder approval.",
    "research": "You are Ananya Iyer, Market Intelligence AI at UnnatiX Technologies. Research client industries, customer segments, competitors, pricing, ad libraries and platform trends. Separate verified facts from assumptions and turn findings into campaign opportunities.",
    "developer": "You are Rohan Verma, Web & App Development AI at UnnatiX Technologies. Produce website, landing-page and app plans, conversion improvements, analytics/pixel specifications, technical SEO fixes, APIs, automations, code and deployment checklists.",
    "operations": "You are Kavya Sharma, Client Operations AI at UnnatiX Technologies. Produce onboarding checklists, campaign timelines, dependency maps, owners, review cycles, reporting cadence and client-ready status updates. Surface blockers early.",
    "finance": "You are Vikram Shah, Finance & ROI AI at UnnatiX Technologies. Build INR retainers, ad-spend allocations, revenue forecasts, margin models and campaign ROI/ROAS reports. Show formulas, assumptions, best/base/worst cases and break-even points.",
    "hr": "You are Meera Joshi, People & SOP AI at UnnatiX Technologies. Create agency SOPs, role scorecards, hiring briefs for SEO/creative/media-buying talent, onboarding plans, training documents and knowledge-base standards.",
}


def _delivery_type(task: dict) -> str:
    text = f"{task.get('title', '')} {task.get('description', '')}".lower()
    if any(x in text for x in ("send email", "outreach", "linkedin", "whatsapp", "publish", "launch campaign")):
        return "external_action"
    if task.get("agent_id") in {"sales", "research"} and any(x in text for x in ("lead", "prospect", "target list", "verified")):
        return "live_research"
    if task.get("agent_id") == "marketing" and any(x in text for x in ("image", "creative", "poster", "carousel")):
        return "creative_asset"
    if task.get("agent_id") == "developer" and any(x in text for x in ("implement", "deploy", "build", "fix")):
        return "code_change"
    return "document"


def _result_status(task: dict) -> str:
    delivery = task.get("delivery_type") or _delivery_type(task)
    return "draft_ready_needs_integration" if delivery in {
        "external_action", "live_research", "creative_asset", "code_change"
    } else "delivered"


async def llm_generate_output(agent_id: str, task: dict, knowledge: List[dict]) -> str:
    """Produce a task deliverable through the configured provider failover chain."""
    sys_prompt = AGENT_SYSTEM_PROMPTS.get(agent_id, AGENT_SYSTEM_PROMPTS["operations"])
    if knowledge:
        ctx_lines = "\n".join(f"- {k['title']}: {(k.get('content') or '')[:280]}" for k in knowledge[:5])
        sys_prompt += f"\n\nBUSINESS CONTEXT (from founder's knowledge base):\n{ctx_lines}"

    user_prompt = (
        f"Task: {task['title']}\n"
        f"Brief: {task['description']}\n\n"
        f"Produce the deliverable now. Output the deliverable directly — no preamble like 'here is the...'. "
        f"This is a {task.get('delivery_type', 'document')} task. Never claim that leads were verified, emails or messages "
        f"were sent, images were created, pages were published, ads were launched, or an external system changed unless "
        f"real tool evidence is supplied. If an integration is needed, make the best ready-to-use draft and finish with "
        f"a clearly labelled ACTION REQUIRED section. Keep it concise but complete (under ~500 words)."
    )
    return await llm_complete(sys_prompt, user_prompt)


@api.post("/tasks/{task_id}/generate")
async def generate_task_output(task_id: str, user: dict = Depends(current_user)):
    task = await db.tasks.find_one({"id": task_id, "user_id": user["id"]}, {"_id": 0})
    if not task:
        raise HTTPException(404, "Task not found")
    if task["status"] == "waiting_approval":
        raise HTTPException(400, "Task is gated on founder approval")

    knowledge = await db.knowledge.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(5)

    try:
        output = await llm_generate_output(task["agent_id"], task, knowledge)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(502, "AI generation failed — try again")

    now = datetime.now(timezone.utc)
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"output": output, "status": "completed", "progress": 100,
                  "execution_status": _result_status(task), "updated_at": now}},
    )
    agent_name = next((e["name"] for e in AI_EMPLOYEES if e["id"] == task["agent_id"]), task["agent_id"])
    await log_activity(user["id"], task["agent_id"], f"{agent_name} delivered: {task['title']}", "output")
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return updated


@api.post("/goals/{goal_id}/run-next")
async def run_next_goal_task(goal_id: str, user: dict = Depends(current_user)):
    """Run one eligible employee task; clients call repeatedly until the queue is drained."""
    task = await db.tasks.find_one_and_update(
        {"goal_id": goal_id, "user_id": user["id"], "status": "planning"},
        {"$set": {"status": "running", "progress": 55, "execution_status": "working",
                  "updated_at": datetime.now(timezone.utc)}},
        sort=[("created_at", 1)], return_document=True,
    )
    if not task:
        return {"processed": False, "remaining": 0}
    task.pop("_id", None)
    knowledge = await db.knowledge.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(5)
    try:
        output = await llm_generate_output(task["agent_id"], task, knowledge)
        await db.tasks.update_one({"id": task["id"]}, {"$set": {
            "output": output, "status": "completed", "progress": 100,
            "execution_status": _result_status(task), "updated_at": datetime.now(timezone.utc),
        }})
        await log_activity(user["id"], task["agent_id"], f"Auto-delivered: {task['title']}", "output")
        remaining = await db.tasks.count_documents({"goal_id": goal_id, "user_id": user["id"], "status": "planning"})
        if remaining == 0:
            waiting = await db.tasks.count_documents({"goal_id": goal_id, "user_id": user["id"], "status": "waiting_approval"})
            if waiting == 0:
                await db.goals.update_one({"id": goal_id}, {"$set": {"status": "completed"}})
                await fire_automations(user["id"], "goal_completed", {"goal_id": goal_id})
        return {"processed": True, "task_id": task["id"], "remaining": remaining}
    except Exception as exc:
        await db.tasks.update_one({"id": task["id"]}, {"$set": {
            "status": "planning", "progress": 25, "execution_status": "retry_queued",
            "updated_at": datetime.now(timezone.utc),
        }})
        logger.error("Autonomous task failed: %s", exc)
        raise HTTPException(502, "Employee execution failed; queued for retry")


@api.post("/tasks/quick")
async def create_quick_task(body: TaskQuickIn, user: dict = Depends(current_user)):
    valid_ids = {e["id"] for e in AI_EMPLOYEES if e["id"] != "ceo"}
    if body.agent_id not in valid_ids:
        raise HTTPException(400, "Invalid agent_id")
    now = datetime.now(timezone.utc)
    task = {
        "id": str(uuid.uuid4()),
        "goal_id": "adhoc",
        "user_id": user["id"],
        "agent_id": body.agent_id,
        "title": body.title,
        "description": body.description,
        "priority": body.priority,
        "status": "waiting_approval" if body.requires_approval else "planning",
        "progress": 10 if body.requires_approval else 25,
        "requires_approval": body.requires_approval,
        "output": None,
        "delivery_type": _delivery_type({"agent_id": body.agent_id, "title": body.title, "description": body.description}),
        "execution_status": "waiting_approval" if body.requires_approval else "queued",
        "evidence": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    agent_name = next((e["name"] for e in AI_EMPLOYEES if e["id"] == body.agent_id), body.agent_id)
    await log_activity(user["id"], body.agent_id, f"{agent_name} accepted ad-hoc task: {body.title}", "task")

    if body.requires_approval:
        appr = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "task_id": task["id"],
            "agent_id": body.agent_id,
            "action": body.title,
            "impact": "Sensitive action — requires founder approval before execution.",
            "payload_preview": body.description,
            "status": "pending",
            "created_at": now,
        }
        await db.approvals.insert_one(appr)
    return task


# ============================================================
# ROUTES: KNOWLEDGE BASE
# ============================================================
@api.get("/knowledge")
async def list_knowledge(user: dict = Depends(current_user)):
    items = await db.knowledge.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.post("/knowledge")
async def create_knowledge(body: KnowledgeIn, user: dict = Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "kind": body.kind,
        "title": body.title,
        "content": body.content or "",
        "mime": body.mime,
        "created_at": datetime.now(timezone.utc),
    }
    await db.knowledge.insert_one(doc)
    doc.pop("_id", None)
    await log_activity(user["id"], "hr", f"Meera Joshi indexed knowledge: {body.title}", "info")
    await fire_automations(user["id"], "knowledge_added", {"knowledge_id": doc["id"]})
    return doc


@api.delete("/knowledge/{kid}")
async def delete_knowledge(kid: str, user: dict = Depends(current_user)):
    res = await db.knowledge.delete_one({"id": kid, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ============================================================
# ROUTES: INTEGRATIONS (sandbox / mocked — real OAuth requires credentials)
# ============================================================
def _smtp_configured() -> bool:
    return all((SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL))


def _smtp_send_sync(to_email: str, subject: str, text_body: str) -> str:
    if not _smtp_configured():
        raise RuntimeError("SMTP is not configured")
    message_id = make_msgid(domain=SMTP_FROM_EMAIL.split("@")[-1])
    msg = EmailMessage()
    msg["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM_EMAIL))
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Message-ID"] = message_id
    msg.set_content(text_body)
    context = ssl.create_default_context()
    if SMTP_SECURITY == "ssl":
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=25, context=context) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=25) as server:
            server.ehlo()
            if SMTP_SECURITY == "starttls":
                server.starttls(context=context)
                server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    return message_id


async def smtp_send(to_email: str, subject: str, text_body: str) -> str:
    return await asyncio.to_thread(_smtp_send_sync, to_email, subject, text_body)


def _google_oauth_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI)


def _oauth_cipher() -> Fernet:
    digest = hashlib.sha256(GOOGLE_OAUTH_ENCRYPTION_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encrypt_secret(value: str) -> str:
    return _oauth_cipher().encrypt(value.encode()).decode()


def _decrypt_secret(value: str) -> str:
    try:
        return _oauth_cipher().decrypt(value.encode()).decode()
    except InvalidToken:
        raise HTTPException(500, "Stored Google credential cannot be decrypted")


GOOGLE_SCOPES = [
    "openid", "email",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]


async def _google_access_token(user_id: str) -> str:
    rec = await db.integrations.find_one({"user_id": user_id, "id": "google_workspace"}, {"_id": 0})
    if not rec or rec.get("status") != "connected_live":
        raise HTTPException(400, "Connect Google Workspace first")
    expires_at = rec.get("token_expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if rec.get("access_token_enc") and expires_at and expires_at > datetime.now(timezone.utc) + timedelta(minutes=2):
        return _decrypt_secret(rec["access_token_enc"])
    refresh_token = _decrypt_secret(rec.get("refresh_token_enc", ""))
    async with httpx.AsyncClient(timeout=20) as http:
        response = await http.post("https://oauth2.googleapis.com/token", data={
            "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token, "grant_type": "refresh_token",
        })
    if response.status_code >= 400:
        raise HTTPException(502, "Google token refresh failed; reconnect Google Workspace")
    token = response.json()
    access_token = token["access_token"]
    await db.integrations.update_one({"user_id": user_id, "id": "google_workspace"}, {"$set": {
        "access_token_enc": _encrypt_secret(access_token),
        "token_expires_at": datetime.now(timezone.utc) + timedelta(seconds=int(token.get("expires_in", 3600))),
    }})
    return access_token


INTEGRATION_CATALOG = [
    {"id": "smtp", "name": "SMTP Email", "category": "Email", "description": "Send real approved outreach and notifications from your company inbox.", "requires_keys": ["SMTP host, user and app password"]},
    {"id": "google_workspace", "name": "Google Workspace", "category": "Email + Calendar", "description": "Read replies and create real Calendar events with Google Meet.", "requires_keys": ["OAuth client ID and secret"]},
    {"id": "slack", "name": "Slack", "category": "Messaging", "description": "Post approvals & summaries to your team channel.", "requires_keys": ["Bot User OAuth Token"]},
    {"id": "hubspot", "name": "HubSpot", "category": "CRM", "description": "Sync Sales leads & pipeline stages.", "requires_keys": ["Private app access token"]},
    {"id": "notion", "name": "Notion", "category": "Docs", "description": "Mirror Research reports & SOPs to a workspace.", "requires_keys": ["Internal integration token"]},
]


@api.get("/integrations")
async def list_integrations(user: dict = Depends(current_user)):
    existing = {i["id"]: i async for i in db.integrations.find({"user_id": user["id"]}, {"_id": 0})}
    out = []
    for cat in INTEGRATION_CATALOG:
        rec = existing.get(cat["id"], {})
        is_live_smtp = cat["id"] == "smtp" and _smtp_configured() and rec.get("status") != "not_configured"
        is_live = is_live_smtp or rec.get("status") == "connected_live"
        out.append({
            **cat,
            "status": "connected_live" if is_live else rec.get("status", "not_configured"),
            "mode": "live" if is_live else "sandbox",
            "configured_at": rec.get("configured_at"),
        })
    return out


@api.get("/integrations/google/start")
async def start_google_oauth(user: dict = Depends(current_user)):
    if not _google_oauth_configured():
        raise HTTPException(400, "Google OAuth environment variables are incomplete")
    state = jwt.encode({
        "sub": user["id"], "purpose": "google_oauth",
        "nonce": str(uuid.uuid4()), "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }, JWT_SECRET, algorithm=JWT_ALG)
    params = {
        "client_id": GOOGLE_CLIENT_ID, "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code", "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline", "prompt": "consent", "include_granted_scopes": "true",
        "state": state,
    }
    return {"auth_url": str(httpx.URL("https://accounts.google.com/o/oauth2/v2/auth", params=params))}


@api.get("/integrations/google/callback")
async def google_oauth_callback(code: str, state: str):
    try:
        claims = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALG])
        if claims.get("purpose") != "google_oauth":
            raise ValueError("invalid purpose")
        user_id = claims["sub"]
    except Exception:
        raise HTTPException(400, "Invalid or expired Google OAuth state")
    async with httpx.AsyncClient(timeout=25) as http:
        response = await http.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI, "grant_type": "authorization_code",
        })
        if response.status_code >= 400:
            logger.warning("Google OAuth exchange failed: %s", response.status_code)
            raise HTTPException(502, "Google OAuth token exchange failed")
        token = response.json()
        profile_response = await http.get("https://openidconnect.googleapis.com/v1/userinfo", headers={
            "Authorization": f"Bearer {token['access_token']}"
        })
    profile = profile_response.json() if profile_response.status_code < 400 else {}
    existing = await db.integrations.find_one({"user_id": user_id, "id": "google_workspace"}, {"_id": 0}) or {}
    refresh = token.get("refresh_token")
    update = {
        "user_id": user_id, "id": "google_workspace", "status": "connected_live",
        "google_email": profile.get("email"), "scopes": token.get("scope", "").split(),
        "access_token_enc": _encrypt_secret(token["access_token"]),
        "token_expires_at": datetime.now(timezone.utc) + timedelta(seconds=int(token.get("expires_in", 3600))),
        "configured_at": datetime.now(timezone.utc),
    }
    if refresh:
        update["refresh_token_enc"] = _encrypt_secret(refresh)
    elif existing.get("refresh_token_enc"):
        update["refresh_token_enc"] = existing["refresh_token_enc"]
    else:
        raise HTTPException(502, "Google did not return a refresh token; reconnect and grant consent")
    await db.integrations.update_one({"user_id": user_id, "id": "google_workspace"}, {"$set": update}, upsert=True)
    await log_activity(user_id, "operations", f"Google Workspace connected for {profile.get('email', 'account')}", "integration")
    return RedirectResponse(f"{os.environ.get('APP_BASE_URL', 'https://frontend-black-six-9a2u5f36zm.vercel.app')}/integrations?google=connected")


@api.post("/integrations/google/sync-replies")
async def sync_google_replies(user: dict = Depends(current_user)):
    access_token = await _google_access_token(user["id"])
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=25, headers=headers) as http:
        listing = await http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", params={
            "q": "in:inbox newer_than:30d", "maxResults": 25,
        })
        if listing.status_code >= 400:
            raise HTTPException(502, "Gmail reply sync failed")
        message_refs = (listing.json().get("messages") or [])[:25]
        synced = 0
        for ref in message_refs:
            response = await http.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{ref['id']}",
                params={"format": "metadata", "metadataHeaders": ["From", "To", "Subject", "Message-ID", "In-Reply-To"]},
            )
            if response.status_code >= 400:
                continue
            data = response.json()
            raw_headers = ((data.get("payload") or {}).get("headers") or [])
            metadata = {h.get("name", "").lower(): h.get("value") for h in raw_headers}
            doc = {
                "user_id": user["id"], "gmail_message_id": data["id"], "thread_id": data.get("threadId"),
                "from": metadata.get("from"), "to": metadata.get("to"), "subject": metadata.get("subject"),
                "message_id": metadata.get("message-id"), "in_reply_to": metadata.get("in-reply-to"),
                "snippet": data.get("snippet"), "received_at": datetime.fromtimestamp(int(data.get("internalDate", "0")) / 1000, tz=timezone.utc),
                "synced_at": datetime.now(timezone.utc),
            }
            await db.email_replies.update_one(
                {"user_id": user["id"], "gmail_message_id": data["id"]},
                {"$set": doc, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
            synced += 1
    await log_activity(user["id"], "sales", f"Gmail synced {synced} recent inbox messages", "integration")
    return {"ok": True, "synced": synced}


@api.post("/integrations/{provider}/toggle")
async def toggle_integration(provider: str, body: IntegrationToggleIn, user: dict = Depends(current_user)):
    if provider not in {c["id"] for c in INTEGRATION_CATALOG}:
        raise HTTPException(404, "Unknown integration")
    if provider == "smtp" and body.enabled and not _smtp_configured():
        raise HTTPException(400, "SMTP environment variables are incomplete")
    if provider == "google_workspace" and body.enabled:
        raise HTTPException(400, "Use Google OAuth Connect")
    status_value = ("connected_live" if provider == "smtp" else "connected_sandbox") if body.enabled else "not_configured"
    now = datetime.now(timezone.utc)
    await db.integrations.update_one(
        {"user_id": user["id"], "id": provider},
        {"$set": {"user_id": user["id"], "id": provider, "status": status_value, "configured_at": now}},
        upsert=True,
    )
    name = next(c["name"] for c in INTEGRATION_CATALOG if c["id"] == provider)
    action = "connected (sandbox)" if body.enabled else "disconnected"
    await log_activity(user["id"], "ceo", f"{name} {action}", "integration")
    return {"id": provider, "status": status_value}


@api.post("/integrations/smtp/test")
async def test_smtp(body: SMTPTestIn, user: dict = Depends(current_user)):
    if not _smtp_configured():
        raise HTTPException(400, "SMTP environment variables are incomplete")
    recipient = str(body.to_email or user["email"])
    try:
        message_id = await smtp_send(
            recipient,
            "UnnatiX GrowthX SMTP connected",
            "SMTP is live. UnnatiX AI employees can now send founder-approved emails through this inbox.",
        )
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(502, "SMTP authentication failed; use a valid app password")
    except Exception as exc:
        logger.error("SMTP test failed: %s", type(exc).__name__)
        raise HTTPException(502, "SMTP connection or delivery failed")
    event = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "kind": "smtp_test",
        "to_email": recipient, "message_id": message_id, "status": "sent",
        "created_at": datetime.now(timezone.utc),
    }
    await db.email_events.insert_one(event)
    await log_activity(user["id"], "sales", f"Live SMTP test sent to {recipient}", "integration")
    return {"ok": True, "status": "sent", "message_id": message_id, "to_email": recipient}


# ============================================================
# ROUTES: LIVE LEAD DISCOVERY (GOOGLE PLACES)
# ============================================================
@api.post("/leads/search")
async def search_live_leads(body: LeadSearchIn, user: dict = Depends(current_user)):
    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(400, "Google Places API key is not configured")
    payload = {
        "textQuery": f"{body.query} in {body.location}",
        "maxResultCount": body.max_results,
        "languageCode": "en",
        "regionCode": "IN",
    }
    field_mask = ",".join([
        "places.id", "places.displayName", "places.primaryType",
        "places.primaryTypeDisplayName", "places.formattedAddress",
        "places.internationalPhoneNumber", "places.websiteUri",
        "places.googleMapsUri", "places.rating", "places.userRatingCount",
        "places.businessStatus",
    ])
    try:
        async with httpx.AsyncClient(timeout=25) as http:
            response = await http.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={
                    "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
                    "X-Goog-FieldMask": field_mask,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code >= 400:
            error = response.json().get("error", {}) if response.content else {}
            logger.warning("Places API failed: %s %s", response.status_code, error.get("status", ""))
            raise HTTPException(502, f"Google Places request failed: {error.get('message', 'check API and billing settings')}")
        places = response.json().get("places", [])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Places search failed: %s", type(exc).__name__)
        raise HTTPException(502, "Google Places connection failed")

    now = datetime.now(timezone.utc)
    results = []
    for place in places:
        place_id = place.get("id")
        if not place_id:
            continue
        lead = {
            "user_id": user["id"], "place_id": place_id,
            "company_name": (place.get("displayName") or {}).get("text", "Unknown business"),
            "industry": (place.get("primaryTypeDisplayName") or {}).get("text") or place.get("primaryType"),
            "location": place.get("formattedAddress"),
            "phone": place.get("internationalPhoneNumber"),
            "website": place.get("websiteUri"),
            "email": None, "contact_name": None, "contact_role": None,
            "google_maps_url": place.get("googleMapsUri"),
            "rating": place.get("rating"), "review_count": place.get("userRatingCount"),
            "business_status": place.get("businessStatus"),
            "source": "google_places", "source_urls": [u for u in [place.get("googleMapsUri"), place.get("websiteUri")] if u],
            "email_verification_status": "not_found", "pipeline_stage": "researched",
            "outreach_eligibility": "needs_public_contact", "do_not_contact": False,
            "retrieved_at": now, "updated_at": now,
        }
        await db.leads.update_one(
            {"user_id": user["id"], "place_id": place_id},
            {"$set": lead, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now}},
            upsert=True,
        )
        saved = await db.leads.find_one({"user_id": user["id"], "place_id": place_id}, {"_id": 0})
        results.append(saved)
    await log_activity(user["id"], "research", f"Google Places found {len(results)} real businesses for: {body.query} in {body.location}", "lead")
    return {"query": body.query, "location": body.location, "count": len(results), "leads": results}


@api.get("/leads")
async def list_live_leads(user: dict = Depends(current_user)):
    return await db.leads.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


EMAIL_RE = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.IGNORECASE)


async def _public_web_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return False
        addresses = await asyncio.to_thread(socket.getaddrinfo, parsed.hostname, None)
        for item in addresses:
            ip = ipaddress.ip_address(item[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:
        return False


def _clean_public_emails(html: str) -> List[str]:
    blocked = {"example.com", "sentry.io", "wixpress.com", "cloudflare.com"}
    found = []
    for email in EMAIL_RE.findall(html.replace("&#64;", "@").replace("[at]", "@")):
        email = email.lower().strip(".,;:()[]<>'\"")
        domain = email.rsplit("@", 1)[-1]
        if domain in blocked or email.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")):
            continue
        if email not in found:
            found.append(email)
    return found[:10]


async def _crawl_public_contacts(website: str) -> dict:
    root = website if website.startswith(("http://", "https://")) else f"https://{website}"
    if not await _public_web_url(root):
        return {"emails": [], "sources": [], "error": "unsafe_or_invalid_url"}
    parsed = urlparse(root)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    user_agent = "UnnatiXLeadResearchBot/1.0"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": user_agent}) as http:
        try:
            robots = await http.get(robots_url)
            if robots.status_code < 400:
                parser.parse(robots.text.splitlines())
            else:
                parser.parse([])
        except Exception:
            parser.parse([])
        queue = [root]
        visited, emails, sources = set(), [], []
        while queue and len(visited) < 5:
            url = queue.pop(0)
            if url in visited or not parser.can_fetch(user_agent, url):
                continue
            visited.add(url)
            try:
                response = await http.get(url)
                if response.status_code >= 400 or "text/html" not in response.headers.get("content-type", ""):
                    continue
                if not await _public_web_url(str(response.url)):
                    continue
                page_emails = _clean_public_emails(response.text)
                for email in page_emails:
                    if email not in emails:
                        emails.append(email)
                        sources.append({"email": email, "url": str(response.url), "method": "public_website"})
                if len(visited) == 1:
                    for href in re.findall(r"href\s*=\s*['\"]([^'\"]+)['\"]", response.text, re.IGNORECASE):
                        absolute = urljoin(str(response.url), href.split("#")[0])
                        target = urlparse(absolute)
                        if target.netloc == urlparse(str(response.url)).netloc and any(
                            word in target.path.lower() for word in ("contact", "about", "team")
                        ) and absolute not in queue:
                            queue.append(absolute)
            except Exception:
                continue
    return {"emails": emails[:10], "sources": sources[:10], "pages_checked": len(visited)}


async def _hunter_domain_email(domain: str) -> dict:
    if not HUNTER_API_KEY:
        return {"email": None, "sources": [], "status": "not_configured"}
    async with httpx.AsyncClient(timeout=20) as http:
        response = await http.get("https://api.hunter.io/v2/domain-search", params={
            "domain": domain, "limit": 10, "api_key": HUNTER_API_KEY,
        })
    if response.status_code >= 400:
        logger.warning("Hunter domain search failed: %s", response.status_code)
        return {"email": None, "sources": [], "status": f"http_{response.status_code}"}
    data = response.json().get("data") or {}
    candidates = data.get("emails") or []
    candidates.sort(key=lambda x: (x.get("type") != "generic", -(x.get("confidence") or 0)))
    if not candidates:
        return {"email": None, "sources": [], "status": "not_found"}
    best = candidates[0]
    return {
        "email": best.get("value"), "confidence": best.get("confidence"),
        "sources": [s.get("uri") for s in (best.get("sources") or []) if s.get("uri")][:5],
        "status": "found", "first_name": best.get("first_name"),
        "last_name": best.get("last_name"), "position": best.get("position"),
    }


async def _hunter_verify_email(email: str) -> dict:
    if not HUNTER_API_KEY:
        return {"status": "unknown", "result": "not_configured"}
    async with httpx.AsyncClient(timeout=25) as http:
        response = await http.get("https://api.hunter.io/v2/email-verifier", params={
            "email": email, "api_key": HUNTER_API_KEY,
        })
    if response.status_code >= 400:
        logger.warning("Hunter verification failed: %s", response.status_code)
        return {"status": "unknown", "result": f"http_{response.status_code}"}
    data = response.json().get("data") or {}
    status = data.get("status") or "unknown"
    result = data.get("result") or "unknown"
    mapped = "verified" if result == "deliverable" or status == "valid" else (
        "invalid" if result == "undeliverable" or status == "invalid" else
        "risky" if result == "risky" or status in {"accept_all", "disposable"} else "unknown"
    )
    return {"status": mapped, "provider_status": status, "result": result, "score": data.get("score")}


@api.post("/leads/enrich")
async def enrich_live_leads(body: LeadEnrichIn, user: dict = Depends(current_user)):
    query = {"user_id": user["id"], "website": {"$nin": [None, ""]}}
    if body.lead_id:
        query["id"] = body.lead_id
    else:
        query["email_verification_status"] = {"$in": ["not_found", "unknown", None]}
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(body.limit)
    enriched = []
    for lead in leads:
        crawl = await _crawl_public_contacts(lead["website"])
        email = (crawl.get("emails") or [None])[0]
        method = "public_website" if email else None
        evidence = crawl.get("sources") or []
        hunter = {}
        if not email:
            domain = (urlparse(lead["website"]).hostname or "").removeprefix("www.")
            hunter = await _hunter_domain_email(domain)
            email = hunter.get("email")
            if email:
                method = "hunter_domain_search"
                evidence.extend({"email": email, "url": url, "method": method} for url in hunter.get("sources", []))
        verification = await _hunter_verify_email(email) if email and body.verify_email else {"status": "unverified"}
        update = {
            "email": email, "email_source": method,
            "email_verification_status": verification.get("status", "unknown"),
            "email_verification": verification, "contact_evidence": evidence,
            "outreach_eligibility": "eligible_for_approval" if verification.get("status") == "verified" else "manual_review",
            "enriched_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
        }
        if hunter.get("first_name") or hunter.get("last_name"):
            update["contact_name"] = " ".join(filter(None, [hunter.get("first_name"), hunter.get("last_name")]))
            update["contact_role"] = hunter.get("position")
        await db.leads.update_one({"id": lead["id"], "user_id": user["id"]}, {"$set": update})
        enriched.append({"lead_id": lead["id"], "company_name": lead["company_name"], **update})
    await log_activity(user["id"], "research", f"Enriched {len(enriched)} leads with public website and Hunter evidence", "lead")
    return {"count": len(enriched), "leads": enriched}


# ============================================================
# ROUTES: KNOWLEDGE FILE UPLOAD (PDF/CSV/TXT)
# ============================================================
def _extract_text(mime: str, raw: bytes) -> str:
    import base64, io, csv
    try:
        if mime == "application/pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            return "\n\n".join((p.extract_text() or "") for p in reader.pages)[:20000]
        if mime == "text/csv":
            text = raw.decode("utf-8", errors="ignore")
            rows = list(csv.reader(io.StringIO(text)))
            return "\n".join(" | ".join(r) for r in rows[:100])[:20000]
        return raw.decode("utf-8", errors="ignore")[:20000]
    except Exception as e:
        logger.warning(f"Extract failed: {e}")
        return ""


@api.post("/knowledge/upload")
async def upload_knowledge_file(body: KnowledgeFileIn, user: dict = Depends(current_user)):
    import base64
    try:
        raw = base64.b64decode(body.file_b64)
    except Exception:
        raise HTTPException(400, "Invalid base64")
    if len(raw) > 4 * 1024 * 1024:
        raise HTTPException(413, "File too large (max 4MB)")
    if body.mime not in ("application/pdf", "text/csv", "text/plain"):
        raise HTTPException(400, "Unsupported mime; allowed: pdf, csv, txt")

    content = _extract_text(body.mime, raw)
    if not content.strip():
        raise HTTPException(422, "Could not extract text from file")

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "kind": "file",
        "title": body.title,
        "content": content,
        "mime": body.mime,
        "byte_size": len(raw),
        "created_at": datetime.now(timezone.utc),
    }
    await db.knowledge.insert_one(doc)
    doc.pop("_id", None)
    await log_activity(user["id"], "hr", f"Meera Joshi indexed file: {body.title} ({body.mime})", "info")
    return doc


# ============================================================
# ROUTES: MEETINGS (Google Meet — SANDBOX mode)
# ============================================================
async def _schedule_google_meeting(user_id: str, meeting: dict) -> dict:
    access_token = await _google_access_token(user_id)
    start = meeting["start_time"]
    end = start + timedelta(minutes=int(meeting["duration_min"]))
    event = {
        "summary": meeting["title"], "description": meeting.get("description", ""),
        "start": {"dateTime": start.isoformat(), "timeZone": "Asia/Kolkata"},
        "end": {"dateTime": end.isoformat(), "timeZone": "Asia/Kolkata"},
        "attendees": [{"email": email} for email in meeting.get("participants", [])],
        "conferenceData": {"createRequest": {"requestId": f"unnatix-{meeting['id']}", "conferenceSolutionKey": {"type": "hangoutsMeet"}}},
    }
    async with httpx.AsyncClient(timeout=25) as http:
        response = await http.post(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            params={"conferenceDataVersion": 1, "sendUpdates": "all"},
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}, json=event,
        )
    if response.status_code >= 400:
        logger.warning("Calendar event creation failed: %s", response.status_code)
        raise HTTPException(502, "Google Calendar event creation failed")
    created = response.json()
    return {"event_id": created.get("id"), "meet_link": created.get("hangoutLink"), "event_url": created.get("htmlLink")}


@api.post("/meetings")
async def create_meeting(body: MeetingIn, user: dict = Depends(current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": body.title,
        "participants": body.participants,
        "start_time": body.start_time,
        "duration_min": body.duration_min,
        "description": body.description,
        "meet_link": None,
        "provider": "google_calendar",
        "status": "pending_approval" if body.requires_approval else "scheduling",
        "created_at": now,
    }
    await db.meetings.insert_one(doc)
    doc.pop("_id", None)

    if body.requires_approval:
        appr = {
            "id": str(uuid.uuid4()), "user_id": user["id"],
            "task_id": doc["id"], "agent_id": "operations",
            "action": f"Send invites for: {body.title}",
            "impact": "Will send meeting invites to participants once approved.",
            "payload_preview": f"Participants: {', '.join(body.participants) or 'none'}\nWhen: {body.start_time.isoformat()}\nGoogle Meet will be created after approval.",
            "status": "pending", "created_at": now,
        }
        await db.approvals.insert_one(appr)
    else:
        created = await _schedule_google_meeting(user["id"], doc)
        doc.update(created)
        doc["status"] = "scheduled"
        await db.meetings.update_one({"id": doc["id"]}, {"$set": {**created, "status": "scheduled"}})

    await log_activity(user["id"], "operations", f"Kavya Sharma scheduled: {body.title}", "meeting")
    return doc


@api.get("/meetings")
async def list_meetings(user: dict = Depends(current_user)):
    items = await db.meetings.find({"user_id": user["id"]}, {"_id": 0}).sort("start_time", 1).to_list(100)
    return items


@api.delete("/meetings/{mid}")
async def cancel_meeting(mid: str, user: dict = Depends(current_user)):
    res = await db.meetings.update_one(
        {"id": mid, "user_id": user["id"]},
        {"$set": {"status": "cancelled"}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Meeting not found")
    return {"ok": True}


# ============================================================
# ROUTES: AUTOMATIONS
# ============================================================
AUTOMATION_TRIGGERS = {
    "goal_created": "When CEO accepts a new goal",
    "goal_completed": "When all tasks of a goal complete",
    "approval_approved": "When founder approves an action",
    "task_completed": "When any task completes",
    "knowledge_added": "When a knowledge item is added",
}
AUTOMATION_ACTIONS = {
    "create_task": "Assign a follow-up task to an agent",
    "add_knowledge_note": "Append a note to the knowledge base",
    "log_only": "Just log to activity feed (for testing)",
}


@api.get("/automations/catalog")
async def automation_catalog(user: dict = Depends(current_user)):
    return {"triggers": AUTOMATION_TRIGGERS, "actions": AUTOMATION_ACTIONS}


@api.get("/automations")
async def list_automations(user: dict = Depends(current_user)):
    items = await db.automations.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api.post("/automations")
async def create_automation(body: AutomationIn, user: dict = Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name,
        "trigger": body.trigger,
        "action": body.action,
        "action_config": body.action_config,
        "enabled": body.enabled,
        "fired_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    await db.automations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/automations/{aid}")
async def toggle_automation(aid: str, body: IntegrationToggleIn, user: dict = Depends(current_user)):
    res = await db.automations.update_one(
        {"id": aid, "user_id": user["id"]},
        {"$set": {"enabled": body.enabled}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Automation not found")
    return {"ok": True}


@api.delete("/automations/{aid}")
async def delete_automation(aid: str, user: dict = Depends(current_user)):
    res = await db.automations.delete_one({"id": aid, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Automation not found")
    return {"ok": True}


async def fire_automations(user_id: str, trigger: str, context: dict) -> None:
    """Execute matching enabled automations for a trigger."""
    autos = await db.automations.find({"user_id": user_id, "trigger": trigger, "enabled": True}, {"_id": 0}).to_list(20)
    for a in autos:
        try:
            await _execute_automation(user_id, a, context)
            await db.automations.update_one({"id": a["id"]}, {"$inc": {"fired_count": 1}})
        except Exception as e:
            logger.warning(f"Automation {a['id']} failed: {e}")


async def _execute_automation(user_id: str, automation: dict, context: dict) -> None:
    cfg = automation.get("action_config") or {}
    if automation["action"] == "log_only":
        await log_activity(user_id, "ceo", f"Automation fired: {automation['name']}", "automation")
    elif automation["action"] == "create_task":
        agent_id = cfg.get("agent_id", "operations")
        title = cfg.get("title") or f"Auto: {automation['name']}"
        desc = cfg.get("description") or f"Triggered by {automation['trigger']}"
        now = datetime.now(timezone.utc)
        task = {
            "id": str(uuid.uuid4()), "goal_id": "automation",
            "user_id": user_id, "agent_id": agent_id,
            "title": title, "description": desc,
            "priority": "medium", "status": "planning", "progress": 25,
            "requires_approval": False, "output": None,
            "created_at": now, "updated_at": now,
        }
        await db.tasks.insert_one(task)
        await log_activity(user_id, agent_id, f"Auto-assigned: {title}", "automation")
    elif automation["action"] == "add_knowledge_note":
        note = {
            "id": str(uuid.uuid4()), "user_id": user_id, "kind": "note",
            "title": cfg.get("title") or f"Auto-note: {automation['name']}",
            "content": cfg.get("content") or f"Automation '{automation['name']}' fired on {automation['trigger']}.",
            "mime": None, "created_at": datetime.now(timezone.utc),
        }
        await db.knowledge.insert_one(note)
        await log_activity(user_id, "hr", f"Automation indexed note: {note['title']}", "automation")


# ============================================================
# ROUTES: ORGANIZATION / MEMBERS / INVITES
# ============================================================
def _gen_invite_code() -> str:
    import secrets, string
    return "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))


@api.get("/org/me")
async def my_org(user: dict = Depends(current_user)):
    # Members = all users sharing the same organization string (treats org-name as org-id for MVP).
    members_raw = await db.users.find({"organization": user["organization"]}, {"_id": 0, "password_hash": 0}).to_list(50)
    return {
        "organization": user["organization"],
        "role": user.get("role", "owner"),
        "members": [{
            "id": m["id"], "name": m["name"], "email": m["email"],
            "role": m.get("role", "owner" if m["id"] == user["id"] else "member"),
            "joined_at": m["created_at"],
        } for m in members_raw],
    }


@api.post("/org/invite")
async def create_invite(user: dict = Depends(current_user)):
    code = _gen_invite_code()
    await db.org_invites.insert_one({
        "code": code,
        "organization": user["organization"],
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc),
        "consumed": False,
    })
    return {"code": code, "organization": user["organization"]}


@api.get("/org/invites")
async def list_invites(user: dict = Depends(current_user)):
    invites = await db.org_invites.find(
        {"organization": user["organization"], "consumed": False},
        {"_id": 0},
    ).sort("created_at", -1).to_list(20)
    return invites


@api.post("/org/join")
async def join_org(body: OrgInviteJoinIn, user: dict = Depends(current_user)):
    invite = await db.org_invites.find_one({"code": body.code.upper(), "consumed": False}, {"_id": 0})
    if not invite:
        raise HTTPException(404, "Invalid or used invite code")
    new_org = invite["organization"]
    if new_org == user["organization"]:
        raise HTTPException(400, "Already a member of this organization")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"organization": new_org, "role": "member"}},
    )
    await db.org_invites.update_one({"code": body.code.upper()}, {"$set": {"consumed": True, "consumed_by": user["id"]}})
    await log_activity(user["id"], "hr", f"{user['name']} joined {new_org}", "org")
    return {"organization": new_org}


@api.delete("/org/members/{member_id}")
async def remove_member(member_id: str, user: dict = Depends(current_user)):
    if user.get("role", "owner") != "owner":
        raise HTTPException(403, "Only owners can remove members")
    if member_id == user["id"]:
        raise HTTPException(400, "Cannot remove yourself")
    target = await db.users.find_one({"id": member_id, "organization": user["organization"]}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Member not found")
    # Move to personal org
    await db.users.update_one(
        {"id": member_id},
        {"$set": {"organization": f"{target['name']}'s Company", "role": "owner"}},
    )
    return {"ok": True}


# ============================================================
# ROUTES: BILLING (Stripe)
# ============================================================
import stripe
stripe.api_key = os.environ.get("STRIPE_API_KEY", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000")

PLAN_PRICING = {
    "pro":   {"amount_cents": 2900, "name": "UnnatiX GrowthX · Pro",   "tagline": "29/month"},
    "scale": {"amount_cents": 9900, "name": "UnnatiX GrowthX · Scale", "tagline": "99/month"},
}


class CheckoutIn(BaseModel):
    plan: Literal["pro", "scale"]


@api.get("/billing/plans")
async def list_plans(user: dict = Depends(current_user)):
    return {
        "current_tier": user.get("billing_tier", "free"),
        "plans": [
            {"id": "free",  "name": "Free",                              "price_label": "$0",   "features": ["9 AI employees", "Up to 3 active goals", "Sandbox integrations"]},
            {"id": "pro",   "name": PLAN_PRICING["pro"]["name"],         "price_label": "$29",  "features": ["Unlimited goals", "Real OAuth integrations", "Priority Claude orchestration", "5 team members"]},
            {"id": "scale", "name": PLAN_PRICING["scale"]["name"],       "price_label": "$99",  "features": ["Everything in Pro", "Unlimited team members", "Custom AI agents", "Dedicated support", "API access"]},
        ],
    }


@api.post("/billing/checkout-session")
async def billing_checkout(body: CheckoutIn, user: dict = Depends(current_user)):
    if not stripe.api_key:
        raise HTTPException(503, "Stripe not configured")
    plan = PLAN_PRICING[body.plan]
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
        sc = StripeCheckout(api_key=stripe.api_key)
        req = CheckoutSessionRequest(
            amount=plan["amount_cents"] / 100.0,
            currency="usd",
            quantity=1,
            success_url=f"{APP_BASE_URL}/billing?success=1&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{APP_BASE_URL}/billing?cancelled=1",
            metadata={"user_id": user["id"], "plan": body.plan, "organization": user["organization"]},
            payment_methods=["card"],
        )
        session = await sc.create_checkout_session(req)
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(502, f"Stripe error: {str(e)}")
    return {"url": session.url, "session_id": session.session_id}


@api.get("/billing/session/{session_id}")
async def billing_session_status(session_id: str, user: dict = Depends(current_user)):
    """Polled by the frontend after redirect to update local tier."""
    if not stripe.api_key:
        raise HTTPException(503, "Stripe not configured")
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        sc = StripeCheckout(api_key=stripe.api_key)
        status_obj = await sc.get_checkout_status(session_id)
    except Exception as e:
        raise HTTPException(404, str(e))
    payment_status = getattr(status_obj, "payment_status", None) or getattr(status_obj, "status", "unknown")
    md = getattr(status_obj, "metadata", {}) or {}
    if md.get("user_id") == user["id"] and payment_status in ("paid", "complete"):
        plan = md.get("plan", "pro")
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"billing_tier": plan, "subscription_status": "active"}},
        )
        await log_activity(user["id"], "ceo", f"Subscription activated · {plan.upper()} tier", "billing")
    return {"payment_status": payment_status, "plan": md.get("plan")}


@api.post("/billing/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook — verifies signature & idempotently updates user billing state."""
    raw = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        # No webhook secret configured — accept events without verification (dev mode)
        try:
            event = json.loads(raw.decode())
        except Exception:
            raise HTTPException(400, "Invalid payload")
    else:
        try:
            event = stripe.Webhook.construct_event(raw, sig, secret)
        except stripe.error.SignatureVerificationError:
            raise HTTPException(400, "Bad signature")

    event_id = event.get("id")
    if event_id and await db.stripe_events.find_one({"_id": event_id}):
        return {"status": "duplicate"}
    if event_id:
        await db.stripe_events.insert_one({"_id": event_id, "type": event.get("type")})

    typ = event.get("type", "")
    obj = (event.get("data") or {}).get("object", {})

    if typ == "checkout.session.completed":
        user_id = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id")
        plan = (obj.get("metadata") or {}).get("plan", "pro")
        if user_id:
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"billing_tier": plan, "stripe_customer_id": obj.get("customer"), "stripe_subscription_id": obj.get("subscription"), "subscription_status": "active"}},
            )
    elif typ in ("customer.subscription.deleted", "customer.subscription.canceled"):
        sub_id = obj.get("id")
        if sub_id:
            await db.users.update_one(
                {"stripe_subscription_id": sub_id},
                {"$set": {"billing_tier": "free", "subscription_status": "canceled"}},
            )
    return {"status": "ok"}


# ============================================================
# ROUTES: ANALYTICS
# ============================================================
@api.get("/analytics/overview")
async def analytics_overview(user: dict = Depends(current_user)):
    uid = user["id"]
    agent_counts = []
    for emp in AI_EMPLOYEES:
        if emp["id"] == "ceo":
            continue
        completed = await db.tasks.count_documents({"user_id": uid, "agent_id": emp["id"], "status": "completed"})
        active = await db.tasks.count_documents({"user_id": uid, "agent_id": emp["id"], "status": {"$in": ["planning", "running"]}})
        agent_counts.append({"agent_id": emp["id"], "name": emp["name"], "accent": emp["accent"], "completed": completed, "active": active})

    statuses = ["pending", "planning", "running", "waiting_approval", "completed", "cancelled"]
    status_counts = []
    for st in statuses:
        c = await db.tasks.count_documents({"user_id": uid, "status": st})
        status_counts.append({"status": st, "count": c})

    appr_approved = await db.approvals.count_documents({"user_id": uid, "status": "approved"})
    appr_rejected = await db.approvals.count_documents({"user_id": uid, "status": "rejected"})
    appr_pending  = await db.approvals.count_documents({"user_id": uid, "status": "pending"})

    # Goals over last 14 days
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    timeline = []
    for offset in range(13, -1, -1):
        day = today - timedelta(days=offset)
        start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        c = await db.goals.count_documents({"user_id": uid, "created_at": {"$gte": start, "$lt": end}})
        timeline.append({"date": day.isoformat(), "goals": c})

    total_outputs = await db.tasks.count_documents({"user_id": uid, "output": {"$ne": None}})
    total_meetings = await db.meetings.count_documents({"user_id": uid, "status": {"$ne": "cancelled"}})
    knowledge_count = await db.knowledge.count_documents({"user_id": uid})
    automations_active = await db.automations.count_documents({"user_id": uid, "enabled": True})

    return {
        "agent_throughput": agent_counts,
        "status_breakdown": status_counts,
        "approvals": {"approved": appr_approved, "rejected": appr_rejected, "pending": appr_pending},
        "goals_timeline": timeline,
        "headlines": {
            "total_outputs_generated": total_outputs,
            "meetings_scheduled": total_meetings,
            "knowledge_items": knowledge_count,
            "automations_active": automations_active,
        },
    }


# ============================================================
# APP WIRING
# ============================================================
app.include_router(api)


@app.on_event("startup")
async def _startup():
    # Vercel functions may cold-start frequently; indexes are provisioned outside
    # the request lifecycle so a transient database delay never blocks health/API boot.
    if os.environ.get("VERCEL"):
        logger.info("UnnatiX GrowthX backend ready (serverless).")
        return
    await db.users.create_index("email", unique=True)
    await db.tasks.create_index([("user_id", 1), ("created_at", -1)])
    await db.activity.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("UnnatiX GrowthX backend ready.")


@app.on_event("shutdown")
async def _shutdown():
    client.close()


# Keep CORS outside FastAPI's error middleware so even unexpected 5xx responses
# remain readable by the Expo web client instead of surfacing as "Failed to fetch".
app = CORSMiddleware(
    app=app,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
