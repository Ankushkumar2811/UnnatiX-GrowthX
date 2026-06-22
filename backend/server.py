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
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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

client = AsyncIOMotorClient(MONGO_URL)
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
        "name": "Aurora",
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
        "name": "Vega",
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
        "id": "sales",
        "name": "Atlas",
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
        "name": "Iris",
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
        "name": "Nova",
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
        "name": "Orion",
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
        "name": "Sterling",
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
        "name": "Sage",
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
ORCHESTRATION_PROMPT = """You are Aurora, the CEO AI of UnnatiX GrowthX, an AI Operating System.
Your job: take the founder's business objective and produce a precise execution plan that delegates work to your team.

Available AI employees (delegate ONLY to these):
- marketing (Vega): content, campaigns, scripts, blog posts, competitor studies
- sales (Atlas): prospect research, lead lists, scoring, outreach drafts (REQUIRES APPROVAL before sending)
- research (Iris): market & competitor analysis, industry trends, opportunity reports
- developer (Nova): software plans, code, APIs, documentation
- operations (Orion): project tracking, workflows, deadlines
- finance (Sterling): budgets, forecasts, expenses, ROI
- hr (Sage): SOPs, knowledge base, team structure

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
- agent_id MUST be one of: marketing, sales, research, developer, operations, finance, hr.
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
    "marketing": "You are Vega, the Marketing AI of UnnatiX GrowthX. Produce concrete, high-quality marketing deliverables (content pieces, scripts, calendars, campaign plans). Be specific, voice-rich, and actionable. Format with clear markdown headings/bullets.",
    "sales": "You are Atlas, the Sales AI. Produce concrete sales deliverables (lead lists with scoring rationale, outreach email drafts, follow-up sequences, ICP summaries). Use markdown. Tone: warm, direct, no-fluff.",
    "research": "You are Iris, the Research AI. Produce thorough research deliverables (market analyses, competitor breakdowns, SWOT, trend reports, opportunity ranking). Cite reasoning clearly. Use markdown with headings.",
    "developer": "You are Nova, the Developer AI. Produce engineering deliverables (architecture plans, API specs, code snippets, documentation, deployment checklists). Use fenced code blocks where appropriate.",
    "operations": "You are Orion, the Operations AI. Produce execution deliverables (timelines, dependency maps, RACI matrices, kanban states, deadlines). Use markdown tables / bullet lists.",
    "finance": "You are Sterling, the Finance AI. Produce financial deliverables (budget breakdowns, revenue forecasts, expense categorization, ROI calculations). Show numbers in tables; show assumptions.",
    "hr": "You are Sage, the HR AI. Produce people-ops deliverables (SOPs, role specs, knowledge base entries, training docs, AI-agent recommendations). Use markdown with numbered steps.",
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
    await log_activity(user["id"], "hr", f"Sage indexed knowledge: {body.title}", "info")
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
# APP WIRING
# ============================================================
app.include_router(api)
app.add_middleware(
    CORSMiddleware, allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.tasks.create_index([("user_id", 1), ("created_at", -1)])
    await db.activity.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("UnnatiX GrowthX backend ready.")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
