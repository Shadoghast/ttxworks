/**
 * Generates JSON source files for TTXWorks compendium packs.
 * Run with: node scripts/generate-pack-sources.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const skillsDir = join(root, "src/packs/skills");
const assetsDir = join(root, "src/packs/assets");

mkdirSync(skillsDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });

/** Generate a Foundry-style 16-char alphanumeric ID */
function genId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Safe filename from name */
function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ============================================================
// SKILLS
// ============================================================

const skills = [
  // SecOps
  {
    name: "Incident Triage",
    category: "Security Operations (SecOps)",
    description: "<p>Rapidly assess and prioritize security incidents based on severity, scope, and business impact. Used to determine whether an event is a true incident, assign severity level, and mobilize appropriate resources.</p>",
    bonus: 10
  },
  {
    name: "Log Analysis",
    category: "Security Operations (SecOps)",
    description: "<p>Review, parse, and interpret log data from systems, networks, and applications to identify indicators of compromise, reconstruct timelines, and support forensic investigations.</p>",
    bonus: 10
  },
  {
    name: "Digital Forensics",
    category: "Security Operations (SecOps)",
    description: "<p>Collect, preserve, and analyze digital evidence from endpoints, servers, and storage media in a forensically sound manner. Supports incident reconstruction and legal proceedings.</p>",
    bonus: 10
  },
  {
    name: "SIEM Operation",
    category: "Security Operations (SecOps)",
    description: "<p>Query, tune, and operate a Security Information and Event Management platform. Build correlation rules, create dashboards, and investigate alerts at scale across the enterprise.</p>",
    bonus: 10
  },
  // Threat Intel & Hunting
  {
    name: "Threat Modeling",
    category: "Threat Intelligence & Hunting",
    description: "<p>Systematically identify and evaluate threats relevant to the organization's assets, architecture, and adversaries. Informs defensive priorities and helps anticipate adversary behavior.</p>",
    bonus: 10
  },
  {
    name: "Threat Hunting",
    category: "Threat Intelligence & Hunting",
    description: "<p>Proactively search through networks and systems for hidden threats that have evaded automated detections. Uses hypothesis-driven techniques and knowledge of adversary TTPs.</p>",
    bonus: 10
  },
  {
    name: "Malware Analysis",
    category: "Threat Intelligence & Hunting",
    description: "<p>Examine malicious code through static and dynamic analysis techniques to understand its behavior, capabilities, persistence mechanisms, and network indicators.</p>",
    bonus: 10
  },
  {
    name: "OSINT",
    category: "Threat Intelligence & Hunting",
    description: "<p>Gather and analyze publicly available information about threats, threat actors, infrastructure, and exposed organizational assets using open-source intelligence techniques.</p>",
    bonus: 10
  },
  // Engineering & Architecture
  {
    name: "Network Architecture",
    category: "Engineering & Architecture",
    description: "<p>Design, understand, and modify network topologies, segmentation strategies, and communication flows. Critical for isolating compromised segments and redirecting traffic during incidents.</p>",
    bonus: 10
  },
  {
    name: "Cloud Security",
    category: "Engineering & Architecture",
    description: "<p>Secure cloud infrastructure and services across IaaS, PaaS, and SaaS environments. Covers identity federation, misconfiguration identification, data protection, and cloud-native incident response.</p>",
    bonus: 10
  },
  {
    name: "Application Security (AppSec)",
    category: "Engineering & Architecture",
    description: "<p>Identify, assess, and remediate security vulnerabilities in software applications. Includes secure code review, web application testing, API security, and vulnerability disclosure processes.</p>",
    bonus: 10
  },
  {
    name: "Identity & Access Mgmt (IAM)",
    category: "Engineering & Architecture",
    description: "<p>Manage authentication, authorization, and access controls across the enterprise. Critical for containing incidents involving compromised credentials or privilege escalation.</p>",
    bonus: 10
  },
  {
    name: "Infrastructure Engineering",
    category: "Engineering & Architecture",
    description: "<p>Design and maintain the technical infrastructure — servers, storage, networking equipment, and supporting systems — that underpin business operations. Enables rapid reconfiguration during crises.</p>",
    bonus: 10
  },
  // IT & Systems Administration
  {
    name: "System Administration",
    category: "IT & Systems Administration",
    description: "<p>Manage and maintain operating systems, servers, and workstations. Enables isolation of compromised systems, application of patches, and restoration of services during incidents.</p>",
    bonus: 10
  },
  {
    name: "Database Management",
    category: "IT & Systems Administration",
    description: "<p>Administer, secure, and recover databases. Critical for assessing data exposure, restoring from backup, and identifying unauthorized access or exfiltration attempts.</p>",
    bonus: 10
  },
  {
    name: "Scripting & Automation",
    category: "IT & Systems Administration",
    description: "<p>Write scripts and automated workflows to accelerate incident response tasks — bulk IOC searches, log parsing, system reconfiguration, or alert triage at scale.</p>",
    bonus: 10
  },
  // GRC
  {
    name: "Policy & Standards",
    category: "Governance, Risk & Compliance (GRC)",
    description: "<p>Develop, interpret, and apply organizational security policies, standards, and procedures. Ensures response actions align with established governance frameworks and documentation requirements.</p>",
    bonus: 10
  },
  {
    name: "Risk Assessment",
    category: "Governance, Risk & Compliance (GRC)",
    description: "<p>Evaluate the likelihood and impact of threats to organizational assets. Informs prioritization decisions during incidents and helps leadership communicate business risk to stakeholders.</p>",
    bonus: 10
  },
  {
    name: "Business Continuity",
    category: "Governance, Risk & Compliance (GRC)",
    description: "<p>Plan and execute strategies to maintain essential business functions during and after disruptions. Includes BCP activation, alternate site operations, and continuity communication.</p>",
    bonus: 10
  },
  {
    name: "Regulatory Compliance",
    category: "Governance, Risk & Compliance (GRC)",
    description: "<p>Navigate applicable regulatory requirements (HIPAA, PCI-DSS, GDPR, SOX, etc.) during an incident. Ensures notifications, documentation, and response actions satisfy legal obligations.</p>",
    bonus: 10
  },
  {
    name: "Legal Counsel",
    category: "Governance, Risk & Compliance (GRC)",
    description: "<p>Apply legal expertise to incident response — attorney-client privilege, litigation hold, regulatory notification requirements, contract obligations, and law enforcement coordination.</p>",
    bonus: 10
  },
  // Leadership & Communication
  {
    name: "Incident Command",
    category: "Leadership & Communication",
    description: "<p>Lead and coordinate the overall incident response effort using structured command principles (ICS/NIMS or equivalent). Establish clear chains of command, priorities, and decision authority.</p>",
    bonus: 10
  },
  {
    name: "Team Coordination",
    category: "Leadership & Communication",
    description: "<p>Facilitate effective collaboration between technical and non-technical teams during an incident. Maintain shared situational awareness, resolve conflicts, and prevent task duplication.</p>",
    bonus: 10
  },
  {
    name: "Executive Comms",
    category: "Leadership & Communication",
    description: "<p>Communicate incident status, risk, and decision options clearly to C-suite and board stakeholders. Translate technical findings into business impact terms and provide decision-ready briefings.</p>",
    bonus: 10
  },
  {
    name: "Public Information",
    category: "Leadership & Communication",
    description: "<p>Manage external communications including press releases, social media, customer notifications, and media inquiries. Protects organizational reputation while meeting disclosure obligations.</p>",
    bonus: 10
  },
  {
    name: "Law Enforcement Liaison",
    category: "Leadership & Communication",
    description: "<p>Coordinate with law enforcement agencies (FBI, USSS, local police, etc.) during and after an incident. Navigate evidence preservation requirements and support criminal investigations.</p>",
    bonus: 10
  },
  // Emergency Management & Logistics
  {
    name: "Operational Planning",
    category: "Emergency Management & Logistics",
    description: "<p>Develop and execute structured response plans across short and long time horizons. Coordinates resource allocation, sequencing of actions, and contingency options under uncertainty.</p>",
    bonus: 10
  },
  {
    name: "Logistics Management",
    category: "Emergency Management & Logistics",
    description: "<p>Procure, track, and distribute equipment, supplies, and personnel to support incident operations. Critical during extended incidents requiring resource mobilization across locations.</p>",
    bonus: 10
  },
  {
    name: "Finance & Administration",
    category: "Emergency Management & Logistics",
    description: "<p>Track incident costs, manage emergency procurement, coordinate with insurers, and maintain financial documentation required for reimbursement, audits, and regulatory filings.</p>",
    bonus: 10
  },
  {
    name: "Damage Assessment",
    category: "Emergency Management & Logistics",
    description: "<p>Systematically evaluate the scope and severity of damage to systems, data, facilities, or people. Produces actionable estimates for recovery planning and business impact reporting.</p>",
    bonus: 10
  },
  {
    name: "Supply Chain Resilience",
    category: "Emergency Management & Logistics",
    description: "<p>Assess and mitigate risks originating from vendors, suppliers, and third-party service providers. Activates alternate supply arrangements and manages third-party incident notifications.</p>",
    bonus: 10
  },
  // Physical & Personnel Security
  {
    name: "Physical Security Systems",
    category: "Physical & Personnel Security",
    description: "<p>Operate and interpret data from physical security systems — access control, CCTV, alarms, and sensors. Supports investigations, lockdowns, and evidence collection involving physical access events.</p>",
    bonus: 10
  },
  {
    name: "Site Security & Access Control",
    category: "Physical & Personnel Security",
    description: "<p>Implement and enforce physical access controls for facilities and restricted areas. Includes lockdown procedures, visitor management, and coordination with law enforcement during physical threats.</p>",
    bonus: 10
  },
  {
    name: "Active Threat Response",
    category: "Physical & Personnel Security",
    description: "<p>Respond to active physical threats — intruders, workplace violence, or armed incidents. Coordinate evacuation, shelter-in-place, and law enforcement interface under extreme pressure.</p>",
    bonus: 10
  },
  {
    name: "Evidence Preservation",
    category: "Physical & Personnel Security",
    description: "<p>Preserve physical evidence at incident scenes in a chain-of-custody manner. Ensures physical artifacts remain admissible for law enforcement, insurance, and legal proceedings.</p>",
    bonus: 10
  },
  {
    name: "Trauma First Aid",
    category: "Physical & Personnel Security",
    description: "<p>Provide emergency medical care to injured personnel until professional medical responders arrive. Includes triage, hemorrhage control, CPR, and coordination with EMS.</p>",
    bonus: 10
  },
  {
    name: "Mass Care & Sheltering",
    category: "Physical & Personnel Security",
    description: "<p>Organize and manage care for large numbers of displaced personnel — shelter, food, water, medical support, and family reunification during extended incidents or evacuations.</p>",
    bonus: 10
  },
  {
    name: "Executive Protection",
    category: "Physical & Personnel Security",
    description: "<p>Provide security and safe movement for senior executives and key personnel during elevated threat conditions. Assess threats, coordinate secure transportation, and manage protective details.</p>",
    bonus: 10
  }
];

