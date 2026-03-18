# CLAUDE.md — TTXWorks Foundry VTT System

## What is TTXWorks?

TTXWorks is a narrative framework for running tabletop exercises (TTX) as a structured, consequence-driven simulation. It bridges the gap between a traditional checklist-based TTX (discussion-focused, strategic) and a full simulation (tactical, hands-on). It draws design principles from narrative TTRPGs — specifically Blades in the Dark — and applies them to professional crisis management training: cybersecurity incidents, natural disasters, physical security events, and complex hybrid scenarios.

**Core Design Philosophy:**
- Sandbox, Not Railroad — players have genuine agency; the GM presents a dynamic world, not a pre-scripted plot
- Consequence-Driven Narrative — "fail forward"; every roll, win or lose, advances the story
- Evolving Threats — the adversary (usually a pentester in the Red Team role) is a live, thinking opponent who adapts

---

## System ID

`ttxworks`

---

## Foundry VTT Integration Notes

TTXWorks **explicitly calls out FoundryVTT** as the preferred Virtual Tabletop for its gameboard. The gameboard is a core part of the exercise — it is both a visualization and a scoreboard. It should be able to display:

- Network diagrams (high-level and granular)
- Geographic maps with client locations
- Business process flow charts
- System status dashboards (colored indicators: Green/Yellow/Red)
- Building floor plans
- Countdown Clocks (segmented circles: 4, 6, or 8 segments)
- Player/Team status (Focus, Stress, Assets)

Use Foundry Levels or Scene layers for multi-level granularity (e.g., Ground = Hardware layer, Level 1 = Data layer, Level 2 = Business Impact layer). Overhead maps are preferred over isometric. Use color and animation to draw attention to active threats.

---

## Actor Types

### `individual`
Represents a single stakeholder or player persona (often the participant themselves).
- Name / Role designation
- Scenario Objectives (list)
- Scenario Restrictions (list)
- Skills (selected from catalog)
- Assets (selected/installed from catalog)
- Focus: `{ value, max }` — default max: **5**
- Stress: `{ value }` — Burned Out threshold: **6**
- Active Clocks (tracked here and on GM Status Board)
- Status: Normal / Burned Out

### `team`
Represents a functional group (e.g., SOC, IR Team, IT Department). One player speaks for the whole team.
- Team Name / Designation
- Scenario Objectives (list)
- Scenario Restrictions (list)
- Skills (aggregated from all member roles)
- Assets (installed for the scenario)
- Focus: `{ value, max }` — default max: **10**
- Stress: `{ value }` — Burned Out threshold: **6**
- Active Clocks
- Status: Normal / Burned Out

### `adversary`
Represents the Red Team / threat actor. Typically played by a pentester. In non-adversarial scenarios (natural disasters, etc.), the GM controls this actor.
- Name / Threat Profile
- Objectives (secret — only GM sees)
- Active Effects (Obfuscation, Persistence, etc.)
- Clocks (adversary progress toward goals)

### `node`
Any targetable object that is not an Individual, Team, or Adversary. Examples: a server, a database, a network segment, a physical location, a critical business process, a decision point.
- Name
- Description
- Status: `Operational | Degraded | Compromised | Offline`
- Health states defined in plain business language (e.g., what does Yellow mean for the ERP system?)
- Active Effects

---

## Item Types

### `skill`
A capability possessed by an Individual or Team. Skills are static for the duration of a scenario.

Fields:
- `name` — Skill name (e.g., "Incident Triage", "Log Analysis")
- `category` — One of the skill categories below
- `description` — Plain-language description and use case
- `bonus` — Typically +10% to TN when directly relevant (used in Optional Skills/Assets Emphasis rules)

**Skill Categories:**
- Security Operations (SecOps)
- Threat Intelligence & Hunting
- Engineering & Architecture
- IT & Systems Administration
- Governance, Risk & Compliance (GRC)
- Leadership & Communication
- Emergency Management & Logistics
- Physical & Personnel Security

**Default Skills (35 total):**

