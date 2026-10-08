import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/overview.js";

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("rejects non-POST requests", async () => {
  const res = mockResponse();
  await handler({ method: "GET", headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("validates math on the server before calling the AI", async () => {
  const res = mockResponse();
  await handler({ method: "POST", headers: {}, body: { expression: "1/0" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid math/i);
});

test("requires the server-side API key", async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const res = mockResponse();
  await handler({ method: "POST", headers: {}, body: { expression: "8*5" } }, res);
  assert.equal(res.statusCode, 503);
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
});

test("caps AI commentary at five lines and computes its own answer", async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  const savedFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-key";
  let sentBody;
  globalThis.fetch = async (_url, options) => {
    sentBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "One\nTwo\nThree\nFour\nFive\nSix" }] } }] }),
    };
  };

  try {
    const res = mockResponse();
    await handler({ method: "POST", headers: { "x-forwarded-for": `test-${Date.now()}` }, body: { expression: "6*7", result: "999" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.result, "42");
    assert.equal(res.body.overview.split("\n").length, 5);
    assert.match(sentBody.contents[0].parts[0].text, /Correct answer: 42/);
    assert.equal(sentBody.contents[0].parts[0].text.includes("999"), false);
    assert.equal(sentBody.generationConfig.thinkingConfig.thinkingLevel, "low");
    assert.equal("temperature" in sentBody.generationConfig, false);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
  }
});

test("turns upstream errors into a generic response without exposing credentials", async () => {
  const savedKey = process.env.GEMINI_API_KEY;
  const savedFetch = globalThis.fetch;
  const savedError = console.error;
  process.env.GEMINI_API_KEY = "test-key";
  console.error = () => {};
  globalThis.fetch = async () => ({ ok: false, status: 400 });

  try {
    const res = mockResponse();
    await handler({ method: "POST", headers: { "x-forwarded-for": `error-${Date.now()}` }, body: { expression: "4*9" } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.upstreamStatus, 400);
    assert.equal(JSON.stringify(res.body).includes("test-key"), false);
  } finally {
    globalThis.fetch = savedFetch;
    console.error = savedError;
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
  }
});
