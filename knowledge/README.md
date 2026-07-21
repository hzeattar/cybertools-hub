# CyberTools AI Knowledge Base

Curated reference documents to enrich RAG / Agent Knowledge for CyberTools AI.

## Contents & Licensing

| File | Source | License |
|---|---|---|
| `devops-docker-railway-playbook.md` | Original, written for this project | Same as repository |
| `secure-coding-php-laravel-vue-node.md` | Original, written for this project | Same as repository |
| `business-trading-analysis-framework.md` | Original, written for this project | Same as repository |
| `owasp-defensive-security-summary.md` | Summarized from OWASP Cheat Sheet Series | CC BY-SA 4.0, attributed to OWASP (https://cheatsheetseries.owasp.org/) |
| `cybersecurity-threat-landscape-mitre-attack.md` | Summarized from MITRE ATT&CK® | Apache License 2.0, attributed to MITRE (https://attack.mitre.org/) |
| `cybersecurity-vulnerability-classes-cwe-top25.md` | Summarized from CWE Top 25 | MITRE/CISA, freely reusable, attributed (https://cwe.mitre.org/top25/) |
| `cybersecurity-incident-response-nist.md` | Summarized from NIST SP 800-61 | U.S. government work, public domain (https://csrc.nist.gov/pubs/sp/800/61/r2/final) |
| `cloud-network-security-hardening.md` | Original, written for this project | Same as repository |

No proprietary, leaked, or third-party copyrighted material is included. Only original
content and explicitly permissively-licensed / public-domain material with attribution.
All cybersecurity documents are strictly defensive (hardening, detection, incident
response) -- none contain exploit code, malware, or offensive/attack instructions.

## How to Use These as Permanent RAG Knowledge

LibreChat's RAG indexes files per-conversation by default (upload via the paperclip
button, then ask about it -- it gets embedded into pgvector and cited in answers).

To make this knowledge **permanent** and available across conversations, attach these
files to an **Agent**:

1. Open the app -> **Agents** -> **Create Agent** (or edit an existing one).
2. Under **Knowledge**, click **Upload** and add the `.md` files from this folder.
3. Enable **File Search** capability for the agent.
4. Save. Any conversation using that agent will now retrieve and cite this knowledge
   automatically, without re-uploading each time.

You can add your own company documents (sales reports, internal wikis, runbooks) the
same way -- just keep the total size reasonable so retrieval stays fast and relevant.
