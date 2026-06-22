"""UnnatiX GrowthX backend regression tests."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = "https://executive-team-ai-1.preview.emergentagent.com"
SEED_EMAIL = "founder@unnatix.dev"
SEED_PASS = "Founder@123"

state = {}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------- Health --------
def test_root():
    r = requests.get(f"{BASE_URL}/api/", timeout=30)
    assert r.status_code == 200
    assert r.json().get("status") == "online"


# -------- Auth --------
def test_register_new_user():
    email = f"test_{uuid.uuid4().hex[:8]}@unnatix.dev"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": "Passw0rd!", "name": "Test User"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == email
    assert "_id" not in str(data)
    state["new_token"] = data["token"]


def test_register_duplicate_rejected():
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": SEED_EMAIL, "password": "x" * 8, "name": "X"}, timeout=30)
    assert r.status_code == 400


def test_login_seeded():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": SEED_EMAIL, "password": SEED_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["token"]
    assert data["user"]["email"] == SEED_EMAIL
    state["token"] = data["token"]
    state["user_id"] = data["user"]["id"]


def test_login_bad_password():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": SEED_EMAIL, "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_me():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    assert r.json()["email"] == SEED_EMAIL
    assert "_id" not in r.text


def test_me_unauthorized():
    r = requests.get(f"{BASE_URL}/api/auth/me", timeout=30)
    assert r.status_code == 401


# -------- Agents --------
def test_list_agents():
    r = requests.get(f"{BASE_URL}/api/agents", headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    agents = r.json()
    assert len(agents) == 8
    ids = {a["id"] for a in agents}
    assert ids == {"ceo", "marketing", "sales", "research", "developer", "operations", "finance", "hr"}
    for a in agents:
        assert "status" in a and "completed_tasks" in a and "performance" in a
        assert "current_task" in a
    assert "_id" not in r.text


# -------- Goals / Orchestration (LLM) --------
def test_create_goal_llm():
    r = requests.post(f"{BASE_URL}/api/goals",
                      headers=_auth(state["token"]),
                      json={"objective": "Help me grow my AI business"}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data and data["objective"]
    tasks = data["tasks"]
    assert 5 <= len(tasks) <= 8, f"Got {len(tasks)} tasks"
    agent_ids = {t["agent_id"] for t in tasks}
    assert len(agent_ids) >= 4
    # check sensitive sales outreach => requires_approval=true should exist
    sales_appr = [t for t in tasks if t["agent_id"] == "sales" and t["requires_approval"]]
    assert len(sales_appr) >= 1, f"Expected at least 1 sales-approval task; got {tasks}"
    state["goal_id"] = data["id"]
    state["tasks"] = tasks
    assert "_id" not in r.text


def test_approvals_created_after_goal():
    r = requests.get(f"{BASE_URL}/api/approvals", headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    items = r.json()
    pending = [a for a in items if a["status"] == "pending"]
    assert len(pending) >= 1
    state["approval_id"] = pending[0]["id"]
    state["approval_task_id"] = pending[0]["task_id"]


# -------- Tasks --------
def test_list_tasks():
    r = requests.get(f"{BASE_URL}/api/tasks", headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    tasks = r.json()
    assert len(tasks) >= 5
    state["complete_task_id"] = next(t["id"] for t in tasks if not t["requires_approval"])


def test_complete_task():
    tid = state["complete_task_id"]
    r = requests.patch(f"{BASE_URL}/api/tasks/{tid}",
                       headers=_auth(state["token"]), json={"status": "completed"}, timeout=30)
    assert r.status_code == 200
    # verify
    r2 = requests.get(f"{BASE_URL}/api/tasks", headers=_auth(state["token"]), timeout=30)
    t = next(x for x in r2.json() if x["id"] == tid)
    assert t["status"] == "completed" and t["progress"] == 100


# -------- Approval decision --------
def test_approve_decision_flips_task_to_running():
    aid = state["approval_id"]
    tid = state["approval_task_id"]
    r = requests.post(f"{BASE_URL}/api/approvals/{aid}/decision",
                      headers=_auth(state["token"]), json={"decision": "approved"}, timeout=30)
    assert r.status_code == 200
    # verify
    tlist = requests.get(f"{BASE_URL}/api/tasks", headers=_auth(state["token"]), timeout=30).json()
    t = next(x for x in tlist if x["id"] == tid)
    assert t["status"] == "running"
    alist = requests.get(f"{BASE_URL}/api/approvals", headers=_auth(state["token"]), timeout=30).json()
    a = next(x for x in alist if x["id"] == aid)
    assert a["status"] == "approved"


# -------- Activity --------
def test_activity():
    r = requests.get(f"{BASE_URL}/api/activity", headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 3
    assert all("user_id" in i for i in items)
    assert "_id" not in r.text


# -------- Dashboard stats --------
def test_dashboard_stats():
    r = requests.get(f"{BASE_URL}/api/stats/dashboard", headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    s = r.json()
    assert s["total_agents"] == 8
    for key in ["active_tasks", "completed_tasks", "goals_running", "approvals_pending",
                "reports_generated", "leads_researched", "content_created",
                "projects_running", "total_tasks", "system_status"]:
        assert key in s
