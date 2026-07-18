import assert from "node:assert/strict";
import test from "node:test";
import { findMatchingTransfer, parseTronTransfers } from "../src/lib/tronscan.ts";

const receiver = "TBGVxoH2Sc6MVHmMtjRsAUZitTQxGEUZUG";
const contract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

test("normalizes TRONSCAN token transfer payloads", () => {
  const transfers = parseTronTransfers({
    token_transfers: [
      {
        transaction_id: "abc",
        to_address: receiver,
        contract_address: contract,
        quant: "9990001",
        block_ts: 1780000000000,
        tokenInfo: { tokenDecimal: 6 },
      },
    ],
  });

  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].txHash, "abc");
  assert.equal(transfers[0].amountUnits, 9_990_001);
});

test("matches only receiver, contract, amount, and timestamp", () => {
  const payload = {
    data: [
      {
        transactionHash: "wrong-amount",
        transferToAddress: receiver,
        contractAddress: contract,
        amount: "9.990000",
        timestamp: 1780000000000,
      },
      {
        transactionHash: "right",
        transferToAddress: receiver,
        contractAddress: contract,
        amount: "9.990001",
        timestamp: 1780000001000,
      },
    ],
  };

  const match = findMatchingTransfer(payload, {
    receiverAddress: receiver,
    contractAddress: contract,
    expectedAmountUnits: 9_990_001,
    minTimestamp: 1780000000000,
  });

  assert.equal(match?.txHash, "right");
});