| Skill | Category |
|-------|----------|
| Incident Triage | SecOps |
| Log Analysis | SecOps |
| Digital Forensics | SecOps |
| SIEM Operation | SecOps |
| Threat Modeling | Threat Intel & Hunting |
| Threat Hunting | Threat Intel & Hunting |
| Malware Analysis | Threat Intel & Hunting |
| OSINT | Threat Intel & Hunting |
| Network Architecture | Engineering & Architecture |
| Cloud Security | Engineering & Architecture |
| Application Security (AppSec) | Engineering & Architecture |
| Identity & Access Mgmt (IAM) | Engineering & Architecture |
| Infrastructure Engineering | Engineering & Architecture |
| System Administration | IT & Systems Administration |
| Database Management | IT & Systems Administration |
| Scripting & Automation | IT & Systems Administration |
| Policy & Standards | GRC |
| Risk Assessment | GRC |
| Business Continuity | GRC |
| Regulatory Compliance | GRC |
| Legal Counsel | GRC |
| Incident Command | Leadership & Communication |
| Team Coordination | Leadership & Communication |
| Executive Comms | Leadership & Communication |
| Public Information | Leadership & Communication |
| Law Enforcement Liaison | Leadership & Communication |
| Operational Planning | Emergency Management & Logistics |
| Logistics Management | Emergency Management & Logistics |
| Finance & Administration | Emergency Management & Logistics |
| Damage Assessment | Emergency Management & Logistics |
| Supply Chain Resilience | Emergency Management & Logistics |
| Physical Security Systems | Physical & Personnel Security |
| Site Security & Access Control | Physical & Personnel Security |
| Active Threat Response | Physical & Personnel Security |
| Evidence Preservation | Physical & Personnel Security |
| Trauma First Aid | Physical & Personnel Security |
| Mass Care & Sheltering | Physical & Personnel Security |
| Executive Protection | Physical & Personnel Security |

### `asset`
A piece of Hardware, Software, a Service, or a Policy that provides mechanical benefits when "installed" for a scenario.

Fields:
- `name` — Asset name
- `category` — Hardware | Software | Service | Policy
- `sourceDomain` — Real-world domain (e.g., "Endpoint Protection Platform", "SIEM", "Incident Response Services")
- `description` — Mechanical benefit description
- `status` — Ready | Compromised | Unavailable | Unknown | Reduced
- `bonus` — Numeric TN modifier when applicable (e.g., +10)
- `usesPerScenario` — null (passive) or integer (limited-use)
- `focusCostToActivate` — null or integer

**Asset Statuses:**
- `Ready` — Default; full effect
- `Compromised` — Half effect; may add complication to any action using it
- `Reduced` — Half effect; no automatic complication
- `Unavailable` — Cannot be used; can be restored with a significant Action
- `Unknown` — Unavailable and status indeterminate; requires investigation Action

**Default Assets (20 total):**

| Asset | Category | Key Benefit |
|-------|----------|-------------|
| Hardware Security Module (HSM) | Hardware | +10% to crypto key actions; adversary can never crit against HSM-protected encryption |
| Secured Backup Server | Hardware | Offline backups immune to network attacks; restoring requires 4-segment Clock |
| Network Packet Broker | Hardware | Log Analysis failures become Complications instead |
| Backup Power Generation | Hardware | Infrastructure rolls to restore power can never be worse than Risky |
| Satellite Communications | Hardware | Ignore first complication from loss of communications |
| Physical Access Control System (PACS) | Hardware | +10% to Site Security & Access Control rolls for lockdowns |
| Emergency Medical / Trauma Kits | Hardware | Trauma First Aid failures become Complications instead |
| Endpoint Detection & Response (EDR) | Software | +10% Threat Hunting & Digital Forensics; can remotely isolate endpoint as Desperate action |
| Security Info & Event Mgmt (SIEM) | Software | Enables SIEM Operation and multi-source Log Analysis; without it, multi-source log actions are auto-Desperate with Limited Effect |
| Next-Gen Firewall (NGFW) | Software | +10% to block/segment actions; resist external network intrusion for 1 Focus |
| Vulnerability Scanner | Software | Enables proactive scanning; success reveals exploitable weaknesses |
| Static App Security Testing (SAST) | Software | During Debrief: AppSec roll to "patch" discovered vulnerability for rest of scenario |
| Advanced Sandbox | Software | +10% Malware Analysis; auto-reveals basic network indicators without roll |
| Threat Intelligence Feed | Service | Once/scenario: ask GM one specific question about adversary TTPs; GM must answer truthfully |
| 3rd-Party IR Retainer | Service | Once/scenario: spend 3 Focus for outside experts — auto Full Success on one technical action |
| External Legal Counsel | Service | +10% to Legal Counsel and Regulatory Compliance rolls |
| Private Security Guard Force | Service | +10% to Site Security & Access Control and Evidence Preservation; resist physical intrusion for 1 Focus |
| Zero Trust Architecture | Policy | Spend 1 Focus to declare a segment was micro-segmented, blocking one lateral movement consequence |
| Incident Response Plan (IRP) | Policy | First use of Team Coordination or Executive Comms is auto Full Success |
| Business Continuity Plan (BCP) | Policy | First use of Business Continuity skill to activate is auto Full Success |
| Emergency Action Plan (EAP) | Policy | First use of Active Threat Response or Mass Care & Sheltering starts from Controlled Position |
| Security Behavior & Culture Program | Policy | Once/scenario: negate one complication caused by employee error |

