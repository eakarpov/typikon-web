import Script from "next/script";
import {analyticsConnector} from "@/utils/google";
import {yandexMetrica} from "@/utils/yandex";

const CommonMeta = () => {
  return (
    <>
        <Script id="gtag" async src="https://www.googletagmanager.com/gtag/js?id=G-5PZYF60JJ0" />
        <Script id="ga-local" strategy="lazyOnload">
            {analyticsConnector}
        </Script>
        <Script id="ym-local" strategy="lazyOnload">
            {yandexMetrica}
        </Script>
    </>
  );
};

export default CommonMeta;
