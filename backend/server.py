"""UnnatiX GrowthX - AI Company OS backend."""
import os
import logging
import uuid
import asyncio
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Literal

import bcrypt
import certifi
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
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
        "role": "CEO AI",
        "department": "Executive",
        "tagline": "Orchestrates all departments",
        "responsibilities": [
            "Understand business goals", "Break work into tasks", "Delegate to departments",
            "Review outputs", "Coordinate execution",
        ],
        "avatar_shape": "prism",
        "accent": "#FF4400",
    },
    {
        "id": "marketing",
        "name": "Harshita Gaur",
        "role": "Marketing AI",
        "department": "Marketing",
        "tagline": "Content, campaigns & growth",
        "responsibilities": [
            "Analyze social media", "Generate content ideas", "Create scripts",
            "Write blog posts", "Marketing plans", "Competitor studies",
        ],
        "avatar_shape": "wave",
        "accent": "#FF7300",
    },
    {
        "id": "seo",
        "name": "Ishaan Kapoor",
        "role": "SEO AI",
        "department": "Growth",
        "tagline": "Search rankings & organic growth",
        "responsibilities": [
            "Keyword research", "Technical SEO audits", "Content briefs",
            "On-page optimization", "Internal linking", "Ranking reports",
        ],
        "avatar_shape": "search",
        "accent": "#14B8A6",
    },
    {
        "id": "sales",
        "name": "Arjun Mehta",
        "role": "Sales AI",
        "department": "Sales",
        "tagline": "Pipeline & outreach drafts",
        "responsibilities": [
            "Research prospects", "Build lead lists", "Score leads",
            "Generate outreach drafts", "Follow-up sequences",
        ],
        "avatar_shape": "spiral",
        "accent": "#00E676",
    },
    {
        "id": "research",
        "name": "Ananya Iyer",
        "role": "Research AI",
        "department": "Research",
        "tagline": "Markets, trends, opportunities",
        "responsibilities": [
            "Market research", "Competitor analysis", "Industry trends",
            "Product ideas", "Opportunity reports",
        ],
        "avatar_shape": "orbit",
        "accent": "#00E5FF",
    },
    {
        "id": "developer",
        "name": "Rohan Verma",
        "role": "Developer AI",
        "department": "Engineering",
        "tagline": "Plans, code, docs & APIs",
        "responsibilities": [
            "Software plans", "Generate code", "Create APIs",
            "Documentation", "Internal tools",
        ],
        "avatar_shape": "grid",
        "accent": "#A78BFA",
    },
    {
        "id": "operations",
        "name": "Kavya Sharma",
        "role": "Operations AI",
        "department": "Operations",
        "tagline": "Workflows & deadlines",
        "responsibilities": [
            "Track projects", "Manage workflows", "Monitor deadlines", "Organize tasks",
        ],
        "avatar_shape": "hex",
        "accent": "#FFC400",
    },
    {
        "id": "finance",
        "name": "Vikram Shah",
        "role": "Finance AI",
        "department": "Finance",
        "tagline": "Budgets, forecasts, ROI",
        "responsibilities": [
            "Budget planning", "Revenue forecasting", "Expense tracking", "ROI calculations",
        ],
        "avatar_shape": "diamond",
        "accent": "#F59E0B",
    },
    {
        "id": "hr",
        "name": "Meera Joshi",
        "role": "HR AI",
        "department": "People",
        "tagline": "SOPs & knowledge base",
        "responsibilities": [
            "Create SOPs", "Team structure", "Knowledge base", "Recommend AI agents",
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
ORCHESTRATION_PROMPT = """You are Shri Nath, the CEO AI of UnnatiX GrowthX, an AI Operating System.
Your job: take the founder's business objective and produce a precise execution plan that delegates work to your team.

Available AI employees (delegate ONLY to these):
- marketing (Harshita Gaur): content, campaigns, scripts, blog posts, competitor studies
- seo (Ishaan Kapoor): keyword research, technical SEO, content briefs, on-page optimization, ranking strategy
- sales (Arjun Mehta): prospect research, lead lists, scoring, outreach drafts (REQUIRES APPROVAL before sending)
- research (Ananya Iyer): market & competitor analysis, industry trends, opportunity reports
- developer (Rohan Verma): software plans, code, APIs, documentation
- operations (Kavya Sharma): project tracking, workflows, deadlines
- finance (Vikram Shah): budgets, forecasts, expenses, ROI
- hr (Meera Joshi): SOPs, knowledge base, team structure

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
- Sales outreach tasks (sending emails, messages, publishing) MUST have requires_approval: true.
- Priorities allowed: "low", "medium", "high".
- agent_id MUST be one of: marketing, seo, sales, research, developer, operations, finance, hr.
- Output pure JSON only. No code fences."""


async def llm_orchestrate(objective: str) -> dict:
    """Use Claude Sonnet 4.5 via emergentintegrations to break the goal down."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"orch-{uuid.uuid4()}",
        system_message=ORCHESTRATION_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    raw = await chat.send_message(UserMessage(text=f"Business objective: {objective}"))
    text = raw if isinstance(raw, str) else str(raw)
    # Strip code fences if model added them
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    try:
        plan = json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"LLM returned non-JSON, using fallback. Raw: {text[:200]}")
        plan = _fallback_plan(objective)
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
        "summary": f"Plan for: {objective}. Cross-department initiative spanning research, marketing, sales and ops.",
        "tasks": [
            {"agent_id": "research", "title": "Market & competitor scan", "description": "Identify 5 competitors and key market trends.", "priority": "high", "requires_approval": False},
            {"agent_id": "marketing", "title": "Positioning & content angles", "description": "Draft 3 positioning angles and 5 content ideas.", "priority": "high", "requires_approval": False},
            {"agent_id": "seo", "title": "Organic search growth plan", "description": "Build a keyword map, technical SEO checklist and prioritized content briefs.", "priority": "high", "requires_approval": False},
            {"agent_id": "sales", "title": "Build 20-lead prospect list", "description": "Compile ICP-matched prospects with rationale.", "priority": "medium", "requires_approval": False},
            {"agent_id": "sales", "title": "Outreach email draft", "description": "Draft a cold outreach sequence for review.", "priority": "medium", "requires_approval": True},
            {"agent_id": "operations", "title": "30-day execution timeline", "description": "Sequence the above tasks with owners and deadlines.", "priority": "medium", "requires_approval": False},
            {"agent_id": "finance", "title": "Budget snapshot", "description": "Estimate spend and projected ROI for this initiative.", "priority": "low", "requires_approval": False},
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
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="LLM key not configured")

    goal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    await log_activity(user["id"], "ceo", f"Received objective: {body.objective[:80]}", "goal")

    try:
        plan = await llm_orchestrate(body.objective)
    except Exception as e:
        logger.error(f"Orchestration failed: {e}")
        plan = _fallback_plan(body.objective)

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

    new_task_status = "running" if body.decision == "approved" else "cancelled"
    new_progress = 60 if body.decision == "approved" else 0
    await db.tasks.update_one(
        {"id": appr["task_id"]},
        {"$set": {"status": new_task_status, "progress": new_progress, "updated_at": now}},
    )
    verb = "approved" if body.decision == "approved" else "rejected"
    await log_activity(user["id"], appr["agent_id"], f"Founder {verb}: {appr['action']}", "approval")
    if body.decision == "approved":
        await fire_automations(user["id"], "approval_approved", {"approval_id": approval_id, "task_id": appr["task_id"]})
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
    "marketing": "You are Harshita Gaur, the Marketing AI of UnnatiX GrowthX. Produce concrete, high-quality marketing deliverables (content pieces, scripts, calendars, campaign plans). Be specific, voice-rich, and actionable. Format with clear markdown headings/bullets.",
    "seo": "You are Ishaan Kapoor, the SEO AI of UnnatiX GrowthX. Produce evidence-driven SEO deliverables: keyword clusters with intent, technical audit checklists, content briefs, metadata, internal-link plans and measurable ranking roadmaps. Never invent search-volume data; clearly label estimates and assumptions. Use structured markdown tables and prioritized actions.",
    "sales": "You are Arjun Mehta, the Sales AI. Produce concrete sales deliverables (lead lists with scoring rationale, outreach email drafts, follow-up sequences, ICP summaries). Use markdown. Tone: warm, direct, no-fluff.",
    "research": "You are Ananya Iyer, the Research AI. Produce thorough research deliverables (market analyses, competitor breakdowns, SWOT, trend reports, opportunity ranking). Cite reasoning clearly. Use markdown with headings.",
    "developer": "You are Rohan Verma, the Developer AI. Produce engineering deliverables (architecture plans, API specs, code snippets, documentation, deployment checklists). Use fenced code blocks where appropriate.",
    "operations": "You are Kavya Sharma, the Operations AI. Produce execution deliverables (timelines, dependency maps, RACI matrices, kanban states, deadlines). Use markdown tables / bullet lists.",
    "finance": "You are Vikram Shah, the Finance AI. Produce financial deliverables (budget breakdowns, revenue forecasts, expense categorization, ROI calculations). Show numbers in tables; show assumptions.",
    "hr": "You are Meera Joshi, the HR AI. Produce people-ops deliverables (SOPs, role specs, knowledge base entries, training docs, AI-agent recommendations). Use markdown with numbered steps.",
}


async def llm_generate_output(agent_id: str, task: dict, knowledge: List[dict]) -> str:
    """Call Claude to produce the actual deliverable for a task."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    sys_prompt = AGENT_SYSTEM_PROMPTS.get(agent_id, AGENT_SYSTEM_PROMPTS["operations"])
    if knowledge:
        ctx_lines = "\n".join(f"- {k['title']}: {(k.get('content') or '')[:280]}" for k in knowledge[:5])
        sys_prompt += f"\n\nBUSINESS CONTEXT (from founder's knowledge base):\n{ctx_lines}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"gen-{task['id']}",
        system_message=sys_prompt,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user = (
        f"Task: {task['title']}\n"
        f"Brief: {task['description']}\n\n"
        f"Produce the deliverable now. Output the deliverable directly — no preamble like 'here is the...'. "
        f"Keep it concise but complete (under ~500 words)."
    )
    raw = await chat.send_message(UserMessage(text=user))
    return raw if isinstance(raw, str) else str(raw)


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
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(502, "AI generation failed — try again")

    now = datetime.now(timezone.utc)
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"output": output, "status": "completed", "progress": 100, "updated_at": now}},
    )
    agent_name = next((e["name"] for e in AI_EMPLOYEES if e["id"] == task["agent_id"]), task["agent_id"])
    await log_activity(user["id"], task["agent_id"], f"{agent_name} delivered: {task['title']}", "output")
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return updated


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
INTEGRATION_CATALOG = [
    {"id": "gmail", "name": "Gmail", "category": "Email", "description": "Send approved outreach drafts via your inbox.", "requires_keys": ["OAuth client + refresh token"]},
    {"id": "slack", "name": "Slack", "category": "Messaging", "description": "Post approvals & summaries to your team channel.", "requires_keys": ["Bot User OAuth Token"]},
    {"id": "hubspot", "name": "HubSpot", "category": "CRM", "description": "Sync Sales leads & pipeline stages.", "requires_keys": ["Private app access token"]},
    {"id": "calendar", "name": "Google Calendar", "category": "Calendar", "description": "Schedule meetings post-approval.", "requires_keys": ["OAuth client + refresh token"]},
    {"id": "notion", "name": "Notion", "category": "Docs", "description": "Mirror Research reports & SOPs to a workspace.", "requires_keys": ["Internal integration token"]},
]


