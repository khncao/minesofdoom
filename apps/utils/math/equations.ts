export type EquationSettings = {
  minNumber: number;
  maxNumber: number;
  multiply: boolean;
  add: boolean;
  subtract: boolean;
  division: boolean;
};

export const defaultEquationSettings = {
  minNumber: 0,
  maxNumber: 12,
  multiply: true,
  add: false,
  subtract: false,
  division: false,
};

export const Ops = {
  mult: "*",
  add: "+",
  sub: "-",
  div: "/",
};

export const approxeq = (v1: number, v2: number, epsilon = 0.01) =>
  Math.abs(v1 - v2) <= epsilon;

export function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export function getRandomEquation(prefs: EquationSettings) {
  const ops: Array<string> = [
    ...(prefs.multiply ? [Ops.mult] : []),
    ...(prefs.add ? [Ops.add] : []),
    ...(prefs.subtract ? [Ops.sub] : []),
    ...(prefs.division ? [Ops.div] : []),
  ];
  const opIdx = Math.floor(Math.random() * ops.length);
  const op = ops[opIdx];
  const a = getRandomInt(prefs.maxNumber);
  let b = getRandomInt(prefs.maxNumber);
  if (op === Ops.div) {
    b = Math.max(1, b);
  }
  let answer;
  switch (op) {
    case Ops.mult:
      answer = a * b;
      break;
    case Ops.add:
      answer = a + b;
      break;
    case Ops.sub:
      answer = a - b;
      break;
    case Ops.div:
      answer = Math.fround(a / b);
  }
  return { op, a, b, answer };
}
