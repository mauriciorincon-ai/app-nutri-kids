"use client";

import { useState } from "react";
import { NotebookPen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmt, useI18n } from "@/i18n";
import { NOTE_CHIPS, type DayNote, type NoteChip } from "@/lib/diet/day-log";
import { cn } from "@/lib/utils";

const CHIP_KEY: Record<
  NoteChip,
  keyof ReturnType<typeof useI18n>["t"]["today"]
> = {
  rejected: "noteChipRejected",
  pain: "noteChipPain",
  craving: "noteChipCraving",
  other: "noteChipOther",
};

const NOTE_TEXT_MAX = 140;

/**
 * Nota corta de una comida: chips (rechazó/dolor/antojo/otro) + texto libre
 * breve. SIN culpa por diseño — describe lo que pasó, no lo califica. El texto
 * es dato de salud del menor: vive solo en el dispositivo (ADR-007). Los chips
 * son botones de alternar accesibles por teclado (`aria-pressed`).
 */
export function NoteEditor({
  mealName,
  note,
  onSave,
}: {
  mealName: string;
  note: DayNote | null;
  onSave: (note: DayNote | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [chips, setChips] = useState<NoteChip[]>(note?.chips ?? []);
  const [text, setText] = useState(note?.text ?? "");

  const hasNote = note !== null;

  const toggleChip = (chip: NoteChip) =>
    setChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );

  const save = () => {
    const trimmed = text.trim();
    onSave(
      chips.length === 0 && trimmed === "" ? null : { chips, text: trimmed },
    );
    setOpen(false);
  };

  const remove = () => {
    setChips([]);
    setText("");
    onSave(null);
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="mt-1 pl-9">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <NotebookPen aria-hidden className="size-4" />
          {hasNote ? t.today.editNote : t.today.addNote}
        </button>
        {note && (note.chips.length > 0 || note.text) && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[...note.chips.map((c) => t.today[CHIP_KEY[c]]), note.text]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-1 ml-9 flex flex-col gap-2 rounded-xl border bg-card px-3 py-3"
      role="group"
      aria-label={fmt(t.today.noteFor, { item: mealName })}
    >
      <div className="flex flex-wrap gap-1.5">
        {NOTE_CHIPS.map((chip) => {
          const active = chips.includes(chip);
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={active}
              onClick={() => toggleChip(chip)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent hover:bg-accent",
              )}
            >
              {t.today[CHIP_KEY[chip]]}
            </button>
          );
        })}
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, NOTE_TEXT_MAX))}
        maxLength={NOTE_TEXT_MAX}
        rows={2}
        placeholder={t.today.notePlaceholder}
        aria-label={fmt(t.today.noteFor, { item: mealName })}
        className="min-h-16 text-base"
      />

      <div className="flex gap-2">
        <Button size="sm" onClick={save} className="min-h-11 flex-1">
          {t.today.noteSave}
        </Button>
        {hasNote && (
          <Button
            size="sm"
            variant="outline"
            onClick={remove}
            className="min-h-11"
          >
            <X aria-hidden className="size-4" />
            {t.today.noteRemove}
          </Button>
        )}
      </div>
    </div>
  );
}
