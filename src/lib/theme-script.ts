import { DARK_QUERY, THEME_COLORS } from "@/lib/theme";

/**
 * Solo lo importa el layout (servidor): va en una página, no en el JavaScript del cliente
 * (el presupuesto de script de /ajustes está a décimas del tope, S10).
 */

/**
 * Lo mismo que `applyTheme`, escrito para correr en línea ANTES de pintar (síncrono, sin
 * módulos). Una prueba lo ejecuta contra `applyTheme` para que no se separen.
 */
export const THEME_SCRIPT = `try{var d=document.documentElement,t=JSON.parse(localStorage.getItem("nutrikids.prefs.v1")||"{}").theme,s=matchMedia("${DARK_QUERY}").matches,k=t==="dark"||(t!=="light"&&s),n=k?"dark":"light",c={light:"${THEME_COLORS.light}",dark:"${THEME_COLORS.dark}"};d.dataset.themePref=t==="dark"||t==="light"?t:"system";d.classList.toggle("dark",k);d.style.colorScheme=n;document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){var o=/dark/.test(m.getAttribute("media")||"")?"dark":"light";m.setAttribute("content",c[t==="dark"||t==="light"?n:o])})}catch(e){}`;
