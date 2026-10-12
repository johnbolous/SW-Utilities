"use client";

import { AdminListPage } from "@/components/admin/AdminListPage";
import { Badge } from "@/components/ui/primitives";
import { UserForm } from "./UserForm";

interface UserRow {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "engineer" | "technician";
  is_active: boolean;
  last_login_at: string | null;
  all_parks_access: boolean;
  user_park_access: { park_id: string }[];
}

export function UsersPageContent() {
  return (
    <AdminListPage<UserRow>
      title="Users"
      apiBase="/api/admin/users"
      listKey="users"
      getId={(r) => r.id}
      getStatus={(r) => r.is_active}
      statusFieldLabel="user"
      searchPlaceholder="Search by name or username…"
      newLabel="+ New user"
      filters={[
        {
          key: "role",
          label: "All roles",
          options: [
            { value: "admin", label: "Administrator" },
            { value: "engineer", label: "Engineer" },
            { value: "technician", label: "Technician" },
          ],
        },
        {
          key: "status",
          label: "All statuses",
          options: [
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ],
        },
      ]}
      columns={[
        { key: "full_name", label: "Name" },
        { key: "username", label: "Username" },
        {
          key: "role",
          label: "Role",
          render: (r) => <span className="capitalize">{r.role}</span>,
        },
        {
          key: "is_active",
          label: "Status",
          render: (r) => <Badge tone={r.is_active ? "success" : "danger"}>{r.is_active ? "Active" : "Disabled"}</Badge>,
        },
        {
          key: "last_login_at",
          label: "Last login",
          render: (r) => (r.last_login_at ? new Date(r.last_login_at).toLocaleString() : "Never"),
        },
      ]}
      renderForm={({ record, onDone, onCancel }) => <UserForm record={record} onDone={onDone} onCancel={onCancel} />}
    />
  );
}
