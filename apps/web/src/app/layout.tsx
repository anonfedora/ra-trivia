import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../contexts/ThemeContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Quiz Portal",
    description: "Advanced Quiz Application",
    icons: {
        icon: "/favicon.png",
        apple: "/apple-touch-icon.png",
        shortcut: "/favicon.png",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.className} bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition-colors duration-200`}>
                <ThemeProvider>
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
