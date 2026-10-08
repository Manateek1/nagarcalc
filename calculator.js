const MAX_EXPRESSION_LENGTH = 120;
const MAX_TOKEN_COUNT = 80;

export function calculate(expression) {
  if (typeof expression !== "string" || expression.length === 0 || expression.length > MAX_EXPRESSION_LENGTH) {
    throw new Error("Expression is empty or too long.");
  }

  const normalized = expression.replace(/[×]/g, "*").replace(/[÷]/g, "/").replace(/[−]/g, "-");
  const tokens = tokenize(normalized);
  let position = 0;

  function peek() {
    return tokens[position];
  }

  function consume(expected) {
    const token = peek();
    if (expected !== undefined && token?.value !== expected) {
      throw new Error("Unexpected token.");
    }
    position += 1;
    return token;
  }

  function parseExpression() {
    let value = parseTerm();
    while (peek()?.value === "+" || peek()?.value === "-") {
      const operator = consume().value;
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parseUnary();
    while (["*", "/"].includes(peek()?.value)) {
      const operator = consume().value;
      const right = parseUnary();
      if (operator === "/" && right === 0) throw new Error("Division by zero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseUnary() {
    if (peek()?.value === "+") {
      consume("+");
      return parseUnary();
    }
    if (peek()?.value === "-") {
      consume("-");
      return -parseUnary();
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (peek()?.value === "%") {
      consume("%");
      value /= 100;
    }
    return value;
  }

  function parsePrimary() {
    const token = peek();
    if (!token) throw new Error("A number is missing.");
    if (token.type === "number") {
      consume();
      return token.value;
    }
    if (token.value === "(") {
      consume("(");
      const value = parseExpression();
      consume(")");
      return value;
    }
    throw new Error("Expected a number.");
  }

  const result = parseExpression();
  if (position !== tokens.length) throw new Error("There is extra math after the answer.");
  if (!Number.isFinite(result)) throw new Error("That number is too powerful.");
  return result;
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) throw new Error("Result is not finite.");
  if (Object.is(value, -0)) return "0";
  return Number(value.toPrecision(12)).toString();
}

function tokenize(input) {
  const tokens = [];
  let index = 0;

  while (index < input.length) {
    if (/\s/.test(input[index])) {
      index += 1;
      continue;
    }

    const numberMatch = input.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      const raw = numberMatch[0];
      if (raw.replace(".", "").length > 16) throw new Error("That number is too long.");
      tokens.push({ type: "number", value: Number(raw) });
      index += raw.length;
    } else if ("+-*/()%".includes(input[index])) {
      tokens.push({ type: "operator", value: input[index] });
      index += 1;
    } else {
      throw new Error("Use numbers and basic math symbols only.");
    }

    if (tokens.length > MAX_TOKEN_COUNT) throw new Error("That is a lot of math. Try a shorter one.");
  }

  return tokens;
}
