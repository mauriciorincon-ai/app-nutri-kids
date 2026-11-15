"use client";

import {
  EMPTY_NOTES,
  loadProfileNotes,
  type ProfileNotes,
} from "@/lib/diet/profile-notes";
import { useLocalStore } from "@/lib/local-store";

/** Lo que quien cuida anotó en este teléfono (aparte del plan). Releer con `notifyLocalStore()`. */
export function useProfileNotes(): ProfileNotes {
  return useLocalStore(loadProfileNotes, EMPTY_NOTES);
}
