# UnnatiX GrowthX — Product Requirements

## Vision
A mobile AI Operating System where a single founder coordinates 9 specialized AI employees through a single dashboard. The CEO AI (Shri Nath) takes a high-level business objective, breaks it into delegated tasks across departments, and routes sensitive actions through founder approval.

## Tech Stack
- **Frontend:** Expo SDK 54 + expo-router (file-based routing, tabs)
- **Backend:** FastAPI (Python), MongoDB, JWT auth, bcrypt
- **AI:** Claude Sonnet 4.5 via Emergent Universal LLM Key (`emergentintegrations`)

## Core Features (MVP)
1. **Auth** — Email + password (JWT), register + login screens.
2. **Dashboard (Command)** — 8 live KPIs (agents, active/completed tasks, goals, approvals, reports, leads, content), system status hero, real-time activity feed.
3. **CEO Orchestration** — Founder enters objective; Shri Nath calls the configured AI model to break it into 5–8 tasks delegated across Marketing/SEO/Sales/Research/Developer/Operations/Finance/HR. Sensitive sales/outreach tasks auto-flag as requires_approval. Workflow timeline visualization.
4. **Agents** — Grid of 9 AI employee cards (Shri Nath/Harshita Gaur/Ishaan Kapoor/Arjun Mehta/Ananya Iyer/Rohan Verma/Kavya Sharma/Vikram Shah/Meera Joshi) with abstract geometric avatars, live status, current task, performance score.
5. **Tasks** — Filterable list (All/Planning/Running/Awaiting/Completed) with priority dots, agent attribution, status badges, progress bars, manual advance action.
6. **Approvals** — Founder approval queue for sensitive AI actions (approve/reject), history view.

## Design
"Dark-First Utility" with Ember/Signal Orange (#FF4400) accent on near-black (#0C0C0C) surfaces. No purple/blue AI-slop. Phosphor-style Ionicons. Custom abstract geometric AI avatars (no images required).

## Smart Business Enhancement
The approval queue + sensitive-action gating gives founders auditable control over outbound actions — turning the AI workforce from a liability risk into a trust-anchored execution layer, which is the unlock for charging premium B2B pricing.

## Future-Ready Hooks
Backend models structured for: organizations/orgs, knowledge base uploads, automation workflows, integrations (Gmail, Slack, Notion, HubSpot, Salesforce, n8n, webhooks), notifications, admin panel.
