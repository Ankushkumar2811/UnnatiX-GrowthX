"""Iteration 3 backend tests: knowledge file upload, meetings, automations, org/admin."""
import os
import re
import base64
import time
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://executive-team-ai-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

FOUNDER = {"email": "founder@unnatix.dev", "password": "Founder@123"}


@pytest.fixture(scope="session")
def founder_token():
    r = requests.post(f"{API}/auth/login", json=FOUNDER, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(founder_token):
    return {"Authorization": f"Bearer {founder_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def second_user():
    """Register a fresh second user to test org invite flow."""
    suffix = int(time.time())
    email = f"TEST_second_{suffix}@unnatix.dev"
    body = {"email": email, "password": "TestPass@123", "name": f"TEST_SecondUser{suffix}"}
    r = requests.post(f"{API}/auth/register", json=body, timeout=15)
    assert r.status_code == 200, f"Register failed: {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"], "headers": {"Authorization": f"Bearer {data['token']}", "Content-Type": "application/json"}}


# ===== Knowledge file upload =====
class TestKnowledgeUpload:
    def test_upload_plain_text(self, auth_headers):
        b64 = base64.b64encode(b"hello world").decode()
        payload = {"kind": "file", "title": "TEST_note.txt", "mime": "text/plain", "file_b64": b64}
        r = requests.post(f"{API}/knowledge/upload", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["content"] == "hello world"
        assert j["mime"] == "text/plain"
        assert j["kind"] == "file"
        assert "id" in j
        # cleanup
        requests.delete(f"{API}/knowledge/{j['id']}", headers=auth_headers, timeout=10)

    def test_upload_unsupported_mime(self, auth_headers):
        b64 = base64.b64encode(b"data").decode()
        payload = {"kind": "file", "title": "TEST_x", "mime": "application/zip", "file_b64": b64}
        r = requests.post(f"{API}/knowledge/upload", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 400, r.text

    def test_upload_invalid_base64(self, auth_headers):
        payload = {"kind": "file", "title": "TEST_bad", "mime": "text/plain", "file_b64": "!!!not-base64!!!@@@"}
        r = requests.post(f"{API}/knowledge/upload", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 400, r.text

    def test_upload_too_large(self, auth_headers):
        big = base64.b64encode(b"x" * (5 * 1024 * 1024)).decode()
        payload = {"kind": "file", "title": "TEST_big", "mime": "text/plain", "file_b64": big}
        r = requests.post(f"{API}/knowledge/upload", json=payload, headers=auth_headers, timeout=30)
        assert r.status_code == 413, r.text


# ===== Meetings =====
class TestMeetings:
    created_ids = []

    def test_create_meeting_scheduled(self, auth_headers):
        start = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        payload = {
            "title": "TEST_kickoff",
            "participants": ["a@x.com", "b@x.com"],
            "start_time": start,
            "duration_min": 30,
            "requires_approval": False,
        }
        r = requests.post(f"{API}/meetings", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "scheduled"
        assert re.match(r"^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}$", j["meet_link"]), j["meet_link"]
        assert j["participants"] == ["a@x.com", "b@x.com"]
        TestMeetings.created_ids.append(j["id"])

    def test_create_meeting_requires_approval(self, auth_headers):
        start = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
        payload = {
            "title": "TEST_sensitive_meet",
            "participants": ["c@x.com"],
            "start_time": start,
            "duration_min": 30,
            "requires_approval": True,
        }
        r = requests.post(f"{API}/meetings", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "pending_approval"
        TestMeetings.created_ids.append(j["id"])

        # Verify approval exists for this meeting
        ar = requests.get(f"{API}/approvals", headers=auth_headers, timeout=15)
        assert ar.status_code == 200
        matches = [a for a in ar.json() if a.get("task_id") == j["id"] and a.get("status") == "pending"]
        assert len(matches) >= 1, "Expected pending approval for meeting"

    def test_list_meetings_sorted(self, auth_headers):
        r = requests.get(f"{API}/meetings", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        starts = [m["start_time"] for m in items]
        assert starts == sorted(starts), "Meetings not sorted ascending by start_time"

    def test_cancel_meeting(self, auth_headers):
        if not TestMeetings.created_ids:
            pytest.skip("No meeting to cancel")
        mid = TestMeetings.created_ids[0]
        r = requests.delete(f"{API}/meetings/{mid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        gr = requests.get(f"{API}/meetings", headers=auth_headers, timeout=15)
        target = next((m for m in gr.json() if m["id"] == mid), None)
        assert target is not None and target["status"] == "cancelled"


# ===== Automations =====
class TestAutomations:
    def test_catalog(self, auth_headers):
        r = requests.get(f"{API}/automations/catalog", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert len(j["triggers"]) == 5
        assert len(j["actions"]) == 3
        for k in ["goal_created", "goal_completed", "approval_approved", "task_completed", "knowledge_added"]:
            assert k in j["triggers"]
        for k in ["create_task", "add_knowledge_note", "log_only"]:
            assert k in j["actions"]

    def test_create_toggle_delete(self, auth_headers):
        payload = {"name": "TEST_auto1", "trigger": "goal_completed", "action": "log_only"}
        r = requests.post(f"{API}/automations", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["enabled"] is True
        assert j["fired_count"] == 0
        aid = j["id"]
        # toggle off
        tr = requests.patch(f"{API}/automations/{aid}", json={"enabled": False}, headers=auth_headers, timeout=15)
        assert tr.status_code == 200
        lst = requests.get(f"{API}/automations", headers=auth_headers, timeout=15).json()
        found = next((a for a in lst if a["id"] == aid), None)
        assert found and found["enabled"] is False
        # delete
        dr = requests.delete(f"{API}/automations/{aid}", headers=auth_headers, timeout=15)
        assert dr.status_code == 200

    def test_task_completed_fires_automation(self, auth_headers):
        # 1) Create automation
        payload = {"name": "TEST_fire_on_task", "trigger": "task_completed", "action": "log_only"}
        r = requests.post(f"{API}/automations", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        aid = r.json()["id"]

        try:
            # 2) Create a quick task
            tpayload = {"agent_id": "operations", "title": "TEST_auto_trigger_task", "description": "trigger me", "priority": "low", "requires_approval": False}
            tr = requests.post(f"{API}/tasks/quick", json=tpayload, headers=auth_headers, timeout=15)
            assert tr.status_code == 200
            tid = tr.json()["id"]

            # 3) Mark task completed
            ur = requests.patch(f"{API}/tasks/{tid}", json={"status": "completed"}, headers=auth_headers, timeout=15)
            assert ur.status_code == 200

            time.sleep(1)
            # 4) Verify fired_count incremented
            lst = requests.get(f"{API}/automations", headers=auth_headers, timeout=15).json()
            found = next((a for a in lst if a["id"] == aid), None)
            assert found, "Automation not found"
            assert found["fired_count"] >= 1, f"Automation did not fire. fired_count={found['fired_count']}"

            # 5) Verify activity log
            ar = requests.get(f"{API}/activity", headers=auth_headers, timeout=15).json()
            automation_logs = [x for x in ar if x.get("kind") == "automation"]
            assert len(automation_logs) >= 1, "No automation activity log entry"
        finally:
            requests.delete(f"{API}/automations/{aid}", headers=auth_headers, timeout=10)


# ===== Org / Admin =====
class TestOrgAdmin:
    def test_org_me(self, auth_headers):
        r = requests.get(f"{API}/org/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "organization" in j
        assert "role" in j
        assert "members" in j and isinstance(j["members"], list)
        emails = [m["email"] for m in j["members"]]
        assert FOUNDER["email"] in emails

    def test_invite_create_and_list(self, auth_headers):
        r = requests.post(f"{API}/org/invite", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "code" in j and len(j["code"]) == 8
        assert "organization" in j
        code = j["code"]

        lr = requests.get(f"{API}/org/invites", headers=auth_headers, timeout=15)
        assert lr.status_code == 200
        codes = [i["code"] for i in lr.json()]
        assert code in codes

    def test_join_org_with_second_user(self, auth_headers, second_user):
        # founder creates invite
        ir = requests.post(f"{API}/org/invite", headers=auth_headers, timeout=15)
        assert ir.status_code == 200
        code = ir.json()["code"]
        founder_org = ir.json()["organization"]

        # second user joins
        jr = requests.post(f"{API}/org/join", json={"code": code}, headers=second_user["headers"], timeout=15)
        assert jr.status_code == 200, jr.text
        assert jr.json()["organization"] == founder_org

        # second user's /auth/me should now show new org
        mr = requests.get(f"{API}/auth/me", headers=second_user["headers"], timeout=15)
        assert mr.status_code == 200
        assert mr.json()["organization"] == founder_org

    def test_remove_member_non_owner_forbidden(self, second_user, auth_headers):
        # second_user should now be in founder's org as 'member' role.
        # Have second_user try to delete the founder.
        me = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15).json()
        r = requests.delete(f"{API}/org/members/{me['id']}", headers=second_user["headers"], timeout=15)
        assert r.status_code == 403, f"Expected 403 from non-owner, got {r.status_code}: {r.text}"


# ===== Regression: iteration 1+2 endpoints still pass =====
class TestRegression:
    def test_agents(self, auth_headers):
        r = requests.get(f"{API}/agents", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) == 8  # ceo + 7 specialists

    def test_tasks_list(self, auth_headers):
        r = requests.get(f"{API}/tasks", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_approvals_list(self, auth_headers):
        r = requests.get(f"{API}/approvals", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_knowledge_note_crud(self, auth_headers):
        cr = requests.post(f"{API}/knowledge", json={"kind": "note", "title": "TEST_reg_note", "content": "abc"}, headers=auth_headers, timeout=15)
        assert cr.status_code == 200
        kid = cr.json()["id"]
        lr = requests.get(f"{API}/knowledge", headers=auth_headers, timeout=15)
        assert kid in [k["id"] for k in lr.json()]
        dr = requests.delete(f"{API}/knowledge/{kid}", headers=auth_headers, timeout=15)
        assert dr.status_code == 200

    def test_integrations_list_and_toggle(self, auth_headers):
        r = requests.get(f"{API}/integrations", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 5
        tr = requests.post(f"{API}/integrations/slack/toggle", json={"enabled": True}, headers=auth_headers, timeout=15)
        assert tr.status_code == 200
        assert tr.json()["status"] == "connected_sandbox"
        # restore
        requests.post(f"{API}/integrations/slack/toggle", json={"enabled": False}, headers=auth_headers, timeout=15)

    def test_stats_dashboard(self, auth_headers):
        r = requests.get(f"{API}/stats/dashboard", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        j = r.json()
        for k in ["total_agents", "active_tasks", "completed_tasks", "goals_running", "approvals_pending"]:
            assert k in j
