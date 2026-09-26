import { ABOUT_DESCRIPTION, ABOUT_TITLE, APP_FEATURES, SITE_DESCRIPTION } from "./copy";
import { REPO_URL, SITE_NAME, SITE_URL } from "./site";

const WEBSITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#app`;

/**
 * schema.org for home: the site and the app. Facts only. No ratings or
 * reviews: there are none to cite, and made-up ones break search rules.
 */
export function homeStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
      },
      {
        "@type": "WebApplication",
        "@id": APP_ID,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: SITE_DESCRIPTION,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [...APP_FEATURES],
        inLanguage: "en",
        sameAs: [REPO_URL],
        isPartOf: { "@id": WEBSITE_ID },
      },
    ],
  };
}

export function aboutStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: `${SITE_URL}/about`,
    name: `${ABOUT_TITLE} · ${SITE_NAME}`,
    description: ABOUT_DESCRIPTION,
    inLanguage: "en",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": APP_ID },
  };
}

/** JSON for a script tag: every `<` is written as its unicode escape, so no string in it can end the tag. */
export function jsonLdText(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
