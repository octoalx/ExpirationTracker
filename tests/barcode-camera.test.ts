import test from "node:test";
import assert from "node:assert/strict";
import { startBarcodeCamera } from "../src/lib/barcode-camera";

const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture() {
  const events: string[] = [], results: string[] = [], errors: unknown[] = [];
  const track = { stop: () => events.push("track-stop"), getCapabilities: () => ({ focusMode: ["continuous"] }), applyConstraints: async () => { events.push("focus"); } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  const video = { srcObject: null, play: async () => { events.push("preview"); } } as unknown as HTMLVideoElement;
  const options = { video, mediaDevices: { getUserMedia: async () => { events.push("camera"); return stream; } },
    onDetected: (code: string) => results.push(code), onReady: () => events.push("ready"), onError: (error: unknown) => errors.push(error) };
  return { events, results, errors, stream, video, options };
}

test("camera preview and optional focus start before decoder download completes", async () => {
  const f = fixture();
  const decoder = deferred<any>();
  const stop = startBarcodeCamera({ ...f.options, reader: () => { f.events.push("decoder-load"); return decoder.promise; } });
  await flush();
  assert.deepEqual(f.events, ["camera", "decoder-load", "preview", "focus"]);
  decoder.resolve({ decodeFromStream: async () => ({ stop: () => f.events.push("decoder-stop") }) });
  await flush();
  assert.equal(f.events.at(-1), "ready");
  stop();
  assert.equal(f.video.srcObject, null);
  assert.ok(f.events.includes("track-stop"));
  assert.ok(f.events.includes("decoder-stop"));
});

test("closing during permission prompt releases a late camera stream without decoding", async () => {
  const f = fixture(), camera = deferred<MediaStream>();
  const stop = startBarcodeCamera({ ...f.options, mediaDevices: { getUserMedia: () => camera.promise },
    reader: async () => ({ decodeFromStream: async () => { throw new Error("Must not decode"); } }) });
  stop(); camera.resolve(f.stream); await flush();
  assert.deepEqual(f.events, ["track-stop"]);
  assert.deepEqual(f.errors, []);
});

test("closing during decoder startup releases late controls and suppresses callbacks", async () => {
  const f = fixture(), controls = deferred<{ stop(): void }>();
  let callback: any;
  const stop = startBarcodeCamera({ ...f.options, reader: async () => ({ decodeFromStream: (_stream, _video, cb) => { callback = cb; return controls.promise; } }) });
  await flush(); stop();
  callback({ getText: () => "4607015330124" }, undefined, { stop() {} });
  controls.resolve({ stop: () => f.events.push("decoder-stop") }); await flush();
  assert.ok(f.events.includes("decoder-stop"));
  assert.deepEqual(f.results, []);
  assert.ok(!f.events.includes("ready"));
});

test("scanner ignores invalid codes, emits one valid result and releases camera", async () => {
  const f = fixture(); let callback: any;
  const controls = { stop: () => f.events.push("decoder-stop") };
  const stop = startBarcodeCamera({ ...f.options, reader: async () => ({ decodeFromStream: async (_s, _v, cb) => { callback = cb; return controls; } }) });
  await flush();
  callback({ getText: () => "letters" }, undefined, controls);
  assert.deepEqual(f.results, []);
  callback({ getText: () => "4607015330124" }, undefined, controls);
  callback({ getText: () => "4607015330124" }, undefined, controls);
  assert.deepEqual(f.results, ["4607015330124"]);
  assert.equal(f.video.srcObject, null); stop();
});

test("decoder failure releases stream; rejected autofocus still permits scanning", async () => {
  const f = fixture();
  const error = new Error("Decoder unavailable");
  startBarcodeCamera({ ...f.options, reader: async () => { throw error; } });
  await flush();
  assert.deepEqual(f.errors, [error]);
  assert.ok(f.events.includes("track-stop"));
  const g = fixture();
  g.stream.getVideoTracks()[0].applyConstraints = async () => { throw new Error("Focus unavailable"); };
  const stop = startBarcodeCamera({ ...g.options, reader: async () => ({ decodeFromStream: async () => ({ stop() {} }) }) });
  await flush();
  assert.deepEqual(g.errors, []);
  assert.ok(g.events.includes("ready")); stop();
});
