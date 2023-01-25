import Script from "next/script";
import {analyticsConnector} from "@/utils/google";

const CommonMeta = () => {
  return (
    <>
        <Script id="gtag" async src="https://www.googletagmanager.com/gtag/js?id=G-5PZYF60JJ0" />
        <Script id="ga-local" strategy="lazyOnload">
            {analyticsConnector}
        </Script>
        <link rel="icon" href="/favicon.ico" />
    </>
  );
};

export default CommonMeta;
