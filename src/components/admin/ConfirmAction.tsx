"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmActionProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  /** Red confirmation for an irreversible action; other confirmations take the accent. */
  danger?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

const DANGER_ACTION =
  "dialog-action-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-expired px-4 text-[15px] font-semibold text-white transition-colors hover:bg-dash-expired/90 disabled:opacity-55";

/**
 * The admin panel asks before anything irreversible. The dialog replaces the
 * browser's confirm/prompt and keeps the same outcome: the action runs only
 * after the button is pressed.
 */
export default function ConfirmAction({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  danger = false,
  children,
  onCancel,
  onConfirm,
}: ConfirmActionProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="work-panel product-dialog product-entry sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-[13px] font-medium leading-5 text-dash-ink-2">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        {children}
        <div className="product-dialog-actions">
          <button type="button" className="dialog-action-secondary" onClick={onCancel} disabled={busy}>
            Отмена
          </button>
          <button
            type="button"
            className={danger ? DANGER_ACTION : "dialog-action-primary primary-action gap-2 text-[15px]"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
