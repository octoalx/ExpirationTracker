import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import handler from "../src/pages/api/version";
import { readRunningRevision } from "../src/lib/server/revision";

function withRevision(content: string | null, run: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "revision-"));
  try {
    if (content !== null) writeFileSync(join(dir, ".release-version"), content);
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function call(method: string) {
  const res = {
    code: 200,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; return this; },
    status(code: number) { this.code = code; return this; },
    json(data: unknown) { this.data = data; return this; },
    data: undefined as unknown,
  };
  handler({ method } as never, res as never);
  return res;
}

test("the running revision is the one baked into the image", () => {
  withRevision("13ffef3bc8afa88f70520b65c09999c4d1105bee\n", (dir) => {
    assert.equal(readRunningRevision(dir), "13ffef3bc8afa88f70520b65c09999c4d1105bee", "AC1: trimmed, unchanged");
  });
});

test("a missing or empty marker reports unknown instead of throwing", () => {
  withRevision(null, (dir) => {
    assert.equal(readRunningRevision(dir), "unknown", "AC3: no marker is unknown, not a crash");
  });
  withRevision("   \n", (dir) => {
    assert.equal(readRunningRevision(dir), "unknown", "AC3: an empty marker is unknown");
  });
});

test("a released image reports an immutable revision, never a host working-tree file", () => {
  // Once the file is baked into the image at build time, the process can no longer
  // fall back to whatever is in the container's working directory: on the host that
  // directory is the checkout, and its marker is rewritten by the next deploy.
  const source = readFileSync("src/lib/server/revision.ts", "utf8");
  assert.match(source, /process\.cwd\(\)/, "AC1: the revision is read from the image working directory");
  assert.match(source, /unknown/, "AC3: no marker means unknown, not a crash");
});

test("the endpoint answers without a session and without caching", () => {
  withRevision("abc123\n", (dir) => {
    const previous = process.cwd();
    process.chdir(dir);
    try {
      const res = call("GET");
      assert.equal(res.code, 200, "AC1: no session required");
      assert.deepEqual(res.data, { revision: "abc123" }, "AC1: it reports the baked revision and nothing else");
      assert.equal(res.headers["Cache-Control"], "no-store", "AC1: a cached answer would defeat the check");
      assert.equal(call("HEAD").code, 200, "AC1: the deploy check may use HEAD");
      const post = call("POST");
      assert.equal(post.code, 405, "AC1: read-only");
      assert.deepEqual(post.headers["Allow"], ["GET", "HEAD"]);
    } finally {
      process.chdir(previous);
    }
  });
});
