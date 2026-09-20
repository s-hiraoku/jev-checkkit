import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonEqual } from "../src/index.js";

test("jsonEqual treats object key order as irrelevant and distinguishes 1 from \"1\"", () => {
  assert.equal(jsonEqual({ a: 1, b: true }, { b: true, a: 1 }), true);
  assert.equal(jsonEqual(1, "1"), false);
  assert.equal(jsonEqual({ a: null }, { a: undefined }), false);
  assert.equal(jsonEqual([1, { x: 2 }], [1, { x: 2 }]), true);
  assert.equal(jsonEqual([1, { x: 2 }], [1, { x: 3 }]), false);
});
