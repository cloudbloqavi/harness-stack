import { describe, it, expect } from "vitest";
import { run } from "../src/foundation/exec.js";

describe("run(): subprocess result", () => {
  it("returns the real exit code on normal completion", async () => {
    const ok = await run("node", ["-e", "process.exit(0)"]);
    expect(ok.code).toBe(0);
    const bad = await run("node", ["-e", "process.exit(3)"]);
    expect(bad.code).toBe(3);
  });

  it("reports FAILURE (not success) when a command times out and is killed", async () => {
    // Sleeps 10s but is capped at 100ms → SIGKILL → close with code === null.
    const res = await run("node", ["-e", "setTimeout(() => {}, 10000)"], {
      timeoutMs: 100,
    });
    expect(res.code).not.toBe(0); // must never coerce a killed process to success
    expect(res.code).toBe(124); // conventional timeout exit code
    expect(res.stderr).toContain("timed out");
  });

  it("returns 127 when the binary cannot be spawned", async () => {
    const res = await run("this-binary-does-not-exist-xyz", []);
    expect(res.code).toBe(127);
  });
});