### `clock`
A visual progress tracker for threats, objectives, or escalating events.

Fields:
- `name` — Label (e.g., "Adversary Achieves Persistence", "Data Fully Exfiltrated")
- `segments` — Total segments: 4, 6, or 8
- `filled` — Number of filled segments (0 to segments)
- `owner` — ID of Actor this clock is attached to (or null for global)
- `consequence` — What happens when the clock fills

### `effect`
A lasting narrative modifier on an entity.

Fields:
- `name` — Label (e.g., "Obfuscation", "Burned Out", "Network Isolated")
- `source` — Who or what created it
- `modifier` — Numeric TN modifier (positive or negative)
- `description` — Narrative description of what the effect represents
- `duration` — Permanent | Rounds (number) | Until Cleared

---

## Core Mechanics

### The Action Roll (d100 Roll-Under)

1. Player declares an Action with a clear goal and justification
2. GM sets base **Position** → determines base Target Number (TN)
3. Player may include relevant Skills or Assets in their Action narrative
4. GM applies any positive modifiers (max 2: Skills, Assets, Help, Focus, beneficial Effects)
5. GM applies negative modifiers (max 2: Stress is always first if applicable, then harmful Effects or obstacles)
6. Player rolls d100 — must roll **equal to or under** final TN to succeed
7. GM adjudicates result based on magnitude

### Position (5-Level System — Standard)

| Position | Base TN | Description |
|----------|---------|-------------|
| Dominant | 80% | Acting from a position of overwhelming strength |
| Advantaged | 65% | Proactive, well-planned, with tools and time |
| Stable | 50% | Standard active incident; success and failure equally plausible |
| Contested | 35% | Reacting under pressure, facing real opposition |
| Compromised | 20% | At a severe disadvantage; high chance of failure and severe consequences |

### Position (3-Level System — Optional Skills/Assets Emphasis Rules)

| Position | Base TN | Description |
|----------|---------|-------------|
| Controlled | 60% | Strength, proper tools, minimal opposition |
| Risky | 40% | Default for active incident; tense and uncertain |
| Desperate | 20% | Extreme pressure, improvising, deep in hostile territory |

In this optional mode, Skills directly relevant to the action grant **+10% TN** and Assets grant **+10% TN**.

### Rule of Two (TN Modifiers)

- Maximum **2 positive modifiers** (+5% to +15% each): relevant Skill, relevant Asset, Help from another player, spending Focus, a beneficial Effect
- Maximum **2 negative modifiers** (-5% to -20% each): Stress (always applied first), harmful Effect, significant obstacle

### Degrees of Success

| Result | Roll Condition | Outcome |
|--------|---------------|---------|
| Critical Success | Roll ≤ TN/2 | Exceptional outcome; may recover 1 Focus, reduce 1 Stress |
| Full Success | Roll ≤ TN | Goal achieved cleanly |
| Complication (Success with Cost) | Roll ≤ TN + 20 (but > TN) | Goal achieved but with a complication; roll d100: on 51+ gain 1 Stress |
| Failure | Roll > TN + 20 | Goal not achieved; gain 1 Stress |
| Critical Failure | Roll > 90 (or similar extreme) | Spectacular failure; gain 2 Stress; severe consequences |

*(Note: The exact Complication/Failure boundary thresholds should be confirmed in the final rules. The framework is intentionally designed to avoid "whiff factor" by making Complication a "fail forward" result.)*

