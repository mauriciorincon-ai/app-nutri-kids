"use client";

import { useState } from "react";
import { Check, Copy, UserMinus } from "lucide-react";

import { useDiet } from "@/components/diet-provider";
import { Button } from "@/components/ui/button";
import { fmt, useI18n, type Dictionary, type Locale } from "@/i18n";
import { lineLabel } from "@/lib/diet/reconcile";
import type { DietPlan } from "@/lib/diet/schema";
import {
  getFamily,
  type FamilyView,
  type LogRow,
  type MemberRow,
} from "@/lib/family/controller";
import { ROLES, type Role } from "@/lib/family/roster";
import { cn } from "@/lib/utils";

import { Confirm, errorText, when } from "./parts";

/**
 * Quién puede qué (S9 · ADR-013): el rol de cada persona, invitar con rol, confirmar a quien
 * llega y la bitácora. Cambiar algo de aquí es solo de una madre o un padre; la firma lo hace
 * cumplir en cada teléfono, la pantalla solo lo explica.
 */

const ROLE_LOOK: Record<Role, { symbol: string; cls: string }> = {
  parent: { symbol: "◆", cls: "bg-primary text-primary-foreground" },
  caregiver: { symbol: "●", cls: "bg-secondary text-secondary-foreground" },
  school: { symbol: "■", cls: "bg-accent text-accent-foreground" },
  nutritionist: { symbol: "▲", cls: "border bg-muted text-foreground" },
};

export function roleName(t: Dictionary, role: Role): string {
  return {
    parent: t.family.roleParent,
    caregiver: t.family.roleCaregiver,
    school: t.family.roleSchool,
    nutritionist: t.family.roleNutritionist,
  }[role];
}

export function roleCan(t: Dictionary, role: Role): string {
  return {
    parent: t.family.roleParentCan,
    caregiver: t.family.roleCaregiverCan,
    school: t.family.roleSchoolCan,
    nutritionist: t.family.roleNutritionistCan,
  }[role];
}

/** El rol con símbolo + texto + color (regla 4: nunca solo color). */
export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n();
  const look = ROLE_LOOK[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
        look.cls,
      )}
      data-role={role}
    >
      <span aria-hidden>{look.symbol}</span>
      {roleName(t, role)}
    </span>
  );
}

/** Las comidas con horario del plan, para el rol de colegio. */
function mealsOf(diet: DietPlan, locale: Locale) {
  return diet.dailyMenu.map((m) => ({ id: m.id, name: m.name[locale] }));
}

function MealPicker({
  legend,
  value,
  onChange,
  testId,
}: {
  legend: string;
  value: string[];
  onChange: (v: string[]) => void;
  testId: string;
}) {
  const { t, locale } = useI18n();
  const { diet } = useDiet();
  const meals = mealsOf(diet, locale);
  if (meals.length === 0)
    return (
      <p className="text-sm text-muted-foreground">{t.family.inviteNoMeals}</p>
    );
  return (
    <fieldset className="flex flex-col gap-1" data-testid={testId}>
      <legend className="text-sm font-semibold">{legend}</legend>
      {meals.map((m) => (
        <label
          key={m.id}
          className="flex min-h-11 items-center gap-3 text-base"
        >
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={value.includes(m.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, m.id]
                  : value.filter((x) => x !== m.id),
              )
            }
          />
          {m.name}
        </label>
      ))}
    </fieldset>
  );
}

