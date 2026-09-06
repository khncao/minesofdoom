#!/usr/bin/env node
// Boot an Android AVD (with a window, no audio) and run the dev app on it.
//
//   node scripts/run-android-avd.mjs <avd>   boot <avd> (if not already running),
//                                            wait for boot, then run
//                                            `npm run android -- -d <serial>`
//   node scripts/run-android-avd.mjs --stop  kill every running emulator
//
// The AVD names match the ones on this machine (`emulator -list-avds`):
//   mines-play-35                             (phone, API 35 + Google APIs)
//   MinesTablet7                               (7" tablet)
//   MinesTablet10                              (10" tablet)
// Stopping the task only stops Metro/gradle — the emulator keeps running
// (use `--stop` / the "Android: stop all emulators" VS Code task).
import { spawn, execFile } from "node:child_process";
import path from "node:path";
import os from "node:os";

const SDK =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), "AppData", "Local", "Android", "Sdk");
const ADB = path.join(SDK, "platform-tools", "adb.exe");
const EMULATOR = path.join(SDK, "emulator", "emulator.exe");

const adb = (args) =>
  new Promise((resolve) =>
    execFile(ADB, args, (err, stdout) =>
      resolve(err ? null : stdout.toString())
    )
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Serials of emulators that are currently in the "device" state. */
const runningEmulators = async () => {
  const out = (await adb(["devices"])) ?? "";
  const serials = [];
  for (const line of out.split("\n")) {
    const [serial, state] = line.trim().split(/\s+/);
    if (serial && serial.startsWith("emulator-") && state === "device") {
      serials.push(serial);
    }
  }
  return serials;
};

const waitForBoot = async (serial) => {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const state = await adb(["-s", serial, "shell", "getprop", "sys.boot_completed"]);
    if (state?.trim() === "1") return;
    await sleep(2_000);
  }
  throw new Error(`emulator ${serial} did not finish booting in 180s`);
};

const avdNameOf = async (serial) =>
  (await adb(["-s", serial, "emu", "avd", "name"]))?.trim();

/** Serial of a running emulator with this AVD name, or null. */
const findAvd = async (avd) => {
  for (const serial of await runningEmulators()) {
    if ((await avdNameOf(serial)) === avd) return serial;
  }
  return null;
};

const runOn = async (avd) => {
  let serial = await findAvd(avd);
  if (!serial) {
    console.log(`Booting ${avd} (no audio)...`);
    const emu = spawn(EMULATOR, ["-avd", avd, "-no-audio"], {
      stdio: "ignore",
      detached: true,
    });
    emu.unref();
    const bootDeadline = Date.now() + 180_000;
    while (Date.now() < bootDeadline) {
      serial = await findAvd(avd);
      if (serial) break;
      await sleep(2_000);
    }
    if (!serial) throw new Error(`no ${avd} emulator appeared within 180s`);
    console.log(`Waiting for ${serial} to finish booting...`);
    await waitForBoot(serial);
    console.log(`Booted: ${serial}`);
  } else {
    console.log(`Reusing ${avd} on ${serial}`);
  }

  // `-d` is the AVD NAME (expo matches it against `emulator -list-avds` /
  // connected emulators), not the adb serial.
  // Windows: npm is npm.cmd and can't be spawned directly (EINVAL) — go
  // through the shell.
  const child = spawn("npm", ["run", "android", "--", "-d", avd], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const forward = (code, sig) => () => process.exit(code ?? (sig ? 1 : 0));
  child.on("exit", forward);
  // Ctrl+C in the task terminal: kill Metro before exiting.
  process.on("SIGINT", () => {
    child.kill("SIGINT");
    setTimeout(() => process.exit(130), 1_500);
  });
};

const stopAll = async () => {
  const serials = await runningEmulators();
  if (serials.length === 0) {
    console.log("No emulators running.");
    return;
  }
  for (const serial of serials) {
    await adb(["-s", serial, "emu", "kill"]);
    console.log(`Killed ${serial}`);
  }
};

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/run-android-avd.mjs <avd> | --stop");
  process.exit(1);
}
if (arg === "--stop") {
  stopAll();
} else {
  runOn(arg).catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
