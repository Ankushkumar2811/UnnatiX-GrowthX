"""UnnatiX GrowthX – Iteration 2 backend tests.

Covers: tasks/quick, tasks/{id}/generate, knowledge CRUD, integrations.
Also regresses login/agents/goals/tasks/approvals/stats/activity.
NOTE: _id leak checks are field-based (not substring) to avoid false positives
on legitimate ids/strings like 'agent_id'.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://executive-team-ai-1.preview.emergentagent.com").rstrip("/")
SEED_EMAIL = "founder@unnatix.dev"
SEED_PASS = "Founder@123"

state = {}


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _has_id_leak(obj) -> bool:
    """Recursively check if an '_id' field exists anywhere in the JSON."""
    if isinstance(obj, dict):
        if "_id" in obj:
            return True
        return any(_has_id_leak(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_has_id_leak(v) for v in obj)
    return False


# ---------- Auth / regression baseline ----------
def test_root():
    r = requests.get(f"{BASE_URL}/api/", timeout=30)
    assert r.status_code == 200
    assert r.json().get("status") == "online"


def test_login_seed():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": SEED_EMAIL, "password": SEED_PASS}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    state["token"] = data["token"]
    state["uid"] = data["user"]["id"]
    assert not _has_id_leak(data)


def test_agents_list():
    r = requests.get(f"{BASE_URL}/api/agents", headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    agents = r.json()
    assert len(agents) == 8
    assert not _has_id_leak(agents)


# ---------- POST /api/tasks/quick ----------
def test_quick_task_marketing_planning():
    body = {
        "agent_id": "marketing",
        "title": "TEST_Write LinkedIn post",
        "description": "Test post for iteration 2",
        "priority": "medium",
        "requires_approval": False,
    }
    r = requests.post(f"{BASE_URL}/api/tasks/quick",
                      headers=_auth(state["token"]), json=body, timeout=30)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["agent_id"] == "marketing"
    assert t["status"] == "planning"
    assert t["progress"] == 25
    assert t["requires_approval"] is False
    assert not _has_id_leak(t)
    state["mk_task_id"] = t["id"]


def test_quick_task_sales_waiting_approval():
    body = {
        "agent_id": "sales",
        "title": "TEST_Send outreach to ICP",
        "description": "Outreach drafts to top 10 ICP",
        "priority": "high",
        "requires_approval": True,
    }
    r = requests.post(f"{BASE_URL}/api/tasks/quick",
                      headers=_auth(state["token"]), json=body, timeout=30)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["status"] == "waiting_approval"
    assert t["agent_id"] == "sales"
    assert t["requires_approval"] is True
    state["sales_task_id"] = t["id"]

    # ensure approval is created
    ar = requests.get(f"{BASE_URL}/api/approvals", headers=_auth(state["token"]), timeout=30)
    assert ar.status_code == 200
    approvals = ar.json()
    matching = [a for a in approvals if a["task_id"] == t["id"] and a["status"] == "pending"]
    assert len(matching) == 1, f"Expected exactly one matching pending approval, got {len(matching)}"


def test_quick_task_invalid_agent():
    body = {"agent_id": "ceo", "title": "TEST_x", "description": "no", "priority": "low",
            "requires_approval": False}
    r = requests.post(f"{BASE_URL}/api/tasks/quick",
                      headers=_auth(state["token"]), json=body, timeout=30)
    assert r.status_code == 400


# ---------- POST /api/tasks/{id}/generate (LLM-backed) ----------
def test_generate_output_on_planning_task():
    tid = state["mk_task_id"]
    r = requests.post(f"{BASE_URL}/api/tasks/{tid}/generate",
                      headers=_auth(state["token"]), timeout=120)
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["status"] == "completed"
    assert t["progress"] == 100
    assert isinstance(t["output"], str) and len(t["output"]) > 20
    assert not _has_id_leak(t)


def test_generate_blocked_on_waiting_approval():
    tid = state["sales_task_id"]
    r = requests.post(f"{BASE_URL}/api/tasks/{tid}/generate",
                      headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 400


def test_generate_unknown_task_404():
    r = requests.post(f"{BASE_URL}/api/tasks/{uuid.uuid4()}/generate",
                      headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 404


# ---------- /api/knowledge CRUD ----------
def test_knowledge_create_list_delete():
    create = requests.post(f"{BASE_URL}/api/knowledge",
                           headers=_auth(state["token"]),
                           json={"kind": "note", "title": "TEST_Brand voice",
                                 "content": "Warm, direct, no fluff."}, timeout=30)
    assert create.status_code == 200, create.text
    item = create.json()
    assert item["title"] == "TEST_Brand voice"
    assert item["kind"] == "note"
    assert not _has_id_leak(item)
    kid = item["id"]

    # list (newest first)
    lst = requests.get(f"{BASE_URL}/api/knowledge", headers=_auth(state["token"]), timeout=30)
    assert lst.status_code == 200
    items = lst.json()
    assert any(k["id"] == kid for k in items)
    # check descending order
    if len(items) >= 2:
        assert items[0]["created_at"] >= items[1]["created_at"]
    assert not _has_id_leak(items)

    # delete
    d = requests.delete(f"{BASE_URL}/api/knowledge/{kid}",
                        headers=_auth(state["token"]), timeout=30)
    assert d.status_code == 200
    # verify removed
    lst2 = requests.get(f"{BASE_URL}/api/knowledge", headers=_auth(state["token"]), timeout=30).json()
    assert not any(k["id"] == kid for k in lst2)


def test_knowledge_delete_404():
    r = requests.delete(f"{BASE_URL}/api/knowledge/{uuid.uuid4()}",
                        headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 404


# ---------- /api/integrations ----------
def test_integrations_catalog():
    r = requests.get(f"{BASE_URL}/api/integrations", headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    items = r.json()
    ids = {i["id"] for i in items}
    assert ids == {"gmail", "slack", "hubspot", "calendar", "notion"}
    for i in items:
        assert i["mode"] == "sandbox"
        assert "status" in i
    assert not _has_id_leak(items)


def test_integration_toggle_on_off():
    # toggle on
    r = requests.post(f"{BASE_URL}/api/integrations/gmail/toggle",
                      headers=_auth(state["token"]), json={"enabled": True}, timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "connected_sandbox"

    # verify via GET
    listing = requests.get(f"{BASE_URL}/api/integrations",
                           headers=_auth(state["token"]), timeout=30).json()
    gmail = next(i for i in listing if i["id"] == "gmail")
    assert gmail["status"] == "connected_sandbox"

    # toggle off
    r2 = requests.post(f"{BASE_URL}/api/integrations/gmail/toggle",
                       headers=_auth(state["token"]), json={"enabled": False}, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["status"] == "not_configured"

    listing2 = requests.get(f"{BASE_URL}/api/integrations",
                            headers=_auth(state["token"]), timeout=30).json()
    gmail2 = next(i for i in listing2 if i["id"] == "gmail")
    assert gmail2["status"] == "not_configured"


def test_integration_toggle_unknown():
    r = requests.post(f"{BASE_URL}/api/integrations/unknown/toggle",
                      headers=_auth(state["token"]), json={"enabled": True}, timeout=30)
    assert r.status_code == 404


# ---------- regression: stats / activity ----------
def test_dashboard_stats_regression():
    r = requests.get(f"{BASE_URL}/api/stats/dashboard",
                     headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    s = r.json()
    assert s["total_agents"] == 8
    for k in ["active_tasks", "completed_tasks", "goals_running", "approvals_pending",
              "system_status", "total_tasks"]:
        assert k in s


def test_activity_regression():
    r = requests.get(f"{BASE_URL}/api/activity",
                     headers=_auth(state["token"]), timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert not _has_id_leak(items)
