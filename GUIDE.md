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

### C. The Human Element (Efficiency Factor)
Humans do not code for 8 straight hours. Meetings, context switching, debugging, and general breaks naturally consume time.
- **Productive Hours Calculation**: RESOLVE assumes an **80% efficiency baseline**. If you set your global "Working Hours/Day" to 8, the engine calculates that only 6.4 hours per day will go toward actual task burn-down. This mathematically guarantees your calendar predictions won't suffer from optimistic time-blocking.

### D. Dynamic ETA Calibration
Once a project has a **Proposed Start Date**, the engine tracks elapsed time. 
- **Calendar Days**: Total expected hours are divided by the team's daily productive hours.
- **Remaining ETA**: Automatically calibrates each day. If a 10-day project started 3 days ago, the Remaining ETA physically ticks down to 7 days, maintaining a realistic "Predicted End Date" projection.
- **Schedule Variance**: RESOLVE continuously checks the *Predicted End Date* against the *Client Deadline* and generates a Variance score (e.g., "3 days ahead" or "2 days behind").

---

## 2. Field Definitions & Data Entry

### Project Form Fields

| Field | Meaning | Real-World Strategy |
| :--- | :--- | :--- |
| **Project Name** | Identifiable name of the deliverable. | Be specific (e.g., "Auth Service Rewrite"). |
| **Priority** | Numerical rank (High/Medium/Low). | Determines dashboard sorting and attention. |
| **Team ID** | The squad or individual assigned. | Used for resource load balancing. |
| **Proposed Start Date** | The day the work officially begins. | Anchors the ETA calibration. |
| **Client Deadline** | The hard drop-dead date. | Used to calculate **Variance** (Ahead/Behind schedule). |
| **PERT: Best Case** | Physical minimum hours required. | The "10x Developer" uninterrupted speed. |
| **PERT: Likely Case**| Most probable hours required. | Includes normal minor setbacks. |
| **PERT: Worst Case** | "The Disaster Scenario" hours. | Factor in legacy code or API delays. |

### Global Settings (`config`)

- **Working Hours/Day**: The baseline hours your team is contracted to work (e.g., 8). This is globally configured in the top header. The engine automatically reduces this to "Productive Hours" (e.g., 6.4) to account for daily human friction. All calendar ETA predictions scale dynamically when you change this number.
- **Tiles Per Row**: Customize your dashboard density (2-4 tiles) based on your monitor size.

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
