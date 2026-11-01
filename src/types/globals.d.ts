/** Globals the game reads from its host page or app. */
export {};

declare global {
  interface Window {
    /** Settings the host page or app sets before the game loads (see src/config.ts). */
    GREENREV_CONFIG?: Record<string, any>;
    /** Present inside a React Native WebView. */
    ReactNativeWebView?: { postMessage(message: string): void };
    /** Optional analytics hook. */
    dataLayer?: unknown[];
    /** The running game, exposed for debugging and smoke tests. */
    game?: unknown;
    webkitAudioContext?: typeof AudioContext;
  }
  // globalThis.X lookups resolve through these
  var GREENREV_CONFIG: Record<string, any> | undefined;
  var ReactNativeWebView: { postMessage(message: string): void } | undefined;
  var webkitAudioContext: typeof AudioContext | undefined;
}
