import '@testing-library/jest-dom'

// jsdom doesn't implement Element.prototype.scrollTo, which the Inspector calls
// to snap back to the top when the selected node changes. Stub it so component
// tests that mount the Inspector don't throw.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}
