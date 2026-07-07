import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";
import "./globals.css";

import { AppHeader } from "@/components/app-shell/app-header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { DisclaimerFooter } from "@/components/app-shell/disclaimer-footer";
import { FirstUseDialog } from "@/components/app-shell/first-use-dialog";
import { SwRegister } from "@/components/app-shell/sw-register";
import { DietProvider } from "@/components/diet-provider";
import { I18nProvider } from "@/i18n";

// Presupuesto de fuentes (gate LCP): 2 familias variables sin ejes extra y
// display OPTIONAL — con swap, el repaint al llegar el webfont movía el LCP a
// ~3.9s en móvil throttled. Con optional no hay repaint: la primera visita usa
// el fallback métrico y desde la segunda el webfont ya está en caché (el SW
// cachea los .woff2). Mono = stack de sistema.
// Pesos estáticos, no variable: la variable de Fraunces+Nunito sumaba ~220 KB
// preloaded y Lantern anclaba el LCP a su llegada (~3.8s).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "600",
  display: "optional",
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "optional",
});

export const metadata: Metadata = {
  title: "Nutri-Kids",
  description:
    "La dieta de tu peque, viva y a la mano: semáforo de alimentos, equivalencias y el checklist de hoy.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#faf7f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang inicial "es" (idioma primario y del prerender); I18nProvider lo
    // actualiza en el cliente si la preferencia guardada es EN.
    <html
      lang="es"
      // El script inline y el I18nProvider mutan atributos de <html> pre/post paint
      suppressHydrationWarning
      className={`${fraunces.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Pre-paint: oculta el overlay de primer uso si ya fue aceptado (cero flash).
            Debe correr ANTES de pintar — por eso es inline y síncrono. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(JSON.parse(localStorage.getItem("nutrikids.prefs.v1")||"{}").disclaimerSeen)document.documentElement.setAttribute("data-first-use-seen","")}catch(e){}`,
          }}
        />
        <I18nProvider>
          <DietProvider>
            <div className="flex min-h-dvh flex-col pb-24 lg:pb-4 lg:pl-44">
              <AppHeader />
              <main className="mx-auto w-full max-w-md flex-1 px-4 lg:max-w-2xl">
                {children}
              </main>
              <DisclaimerFooter />
            </div>
            <BottomNav />
            <FirstUseDialog />
            <SwRegister />
          </DietProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