---

## Focus

- **Starting pool:** Individuals = 5, Teams = 10
- **Separate pools** — cannot be shared between actors
- **Spending Focus:**
  - +10% TN: spend 1 Focus
  - +20% TN: spend 2 Focus (maximum per roll)
  - Resist a consequence: GM sets cost (1–3 Focus) after a complication or failure
  - Activate a Contingency: spend 1–3 Focus (GM sets cost) to retroactively establish a preparatory action
- **Burned Out:** When Focus reaches 0; cannot spend Focus to enhance rolls (may still spend to resist consequences or activate Contingencies)
- **Regaining Focus:** Critical Success; specific narrative actions designed to recover Focus (e.g., mandated rest)

---

## Stress

- **Gaining Stress:**
  - Failure → +1 Stress
  - Critical Failure → +2 Stress
  - Complication → roll d100: on 51+, +1 Stress
- **Effect:** Each Stress point applies -10% penalty to all subsequent Action Roll TNs
- **Burned Out:** At 6 Stress, cannot spend Focus to enhance performance
- **Reducing Stress:** GM may award -1 Stress on successive successes; Critical Success may reduce by 1

---

## Clocks

Clocks are the primary tool for representing escalating threats and timed objectives. They are circles divided into 4, 6, or 8 segments. The GM fills segments based on adversary actions, failed rolls, or the passage of time. When a clock fills completely, a significant narrative event triggers.

Use Clocks to:
- Represent adversary progress (e.g., "Data Exfiltration: 6 segments")
- Represent rescue/restoration progress (e.g., "Restore Backup: 4 segments")
- Create time pressure when discussion stalls (advance a Clock to force decisions)
- Represent cascading effects and dependencies

---

## Contingencies

A special use of Focus. A player may spend 1–3 Focus (GM sets cost) to declare a retroactive preparatory action. This does not grant automatic success — it retroactively establishes a narrative truth that improves the Team's Position for the next Action Roll.

**Training value:** During the Debrief, the GM should highlight Contingency moments and ask: "What real-world process would make this preparatory action standard practice?"

---

## Scenario Phases

### Pre-Exercise

**Phase 0: Configuration** (GM + Sponsor + 1 technical resource)
- Identify threat/adversary profile
- Identify participant list
- Build Individual/Team character sheets
- Identify relevant Assets
- Review existing Incident Response Plan
- Build the "Business Resilience Dashboard" (subway map of critical processes and dependencies)

**Phase 1: Build the Gameboard**
- Design VTT scene(s): network map, geo map, business process flow, system status dashboard, building map
- Use layers for granularity; use colors (Green/Yellow/Red) for status; add Clock UI elements
- Define health states for critical nodes in plain business language before exercise begins

### Exercise Session

**Phase 2: Briefing**
- GM presents initial situation (known intelligence, environment state, objectives)
- GM presents first key decision point and probing question
- Review player sheets with participants

**Phase 3: Execution** (Rounds)
Each Round:
1. **Player Planning** — GM describes current situation; players discuss strategy
2. **Declare Actions** — Each player declares action; Adversary secretly declares to GM
3. **Resolve Actions** — GM sets Position/TN; players roll; all actions simultaneous unless stated otherwise
4. **Narration** — GM synthesizes all results into a cohesive situation update including time elapsed (time is flexible: could be minutes, hours, or days per round depending on action scope)

**Phase 4: Debrief (After-Action Review)**
- Outcome summary (was threat contained? data lost? business impact?)
- Key decision analysis: Focus/Contingency moments, Asset value, critical choices
- Lessons Learned: 1–3 actionable insights per exercise
- Mechanical rewards: bonus starting Focus, free Asset, new Skill — or recognition awards for one-off exercises

### Post-Exercise

**Phase 5: Reporting**
- Formalize Phase 3 results
- Include specific mitigation steps for identified gaps
- May include revisions to IRP, policies, and procedures

---

## GM Role & Tips

- **Be a fan of the players** — present a formidable challenge but root for them to succeed through cleverness
- **Drive narrative forward** — every failure is a complication, not a dead end
- **Use Clocks to create urgency** — advance a Clock when discussion stalls rather than directly confronting players
- **Paraphrase and confirm** before rolling — "So to confirm, you're wiping the server accepting the outage. Right?"
- **Consequence Menu** (when roll fails or complicates):
  - Start a Clock (new threat begins)
  - Inflict Stress
  - Worsen Position
  - Reduce Effect (partial success)
  - Lose an Opportunity (approach must change)
  - Damage an Asset (Compromised status)
