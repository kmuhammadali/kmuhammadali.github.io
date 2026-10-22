// Browser titles are independent of the editable terminal branding in the CMS.
export const SITE_TITLE = 'Muhammad Ali';
export const pageTitle = (articleTitle?: string) => articleTitle ? `${articleTitle} | ${SITE_TITLE}` : SITE_TITLE;