function RolePicker({
  legend,
  value,
  onChange,
  name,
}: {
  legend: string;
  value: Role;
  onChange: (r: Role) => void;
  name: string;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-semibold">{legend}</legend>
      {ROLES.map((r) => (
        <label
          key={r}
          className="flex min-h-11 items-start gap-3 py-1 text-base"
        >
          <input
            type="radio"
            name={name}
            className="mt-1 size-5 accent-primary"
            checked={value === r}
            onChange={() => onChange(r)}
          />
          <span className="flex flex-col">
            <RoleBadge role={r} />
            <span className="text-sm text-muted-foreground">
              {roleCan(t, r)}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Tu rol, arriba del todo: qué puedes hacer desde este teléfono. */
export function MyRole({ view }: { view: FamilyView }) {
  const { t } = useI18n();
  if (!view.role)
    return (
      <p
        role="status"
        className="rounded-xl bg-accent px-4 py-3 text-sm leading-relaxed text-accent-foreground"
        data-testid="family-no-role"
      >
        ⏳ {t.family.noRoleYet}
        {view.mark && (
          <span className="mt-1 block" data-testid="family-my-mark">
            {fmt(t.family.myMark, { mark: view.mark })}
          </span>
        )}
      </p>
    );
  return (
    <div
      className="rounded-xl border bg-card px-4 py-3 text-sm"
      data-testid="family-my-role"
    >
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {fmt(t.family.yourRole, { role: "" })}
        <RoleBadge role={view.role} />
      </p>
      <p className="mt-1 text-muted-foreground">{roleCan(t, view.role)}</p>
    </div>
  );
}

function PersonRow({
  m,
  parent,
  onRemove,
}: {
  m: MemberRow;
  parent: boolean;
  onRemove: (m: MemberRow) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Role>(m.role);
  const [meals, setMeals] = useState<string[]>(m.meals);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    const r = await getFamily().setRole(m.id, role, meals);
    setMsg(r.ok ? t.family.roleSaved : errorText(t, r.reason));
    if (r.ok) setEditing(false);
  };
  return (
    <li
      className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
      data-testid={`family-person-${m.id}`}
    >
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {m.name || "—"}
        <RoleBadge role={m.role} />
        {m.self && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
            {t.family.youTag}
          </span>
        )}
      </p>
      {!m.self && m.seen > 0 && (
        <p className="-mt-1 text-sm text-muted-foreground">
          {fmt(t.family.seenAt, { when: when(m.seen, locale) })}
        </p>
      )}
      {parent && !editing && (
        <Button
          variant="outline"
          size="lg"
          className="min-h-11 bg-transparent"
          onClick={() => setEditing(true)}
          data-testid={`family-role-edit-${m.id}`}
        >
          {fmt(t.family.roleFor, { name: m.name })}
        </Button>
      )}
      {parent && editing && (
        <div className="flex flex-col gap-2">
          <RolePicker
            legend={fmt(t.family.roleFor, { name: m.name })}
            value={role}
            onChange={setRole}
            name={`role-${m.id}`}
          />
          {role === "school" && (
            <MealPicker
              legend={fmt(t.family.mealsFor, { name: m.name })}
              value={meals}
              onChange={setMeals}
              testId={`family-meals-${m.id}`}
            />
          )}
          <Button
            size="lg"
            className="min-h-11"
            onClick={save}
            data-testid={`family-role-save-${m.id}`}
          >
            {t.family.roleSave}
          </Button>
        </div>
      )}
      {msg && (
        <p role="status" className="text-sm">
          {msg}
        </p>
      )}
      {parent && !m.self && (
        <Confirm
          testId={`family-remove-${m.id}`}
          icon={<UserMinus aria-hidden className="size-5" />}
          triggerLabel={fmt(t.family.removeButton, { name: m.name })}
          title={fmt(t.family.removeTitle, { name: m.name })}
          body={fmt(t.family.removeBody, { name: m.name })}
          yes={t.family.removeYes}
          onYes={() => onRemove(m)}
        />
      )}
    </li>
  );
}

export function People({
  view,
  onRemove,
}: {
  view: FamilyView;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const parent = view.role === "parent";
  // Sin roster todavía (familia del S7 que migra, o recién entrado): se ven los teléfonos.
  const rows: MemberRow[] =
    view.members.length > 0
      ? view.members
      : view.phones.map((p) => ({
          id: p.id,
          name: p.name,
          role: "caregiver" as Role,
          meals: [],
          self: p.self,
          seen: p.seen,
        }));
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg">{t.family.peopleTitle}</h3>
      <ul className="flex flex-col gap-2" data-testid="family-phones">
        {view.members.length > 0
          ? rows.map((m) => (
              <PersonRow
                key={`${m.id}.${m.role}.${m.meals.join(",")}`}
                m={m}
                parent={parent}
                onRemove={(x) => onRemove(x.id)}
              />
            ))
          : rows.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border bg-card px-4 py-3 font-semibold"
              >
                {m.name || "—"}
                {m.self && (
                  <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                    {t.family.youTag}
                  </span>
                )}
              </li>
            ))}
      </ul>
    </section>
  );
}

/** Quien entró y aún no tiene rol: un padre lo confirma (con el rol de su invitación) o le da uno. */
export function Waiting({
  view,
  onRemove,
}: {
  view: FamilyView;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [choice, setChoice] = useState<Record<string, Role>>({});
  const [msg, setMsg] = useState<string | null>(null);
  if (view.waiting.length === 0) return null;
  const parent = view.role === "parent";
  return (
    <section className="flex flex-col gap-2" data-testid="family-waiting">
      <h3 className="text-lg">{t.family.waitingTitle}</h3>
      <ul className="flex flex-col gap-2">
        {view.waiting.map((w) => {
          const role = choice[w.id] ?? w.invited?.role ?? "caregiver";
          return (
            <li
              key={w.id}
              className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3"
            >
              <p className="font-semibold">⏳ {w.name || "—"}</p>
              <p className="-mt-1 text-sm text-muted-foreground">
                {!w.ready
                  ? t.family.waitingOld
                  : w.invited
                    ? fmt(t.family.waitingInvited, {
                        role: roleName(t, w.invited.role),
                      })
                    : t.family.waitingNoInvite}
              </p>
              {w.mark && (
                <p
                  className="-mt-1 text-sm font-semibold"
                  data-testid={`family-mark-${w.id}`}
                >
                  🔑 {fmt(t.family.waitingMark, { mark: w.mark })}
                </p>
              )}
              {parent && w.ready && (
                <>
                  {!w.invited && (
                    <RolePicker
                      legend={fmt(t.family.roleFor, { name: w.name })}
                      value={role}
                      onChange={(r) => setChoice({ ...choice, [w.id]: r })}
                      name={`wait-${w.id}`}
                    />
                  )}
                  <Button
                    size="lg"
                    className="min-h-11"
                    data-testid={`family-confirm-${w.id}`}
                    onClick={async () => {
                      const r = await getFamily().setRole(
                        w.id,
                        role,
                        w.invited?.meals ?? [],
                      );
                      setMsg(
                        r.ok ? t.family.roleSaved : errorText(t, r.reason),
                      );
                    }}
                  >
                    <Check aria-hidden className="size-5" />
                    {fmt(t.family.waitingConfirm, { role: roleName(t, role) })}
                  </Button>
                </>
              )}
              {parent && (
                <Confirm
                  testId={`family-remove-${w.id}`}
                  icon={<UserMinus aria-hidden className="size-5" />}
                  triggerLabel={fmt(t.family.removeButton, { name: w.name })}
                  title={fmt(t.family.removeTitle, { name: w.name })}
                  body={fmt(t.family.removeBody, { name: w.name })}
                  yes={t.family.removeYes}
                  onYes={() => onRemove(w.id)}
                />
              )}
            </li>
          );
        })}
      </ul>
      {msg && (
        <p role="status" className="text-sm">
          {msg}
        </p>
      )}
    </section>
  );
}

/** Invitar con rol: la invitación lleva la huella del roster y la etiqueta de ese rol. */
export function InviteCard() {
  const { t } = useI18n();
  const [role, setRole] = useState<Role>("caregiver");
  const [meals, setMeals] = useState<string[]>([]);
  const [made, setMade] = useState<{ role: Role; invite: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const create = async () => {
    setProblem(null);
    const r = await getFamily().invite(role, meals);
    if (r.ok) setMade({ role, invite: r.invite });
    else setProblem(errorText(t, r.reason));
  };
  return (
    <section className="flex flex-col gap-2" data-testid="family-invite">
      <h3 className="text-lg">{t.family.inviteTitle}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t.family.inviteBody}
      </p>
      <RolePicker
        legend={t.family.inviteRole}
        value={role}
        onChange={setRole}
        name="invite-role"
      />
      {role === "school" && (
        <MealPicker
          legend={t.family.inviteMeals}
          value={meals}
          onChange={setMeals}
          testId="family-invite-meals"
        />
      )}
      <Button
        size="lg"
        className="min-h-11"
        onClick={create}
        data-testid="family-invite-create"
      >
        {t.family.inviteCreate}
      </Button>
      {made && (
        <div
          className="rounded-xl border bg-card px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-semibold">
            {fmt(t.family.inviteReady, { role: roleName(t, made.role) })}
          </p>
          <p
            className="mt-1 font-mono text-base break-all"
            data-testid="family-invite-code"
          >
            {made.invite}
          </p>
          <Button
            variant="outline"
            size="lg"
            className="mt-2 min-h-11 bg-transparent"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(made.invite);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy aria-hidden className="size-5" />
            {copied ? "✓" : t.family.codeLabel}
          </Button>
          <p className="mt-2 text-muted-foreground">{t.family.inviteHint}</p>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm font-semibold text-tl-red">
          ⚠ {problem}
        </p>
      )}
    </section>
  );
}

function shortDate(date: string, locale: Locale): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat(locale === "es" ? "es-CO" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(d);
}

function itemName(
  check: string,
  diet: DietPlan,
  t: Dictionary,
  locale: Locale,
): string {
  const [kind, id] = check.split(":");
  if (kind === "meal") {
    const m = diet.dailyMenu.find((x) => x.id === id);
    if (m) return `«${m.name[locale]}»`;
  }
  if (kind === "supplement") {
    const s = diet.supplements.find((x) => x.id === id);
    if (s) return `«${s.name[locale]}»`;
  }
  if (kind === "water") return t.family.logItemWater;
  return t.family.logItemOther;
}

/** Una fila de la bitácora, en llano: «Mamá · marcó «Desayuno» (16 nov)». */
export function describeLog(
  row: LogRow,
  t: Dictionary,
  locale: Locale,
  diet: DietPlan,
  nameOf: (id: string) => string,
): string {
  const day = (r: string) => {
    const [date, check] = r.split("|");
    return {
      item: itemName(check ?? "", diet, t, locale),
      date: shortDate(date, locale),
    };
  };
  switch (row.k) {
    case "mark":
      return fmt(t.family.logMark, day(row.r));
    case "unmark":
      return fmt(t.family.logUnmark, day(row.r));
    case "day-note":
      return fmt(t.family.logDayNote, day(row.r));
    case "profile-note":
      return t.family.logProfileNote;
    case "textures":
      return t.family.logTextures;
    case "plan":
      return t.family.logPlan;
    case "plan-line":
      return fmt(t.family.logPlanLine, {
        item: lineLabel(diet, row.r)?.[locale] ?? t.family.logItemOther,
      });
    case "notice":
      return t.family.logNotice;
    case "wellbeing":
      return fmt(t.family.logWellbeing, {
        date: shortDate(row.r.split("|")[0] ?? "", locale),
      });
    case "roster": {
      const [op, id, role] = row.r.split(":");
      const r = (role ?? id) as Role;
      if (op === "genesis") return t.family.logGenesis;
      if (op === "set")
        return fmt(t.family.logSet, {
          name: nameOf(id),
          role: ROLES.includes(r) ? roleName(t, r) : "—",
        });
      if (op === "remove") return fmt(t.family.logRemove, { name: nameOf(id) });
      return fmt(t.family.logInvite, {
        role: ROLES.includes(id as Role) ? roleName(t, id as Role) : "—",
      });
    }
  }
}

export function LogList({ view }: { view: FamilyView }) {
  const { t, locale } = useI18n();
  const { diet } = useDiet();
  const names = new Map<string, string>();
  for (const m of view.members) names.set(m.id, m.name);
  for (const p of view.phones) if (!names.has(p.id)) names.set(p.id, p.name);
  const nameOf = (id: string) => names.get(id) ?? "—";
  return (
    <section className="flex flex-col gap-2" data-testid="family-log">
      <h3 className="text-lg">{t.family.logTitle}</h3>
      <p className="text-sm text-muted-foreground">{t.family.logBody}</p>
      {view.log.length === 0 ? (
        <p className="text-sm">{t.family.logEmpty}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {view.log.map((row) => (
            <li
              key={`${row.by}.${row.t}.${row.k}.${row.r}`}
              className="flex flex-col rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {row.name}
                {row.role && <RoleBadge role={row.role} />}
              </span>
              <span>{describeLog(row, t, locale, diet, nameOf)}</span>
              <span className="text-muted-foreground">
                {when(row.t, locale)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
