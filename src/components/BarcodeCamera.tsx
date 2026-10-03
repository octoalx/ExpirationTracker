import { useEffect, useRef, useState } from "react";
import { startBarcodeCamera } from "@/lib/barcode-camera";

interface Props { onDetected: (barcode: string) => void; onClose: () => void }

/** Decode locally; camera frames are never uploaded. */
export default function BarcodeCamera({ onDetected, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Запускаем камеру…");
  const callbacks = useRef({ onDetected, onClose });
  callbacks.current = { onDetected, onClose };
  useEffect(() => {
    const fail = (error: unknown) => {
      setMessage(error instanceof DOMException && error.name === "NotAllowedError"
          ? "Доступ к камере запрещён. Разрешите его в браузере или введите код вручную."
          : error instanceof DOMException && error.name === "NotFoundError"
            ? "Камера не найдена. Введите штрих-код вручную."
            : error instanceof Error ? error.message : "Не удалось запустить камеру");
    };
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fail(new Error("Для камеры откройте сайт по HTTPS. Можно ввести штрих-код вручную."));
      return;
    }
    if (!video.current) return;
    const stop = startBarcodeCamera({ video: video.current, mediaDevices: navigator.mediaDevices,
      onDetected: barcode => callbacks.current.onDetected(barcode), onError: fail,
      onReady: () => setMessage("Наведите заднюю камеру на штрих-код целиком. Держите телефон неподвижно."),
    });
    const hide = () => { if (document.hidden) { stop(); callbacks.current.onClose(); } };
    document.addEventListener("visibilitychange", hide);
    return () => { stop(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  return <div className="space-y-2 rounded-xl border border-slate-200 p-3">
    <video ref={video} muted playsInline autoPlay aria-label="Камера для сканирования штрих-кода" className="max-h-64 w-full rounded-lg bg-black object-contain" />
    <p role="status" className="text-sm text-slate-600">{message}</p>
    <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Закрыть камеру</button>
  </div>;
}
