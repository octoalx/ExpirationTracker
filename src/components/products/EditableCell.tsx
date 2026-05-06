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
    inputRef.current?.focus();
    inputRef.current?.select();
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
    // Small delay to allow click events to process
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
        "h-8 px-2 py-1 text-sm",
        "border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20",
        "animate-in fade-in zoom-in-95 duration-150"
      )}
    />
  );
}
