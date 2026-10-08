import test from "node:test";
import assert from "node:assert/strict";
import { calculate, formatNumber } from "../calculator.js";

test("uses standard operator precedence", () => {
  assert.equal(calculate("2 + 3 * 4"), 14);
});

test("handles parentheses and unary signs", () => {
  assert.equal(calculate("-(2 + 3) * 4"), -20);
  assert.equal(calculate("(-8) / -2"), 4);
});

test("supports percentages and display operators", () => {
  assert.equal(calculate("200 × 15%"), 30);
  assert.equal(calculate("8 ÷ 2"), 4);
  assert.equal(calculate("8 − 3"), 5);
});

test("formats floating point noise for display", () => {
  assert.equal(formatNumber(calculate("0.1 + 0.2")), "0.3");
  assert.equal(formatNumber(-0), "0");
});

test("supports scientific notation when continuing a large or tiny result", () => {
  assert.equal(calculate("1e+15 + 2"), 1_000_000_000_000_002);
  assert.equal(calculate("2.5e-7 * 2"), 5e-7);
});

test("rejects malformed, unsafe, or unbounded input", () => {
  for (const input of ["", "1 +", "2 ** 3", "1/0", "alert(1)", "9".repeat(121)]) {
    assert.throws(() => calculate(input), undefined, `expected rejection for ${input.slice(0, 18)}`);
  }
});
