# Recall checking: free setup (about 5 minutes)

## What it does
When someone scans a product, the app asks your own small service whether a recall notice matches it. The service looks at public recall lists:

| List | Covers | How it finds a product |
|---|---|---|
| National Consumer Commission (South Africa) | local food, medical products, vehicles | brand + product name |
| US Consumer Product Safety Commission | consumer goods, electronics, toys | barcode, or brand + name |
| US Food and Drug Administration | food and supplements | barcode written in the notice, or brand + name |

It is free: no keys, no database, and Cloudflare's free plan allows 100,000 requests a day. Answers are remembered for six hours (and forgotten at once whenever an update changes how recalls are matched).

## Be honest about what it can and cannot do
- **It cannot promise a product is safe.** The app says "No recall notice found in ... This is not a guarantee" and tells people to check the batch on the pack.
- **A match by name is "possible", not "certain".** Only a barcode or batch printed in the notice is called a firm match.
- **US recalls may not cover South Africa.** The card says so.
- **If the lists cannot be reached, the app says "could not check"**, never "no recall".
- There is no single South African list with barcodes, so South African matching is by brand and product name.
- The NCC website is read through its WordPress search; if that is switched off the service falls back to the recall list page (recent notices only) and says so.

## Set it up
In VS Code, open a terminal and run these one at a time (you are already logged in to Cloudflare):

```
cd workers\recall-lookup
npx wrangler deploy
```

The last lines print your address, which will look like `https://product-trust-recall-lookup.producttrust.workers.dev`.

**Test it** in your browser. Add `/health` to the end: you should see `{"ok":true}`. Then try a real question, for example
`YOUR-ADDRESS/lookup?brand=McCain&name=McCain%20green%20beans` : the answer lists `sourcesChecked`.

**Turn it on** by adding one line to your `.env` (no spaces, no quotes; use YOUR address, without `/health`):

```
EXPO_PUBLIC_RECALL_LOOKUP_URL=https://product-trust-recall-lookup.producttrust.workers.dev
```

Then restart with `npx expo start --go -c` (for the website, run `npm run deploy:web` again).

## Optional: a free key for the US food list
If a test ever says the US food list failed with "rate limit", get a free key at https://open.fda.gov/apis/authentication/ and run, in `workers/recall-lookup`:

```
npx wrangler secret put OPENFDA_API_KEY
```

## If something looks wrong
- `sourcesFailed` in the answer names any list that could not be reached. One failing list does not stop the others.
- Turn recall checking off at any time by leaving the `.env` line blank.

## If a recall you KNOW exists is not found
Add `&debug=1` to the test address and read what the service says it did, for example:
`YOUR-ADDRESS/lookup?brand=McCain&name=McCain%20green%20beans&debug=1`
Look at the `debug` part of the answer: `ncc.queries` is what was asked of the South African site, `ncc.fetched` is how many notices came back, and `ncc.matched` is how many were judged to be this product.
If `fetched` is 0 the NCC site returned nothing for those words; if `fetched` is more than 0 but `matched` is 0, the notices exist but do not mention both the brand and a product word. Send me that block.

## Testing after a change
Use `&debug=1` on the test address: a debug question is never answered from memory, and it explains what was asked. (An ordinary test address shows the answer remembered from the last time that same product was checked: compare the `checkedAt` time in the answer with the clock.)
