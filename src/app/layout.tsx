import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";

import { AppHeader } from "@/components/app-shell/app-header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { DisclaimerFooter } from "@/components/app-shell/disclaimer-footer";
import { FirstUseDialog } from "@/components/app-shell/first-use-dialog";
import { SwRegister } from "@/components/app-shell/sw-register";
import { DietProvider } from "@/components/diet-provider";
import { I18nProvider } from "@/i18n";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
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
      className={`${fraunces.variable} ${nunitoSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
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
