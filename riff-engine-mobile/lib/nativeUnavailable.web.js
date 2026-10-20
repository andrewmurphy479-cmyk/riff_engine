// A null module keeps native ad / purchase SDKs unavailable in the browser.
// monetization/ guards every require of them, so property access on null
// throws inside those try blocks and the app runs ad-free on web.
module.exports = null;
