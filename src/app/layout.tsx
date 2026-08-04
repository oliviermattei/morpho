import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * s10 plan decision 4: don't bet on `mobile-web-app-capable` alone.
 * `metadata.appleWebApp.capable` only emits the MODERN tag
 * (`node_modules/next/dist/lib/metadata/metadata.js`, "--- Apple Web
 * App ---": `capable` → `<meta name="mobile-web-app-capable">`, never
 * the legacy `apple-mobile-web-app-capable` one) — `metadata.other`
 * carries the legacy tag explicitly, one line, so the question never
 * has to be re-opened by failing silently on an older iOS. `statusBarStyle:
 * "default"`, not `"black-translucent"`: the latter requires
 * `viewport-fit: cover` and safe-area handling this story doesn't do.
 */
export const metadata: Metadata = {
  title: "morpho",
  description: "Suivi de poids et de mensurations corporelles",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "morpho",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

/**
 * s10 plan decision 6: `viewport.themeColor` stays BI-THEME (an array of
 * `{media, color}`) — the manifest's own `theme_color` cannot be
 * mediatized, this is the one that actually stays in sync with
 * `prefers-color-scheme`. Colors are the same sRGB conversions declared
 * in `docs/design-system.md` § Identité PWA, not chosen here.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Design system §Thème: the app follows the system color-scheme preference.
// The preset styles by class (`.dark`), so the class must be set on <html>
// before the first paint — a media query alone would not drive Tailwind's
// `dark:` variant. Kept minimal on purpose: no persisted override in this
// story, only the system preference.
const THEME_SCRIPT = `(function(){try{if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark")}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* s10 plan task 6, decision 17: both defaults flipped OFF — they
            would each work against this story (trap 3). cacheOnNavigation
            posts CACHE_URLS for every visited page, a user-data caching
            mechanism entirely outside the routing table just written
            (src/lib/pwa/runtime-caching.ts). reloadOnOnline calls
            location.reload() the instant the network returns, dropping
            whatever the user was mid-typing (criterion 5) — a maison
            router.refresh() (task 7's useOnlineStatus) replaces it. */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          cacheOnNavigation={false}
          reloadOnOnline={false}
        >
          {children}
        </SerwistProvider>
        {/* Plan decision 12: mounted once, at the root — no authenticated
            layout exists yet, and building one just to host this would
            be structure s06 will redo. */}
        <Toaster />
      </body>
    </html>
  );
}
