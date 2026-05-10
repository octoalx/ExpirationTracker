"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditableCellProps {
  value: string;
  type?: "text" | "date" | "number";
  onSave: (value: string) => void;
  onCancel: () => void;
}

/** Inline editable cell with Enter/Escape/blur handling. */
export function EditableCell({
  value,
  type = "text",
  onSave,
  onCancel,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      savedRef.current = true;
      onSave(editValue);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      savedRef.current = true;
      onCancel();
    }
  };

  const handleBlur = () => {
    // Delay to let pending click events settle before auto-saving
    setTimeout(() => {
      if (!savedRef.current) {
        onSave(editValue);
      }
    }, 150);
  };

  return (
    <Input
      ref={inputRef}
      type={type}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn(
        "h-8 w-full min-w-0 px-2 py-1 text-sm",
        "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20",
        "animate-in fade-in zoom-in-95 duration-150"
      )}
    />
  );
}
