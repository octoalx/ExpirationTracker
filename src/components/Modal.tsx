import { X } from "lucide-react";
import { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md transition-opacity">
      <div className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 p-6 transform transition-all">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-800"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}
