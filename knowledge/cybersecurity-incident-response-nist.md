# Incident Response Lifecycle (based on NIST SP 800-61)

This document summarizes the incident-response lifecycle from **NIST Special
Publication 800-61 (Computer Security Incident Handling Guide)**, a work of the
U.S. federal government and in the **public domain** in the United States, freely
reusable. Source: https://csrc.nist.gov/pubs/sp/800/61/r2/final (NIST).
This is a rephrased, condensed summary for internal assistant use.

## The Four Phases

### 1. Preparation
- Maintain an incident-response plan with clear roles (who declares an incident, who communicates externally, who has authority to take systems offline).
- Ensure logging/monitoring coverage exists *before* an incident (you cannot investigate what you didn't log).
- Keep contact lists (internal escalation, hosting provider, legal, PR) current and accessible even if primary systems are down.
- Run periodic table-top exercises so the plan is tested under low-stakes conditions.

### 2. Detection & Analysis
- Establish a low-friction way for staff/users to report suspicious activity.
- Correlate signals across sources (auth logs, WAF, EDR, cloud audit logs) rather than relying on a single alert.
- Document a timeline as you investigate: first indicator, scope of affected systems/accounts, suspected entry point, ongoing impact.
- Classify severity early (data exposure? service outage? financial impact?) to right-size the response.

### 3. Containment, Eradication & Recovery
- **Short-term containment**: isolate affected systems/accounts without destroying evidence (e.g. disable an account rather than wiping a server immediately).
- **Evidence preservation**: snapshot logs/disks before remediation where feasible -- needed for root-cause analysis and potential legal/compliance obligations.
- **Eradication**: remove the actual root cause (revoke compromised credentials/keys, patch the exploited weakness, remove persistence mechanisms) -- not just the visible symptom.
- **Recovery**: restore from known-good backups/images, rotate all credentials that may have been exposed, and monitor closely for recurrence before declaring the incident closed.

### 4. Post-Incident Activity
- Write a blameless post-mortem: timeline, root cause, what worked, what didn't, concrete follow-up actions with owners and dates.
- Update detection rules based on what was missed during the incident.
- Update the incident-response plan itself if gaps were found in the process (not just the technical fix).

## Severity Triage Quick Reference

| Signal | Likely Severity |
|---|---|
| Single failed login attempts, no lateral movement | Low -- monitor |
| Confirmed unauthorized access to non-sensitive system | Medium -- contain and investigate |
| Confirmed access to sensitive data or production credentials | High -- activate full IR plan, consider legal/compliance notification |
| Active data exfiltration or ransomware encryption in progress | Critical -- immediate containment, executive/legal involvement |

## Key Principle

Speed matters, but **evidence-destroying panic** (wiping systems before understanding
scope) often costs more than a short, disciplined containment step. Contain first,
understand second, eradicate third, recover fourth.

This document describes response process only; it does not include exploit code or
offensive techniques.
