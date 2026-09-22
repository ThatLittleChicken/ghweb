import Head from 'next/head'

const SITE = 'https://gentyo.ng'
const OG_IMAGE = `${SITE}/Screenshot.png`

interface SeoProps {
  title: string
  description: string
  path: string
}

// Per-page head tags. The site is deliberately kept out of search results:
// noindex is served here and as an X-Robots-Tag header (see firebase.json).
// Open Graph/Twitter tags stay so shared links still preview properly.
export default function Seo({ title, description, path }: SeoProps) {
  const url = `${SITE}${path}`
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Gent Yong" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />
    </Head>
  )
}
