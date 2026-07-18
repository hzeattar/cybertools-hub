import { getUsdtContract, USDT_DECIMALS, USDT_UNIT } from "./payment.ts";

export type NormalizedTronTransfer = {
  txHash: string;
  toAddress: string;
  contractAddress: string;
  amountUnits: number;
  timestamp: number;
  confirmed: boolean;
};

type TransferMatch = {
  receiverAddress: string;
  expectedAmountUnits: number;
  contractAddress?: string;
  minTimestamp?: number;
};

function normalizeAddress(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toUnits(value: unknown, decimals: number) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Math.round(value * USDT_UNIT);
  }

  const text = String(value ?? "").trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) return Number(text);
  if (/^\d+\.\d+$/.test(text)) {
    const [whole, fraction] = text.split(".");
    const normalized = fraction.padEnd(decimals, "0").slice(0, decimals);
    return Number(whole) * 10 ** decimals + Number(normalized);
  }
  return 0;
}

export function normalizeTronTransfer(input: Record<string, unknown>): NormalizedTronTransfer | null {
  const tokenInfo = (input.tokenInfo ?? input.token_info ?? {}) as Record<string, unknown>;
  const txHash =
    input.transaction_id ?? input.transactionId ?? input.transactionHash ?? input.hash ?? input.txHash ?? input.txid;
  const toAddress =
    input.to_address ?? input.transferToAddress ?? input.toAddress ?? input.to ?? input.receiver_address ?? input.to_address_tag;
  const contractAddress =
    input.contract_address ??
    input.contractAddress ??
    tokenInfo.tokenId ??
    tokenInfo.tokenID ??
    tokenInfo.contract_address ??
    tokenInfo.address;
  const timestamp = input.block_ts ?? input.block_timestamp ?? input.timestamp ?? input.time ?? input.confirmed_at;
  const decimals = Number(tokenInfo.tokenDecimal ?? tokenInfo.decimals ?? input.decimals ?? USDT_DECIMALS);
  const amount = input.quant ?? input.amount_str ?? input.amount ?? input.value ?? input.tokenAmount ?? input.quantity;

  if (!txHash || !toAddress || !contractAddress || !timestamp) return null;

  return {
    txHash: String(txHash),
    toAddress: normalizeAddress(toAddress),
    contractAddress: normalizeAddress(contractAddress),
    amountUnits: toUnits(amount, decimals || USDT_DECIMALS),
    timestamp: Number(timestamp),
    confirmed: input.confirmed !== false && input.revert !== true,
  };
}

export function parseTronTransfers(payload: unknown) {
  const data = payload as Record<string, unknown>;
  const candidates =
    (Array.isArray(data.token_transfers) && data.token_transfers) ||
    (Array.isArray(data.data) && data.data) ||
    (Array.isArray(data.transfers) && data.transfers) ||
    (Array.isArray(payload) && payload) ||
    [];

  return candidates
    .map((item) => normalizeTronTransfer(item as Record<string, unknown>))
    .filter((item): item is NormalizedTronTransfer => Boolean(item));
}

export function findMatchingTransfer(payload: unknown, match: TransferMatch) {
  const contract = match.contractAddress ?? getUsdtContract();
  return parseTronTransfers(payload).find((transfer) => {
    const timestampOk = match.minTimestamp ? transfer.timestamp >= match.minTimestamp : true;
    return (
      transfer.confirmed &&
      transfer.toAddress === match.receiverAddress &&
      transfer.contractAddress === contract &&
      transfer.amountUnits === match.expectedAmountUnits &&
      timestampOk
    );
  });
}

export async function fetchRecentUsdtTransfers(address: string) {
  const base = process.env.TRONSCAN_API_BASE ?? "https://apilist.tronscanapi.com";
  const contract = getUsdtContract();
  const url = new URL("/api/token_trc20/transfers", base);
  url.searchParams.set("limit", "50");
  url.searchParams.set("start", "0");
  url.searchParams.set("sort", "-timestamp");
  url.searchParams.set("relatedAddress", address);
  url.searchParams.set("contract_address", contract);

  const headers: HeadersInit = {
    accept: "application/json",
  };
  if (process.env.TRONSCAN_API_KEY) {
    headers["TRON-PRO-API-KEY"] = process.env.TRONSCAN_API_KEY;
  }

  const response = await fetch(url, { headers, next: { revalidate: 0 } });
  if (!response.ok) {
    throw new Error(`TRONSCAN returned ${response.status}`);
  }
  return response.json();
}
