// Maestro 2.x `runScript` evaluates the file as JavaScript (no shell, no
// top-level await, no shell builtins) — a busy loop is the portable sleep.
const __t = Date.now();
// eslint-disable-next-line no-empty -- busy loop IS the sleep
while (Date.now() - __t < 5000) {}
