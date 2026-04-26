/**
 * Hand-curated rules for the most common merchants.
 *
 * These are tried before falling back to the LLM normalizer. The rules are
 * intentionally additive — anyone can submit a PR to extend the list.
 *
 * Format:
 *   - `domains`: from-address domains that should always map to this merchant.
 *   - `aliasPatterns`: substring/regex matches against the raw merchant name.
 *   - `category`: optional default category for the dashboard.
 */

export interface MerchantRule {
  canonical: string;
  display: string;
  category: string;
  domains?: string[];
  aliasPatterns?: RegExp[];
}

export const MERCHANT_RULES: MerchantRule[] = [
  // --- Marketplaces -------------------------------------------------------
  { canonical: 'amazon', display: 'Amazon', category: 'shopping',
    domains: ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'marketplace.amazon.com'],
    aliasPatterns: [/^amzn?\b/i, /amazon\s*marketplace/i, /amazon\.com/i, /amzn\s*mktp/i] },
  { canonical: 'amazon-fresh', display: 'Amazon Fresh', category: 'groceries',
    domains: ['fresh.amazon.com'], aliasPatterns: [/amazon\s*fresh/i] },
  { canonical: 'whole-foods', display: 'Whole Foods', category: 'groceries',
    domains: ['wholefoodsmarket.com'], aliasPatterns: [/whole\s*foods/i] },
  { canonical: 'etsy', display: 'Etsy', category: 'shopping',
    domains: ['etsy.com'], aliasPatterns: [/^etsy\b/i] },
  { canonical: 'ebay', display: 'eBay', category: 'shopping',
    domains: ['ebay.com', 'ebay.co.uk'], aliasPatterns: [/^ebay\b/i] },

  // --- Streaming / SaaS ---------------------------------------------------
  { canonical: 'netflix', display: 'Netflix', category: 'streaming',
    domains: ['netflix.com'], aliasPatterns: [/^netflix\b/i] },
  { canonical: 'spotify', display: 'Spotify', category: 'streaming',
    domains: ['spotify.com'], aliasPatterns: [/^spotify\b/i] },
  { canonical: 'disney-plus', display: 'Disney+', category: 'streaming',
    domains: ['disneyplus.com'], aliasPatterns: [/disney\s*\+|disneyplus/i] },
  { canonical: 'hbo-max', display: 'Max', category: 'streaming',
    domains: ['max.com', 'hbomax.com'], aliasPatterns: [/^(hbo\s*max|max)\b/i] },
  { canonical: 'hulu', display: 'Hulu', category: 'streaming',
    domains: ['hulu.com'], aliasPatterns: [/^hulu\b/i] },
  { canonical: 'youtube-premium', display: 'YouTube Premium', category: 'streaming',
    domains: ['youtube.com'], aliasPatterns: [/youtube\s*(premium|music)/i] },
  { canonical: 'apple', display: 'Apple', category: 'apps',
    domains: ['apple.com', 'itunes.com'],
    aliasPatterns: [/^apple\b/i, /^itunes\b/i, /app\s*store/i, /apple\.com\/bill/i] },
  { canonical: 'google', display: 'Google', category: 'apps',
    domains: ['google.com', 'play.google.com'],
    aliasPatterns: [/^google\b/i, /google\s*play/i, /google\s*one/i] },
  { canonical: 'microsoft', display: 'Microsoft', category: 'apps',
    domains: ['microsoft.com', 'office.com', 'live.com'],
    aliasPatterns: [/^microsoft\b/i, /^office\s*365\b/i, /microsoft\s*365/i] },
  { canonical: 'github', display: 'GitHub', category: 'developer',
    domains: ['github.com'], aliasPatterns: [/^github\b/i] },
  { canonical: 'openai', display: 'OpenAI', category: 'developer',
    domains: ['openai.com'], aliasPatterns: [/openai|chatgpt/i] },
  { canonical: 'figma', display: 'Figma', category: 'developer',
    domains: ['figma.com'], aliasPatterns: [/^figma\b/i] },
  { canonical: 'notion', display: 'Notion', category: 'productivity',
    domains: ['notion.so', 'notion.com'], aliasPatterns: [/^notion\b/i] },
  { canonical: 'linear', display: 'Linear', category: 'productivity',
    domains: ['linear.app'], aliasPatterns: [/^linear\b/i] },
  { canonical: 'slack', display: 'Slack', category: 'productivity',
    domains: ['slack.com'], aliasPatterns: [/^slack\b/i] },
  { canonical: 'dropbox', display: 'Dropbox', category: 'productivity',
    domains: ['dropbox.com'], aliasPatterns: [/^dropbox\b/i] },
  { canonical: '1password', display: '1Password', category: 'productivity',
    domains: ['1password.com'], aliasPatterns: [/^1password\b/i] },

  // --- Food / delivery ----------------------------------------------------
  { canonical: 'doordash', display: 'DoorDash', category: 'food',
    domains: ['doordash.com'], aliasPatterns: [/door\s*dash/i] },
  { canonical: 'uber-eats', display: 'Uber Eats', category: 'food',
    domains: ['ubereats.com'], aliasPatterns: [/uber[\s*-]*eats/i] },
  { canonical: 'grubhub', display: 'Grubhub', category: 'food',
    domains: ['grubhub.com'], aliasPatterns: [/^grubhub\b/i] },
  { canonical: 'instacart', display: 'Instacart', category: 'groceries',
    domains: ['instacart.com'], aliasPatterns: [/^instacart\b/i] },
  { canonical: 'starbucks', display: 'Starbucks', category: 'food',
    domains: ['starbucks.com'], aliasPatterns: [/^starbucks\b/i] },
  { canonical: 'chipotle', display: 'Chipotle', category: 'food',
    domains: ['chipotle.com'], aliasPatterns: [/^chipotle\b/i] },

  // --- Transit ------------------------------------------------------------
  { canonical: 'uber', display: 'Uber', category: 'transit',
    domains: ['uber.com'], aliasPatterns: [/^uber\b(?!.*eats)/i] },
  { canonical: 'lyft', display: 'Lyft', category: 'transit',
    domains: ['lyft.com'], aliasPatterns: [/^lyft\b/i] },
  { canonical: 'airbnb', display: 'Airbnb', category: 'travel',
    domains: ['airbnb.com'], aliasPatterns: [/^airbnb\b/i] },
  { canonical: 'booking', display: 'Booking.com', category: 'travel',
    domains: ['booking.com'], aliasPatterns: [/booking\.com/i] },
  { canonical: 'delta', display: 'Delta Air Lines', category: 'travel',
    domains: ['delta.com'], aliasPatterns: [/delta\s*air/i] },
  { canonical: 'united', display: 'United Airlines', category: 'travel',
    domains: ['united.com'], aliasPatterns: [/united\s*airlines/i] },

  // --- Payments / wallets -------------------------------------------------
  { canonical: 'paypal', display: 'PayPal', category: 'payments',
    domains: ['paypal.com'], aliasPatterns: [/^paypal\b/i] },
  { canonical: 'venmo', display: 'Venmo', category: 'payments',
    domains: ['venmo.com'], aliasPatterns: [/^venmo\b/i] },
  { canonical: 'square', display: 'Square', category: 'payments',
    domains: ['squareup.com'], aliasPatterns: [/square\s*up|squareup/i] },
  { canonical: 'stripe', display: 'Stripe', category: 'payments',
    domains: ['stripe.com'], aliasPatterns: [/^stripe\b/i] },

  // --- Telecoms / ISPs ----------------------------------------------------
  { canonical: 'verizon', display: 'Verizon', category: 'utilities',
    domains: ['verizon.com'], aliasPatterns: [/^verizon\b/i] },
  { canonical: 'att', display: 'AT&T', category: 'utilities',
    domains: ['att.com'], aliasPatterns: [/^at&t\b|^at\s*&\s*t\b/i] },
  { canonical: 'tmobile', display: 'T-Mobile', category: 'utilities',
    domains: ['t-mobile.com'], aliasPatterns: [/^t-mobile\b/i] },
  { canonical: 'comcast', display: 'Xfinity', category: 'utilities',
    domains: ['comcast.com', 'xfinity.com'], aliasPatterns: [/xfinity|comcast/i] },

  // --- Fitness / wellness -------------------------------------------------
  { canonical: 'peloton', display: 'Peloton', category: 'fitness',
    domains: ['onepeloton.com'], aliasPatterns: [/peloton/i] },
  { canonical: 'classpass', display: 'ClassPass', category: 'fitness',
    domains: ['classpass.com'], aliasPatterns: [/classpass/i] },
  { canonical: 'strava', display: 'Strava', category: 'fitness',
    domains: ['strava.com'], aliasPatterns: [/^strava\b/i] },
  { canonical: 'headspace', display: 'Headspace', category: 'fitness',
    domains: ['headspace.com'], aliasPatterns: [/headspace/i] },
  { canonical: 'calm', display: 'Calm', category: 'fitness',
    domains: ['calm.com'], aliasPatterns: [/^calm\b/i] },

  // --- Retail / clothing --------------------------------------------------
  { canonical: 'target', display: 'Target', category: 'shopping',
    domains: ['target.com'], aliasPatterns: [/^target\b/i] },
  { canonical: 'walmart', display: 'Walmart', category: 'shopping',
    domains: ['walmart.com'], aliasPatterns: [/^walmart\b|^wal-mart\b/i] },
  { canonical: 'costco', display: 'Costco', category: 'shopping',
    domains: ['costco.com'], aliasPatterns: [/^costco\b/i] },
  { canonical: 'best-buy', display: 'Best Buy', category: 'shopping',
    domains: ['bestbuy.com'], aliasPatterns: [/best\s*buy/i] },
  { canonical: 'home-depot', display: 'The Home Depot', category: 'shopping',
    domains: ['homedepot.com'], aliasPatterns: [/home\s*depot/i] },
  { canonical: 'ikea', display: 'IKEA', category: 'shopping',
    domains: ['ikea.com'], aliasPatterns: [/^ikea\b/i] },
  { canonical: 'nike', display: 'Nike', category: 'shopping',
    domains: ['nike.com'], aliasPatterns: [/^nike\b/i] },

  // --- News / publishing --------------------------------------------------
  { canonical: 'nytimes', display: 'The New York Times', category: 'news',
    domains: ['nytimes.com'], aliasPatterns: [/new york times|nytimes/i] },
  { canonical: 'wapo', display: 'The Washington Post', category: 'news',
    domains: ['washingtonpost.com'], aliasPatterns: [/washington\s*post/i] },
  { canonical: 'wsj', display: 'The Wall Street Journal', category: 'news',
    domains: ['wsj.com'], aliasPatterns: [/wall\s*street\s*journal|wsj/i] },
  { canonical: 'substack', display: 'Substack', category: 'news',
    domains: ['substack.com'], aliasPatterns: [/^substack\b/i] },
  { canonical: 'medium', display: 'Medium', category: 'news',
    domains: ['medium.com'], aliasPatterns: [/^medium\b/i] },

  // --- Cloud / infra ------------------------------------------------------
  { canonical: 'aws', display: 'Amazon Web Services', category: 'cloud',
    domains: ['aws.amazon.com'], aliasPatterns: [/amazon web services|^aws\b/i] },
  { canonical: 'gcp', display: 'Google Cloud', category: 'cloud',
    domains: ['cloud.google.com'], aliasPatterns: [/google\s*cloud/i] },
  { canonical: 'cloudflare', display: 'Cloudflare', category: 'cloud',
    domains: ['cloudflare.com'], aliasPatterns: [/^cloudflare\b/i] },
  { canonical: 'vercel', display: 'Vercel', category: 'cloud',
    domains: ['vercel.com'], aliasPatterns: [/^vercel\b/i] },
  { canonical: 'netlify', display: 'Netlify', category: 'cloud',
    domains: ['netlify.com'], aliasPatterns: [/^netlify\b/i] },
  { canonical: 'digitalocean', display: 'DigitalOcean', category: 'cloud',
    domains: ['digitalocean.com'], aliasPatterns: [/digitalocean/i] },
];

/** Try to match raw merchant string OR from-domain to a canonical rule. */
export function findRuleMatch(rawMerchant: string, fromAddress: string): MerchantRule | null {
  const lower = (rawMerchant ?? '').toLowerCase().trim();
  const domain = (fromAddress.split('@')[1] ?? '').toLowerCase().trim();

  // Domain match wins.
  if (domain) {
    for (const r of MERCHANT_RULES) {
      if (!r.domains) continue;
      for (const d of r.domains) {
        if (domain === d || domain.endsWith('.' + d)) return r;
      }
    }
  }
  if (!lower) return null;
  for (const r of MERCHANT_RULES) {
    if (!r.aliasPatterns) continue;
    for (const p of r.aliasPatterns) {
      if (p.test(lower)) return r;
    }
  }
  return null;
}
