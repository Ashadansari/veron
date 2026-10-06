const CART_STORAGE_PREFIX = "najfancy.cart.v2";

/** Give each authenticated customer a private browser-side snapshot; guests have a separate empty scope. */
export function getCartStorageKey(userId: string | null): string {
  return userId
    ? `${CART_STORAGE_PREFIX}.customer.${encodeURIComponent(userId)}`
    : `${CART_STORAGE_PREFIX}.guest`;
}
