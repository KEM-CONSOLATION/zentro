/**
 * Google Search Console Verification Component
 * 
 * To verify your site with Google Search Console:
 * 1. Go to https://search.google.com/search-console
 * 2. Add your property (countpadi.com)
 * 3. Choose "HTML tag" verification method
 * 4. Copy the content value from the meta tag (e.g., "abc123xyz")
 * 5. Add it to your .env.local file as: NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=abc123xyz
 * 6. The verification meta tag will be automatically added to your site
 * 
 * Alternative: You can also verify via DNS or HTML file upload
 */

export default function GoogleSiteVerification() {
  const verificationCode = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

  if (!verificationCode) {
    return null
  }

  return (
    <meta
      name="google-site-verification"
      content={verificationCode}
    />
  )
}
