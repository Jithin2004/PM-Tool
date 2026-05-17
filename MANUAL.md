# RESOLVE PM: High-Fidelity Engineering Management System
## System Architecture, Telemetry, and Operational Manual

Welcome to **Resolve PM**, a production-grade predictive project management and telemetry suite. It is designed to replace subjective guessing with rigorous industrial engineering metrics, resource allocation analytics, global policy compliance, and modern responsive interfaces.

---

## 1. Estimation & Predictive Modeling Engine

At the center of Resolve PM is a mathematically calibrated forecasting model that filters human estimation optimism and simulates calendar timelines.

### A. Program Evaluation and Review Technique (PERT)
Rather than a single static delivery estimate, every asset uses three distinct hour values:
1. **Optimistic Case ($O$)**: Ideal conditions; uninterrupted focus, zero deployment hiccups.
2. **Most Likely Case ($M$)**: Normal conditions; includes day-to-day meetings, normal debugging, and normal operational cycles.
3. **Pessimistic Case ($P$)**: Worst-case conditions; technical debt blockages, environmental bugs, or infrastructure failures.

$$\text{PERT Expected Effort } (\mu) = \frac{O + 4M + P}{6}$$

*Rationale:* This standard three-point weight ensures that pessimistic edge cases influence the timeline further than optimistic assumptions pull it in, reflecting the natural entropy of engineering systems.

### B. Uncertainty & Standard Deviation (Risk Assessment)
To evaluate the confidence level of a project's forecast, the system calculates the statistical Standard Deviation ($\sigma$):

$$\text{Standard Deviation } (\sigma) = \frac{P - O}{6}$$

* **Optimized / Stable ($\sigma < 1.5$)**: High certainty; low discrepancy between optimistic and pessimistic scenarios.
* **Balanced / Standard ($1.5 \le \sigma < 3$)**: Normal operational deviation.
* **Volatile / Critical Risk ($\sigma \ge 3$)**: Extreme uncertainty. The UI flags these projects with highlighted red warnings and elevated variance indicators to prompt leads for scope division.

### C. Human Efficiency Baseline (Friction Discount)
Humans cannot maintain continuous task burn-down for a full 8-hour workday. Resolve PM applies a **globally configured Working Hours baseline** alongside an **80% human efficiency multiplier**:

$$\text{Daily Productive Capacity} = \text{Working Hours} \times 0.80$$

For example, a standard 8-hour configuration results in exactly **6.4 hours** of actual task burn-down per calendar day. This prevents optimistic calendar projections and aligns predicted dates with real-world sprint capacity.

### D. Dynamic ETA & Calendar Calibration
For any active project, the forecast calculates calendar duration as:

$$\text{Burn Duration (Days)} = \frac{\mu}{\text{Daily Productive Capacity}}$$

Once a project has a **Proposed Start Date**, the engine tracks elapsed time. The remaining ETA automatically ticks down relative to the start date, dynamically shifting the *Predicted End Date*. This predicted date is continuously compared to the *Client Deadline* to compute the **Schedule Variance**:

$$\text{Schedule Variance} = \text{Client Deadline} - \text{Predicted End Date}$$

---

## 2. Logistics & Payroll Telemetry

Resolve PM tracks day-to-day operations through a robust logistics suite encompassing attendance logs, financial slabs, and rollups.

### A. Attendance Status Matrices
Attendance records can be marked under multiple fine-grained categories to determine accurate payroll telemetry:
* **Present**: Full daily wage payout; counts toward standard resource burn.
* **Half Day (Unpaid)**: Unexcused half-day. Deducts $50\%$ of the base daily wage.
* **Half Day (Paid)**: Excused half-day. Full base daily wage is preserved.
* **Absent (Unpaid)**: Unexcused absence. Deducts $100\%$ of the base daily wage.
* **Casual Leave (CL)** / **Medical Leave (ML)**: Excused absence. Payroll rules apply depending on profile allowances.

### B. Payroll Financial Calculations
The telemetry module rolls up monthly wages based on active profiles, role-based pay, and global guidelines:

$$\text{Gross Pay} = (\text{Base Pay} \times \text{Days Present}) + (\text{Base Pay} \times 0.5 \times \text{Paid Half-Days}) + \text{Allowances} - \text{Deductions}$$

Where:
* **Base Pay**: Evaluated dynamically based on user identity type (e.g. PM, Super Admin, Developer).
* **Allowances**: Dynamically added travel, meal, or night-shift allowances.
* **Deductions**: Subtracted unexcused absences and unpaid half-days.

---

## 3. UI Theme Engine (Dual Slate Interface)

Resolve PM includes a state-of-the-art **Dual Theme Engine** that transitions the interface between two highly refined visual states.

### A. Persisted Theme Selector
The system leverages React state synchronized with local persistent storage:
* **Dark Theme (Default)**: Premium glassmorphic workspace using deep carbons (`#0a0a0a`, `#0c0c0c`) and low-opacity borders (`rgba(255,255,255,0.1)`).
* **Light Slate Theme**: A clean, premium Slate-based aesthetic (`#f8fafc` slate-50, `#0f172a` slate-900) optimized for daylight operations.

### B. Instant High-Fidelity Transition
Themes are triggered via dedicated, accessible toggle buttons rendered on both desktop and mobile headers. Persisting the preference ensures that the selected mode is restored instantly across page reloads.

---

## 4. Mobile Adaptations & Navigation

All interactive views are meticulously designed for absolute responsiveness on touch viewports and small screens.

* **Hamburger Mobile Drawer**: Packs navigation options, system settings, and profile managers into an elegant sliding overlay.
* **Adaptive Grid System**: Card listings stack vertically (`flex-col sm:flex-row`) to prevent column overlaps.
* **Scrollable Tab Rows**: Tab bars automatically implement lateral swipe capability on overflow containers.
* **Squad Roster Tab Manager**: Splits directory listings and analytical telemetry into toggleable mobile-first tabs with quick backtracking capabilities.

---
*Generated by Resolve Core Engineering - Precision V5.0*