@api.get("/integrations")
async def list_integrations(user: dict = Depends(current_user)):
    existing = {i["id"]: i async for i in db.integrations.find({"user_id": user["id"]}, {"_id": 0})}
    out = []
    for cat in INTEGRATION_CATALOG:
        rec = existing.get(cat["id"], {})
        out.append({
            **cat,
            "status": rec.get("status", "not_configured"),
            "mode": "sandbox",
            "configured_at": rec.get("configured_at"),
        })
    return out


@api.post("/integrations/{provider}/toggle")
async def toggle_integration(provider: str, body: IntegrationToggleIn, user: dict = Depends(current_user)):
    if provider not in {c["id"] for c in INTEGRATION_CATALOG}:
        raise HTTPException(404, "Unknown integration")
    status_value = "connected_sandbox" if body.enabled else "not_configured"
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
def _sandbox_meet_link() -> str:
    import secrets, string
    alpha = string.ascii_lowercase
    chunk = lambda n: "".join(secrets.choice(alpha) for _ in range(n))
    return f"https://meet.google.com/{chunk(3)}-{chunk(4)}-{chunk(3)}"


@api.post("/meetings")
async def create_meeting(body: MeetingIn, user: dict = Depends(current_user)):
    now = datetime.now(timezone.utc)
    link = _sandbox_meet_link()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": body.title,
        "participants": body.participants,
        "start_time": body.start_time,
        "duration_min": body.duration_min,
        "description": body.description,
        "meet_link": link,
        "provider": "google_meet_sandbox",
        "status": "pending_approval" if body.requires_approval else "scheduled",
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
            "payload_preview": f"Participants: {', '.join(body.participants) or '—'}\nWhen: {body.start_time.isoformat()}\nLink: {link}",
            "status": "pending", "created_at": now,
        }
        await db.approvals.insert_one(appr)

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
