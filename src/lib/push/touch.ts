import { pushApi } from "./client";
import { loadPushState } from "./state";

/**
 * Tras subir un aviso propio, despierta a los otros teléfonos de la familia. Solo lleva el
 * código de la familia y quién soy (para no despertarme a mí), con el token de la familia en
 * el encabezado: ni el texto ni el nombre salen del teléfono en claro. Si falla, el aviso ya
 * está subido: los otros lo verán al abrir la app (el despertar es solo el empujón).
 */
export async function touchFamily(
  family: string,
  familyToken: string,
  api = pushApi(),
): Promise<boolean> {
  const mine = loadPushState();
  const r = await api.family(familyToken, family, mine?.id ?? null);
  return r.ok;
}
