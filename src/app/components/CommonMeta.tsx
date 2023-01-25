import Script from "next/script";
import {analyticsConnector} from "@/utils/google";

const CommonMeta = () => {
  return (
    <>
        <Script id="gtag" async src="https://www.googletagmanager.com/gtag/js?id=G-5PZYF60JJ0" />
        <Script id="ga-local" strategy="lazyOnload">
            {analyticsConnector}
        </Script>
        <meta property="og:image" content="https://www.typikon.ru/logo.png"/>
        <meta name="keywords" content="уставные чтения, устав, типикон, богослужебные указания, триодь, минея, пролог, златоуст, торжественник, учительное евангелие, толковый апостол" />
        <link rel="icon" href="/favicon.ico" />
    </>
  );
};

export default CommonMeta;
