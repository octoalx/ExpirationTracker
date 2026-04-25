import React, { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, ImagePlus, SwitchCamera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

type Tab = "camera" | "image";

const SCANNER_ELEMENT_ID = "scanner-viewport";

const ScannerModal: React.FC<ScannerModalProps> = ({
  open,
  onClose,
  onScanSuccess,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("camera");
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasScannedRef = useRef(false);

  const stopCamera = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {
      // ignore
    }
  }, []);

  const startCamera = useCallback(
    async (cameraId: string) => {
      if (!scannerRef.current) return;
      setIsStarting(true);
      setError(null);
      try {
        await stopCamera();
        await scannerRef.current.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.7778,
          },
          (decodedText) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;
            onScanSuccess(decodedText);
          },
          undefined,
        );
      } catch (err: any) {
        setError(
          err?.message?.includes("NotAllowed")
            ? "Доступ к камере запрещён. Разрешите доступ в настройках браузера."
            : "Не удалось запустить камеру.",
        );
      } finally {
        setIsStarting(false);
      }
    },
    [onScanSuccess, stopCamera],
  );

  // Init scanner & enumerate cameras
  useEffect(() => {
    if (!open) return;
    hasScannedRef.current = false;

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    Html5Qrcode.getCameras()
      .then((devices) => {
        setCameras(devices);
        if (devices.length > 0 && activeTab === "camera") {
          startCamera(devices[0].id);
        }
      })
      .catch(() => {
        setError("Камеры не найдены или доступ запрещён.");
      });

    return () => {
      stopCamera().then(() => {
        try {
          scanner.clear();
        } catch {
          // ignore
        }
      });
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Switch tabs
  useEffect(() => {
    if (!open) return;
    if (activeTab === "camera" && cameras.length > 0) {
      startCamera(cameras[activeCameraIdx]?.id ?? cameras[0].id);
    } else {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSwitchCamera = () => {
    if (cameras.length < 2) return;
    const nextIdx = (activeCameraIdx + 1) % cameras.length;
    setActiveCameraIdx(nextIdx);
    startCamera(cameras[nextIdx].id);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    setError(null);
    try {
      await stopCamera();
      const result = await scannerRef.current.scanFile(file, true);
      onScanSuccess(result);
    } catch {
      setError("Штрих-код не найден на изображении. Попробуйте другое фото.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold">Сканировать штрих-код</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("camera")}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "camera"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Camera className="size-4" />
            Камера
          </button>
          <button
            onClick={() => setActiveTab("image")}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "image"
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <ImagePlus className="size-4" />
            Загрузить фото
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Camera viewport — always in DOM so html5-qrcode can attach */}
          <div
            className={activeTab === "camera" ? "block" : "hidden"}
          >
            <div
              id={SCANNER_ELEMENT_ID}
              className="overflow-hidden rounded-xl bg-black"
            />
            {isStarting && (
              <div className="flex items-center justify-center gap-2 pt-4 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Запуск камеры…
              </div>
            )}
            {cameras.length > 1 && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSwitchCamera}
                >
                  <SwitchCamera className="mr-1.5 size-4" />
                  Переключить камеру
                </Button>
              </div>
            )}
          </div>

          {/* Image upload */}
          {activeTab === "image" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <label
                htmlFor="barcode-image"
                className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 px-8 py-10 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30"
              >
                <ImagePlus className="size-10 text-slate-400" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Нажмите для загрузки фото
                </span>
                <span className="text-xs text-slate-400">
                  JPG, PNG — со штрих-кодом
                </span>
              </label>
              <input
                id="barcode-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScannerModal;
