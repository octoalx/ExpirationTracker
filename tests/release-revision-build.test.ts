import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The running image must report the revision it was built from, because the deploy
 * health check compares that answer with the revision it promoted. On 2026-11-13 the
 * image reported the previous release instead: `COPY . .` came after the line that
 * wrote `BUILD_REVISION`, so the host's stale `.release-version` overwrote the
 * argument and every deploy rolled back. These tests keep the order and the
 * `.dockerignore` entry from drifting back.
 */
const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");

test(".release-version never enters the build context", () => {
  const entries = dockerignore.split(/\r?\n/).map((line) => line.trim());
  assert.ok(entries.includes(".release-version"), ".dockerignore must exclude .release-version");
});

test("BUILD_REVISION is written after the context copy in the builder stage", () => {
  const builder = dockerfile.slice(0, dockerfile.indexOf("Stage 3"));
  const copyIndex = builder.lastIndexOf("COPY . .");
  const writeIndex = builder.search(/RUN rm -f \.release-version/);
  assert.notEqual(copyIndex, -1, "builder stage must copy the context");
  assert.notEqual(writeIndex, -1, "builder stage must write .release-version");
  assert.ok(
    writeIndex > copyIndex,
    "RUN writing .release-version must come after COPY . . — otherwise the copied host marker wins",
  );
});

test("the runner stage copies the marker the builder wrote", () => {
  assert.match(
    dockerfile,
    /COPY --from=builder \/app\/\.release-version \.\/\.release-version/,
    "runner stage must take .release-version from the builder",
  );
});
