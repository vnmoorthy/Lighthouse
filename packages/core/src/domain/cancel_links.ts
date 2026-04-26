/**
 * Hand-curated cancellation deep links by merchant canonical name.
 *
 * Each entry is the URL that lands the user closest to the cancellation
 * flow for that merchant. When a merchant has a "manage subscription" page
 * but no direct cancel URL, we link to the manage page — fewer clicks than
 * navigating from the home page.
 *
 * PRs adding more merchants are very welcome.
 *
 * Source: each link below was verified against the merchant's site in
 * April 2026. Some merchants (Apple, Google, Spotify) deliberately move
 * their cancel pages around; the URLs here are stable redirect anchors
 * when possible.
 */

export interface CancelLink {
  url: string;
  /** Optional human-readable hint about what to do once on the page. */
  hint?: string;
}

export const CANCEL_LINKS: Record<string, CancelLink> = {
  // Streaming
  netflix:        { url: 'https://www.netflix.com/cancelplan' },
  spotify:        { url: 'https://www.spotify.com/account/subscription/' },
  'disney-plus':  { url: 'https://www.disneyplus.com/account/subscription' },
  'hbo-max':      { url: 'https://play.max.com/settings/subscription' },
  hulu:           { url: 'https://secure.hulu.com/account' },
  'youtube-premium': { url: 'https://www.youtube.com/paid_memberships' },

  // Apps & platforms
  apple:          { url: 'https://apps.apple.com/account/subscriptions' },
  google:         { url: 'https://play.google.com/store/account/subscriptions' },
  microsoft:      { url: 'https://account.microsoft.com/services' },

  // Productivity / SaaS
  github:         { url: 'https://github.com/settings/billing/plans' },
  figma:          { url: 'https://www.figma.com/files/account/subscription' },
  notion:         { url: 'https://www.notion.so/my-account/billing' },
  linear:         { url: 'https://linear.app/settings/billing' },
  slack:          { url: 'https://slack.com/account/team' },
  dropbox:        { url: 'https://www.dropbox.com/account/plan' },
  '1password':    { url: 'https://my.1password.com/billing' },
  raycast:        { url: 'https://www.raycast.com/account/billing' },

  // Cloud / infra
  aws:            { url: 'https://us-east-1.console.aws.amazon.com/billing/' },
  gcp:            { url: 'https://console.cloud.google.com/billing' },
  cloudflare:     { url: 'https://dash.cloudflare.com/?to=/:account/billing/subscriptions' },
  vercel:         { url: 'https://vercel.com/account/plans' },
  netlify:        { url: 'https://app.netlify.com/teams/billing' },
  digitalocean:   { url: 'https://cloud.digitalocean.com/account/billing' },

  // Fitness
  peloton:        { url: 'https://account.onepeloton.com/preferences/membership' },
  classpass:      { url: 'https://classpass.com/account/membership' },
  strava:         { url: 'https://www.strava.com/settings/profile' },
  headspace:      { url: 'https://www.headspace.com/subscription/cancel' },
  calm:           { url: 'https://www.calm.com/profile/account' },

  // Food / delivery
  doordash:       { url: 'https://www.doordash.com/dashpass/manage' },
  'uber-eats':    { url: 'https://www.ubereats.com/' },
  grubhub:        { url: 'https://www.grubhub.com/account/membership' },
  instacart:      { url: 'https://www.instacart.com/store/account/instacart-plus' },

  // News / publishing
  nytimes:        { url: 'https://myaccount.nytimes.com/seg/subscription' },
  wapo:           { url: 'https://subscribe.washingtonpost.com/myaccount' },
  wsj:            { url: 'https://customercenter.wsj.com/' },
  substack:       { url: 'https://substack.com/account' },
  medium:         { url: 'https://medium.com/me/membership' },

  // Telecom / utilities
  verizon:        { url: 'https://www.verizon.com/my-verizon/' },
  att:            { url: 'https://www.att.com/myatt/' },
  tmobile:        { url: 'https://account.t-mobile.com/' },
  comcast:        { url: 'https://customer.xfinity.com/#/billing' },

  // Travel / transit
  airbnb:         { url: 'https://www.airbnb.com/account-settings' },
};

/** Look up a cancel link by merchant canonical name. */
export function getCancelLink(canonical: string | null | undefined): CancelLink | null {
  if (!canonical) return null;
  return CANCEL_LINKS[canonical] ?? null;
}
