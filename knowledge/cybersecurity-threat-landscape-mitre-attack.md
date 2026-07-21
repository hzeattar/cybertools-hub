# Threat Landscape Overview: MITRE ATT&CK Framework

This document summarizes the **MITRE ATT&CK®** framework for defensive threat modeling
and detection engineering. MITRE ATT&CK is licensed under **Apache License 2.0** and made
freely available for use with attribution.
Source: https://attack.mitre.org/ (MITRE Corporation, ATT&CK®).
This summary is rephrased and condensed for internal assistant use, with attribution
to MITRE as required by the license.

## Purpose

ATT&CK is a knowledge base of adversary tactics and techniques observed in real-world
attacks. Defenders use it to: build detection coverage maps, prioritize hardening,
and communicate incidents in a common vocabulary.

## The 14 Enterprise Tactics (the "why" of an action)

1. **Reconnaissance** -- gathering information to plan future operations.
2. **Resource Development** -- establishing infrastructure/capabilities.
3. **Initial Access** -- gaining an initial foothold (phishing, exploiting public-facing apps, valid accounts).
4. **Execution** -- running attacker-controlled code.
5. **Persistence** -- maintaining access across restarts/credential changes.
6. **Privilege Escalation** -- gaining higher-level permissions.
7. **Defense Evasion** -- avoiding detection.
8. **Credential Access** -- stealing account names/passwords.
9. **Discovery** -- learning about the environment.
10. **Lateral Movement** -- moving through the environment.
11. **Collection** -- gathering data of interest.
12. **Command and Control** -- communicating with compromised systems.
13. **Exfiltration** -- stealing data.
14. **Impact** -- manipulating, interrupting, or destroying systems/data.

## How Defenders Use This (detection-first framing)

- **Coverage mapping**: for each tactic, list which of your logs/tools would detect a technique in that category (EDR, network IDS, cloud audit logs, WAF). Gaps here are your highest-priority monitoring investments.
- **Prioritization**: not all techniques are equally likely for your environment/industry -- prioritize detections for the initial-access and execution techniques most relevant to your actual attack surface (public web apps, exposed APIs, phishing-prone staff).
- **Incident narrative**: when writing a post-incident report, tag each observed action with its ATT&CK tactic/technique ID -- this makes reports comparable across incidents and over time.
- **Table-top exercises**: simulate a specific technique chain (e.g. phishing -> credential access -> lateral movement -> exfiltration) and verify at each stage whether your team would actually detect and respond in time.

## Common High-Value Detections for Web/Cloud Platforms

- Unusual authentication patterns: impossible travel, repeated MFA prompts (MFA fatigue), login from new ASN/country for privileged accounts.
- Anomalous API/database query volume (possible discovery or exfiltration in progress).
- New or modified scheduled tasks/cron jobs/webhooks (common persistence technique).
- Outbound connections to newly-registered or rare domains (possible C2).
- Privilege changes to service accounts or API keys outside of a change-management window.

This document is for defensive detection engineering and incident-response planning
only. It intentionally does not include exploit code, payloads, or step-by-step
attack instructions.
