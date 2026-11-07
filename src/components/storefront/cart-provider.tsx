"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CatalogProduct, ProductVariant } from "@/lib/catalog/types";
import { authClient } from "@/lib/auth-client";
import { getCartStorageKey } from "@/components/storefront/cart-storage";
import { getAuthenticatedCustomerCart } from "@/app/actions/customer";

const LEGACY_CART_STORAGE_KEY = "najfancy.cart.v1";

export type CartLine = {
  productId: string;
  variantId: string;
  quantity: number;
  product: CatalogProduct;
  variant: ProductVariant;
};

type StoredCartLine = { productSlug: string; variantSku: string; quantity: number };
type LegacyStoredCartLine = { productId: string; variantId: string; quantity: number };

type CartContextValue = {
  items: CartLine[];
  isLoaded: boolean;
  loadError: string;
  itemCount: number;
  subtotalPaisa: bigint;
  refreshCustomerCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(raw: string | null): (StoredCartLine | LegacyStoredCartLine)[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is StoredCartLine | LegacyStoredCartLine => {
      if (typeof value !== "object" || value === null) return false;
      const row = value as Record<string, unknown>;
      return Number.isInteger(row.quantity) && Number(row.quantity) > 0 && Number(row.quantity) <= 20 &&
        ((typeof row.productSlug === "string" && typeof row.variantSku === "string") ||
          (typeof row.productId === "string" && typeof row.variantId === "string"));
    });
  } catch {
    return [];
  }
}

function serializeCart(items: CartLine[]): StoredCartLine[] {
  return items.map(({ product, variant, quantity }) => ({
    productSlug: product.slug,
    variantSku: variant.sku ?? variant.id,
    quantity,
  }));
}

async function restoreCart(raw: string | null): Promise<CartLine[]> {
  const entries = readStoredCart(raw);
  if (!entries.length) return [];
  const response = await fetch("/api/catalog/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) throw new Error("Saved bag could not be revalidated.");
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? payload as CartLine[] : [];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const userId = session.isPending ? null : session.data?.user?.id ?? null;
  const storageKey = session.isPending ? null : getCartStorageKey(userId);
  const [storedItems, setStoredItems] = useState<CartLine[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const [canPersist, setCanPersist] = useState(false);
  const [loadError, setLoadError] = useState("");
  const items = useMemo(
    () => storageKey && loadedStorageKey === storageKey ? storedItems : [],
    [loadedStorageKey, storageKey, storedItems],
  );

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      if (!storageKey) {
        setStoredItems([]);
        setLoadedStorageKey(null);
        setCanPersist(false);
        setIsLoaded(false);
        return;
      }

      setStoredItems([]);
      setLoadedStorageKey(null);
      setCanPersist(false);
      setIsLoaded(false);
      setLoadError("");

      if (userId) {
        try {
          // Customer localStorage is never read as cart input. Discard old snapshots so they cannot
          // resurrect rows that have already been removed from the database cart.
          window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
          window.localStorage.removeItem(storageKey);
        } catch { /* Storage can be unavailable in restricted browsers. */ }
        void getAuthenticatedCustomerCart().then((snapshot) => {
          if (!active) return;
          setStoredItems(snapshot.items as CartLine[]);
          setCanPersist(false);
        }).catch(() => {
          if (active) {
            setStoredItems([]);
            setLoadError("Your saved bag could not be loaded from your account. Reload when the store is available.");
          }
        }).finally(() => {
          if (!active) return;
          setLoadedStorageKey(storageKey);
          setIsLoaded(true);
        });
        return;
      }

      let stored: string | null = null;
      try {
        // Drop the old origin-wide snapshot. It was shared between guests and every signed-in customer.
        window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
        stored = window.localStorage.getItem(storageKey);
      } catch { /* Storage can be unavailable in restricted browsers. */ }

      if (!stored) {
        setStoredItems([]);
        setCanPersist(true);
        setLoadedStorageKey(storageKey);
        setIsLoaded(true);
        return;
      }

      void restoreCart(stored).then((restored) => {
        if (!active) return;
        setStoredItems(restored);
        setCanPersist(true);
      }).catch(() => {
        if (active) setLoadError("Your saved bag could not be checked against the catalog. Your saved items are preserved; reload when the catalog is available.");
      }).finally(() => {
        if (!active) return;
        setLoadedStorageKey(storageKey);
        setIsLoaded(true);
      });
    });
    return () => { active = false; window.cancelAnimationFrame(frame); };
  }, [storageKey, userId]);

  useEffect(() => {
    if (userId || !storageKey || loadedStorageKey !== storageKey || !isLoaded || !canPersist) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(serializeCart(items))); } catch { /* Keep the in-memory cart usable if storage is full or disabled. */ }
  }, [items, isLoaded, canPersist, loadedStorageKey, storageKey, userId]);

  useEffect(() => {
    if (userId) return;
    function onStorage(event: StorageEvent) {
      if (event.key === storageKey) void restoreCart(event.newValue).then((restored) => {
        setStoredItems(restored);
        setCanPersist(true);
        setLoadError("");
      }).catch(() => setLoadError("Your saved bag could not be checked against the catalog."));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey, userId]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    isLoaded: Boolean(storageKey && loadedStorageKey === storageKey && isLoaded),
    loadError,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotalPaisa: items.reduce((sum, item) => sum + BigInt(item.variant.pricePaisa) * BigInt(item.quantity), 0n),
    async refreshCustomerCart() {
      if (!userId) return;
      try {
        const snapshot = await getAuthenticatedCustomerCart();
        setStoredItems(snapshot.items as CartLine[]);
        setCanPersist(false);
        setLoadError("");
        if (storageKey) setLoadedStorageKey(storageKey);
        setIsLoaded(true);
      } catch (error) {
        // Never leave an old client snapshot displayed as if it were current after a failed refresh.
        setStoredItems([]);
        setLoadError("Your saved bag could not be refreshed from your account. Reload when the store is available.");
        throw error;
      }
    },
  }), [items, isLoaded, loadedStorageKey, loadError, storageKey, userId]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
