"""Iteration 4: Billing (Stripe) + Analytics regression tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://executive-team-ai-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

FOUNDER = {"email": "founder@unnatix.dev", "password": "Founder@123"}


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(f"{API}/auth/login", json=FOUNDER, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============================================================
# BILLING / STRIPE
# ============================================================
class TestBillingPlans:
    def test_plans_shape(self, auth_headers):
        r = requests.get(f"{API}/billing/plans", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "current_tier" in body
        plans = body["plans"]
        assert len(plans) == 3
        ids = [p["id"] for p in plans]
        assert ids == ["free", "pro", "scale"]
        for p in plans:
            assert p["name"] and p["price_label"] and isinstance(p["features"], list) and len(p["features"]) >= 3
        # Price labels
        labels = {p["id"]: p["price_label"] for p in plans}
        assert labels["free"] == "$0"
        assert labels["pro"] == "$29"
        assert labels["scale"] == "$99"


class TestCheckoutSession:
    def test_checkout_pro_returns_stripe_url(self, auth_headers):
        r = requests.post(f"{API}/billing/checkout-session", headers=auth_headers, json={"plan": "pro"}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert "url" in body and "session_id" in body
        assert body["url"].startswith("https://checkout.stripe.com/"), f"URL not real Stripe: {body['url']}"
        assert body["session_id"].startswith("cs_"), f"session_id unexpected: {body['session_id']}"
        # Persist for next test
        pytest.pro_session_id = body["session_id"]

    def test_checkout_scale_returns_stripe_url(self, auth_headers):
        r = requests.post(f"{API}/billing/checkout-session", headers=auth_headers, json={"plan": "scale"}, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["url"].startswith("https://checkout.stripe.com/")

    def test_invalid_plan_returns_422(self, auth_headers):
        r = requests.post(f"{API}/billing/checkout-session", headers=auth_headers, json={"plan": "enterprise"}, timeout=20)
        assert r.status_code == 422

    def test_unpaid_session_does_not_promote_tier(self, auth_headers):
        sid = getattr(pytest, "pro_session_id", None)
        assert sid, "Needs the pro checkout-session test to run first"
        r = requests.get(f"{API}/billing/session/{sid}", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body.get("payment_status") not in ("paid", "complete"), f"unexpectedly paid: {body}"
        # tier should remain 'free'
        plans = requests.get(f"{API}/billing/plans", headers=auth_headers, timeout=20).json()
        assert plans["current_tier"] == "free"


# ============================================================
# ANALYTICS
# ============================================================
class TestAnalytics:
    def test_overview_shape(self, auth_headers):
        r = requests.get(f"{API}/analytics/overview", headers=auth_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()

        # 7 agents (excluding ceo)
        assert len(body["agent_throughput"]) == 7
        for a in body["agent_throughput"]:
            assert a["agent_id"] != "ceo"
            assert {"agent_id", "name", "accent", "completed", "active"} <= set(a.keys())
            assert isinstance(a["completed"], int) and isinstance(a["active"], int)

        # 6 statuses
        assert len(body["status_breakdown"]) == 6
        statuses = [s["status"] for s in body["status_breakdown"]]
        assert set(statuses) == {"pending", "planning", "running", "waiting_approval", "completed", "cancelled"}

        # 14 timeline
        assert len(body["goals_timeline"]) == 14
        for t in body["goals_timeline"]:
            assert "date" in t and "goals" in t and isinstance(t["goals"], int)

        # Approvals
        appr = body["approvals"]
        assert {"approved", "rejected", "pending"} <= set(appr.keys())

        # Headlines: 4 numeric keys
        h = body["headlines"]
        assert {"total_outputs_generated", "meetings_scheduled", "knowledge_items", "automations_active"} <= set(h.keys())
        for k, v in h.items():
            assert isinstance(v, int)


# ============================================================
# REGRESSION (iterations 1-3 — quick smoke)
# ============================================================
class TestRegression:
    def test_auth_me(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == FOUNDER["email"]

    def test_agents(self, auth_headers):
        r = requests.get(f"{API}/agents", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) == 8

    def test_tasks(self, auth_headers):
        r = requests.get(f"{API}/tasks", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_approvals(self, auth_headers):
        r = requests.get(f"{API}/approvals", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_knowledge_list(self, auth_headers):
        r = requests.get(f"{API}/knowledge", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_integrations(self, auth_headers):
        r = requests.get(f"{API}/integrations", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) == 5

    def test_meetings(self, auth_headers):
        r = requests.get(f"{API}/meetings", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_automations_catalog(self, auth_headers):
        r = requests.get(f"{API}/automations/catalog", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert len(body["triggers"]) == 5 and len(body["actions"]) == 3

    def test_org_me(self, auth_headers):
        r = requests.get(f"{API}/org/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["organization"]

    def test_stats(self, auth_headers):
        r = requests.get(f"{API}/stats/dashboard", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["total_agents"] == 8
