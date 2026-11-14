import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(path, "utf8");
const screen = read("src/components/CatalogImport.tsx");
const styles = read("src/styles/globals.css");

/** Declarations of one CSS rule, e.g. `.primary-action:disabled`. */
function ruleDeclarations(source: string, selector: string): Record<string, string> {
  const start = source.indexOf(`${selector} {`);
  assert.ok(start >= 0, `rule ${selector} exists`);
  const body = source.slice(source.indexOf("{", start) + 1, source.indexOf("}", start));
  return Object.fromEntries(body.split(";").map(part => part.split(":")).filter(pair => pair.length === 2).map(([prop, value]) => [prop.trim(), value.trim()]));
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("the Catalog tab takes only the goods.dbf + barcode.dbf pair", () => {
  assert.equal((screen.match(/type="file"/g) ?? []).length, 2, "exactly two file inputs");
  assert.equal((screen.match(/accept="\.dbf"/g) ?? []).length, 2, "both accept DBF only");
  assert.ok(!/\.csv|\.xlsx?|parseCatalogCsv|parseExcelFile/i.test(screen), "no CSV or Excel path");
  assert.ok(screen.includes("Сохранить каталог"), "the save action is kept");
  assert.ok(!screen.includes("Проверить файлы"), "no separate preview step");
});

test("saving uploads the pair in parts through the chunked routes; the browser does not parse DBF", () => {
  for (const step of ["init", "chunk", "status", "finalize"]) {
    assert.ok(screen.includes(`/api/admin/catalog-upload/${step}`), `${step} route is used`);
  }
  assert.ok(screen.includes("buildCatalogUploadBody"), "the framed body is built from the files");
  assert.ok(screen.includes("planChunks"), "the body is cut into parts");
  assert.ok(!screen.includes("catalog-dbf"), "no browser DBF parser or worker");
  assert.ok(!screen.includes("Worker("), "no worker");
  const callers = sources("src").filter(path => /\/api\/admin\/catalog-upload/.test(read(path)));
  assert.deepEqual(callers, [join("src", "components", "CatalogImport.tsx")]);
});

test("every response is read with its status and checked for JSON before parsing", () => {
  assert.ok(screen.includes('headers.get("content-type")'), "content type is checked");
  assert.ok(screen.includes("Код ответа ${response.status}"), "non-JSON answers show the status code");
  assert.ok(screen.includes("413"), "a 413 gets its own message");
  assert.ok(screen.indexOf("isJson") < screen.indexOf("JSON.parse(text)"), "JSON is parsed only after the check");
});

test("failures report how many records are confirmed and that repeating the pair is safe", () => {
  assert.ok(screen.includes("Подтверждено записей"), "confirmed count is shown");
  assert.ok(screen.includes("дубликаты не появятся"), "retry safety is stated");
});

test("a saved catalog clears both file inputs, not only their React state", () => {
  assert.equal((screen.match(/ref=\{(goods|barcode)Input\}/g) ?? []).length, 2, "both inputs are bound to a ref");
  assert.ok(/goodsInput\.current\.value = ""/.test(screen), "the goods input value is reset");
  assert.ok(/barcodeInput\.current\.value = ""/.test(screen), "the barcode input value is reset");
  const reset = screen.indexOf("setGoodsFile(null); setBarcodeFile(null);");
  assert.ok(reset > 0, "the file state is cleared after a successful import");
  assert.ok(screen.indexOf('goodsInput.current.value = ""') > reset, "the inputs are cleared together with the state");
});

test("a disabled save button is neutral; the wait cursor means work in progress", () => {
  const disabled = ruleDeclarations(styles, ".primary-action:disabled");
  assert.equal(disabled.cursor, "not-allowed", "a disabled primary action shows a plain cursor");
  assert.equal(ruleDeclarations(styles, '.primary-action[data-busy="true"]:disabled').cursor, "wait", "only a busy button shows the wait cursor");
  assert.equal(ruleDeclarations(styles, ".primary-action:disabled:hover").background, "#1554b5", "hover keeps the disabled background");
  assert.ok(screen.includes("data-busy={busy}"), "the save button marks its busy state");
});
