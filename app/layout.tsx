import type { Metadata, Viewport } from "next";
import { Poppins, Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import "./globals.css";

// Set the theme class before first paint (no flash of the wrong theme).
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI & Tech for Professionals",
  description:
    "Learn to do your real job with AI — short lessons and applied, gamified simulations for HR professionals.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "AI & Tech", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">
        <div className="app-surface">
          <span className="sigdot" aria-hidden />
          <span className="sigdot d2" aria-hidden />
          <ThemeToggle />
          <PostHogProvider>{children}</PostHogProvider>
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
