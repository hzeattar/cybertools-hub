import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, signSessionValue, verifyPassword, verifySessionValue } from "../src/lib/auth-crypto.ts";

test("password hashes verify only the original password", async () => {
  const hash = await hashPassword("CorrectHorse123!");
  assert.equal(await verifyPassword("CorrectHorse123!", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("signed session values reject tampering", () => {
  const signed = signSessionValue("session-token");
  assert.equal(verifySessionValue(signed), "session-token");
  assert.equal(verifySessionValue(`${signed}tampered`), null);
});
