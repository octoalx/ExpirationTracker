import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import "@/styles/globals.css";
import Layout from "@/components/Layout";
import Toaster from "@/components/Toaster";

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <div suppressHydrationWarning>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
        <SessionProvider session={pageProps.session}>
          <Layout>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={router.asPath}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="will-change-transform"
              >
                <Component {...pageProps} />
              </motion.div>
            </AnimatePresence>
          </Layout>
          <Toaster />
        </SessionProvider>
      </ThemeProvider>
    </div>
  );
}
