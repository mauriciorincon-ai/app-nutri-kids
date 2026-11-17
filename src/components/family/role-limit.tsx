"use client";

import { fmt, useI18n } from "@/i18n";

import { roleCan, roleName } from "./roles";
import { useFamily } from "./use-family";

/**
 * Una línea donde el rol limita lo que se puede cambiar (S9): qué puede hacer este teléfono,
 * sin alarma. Con familia y rol de madre o padre, o sin familia, no se muestra.
 */
export function RoleLimit() {
  const { t } = useI18n();
  const view = useFamily();
  if (view.phase === "off" || view.role === "parent") return null;
  return (
    <p
      role="status"
      className="rounded-xl border bg-card px-4 py-3 text-sm leading-relaxed"
      data-testid="role-limit"
    >
      ℹ{" "}
      {view.role
        ? `${fmt(t.family.roleBlocked, { role: roleName(t, view.role) })} ${roleCan(t, view.role)}`
        : t.family.noRoleYet}
    </p>
  );
}