// ============================================================
// ASSETS
// ============================================================

const assets = [
  // Hardware
  {
    name: "Hardware Security Module (HSM)",
    category: "hardware",
    sourceDomain: "Cryptographic Key Management",
    description: "<p><strong>Benefit:</strong> +10% TN to any action involving cryptographic key operations. The adversary can never score a Critical Success against HSM-protected encryption — critical results against those actions become standard Failures instead.</p>",
    bonus: 10, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Secured Backup Server",
    category: "hardware",
    sourceDomain: "Backup & Recovery Infrastructure",
    description: "<p><strong>Benefit:</strong> Offline backups are immune to network-based attacks. Adversary cannot compromise this asset remotely. Restoring data from this backup requires completing a 4-segment Clock.</p>",
    bonus: 0, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Network Packet Broker",
    category: "hardware",
    sourceDomain: "Network Visibility & Monitoring",
    description: "<p><strong>Benefit:</strong> Log Analysis failures become Complications instead of Failures when this asset is active. The packet broker ensures complete traffic capture that catches what SIEM correlation misses.</p>",
    bonus: 0, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Backup Power Generation",
    category: "hardware",
    sourceDomain: "Facility & Infrastructure Resilience",
    description: "<p><strong>Benefit:</strong> Infrastructure rolls to restore power or maintain operations during a power failure can never result in a Desperate Position — worst case is Risky. Generators provide guaranteed baseline capability.</p>",
    bonus: 0, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Satellite Communications",
    category: "hardware",
    sourceDomain: "Alternate Communications",
    description: "<p><strong>Benefit:</strong> Ignore the first complication that would arise from loss of primary communications infrastructure. Satcom provides an out-of-band channel unaffected by network incidents or physical damage to terrestrial links.</p>",
    bonus: 0, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Physical Access Control System (PACS)",
    category: "hardware",
    sourceDomain: "Physical Security Infrastructure",
    description: "<p><strong>Benefit:</strong> +10% TN to all Site Security & Access Control rolls involving lockdowns, access revocation, or badge-reader-based investigations. Provides centralized control and audit trail of all physical access.</p>",
    bonus: 10, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Emergency Medical / Trauma Kits",
    category: "hardware",
    sourceDomain: "Medical Preparedness",
    description: "<p><strong>Benefit:</strong> Trauma First Aid failures become Complications instead of Failures. Stocked kits with tourniquets, hemostatic agents, and AEDs give responders the tools to stabilize casualties even under pressure.</p>",
    bonus: 0, usesPerScenario: null, focusCostToActivate: null
  },
  // Software
  {
    name: "Endpoint Detection & Response (EDR)",
    category: "software",
    sourceDomain: "Endpoint Protection Platform",
    description: "<p><strong>Benefit:</strong> +10% TN to Threat Hunting and Digital Forensics rolls. Once per scenario, can remotely isolate a compromised endpoint as a Desperate action (no roll needed, but costs 2 Focus and triggers a 4-segment Clock for adversary pivot attempts).</p>",
    bonus: 10, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Security Info & Event Mgmt (SIEM)",
    category: "software",
    sourceDomain: "Security Operations Platform",
    description: "<p><strong>Benefit:</strong> Enables the SIEM Operation skill and multi-source Log Analysis. Without this asset, any action requiring correlation of logs from multiple sources is automatically Desperate Position with Limited Effect.</p>",
    bonus: 0, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Next-Gen Firewall (NGFW)",
    category: "software",
    sourceDomain: "Network Security",
    description: "<p><strong>Benefit:</strong> +10% TN to actions that block, segment, or filter network traffic. Once per scene, spend 1 Focus to automatically resist one external network intrusion consequence (the NGFW catches it).</p>",
    bonus: 10, usesPerScenario: null, focusCostToActivate: 1
  },
  {
    name: "Vulnerability Scanner",
    category: "software",
    sourceDomain: "Vulnerability Management",
    description: "<p><strong>Benefit:</strong> Enables proactive vulnerability scanning. On a successful scan action, the GM must reveal one currently exploitable weakness in the environment that the adversary could target. Prevents surprise attacks from known vulnerabilities.</p>",
    bonus: 0, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Static App Security Testing (SAST)",
    category: "software",
    sourceDomain: "Application Security",
    description: "<p><strong>Benefit:</strong> During the Debrief phase, an AppSec roll using SAST can \"patch\" one discovered vulnerability for the remainder of the scenario, preventing the adversary from exploiting it again.</p>",
    bonus: 0, usesPerScenario: 1, focusCostToActivate: null
  },
  {
    name: "Advanced Sandbox",
    category: "software",
    sourceDomain: "Malware Analysis",
    description: "<p><strong>Benefit:</strong> +10% TN to Malware Analysis rolls. Additionally, any malware submitted to the sandbox automatically reveals basic network indicators of compromise (C2 IPs, domains) without requiring a roll — the GM provides this information freely.</p>",
    bonus: 10, usesPerScenario: null, focusCostToActivate: null
  },
  // Service
  {
    name: "Threat Intelligence Feed",
    category: "service",
    sourceDomain: "Threat Intelligence Services",
    description: "<p><strong>Benefit:</strong> Once per scenario, ask the GM one specific, direct question about the adversary's TTPs, tools, or objectives. The GM must answer truthfully and completely. Cannot be used to ask \"what is the adversary planning next?\" — must be specific (e.g., \"What C2 protocol is the adversary using?\").</p>",
    bonus: 0, usesPerScenario: 1, focusCostToActivate: null
  },
  {
    name: "3rd-Party IR Retainer",
    category: "service",
    sourceDomain: "Incident Response Services",
    description: "<p><strong>Benefit:</strong> Once per scenario, spend 3 Focus to call in outside IR experts. This action automatically achieves Full Success on one technical action of your choice — the retainer firm handles it. The action still takes time (advance the narrative clock).</p>",
    bonus: 0, usesPerScenario: 1, focusCostToActivate: 3
  },
  {
    name: "External Legal Counsel",
    category: "service",
    sourceDomain: "Legal & Regulatory Advisory",
    description: "<p><strong>Benefit:</strong> +10% TN to Legal Counsel and Regulatory Compliance rolls. Outside counsel provides specialized expertise in breach notification law, privilege protection, and regulatory negotiation that internal teams may lack.</p>",
    bonus: 10, usesPerScenario: null, focusCostToActivate: null
  },
  {
    name: "Private Security Guard Force",
    category: "service",
    sourceDomain: "Physical Security Services",
    description: "<p><strong>Benefit:</strong> +10% TN to Site Security & Access Control and Evidence Preservation rolls. Once per scene, spend 1 Focus to automatically resist one physical intrusion consequence — the guards intercept it.</p>",
    bonus: 10, usesPerScenario: null, focusCostToActivate: 1
  },
  // Policy
  {
    name: "Zero Trust Architecture",
    category: "policy",
    sourceDomain: "Security Architecture",
    description: "<p><strong>Benefit:</strong> Spend 1 Focus to retroactively declare that a specific network segment was micro-segmented, blocking one lateral movement consequence from occurring. Can only be used once per segment per scenario.</p>",
    bonus: 0, usesPerScenario: null, focusCostToActivate: 1
  },
  {
    name: "Incident Response Plan (IRP)",
    category: "policy",
    sourceDomain: "Incident Management",
    description: "<p><strong>Benefit:</strong> The first use of the Team Coordination or Executive Comms skill in a scenario is automatically a Full Success — no roll required. A tested, practiced plan removes uncertainty from the first critical actions.</p>",
    bonus: 0, usesPerScenario: 1, focusCostToActivate: null
  },
  {
    name: "Business Continuity Plan (BCP)",
    category: "policy",
    sourceDomain: "Business Continuity",
    description: "<p><strong>Benefit:</strong> The first use of the Business Continuity skill to activate continuity procedures is automatically a Full Success — no roll required. A documented, exercised BCP eliminates uncertainty in initial activation.</p>",
    bonus: 0, usesPerScenario: 1, focusCostToActivate: null
  },
  {
    name: "Emergency Action Plan (EAP)",
    category: "policy",
    sourceDomain: "Physical Security & Emergency Management",
    description: "<p><strong>Benefit:</strong> The first use of the Active Threat Response or Mass Care & Sheltering skill in a scenario always starts from Controlled Position (minimum), regardless of actual circumstances. A practiced EAP means responders know exactly what to do.</p>",
    bonus: 0, usesPerScenario: 1, focusCostToActivate: null
  },
  {
    name: "Security Behavior & Culture Program",
    category: "policy",
    sourceDomain: "Security Awareness & Training",
    description: "<p><strong>Benefit:</strong> Once per scenario, negate one complication that was caused by employee error — phishing click, misconfiguration, lost device, etc. A strong security culture means staff are less likely to make critical mistakes under pressure.</p>",
    bonus: 0, usesPerScenario: 1, focusCostToActivate: null
  }
];

