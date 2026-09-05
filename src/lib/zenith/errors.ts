/**
 * Zenith connect error codes -> user-facing copy. Shared by the server page
 * (full-page fallback path) and the client popup button, so both show identical
 * messages.
 */
export const ZENITH_ERROR_MESSAGES: Record<string, string> = {
  denied: "The connection was cancelled on Zenith Code.",
  bad_state: "The connect link expired or was invalid. Please try again.",
  no_code: "Zenith Code didn't return an authorization code. Please try again.",
  exchange: "Couldn't complete the connection with Zenith Code. Please try again.",
  no_dealer: "Your dealer account couldn't be found.",
  no_number: "Zenith Code didn't return a registered WhatsApp number for your account.",
  no_org: "Zenith Code didn't return an account id, so we couldn't link your account. Please try again.",
  zenith_already_linked:
    "This Zenith Code account is already connected to another NivaasBhoomi dealer. Disconnect it there first.",
  dealer_already_linked:
    "Your account is already connected to a different Zenith Code account. Disconnect first.",
  not_configured: "Zenith Code isn't configured on the server yet.",
  server: "Something went wrong connecting to Zenith Code. Please try again.",
};
