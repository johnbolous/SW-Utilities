"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input, Select, Button } from "@/components/ui/primitives";
import { isUserRole } from "@/lib/utils/enumGuards";
import type { Enums } from "@/types/database";

type UserRole = Enums<"user_role">;
interface UserRecord {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  all_parks_access?: boolean;
  user_park_access?: { park_id: string }[];
}

interface UserCreatePayload {
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
  parkIds?: string[];
  allParksAccess?: boolean;
}

interface UserEditPayload {
  fullName: string;
  role: UserRole;
  parkIds?: string[];
  allParksAccess?: boolean;
  newPassword?: string;
}

export function UserForm({
  record,
  onDone,
  onCancel,
}: {
  record: UserRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [username, setUsername] = useState(record?.username ?? "");
  const [fullName, setFullName] = useState(record?.full_name ?? "");
  const [role, setRole] = useState<UserRole>(record?.role ?? "technician");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [parks, setParks] = useState<{ id: string; name: string }[]>([]);
  const [allParksAccess, setAllParksAccess] = useState(record?.all_parks_access ?? false);
  const [selectedParkIds, setSelectedParkIds] = useState<string[]>(
    (record?.user_park_access ?? []).map((r) => r.park_id)
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) => setParks(body.parks ?? []));
  }, []);

  function toggleTechnicianPark(parkId: string) {
    setSelectedParkIds([parkId]);
  }

  function toggleEngineerPark(parkId: string) {
    setSelectedParkIds((prev) => (prev.includes(parkId) ? prev.filter((p) => p !== parkId) : [...prev, parkId]));
  }

  function handleRoleChange(value: string) {
    if (!isUserRole(value)) return;
    setRole(value);
    setSelectedParkIds([]);
    setAllParksAccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parkPayload: Pick<UserEditPayload, "parkIds" | "allParksAccess"> =
      role === "admin"
        ? {}
        : role === "engineer"
        ? { parkIds: selectedParkIds, allParksAccess }
        : { parkIds: selectedParkIds, allParksAccess: false };

    try {
      if (isEdit) {
        const patch: UserEditPayload = { fullName, role, ...parkPayload };
        if (newPassword.trim()) patch.newPassword = newPassword.trim();
        const res = await fetch(`/api/admin/users/${record!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "FAILED");
        }
      } else {
        const payload: UserCreatePayload = { username, fullName, password, role, ...parkPayload };
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "FAILED");
        }
      }
      onDone();
    } catch (e: any) {
      const map: Record<string, string> = {
        USERNAME_TAKEN: "That username is already taken.",
        WEAK_PASSWORD: "Password must be at least 8 characters, with a letter and a number.",
        INVALID_USERNAME: "Username must be 3-32 characters: letters, numbers, underscore, dot or hyphen.",
        MISSING_FULL_NAME: "Full name is required.",
        LAST_ADMIN_CANNOT_DEMOTE_SELF: "You can't remove the last administrator's admin role.",
        ENGINEER_NEEDS_AT_LEAST_ONE_PARK: "Select at least one park, or turn on \"Access to all parks\".",
        TECHNICIAN_NEEDS_EXACTLY_ONE_PARK: "Select exactly one park for a technician.",
        TECHNICIAN_CANNOT_HAVE_ALL_PARKS: "A technician can only have one park, not all-parks access.",
      };
      setError(map[e.message] ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit user" : "New user"}</div>

      {!isEdit && (
        <>
          <FieldLabel>Username</FieldLabel>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mb-3" required autoCapitalize="none" />
        </>
      )}

      <FieldLabel>Full name</FieldLabel>
      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mb-3" required />

      <FieldLabel>Role</FieldLabel>
      <Select value={role} onChange={(e) => handleRoleChange(e.target.value)} className="mb-3">
        <option value="technician">Technician</option>
        <option value="engineer">Engineer</option>
        <option value="admin">Administrator</option>
      </Select>

      {role === "technician" && (
        <>
          <FieldLabel>Assigned park (exactly one)</FieldLabel>
          <Select value={selectedParkIds[0] ?? ""} onChange={(e) => toggleTechnicianPark(e.target.value)} className="mb-3" required>
            <option value="">—</option>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </>
      )}

      {role === "engineer" && (
        <div className="mb-3">
          <FieldLabel>Assigned parks</FieldLabel>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={allParksAccess} onChange={(e) => setAllParksAccess(e.target.checked)} />
            Access to all Technology Parks (current and future)
          </label>
          {!allParksAccess && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border rounded-lg p-2.5">
              {parks.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedParkIds.includes(p.id)} onChange={() => toggleEngineerPark(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {!isEdit && (
        <>
          <FieldLabel>Password</FieldLabel>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mb-3" required />
        </>
      )}

      {isEdit && (
        <>
          <FieldLabel>Reset password (leave blank to keep current)</FieldLabel>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mb-3" />
        </>
      )}

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create user"}
        </Button>
      </div>
    </form>
  );
}
