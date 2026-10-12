"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Search, Plus, Pencil, Power, Trash2 } from "lucide-react";
import { Card, Select, Input, Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

export interface AdminColumn<T> {
  key: Extract<keyof T, string>;
  label: string;
  render?: (row: T) => ReactNode;
}

export interface AdminFilterOption {
  value: string;
  label: string;
  parkId?: string;
  buildingId?: string;
  [key: string]: any;
}

export interface AdminFilter {
  key: string;
  label: string;
  options: AdminFilterOption[];
  value?: string;
  onChange?: (value: string) => void;
}

interface Props<T> {
  title: string;
  apiBase: string;
  listKey: string;
  columns: AdminColumn<T>[];
  filters?: AdminFilter[];
  searchPlaceholder?: string;
  getId: (row: T) => string;
  getStatus?: (row: T) => boolean;
  statusFieldLabel?: string;
  onDelete?: (row: T) => Promise<{ ok: boolean; error?: string }>;
  deleteLabel?: string;
  renderForm: (props: { record: T | null; onDone: () => void; onCancel: () => void }) => ReactNode;
  pageSize?: number;
  newLabel?: string;
}

export function AdminListPage<T>({
  title,
  apiBase,
  listKey,
  columns,
  filters = [],
  searchPlaceholder = "Search…",
  getId,
  getStatus,
  statusFieldLabel = "record",
  onDelete,
  deleteLabel = "record",
  renderForm,
  pageSize = 20,
  newLabel = "+ New",
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<T | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<T | null>(null);
  const [toggling, setToggling] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q.trim()) params.set("q", q.trim());
    for (const [k, v] of Object.entries(filterValues)) if (v) params.set(k, v);

    try {
      const res = await fetch(`${apiBase}?${params.toString()}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      setRows(body[listKey] ?? []);
      setTotal(body.total ?? (body[listKey]?.length ?? 0));
    } catch {
      setError("Could not load this data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, JSON.stringify(filterValues)]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleToggleStatus() {
    if (!confirmTarget || !getStatus) return;
    setToggling(true);
    const current = getStatus(confirmTarget);
    try {
      const res = await fetch(`${apiBase}/${getId(confirmTarget)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      if (!res.ok) throw new Error();
      setConfirmTarget(null);
      load();
    } catch {
      setError("Could not update status.");
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !onDelete) return;
    setDeleting(true);
    const result = await onDelete(deleteTarget);
    setDeleting(false);
    if (result.ok) {
      setDeleteTarget(null);
      load();
    } else {
      setError(result.error ?? "Could not delete this record.");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="font-display font-bold text-2xl">{title}</div>
        <Button
          onClick={() => {
            setEditingRecord(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> {newLabel}
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute top-3 left-3 text-brand-gray" />
            <Input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder={searchPlaceholder}
              className="ps-9"
            />
          </div>
          {filters.map((f) => (
            <Select
              key={f.key}
              value={f.value ?? filterValues[f.key] ?? ""}
              onChange={(e) => {
                const value = e.target.value;

                setPage(1);

                if (f.onChange) {
                  f.onChange(value);
                }

                setFilterValues((prev) => ({
                  ...prev,
                  [f.key]: value,
                }));
              }}
              className="w-auto min-w-[140px]"
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))}
        </div>

        {error && (
          <div className="p-3 mb-4 text-sm text-danger bg-danger/10 rounded-md border border-danger/20">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-brand-gray font-medium">
                {columns.map((c) => (
                  <th key={c.key} className="pb-3 px-2">
                    {c.label}
                  </th>
                ))}
                <th className="pb-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={columns.length + 1} className="py-6 text-center text-brand-gray">
                    …
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="py-6 text-center text-brand-gray">
                    No results.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={getId(row)}>
                    {columns.map((c) => (
                      <td key={c.key} className="py-3 px-2">
                        {c.render ? c.render(row) : String(row[c.key] ?? "")}
                      </td>
                    ))}
                    <td className="py-3 px-2">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => {
                            setEditingRecord(row);
                            setFormOpen(true);
                          }}
                          className="p-1.5 rounded-md bg-surface-soft border border-border text-brand-gray hover:text-brand-navy"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        {getStatus && (
                          <button
                            onClick={() => setConfirmTarget(row)}
                            className={`p-1.5 rounded-md border ${
                              getStatus(row)
                                ? "bg-surface-soft border-border text-brand-gray hover:text-danger"
                                : "bg-success/10 border-success/30 text-success"
                            }`}
                            title={getStatus(row) ? "Disable" : "Enable"}
                          >
                            <Power size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="p-1.5 rounded-md bg-surface-soft border border-border text-brand-gray hover:text-danger"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm text-brand-gray">
          <div>{total} total</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-md bg-surface-soft border border-border disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-md bg-surface-soft border border-border disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)}>
        {renderForm({
          record: editingRecord,
          onDone: () => {
            setFormOpen(false);
            load();
          },
          onCancel: () => setFormOpen(false),
        })}
      </Modal>

      {getStatus && (
        <ConfirmDialog
          open={!!confirmTarget}
          title={confirmTarget && getStatus(confirmTarget) ? `Disable this ${statusFieldLabel}?` : `Enable this ${statusFieldLabel}?`}
          body={
            confirmTarget && getStatus(confirmTarget)
              ? "It will be hidden from technicians and engineers. Historical data is kept."
              : "It will become visible to technicians and engineers again."
          }
          confirmLabel={confirmTarget && getStatus(confirmTarget) ? "Disable" : "Enable"}
          danger={!!(confirmTarget && getStatus(confirmTarget))}
          loading={toggling}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {onDelete && (
        <ConfirmDialog
          open={!!deleteTarget}
          title={`Delete this ${deleteLabel}?`}
          body={`سيتم حذف هذا ${deleteLabel} نهائياً. لا يمكن التراجع عن هذا الإجراء.`}          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}