import React, { useEffect, useRef } from 'react';
import Html5Qrcode from 'html5-qrcode';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanError }) => {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!scannerRef.current) return;

    html5QrcodeRef.current = new Html5Qrcode(scannerRef.current.id);

    const startScanning = async () => {
      try {
        await html5QrcodeRef.current?.start(
          'user', // Use 'user' for front camera, 'environment' for back camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScanSuccess(decodedText);
            // Optionally stop scanning after first success
            // html5QrcodeRef.current?.stop().catch(err => console.error("Stop failed:", err));
          },
          (errorMessage) => {
            if (onScanError) {
              onScanError(errorMessage);
            }
          }
        );
      } catch (err) {
        console.error("Error starting scanner:", err);
        if (onScanError) {
          onScanError("Failed to start scanner. Please check camera permissions.");
        }
      }
    };

    startScanning();

    // Cleanup on component unmount
    return () => {
      html5QrcodeRef.current?.stop().then(() => {
        console.log("Scanner stopped.");
      }).catch(err => {
        console.error("Error stopping scanner:", err);
      });
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div
      ref={scannerRef}
      id="reader"
      style={{ width: '100%', height: '100%' }}
    ></div>
  );
};

export default BarcodeScanner;