// ============================================================
// WRITE FILES
// ============================================================

let skillCount = 0;
for (const skill of skills) {
  const id = genId();
  const doc = {
    _id: id,
    name: skill.name,
    type: "skill",
    system: {
      category: skill.category,
      description: skill.description,
      bonus: skill.bonus
    },
    img: "icons/svg/item-bag.svg",
    effects: [],
    flags: {},
    folder: null,
    sort: skillCount * 100000
  };
  const filename = join(skillsDir, `${safeName(skill.name)}_${id}.json`);
  writeFileSync(filename, JSON.stringify(doc, null, 2));
  skillCount++;
}

let assetCount = 0;
for (const asset of assets) {
  const id = genId();
  const doc = {
    _id: id,
    name: asset.name,
    type: "asset",
    system: {
      category: asset.category,
      sourceDomain: asset.sourceDomain,
      description: asset.description,
      status: "ready",
      bonus: asset.bonus,
      usesPerScenario: asset.usesPerScenario ?? null,
      usesRemaining: asset.usesPerScenario ?? null,
      focusCostToActivate: asset.focusCostToActivate ?? null
    },
    img: "icons/svg/item-bag.svg",
    effects: [],
    flags: {},
    folder: null,
    sort: assetCount * 100000
  };
  const filename = join(assetsDir, `${safeName(asset.name)}_${id}.json`);
  writeFileSync(filename, JSON.stringify(doc, null, 2));
  assetCount++;
}

console.log(`✓ Generated ${skillCount} skill source files → src/packs/skills/`);
console.log(`✓ Generated ${assetCount} asset source files → src/packs/assets/`);
