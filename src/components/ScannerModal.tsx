// components/scanner/ScannerModal.tsx
import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScannerState } from 'html5-qrcode';

interface ScannerModalProps {
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const ScannerModal: React.FC<ScannerModalProps> = ({ onClose, onScanSuccess }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Ensure the scanner is only created once
    if (scannerRef.current) {
      return;
    }

    const scanner = new Html5QrcodeScanner(
      'reader', // ID of the container element
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false, // verbose mode
    );

    const handleScanSuccess = (decodedText: string) => {
      onScanSuccess(decodedText);
    };

    scanner.render(handleScanSuccess, undefined);
    scannerRef.current = scanner;

    return () => {
      // Cleanup: clear the scanner on component unmount
      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.clear().catch(error => {
          console.error('Failed to clear html5-qrcode-scanner.', error);
        });
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 rounded-full bg-gray-200 p-2 text-gray-600 hover:bg-gray-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="mb-4 text-center text-xl font-semibold">Scan Barcode</h2>
        <div id="reader" className="w-full"></div>
      </div>
    </div>
  );
};

export default ScannerModal;
