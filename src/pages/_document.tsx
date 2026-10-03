import { Html, Head, Main, NextScript } from "next/document";

/** Custom document with a local Cyrillic font and Russian locale. */
export default function Document() {
  return (
    <Html lang="ru">
      <Head>
        <link rel="preload" href="/fonts/manrope-variable.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
