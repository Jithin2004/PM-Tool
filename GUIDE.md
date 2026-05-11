# RESOLVE PM: Engineering Project Management Guide

Welcome to **RESOLVE PM**, a high-fidelity project management tool designed for engineering and product teams who require predictive accuracy over simple task tracking. This guide covers the core concepts, field definitions, and real-world application of the predictive models used in the system.

---

## 1. Core Methodology: Predictive Modeling

RESOLVE doesn't just add up estimates; it simulates development reality using several industrial engineering principles:

### A. PERT Estimation (Program Evaluation and Review Technique)
Instead of a single "guess," you provide three values for every project:
- **Optimistic (Best Case)**: Everything goes perfectly. No bugs, no meeting interruptions, environment is stable.
- **Most Likely (Expected)**: The time it usually takes. Includes normal minor setbacks.
- **Pessimistic (Worst Case)**: "Everything that can go wrong, does." Technical debt, major bugs, or scope creep.

**The Formula**: `(Best + 4 * Expected + Worst) / 6`
*Why?* This weights the "Most Likely" case heavily but allows "Pessimism" to pull the date further out than "Optimism" pulls it in, reflecting the natural entropy of software development.

### B. Historical Bias Calibration
RESOLVE tracks your team's accuracy. If you consistently underestimate by 20%, the system learns this from your **Done** projects (comparing `Actual Hours` to the `PERT Estimate`) and automatically scales future forecasts by that same bias factor.

### C. The Fatigue Factor (Decay Logic)
Human productivity isn't linear. After 6 hours of deep work, efficiency drops. 
- **Configuration**: If `Fatigue Factor` is set to `0.80`, hours worked after the 6th hour in a single day are only "80% efficient." This means a 2-hour task at the end of the day might actually take 2.5 hours of calendar time.

### D. Context Switch Cost
Every time a team or individual switches between projects, there is a mental "re-loading" cost. 
- RESOLVE applies a **Logarithmic Penalty**. The more projects a team is juggling simultaneously, the higher the overhead per project.

---

## 2. Field Definitions & Data Entry

### Project Form Fields

| Field | Meaning | Real-World Strategy |
| :--- | :--- | :--- |
| **Project Name** | Identifiable name of the deliverable. | Be specific (e.g., "Auth Service Rewrite"). |
| **Priority** | Numerical rank (1 = Highest). | Lower numbers get scheduled first by the engine. |
| **Team ID** | The squad or individual assigned. | Use this to balance load across different departments. |
| **Expected Hours** | Your primary gut-feel estimate. | Don't include buffer; the system adds it later. |
| **Best Case** | "10x Developer" speed. | Be honest—what is the physical minimum time? |
| **Worst Case** | "The Disaster Scenario." | Factor in unknown legacy code or 3rd party API delays. |
| **Overhead Multiplier** | Multiplier for meetings/QA/Admin. | Standard is `1.3` (30% overhead). For complex R&D, use `1.8`. |
| **Client Deadline** | The hard drop-dead date. | Used to calculate **Health Status** (OK, Risk, or Late). |

### Global Settings (`config`)

- **Hours Per Day**: Actual productive coding hours (usually 6-7, not 8).
- **Buffer %**: A "Safety Margin" applied to every project (e.g., 10%).
- **Context Switch (Hrs)**: The base penalty for switching tasks. Standard is `0.5` to `1.5` hours.
- **Fatigue Factor**: The multiplier applied to work after the 6th hour (default `0.85`).

---

## 3. Real-World Execution Scenarios

### Scenario 1: The "Tight Deadline" Project
If a project shows as **LATE** (Red):
1.  **Reduce Scope**: Lower the `Expected Hours`.
2.  **Increase Priority**: Move it to `Priority 1` to push it to the top of the team's queue.
3.  **Adjust Team**: Switch it to a team with a shorter backlog.

### Scenario 2: High Uncertainty (R&D)
When building something never done before:
- Set a high **Worst Case** (e.g., 3-4x the Expected).
- Increase the **Overhead Multiplier** to `1.5` to account for heavy research and QA.

### Scenario 3: Portfolio Health (Admin View)
Switch to the **Admin Role** to see the "Strategic Portfolio Monitor."
- **Portfolio Confidence**: The percentage of projects currently on track to meet client deadlines.
- If this drops below 80%, consider hiring or adjusting client expectations proactively rather than on the deadline day.

---

## 4. Roles & Accountability

- **Admin**: Views aggregate health, manages team budgets/overhead, and reviews the **Audit Log**.
- **PM/Lead**: Manages individual project estimates and priorities.
- **Audit Logs**: Every change to a project (status shift, estimate update) is logged with a timestamp and the user ID. This ensures accountability for "deadline shifts."

---
*Created with PRECISION v4.0 — Resolved Engineering.*
