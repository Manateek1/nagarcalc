# NagarCalc

A loud-looking, lightweight calculator with local arithmetic, hand-synthesized button sounds, and a tiny Gemini explanation after each result.

## Run locally

Use Node.js 22 or later. `npm test` runs the calculator and API handler checks. To preview the static UI, run a local static server from this directory; the AI endpoint requires the Vercel runtime and a `GEMINI_API_KEY` environment variable.

## Deploy on Vercel

Import this repository as a Vercel project and add `GEMINI_API_KEY` as an encrypted environment variable for Production and Preview. The key is read only by `api/overview.js`; it is never sent to the browser.
