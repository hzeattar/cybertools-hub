import { getProduct } from "@/data/catalog";

export function buildDigitalProductMarkdown(productSlug: string) {
  const product = getProduct(productSlug);
  if (!product) return null;

  const deliverables = product.deliverables.map((item) => `- ${item}`).join("\n");

  return `# ${product.name}

${product.summary}

Audience: ${product.audience}

## Deliverables

${deliverables}

## Operating Workflow

1. Read the target program policy and copy the in-scope assets into the scope worksheet.
2. Pick one asset and one test theme. Do not mix unrelated findings in the same report.
3. Capture evidence before writing the impact section.
4. Redact tokens, customer data, private keys, and third-party personal data.
5. Submit only behavior that is reproducible and allowed by the program rules.

## Report Skeleton

Summary:
Affected asset:
Vulnerability class:
Steps to reproduce:
Actual behavior:
Expected behavior:
Security impact:
Evidence:
Recommended fix:

## Notes

This digital product is a V1 generated pack from CyberTools Hub. It is designed for authorized security testing and responsible disclosure only.
`;
}