- **Manage dominant participants** — acknowledge and redirect; parking lot for tangential points
- **Engage quiet participants** — use Player Sheets to target expertise with role-specific questions
- **Don't over-plan** — for a 4-hour workshop, plan ~2.5 hours of content; the rest will be consumed by discussion

---

## Individual/Team Interaction

- A **Leadership Individual** may use their Action to direct a **Team**, improving that Team's Position on the subsequent Action Roll (e.g., from Contested to Stable)
- The Individual only makes an Action Roll if the Team is not represented by another participant
- The **Team** makes the actual execution roll using their own Skills, Assets, and Focus
- Unclear or conflicting direction grants no benefit or worsens Position

---

## Acquiring Skills and Assets During Play

- Skills and Assets are set during **Phase 0** and remain static during the exercise
- Custom Skills and Assets can be created collaboratively (GM has final say)
- Good skill scope: specific enough to matter, broad enough to be used regularly (e.g., "Log Analysis" not "Cisco Firewall Log Analysis")
- Good asset scope: grants meaningful mechanical benefit without being a "solve everything" button

---

## Foundry VTT File Structure

```
ttxworks/
  system.json              ← Manifest
  ttxworks.mjs             ← Entry point (Hooks.once "init")
  module/
    data-models.mjs        ← TypeDataModel subclasses
    documents.mjs          ← Actor/Item subclasses
    sheets/
      individual-sheet.mjs
      team-sheet.mjs
      adversary-sheet.mjs
      node-sheet.mjs
      skill-sheet.mjs
      asset-sheet.mjs
      clock-sheet.mjs
  templates/
    actor/
      individual-sheet.hbs
      team-sheet.hbs
      adversary-sheet.hbs
      node-sheet.hbs
    item/
      skill-sheet.hbs
      asset-sheet.hbs
      clock-sheet.hbs
      effect-sheet.hbs
  styles/
    ttxworks.css
  lang/
    en.json
  packs/
    skills/                ← Pre-built skill compendium (all 37 default skills)
    assets/                ← Pre-built asset compendium (all 20 default assets)
```

---

## Key system.json Settings

```json
{
  "id": "ttxworks",
  "title": "TTXWorks: A Narrative Framework for Tabletop Exercises",
  "initiative": "1d100",
  "grid": { "distance": 5, "units": "ft" },
  "primaryTokenAttribute": "focus",
  "secondaryTokenAttribute": "stress",
  "documentTypes": {
    "Actor": {
      "individual": {},
      "team": {},
      "adversary": {},
      "node": {}
    },
    "Item": {
      "skill": {},
      "asset": {},
      "clock": {},
      "effect": {}
    }
  }
}
```

---

## Key Design Decisions for Claude Code

- **All rolls are d100 roll-under.** The target number is always the ceiling; rolling equal to or under is a success.
- **Position is the GM's primary tool** — it should be fast to set and easy to modify based on narrative context.
- **The Action Roll UI** should show: current TN, modifiers applied, final TN, and the roll result interpreted into the Degrees of Success table.
- **Focus and Stress are the most important UI elements** on player sheets — they should be prominently displayed and easy to update.
- **Clocks are a first-class UI element** — they should appear on the gameboard as visual segmented circles that the GM can fill/empty in real time.
- **Asset status** (Ready/Compromised/Reduced/Unavailable/Unknown) must be easy for the GM to change mid-exercise.
- **The Adversary sheet** should be GM-only (not visible to players).
- **The gameboard** is the beating heart of the exercise — it is not a secondary feature; it IS the exercise interface.
- **Multi-level scenes** using Foundry Levels module are preferred for complex organizations (hardware layer, data layer, business impact layer).

---

## Source Document

Framework document: `TTXWorks_Framework_for_Tabletop_Exercises_v3.docx`
Attribution: Inspired by *Blades in the Dark* (One Seven Design / John Harper), licensed under Creative Commons Attribution 3.0 Unported. Also informed by NIMS/FEMA doctrine and ASIS International standards.
