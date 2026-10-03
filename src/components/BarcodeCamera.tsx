import { useEffect, useRef, useState } from "react";

interface Props { onDetected: (barcode: string) => void; onClose: () => void }

/** Decode locally; camera frames are never uploaded. */
export default function BarcodeCamera({ onDetected, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Запускаем камеру…");
  useEffect(() => {
    let cancelled = false, detected = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    const stop = () => {
      controls?.stop();
      stream?.getTracks().forEach(track => track.stop());
    };
    const start = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Для камеры откройте сайт по HTTPS. Можно ввести штрих-код вручную.");
        }
        const { BrowserMultiFormatOneDReader } = await import("@zxing/browser");
        if (cancelled) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        if (cancelled || !video.current) { stop(); return; }
        const reader = new BrowserMultiFormatOneDReader(undefined, { delayBetweenScanAttempts: 250 });
        controls = await reader.decodeFromStream(stream, video.current, (result, _error, activeControls) => {
          if (!result || cancelled || detected) return;
          const barcode = result.getText();
          if (!/^\d{8,14}$/.test(barcode)) return;
          detected = true;
          activeControls.stop();
          stream?.getTracks().forEach(track => track.stop());
          onDetected(barcode);
        });
        if (cancelled || detected) { stop(); return; }
        setMessage("Наведите заднюю камеру на штрих-код. Держите телефон неподвижно.");
      } catch (error) {
        stop();
        if (!cancelled) setMessage(error instanceof DOMException && error.name === "NotAllowedError"
          ? "Доступ к камере запрещён. Разрешите его в браузере или введите код вручную."
          : error instanceof DOMException && error.name === "NotFoundError"
            ? "Камера не найдена. Введите штрих-код вручную."
            : error instanceof Error ? error.message : "Не удалось запустить камеру");
      }
    };
    const hide = () => { if (document.hidden) { stop(); onClose(); } };
    document.addEventListener("visibilitychange", hide);
    void start();
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", hide); };
  }, [onDetected, onClose]);
  return <div className="space-y-2 rounded-xl border border-slate-200 p-3">
    <video ref={video} muted playsInline autoPlay aria-label="Камера для сканирования штрих-кода" className="max-h-48 w-full rounded-lg bg-black object-cover" />
    <p role="status" className="text-sm text-slate-600">{message}</p>
    <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Закрыть камеру</button>
  </div>;
}
