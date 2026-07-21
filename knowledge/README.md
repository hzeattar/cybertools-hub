# CyberTools AI Knowledge Base

Curated reference documents to enrich RAG / Agent Knowledge for CyberTools AI.

## Contents & Licensing

| File | Source | License |
|---|---|---|
| `devops-docker-railway-playbook.md` | Original, written for this project | Same as repository |
| `secure-coding-php-laravel-vue-node.md` | Original, written for this project | Same as repository |
| `business-trading-analysis-framework.md` | Original, written for this project | Same as repository |
| `owasp-defensive-security-summary.md` | Summarized from OWASP Cheat Sheet Series | CC BY-SA 4.0, attributed to OWASP (https://cheatsheetseries.owasp.org/) |

No proprietary, leaked, or third-party copyrighted material is included. Only original
content and explicitly permissively-licensed (CC BY-SA) material with attribution.

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
