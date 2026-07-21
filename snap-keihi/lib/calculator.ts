export type CalcOperator = "+" | "−" | "×" | "÷";

const OPERATORS: CalcOperator[] = ["+", "−", "×", "÷"];

function isOperator(ch: string): ch is CalcOperator {
  return (OPERATORS as string[]).includes(ch);
}

function apply(a: number, op: CalcOperator, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
  }
}

// Evaluates a plain left-to-right expression like "1200+350×2" (no operator
// precedence, matching how a basic calculator reads button presses back).
// Returns null if the expression has no complete number to evaluate.
export function evaluateExpression(expr: string): number | null {
  const tokens = expr.match(/\d+(\.\d+)?|[+−×÷]/g);
  if (!tokens || tokens.length === 0) return null;

  let result = Number(tokens[0]);
  if (isOperator(tokens[0]) || !Number.isFinite(result)) return null;

  for (let i = 1; i < tokens.length - 1; i += 2) {
    const op = tokens[i];
    const next = Number(tokens[i + 1]);
    if (!isOperator(op) || !Number.isFinite(next)) break;
    result = apply(result, op, next);
  }

  return Number.isFinite(result) ? result : null;
}

// Appends a key press to a calculator display string, keeping it a valid
// expression (no leading operator, no two operators in a row).
export function pressKey(expr: string, key: string): string {
  if (key === "C") return "";
  if (key === "back") return expr.slice(0, -1);

  if (isOperator(key)) {
    if (expr === "") return "";
    if (isOperator(expr[expr.length - 1])) return expr.slice(0, -1) + key;
    return expr + key;
  }

  if (key === ".") {
    const lastNumber = expr.split(/[+−×÷]/).pop() ?? "";
    if (lastNumber.includes(".")) return expr;
    return expr + (lastNumber === "" ? "0." : ".");
  }

  // digit
  return expr + key;
}
