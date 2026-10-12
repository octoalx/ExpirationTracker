interface ScanControls { stop: () => void }
interface BarcodeReader {
  decodeFromStream: (stream: MediaStream, video: HTMLVideoElement,
    callback: (result: { getText(): string } | undefined, error: unknown, controls: ScanControls) => void) => Promise<ScanControls>;
}

async function loadReader(): Promise<BarcodeReader> {
  const { BrowserMultiFormatOneDReader } = await import("@zxing/browser");
  return new BrowserMultiFormatOneDReader(undefined, { delayBetweenScanAttempts: 150 });
}

/** Start preview while the decoder loads; release even late-arriving resources. */
export function startBarcodeCamera(options: {
  video: HTMLVideoElement;
  mediaDevices: Pick<MediaDevices, "getUserMedia">;
  onDetected: (barcode: string) => void;
  onReady: () => void;
  onError: (error: unknown) => void;
  reader?: () => Promise<BarcodeReader>;
}) {
  let cancelled = false, detected = false;
  let stream: MediaStream | undefined;
  let controls: ScanControls | undefined;
  const stop = () => {
    controls?.stop();
    stream?.getTracks().forEach(track => track.stop());
    if (options.video.srcObject === stream) options.video.srcObject = null;
  };
  const start = async () => {
    try {
      const camera = options.mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 },
      } });
      // Observe decoder rejection immediately, even while a permission prompt is open.
      const decoder = (options.reader ?? loadReader)().then(reader => ({ reader }), error => ({ error }));
      stream = await camera;
      if (cancelled) { stop(); return; }
      options.video.srcObject = stream;
      await options.video.play();
      if (cancelled) { stop(); return; }
      const track = stream.getVideoTracks()[0];
      try {
        const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined;
        if (capabilities?.focusMode?.includes("continuous")) {
          // Focus is optional: unsupported/rejected controls must not block scanning.
          void track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        }
      } catch { /* Some browsers expose capability methods but reject their use. */ }
      const loaded = await decoder;
      if (cancelled) { stop(); return; }
      if ("error" in loaded) throw loaded.error;
      controls = await loaded.reader.decodeFromStream(stream, options.video, (result, _error, activeControls) => {
        if (!result || cancelled || detected) return;
        const barcode = result.getText();
        if (!/^\d{8,14}$/.test(barcode)) return;
        detected = true;
        activeControls.stop(); stop();
        options.onDetected(barcode);
      });
      if (cancelled || detected) { stop(); return; }
      options.onReady();
    } catch (error) {
      stop();
      if (!cancelled) options.onError(error);
    }
  };
  void start();
  return () => { cancelled = true; stop(); };
}
