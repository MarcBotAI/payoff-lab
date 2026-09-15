/**
 * Payoff Lab — Amazon.ca Associates
 * Swap the tag in ONE place. On load, every amazon.ca link gets this tag.
 */
const AMAZON_TAG = 'payofflab-20';

(function applyAmazonTag() {
  document.querySelectorAll('a[href*="amazon.ca"]').forEach(function (a) {
    try {
      var u = new URL(a.href, window.location.href);
      u.searchParams.set('tag', AMAZON_TAG);
      a.href = u.toString();
    } catch (_) {
      /* ignore malformed hrefs */
    }
  });
})();
