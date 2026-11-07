const CART_STORAGE_PREFIX = "najfancy.cart.v2";

/** Namespace for the guest browser cart and legacy authenticated snapshots; authenticated cart data is server-owned. */
export function getCartStorageKey(userId: string | null): string {
  return userId
    ? `${CART_STORAGE_PREFIX}.customer.${encodeURIComponent(userId)}`
    : `${CART_STORAGE_PREFIX}.guest`;
}
