"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/primitives";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div className="font-display font-bold text-lg mb-1">{title}</div>
      <div className="text-sm text-brand-gray mb-5">{body}</div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={loading}>
          {loading ? "…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
