import { Toaster } from "react-hot-toast";

/** Global toast notification provider with emerald-themed styling. */
export default function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: "0.75rem",
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(16, 185, 129, 0.2)",
          color: "#0f172a",
          fontSize: "0.875rem",
          fontWeight: "500",
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(16,185,129,0.1)",
          padding: "10px 16px",
        },
        success: {
          iconTheme: {
            primary: "#059669",
            secondary: "#ffffff",
          },
        },
        error: {
          iconTheme: {
            primary: "#dc2626",
            secondary: "#ffffff",
          },
        },
      }}
    />
  );
}
