import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/authz";
import { verifyKhaltiReturn } from "@/lib/commerce/payment-processing";
import { getCanonicalAppUrl } from "@/lib/http/canonical-app-url";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const loginDestination = getCanonicalAppUrl("/login?next=/account/orders");
  if (!loginDestination) return Response.json({ error: "Payment return is unavailable." }, { status: 503 });

  const current = await getCurrentSession();
  if (!current || current.user.role !== "CUSTOMER") {
    return NextResponse.redirect(loginDestination);
  }

  const params = request.nextUrl.searchParams;
  const transactionReferences = [params.get("transaction_id"), params.get("txnId"), params.get("tidx")]
    .filter((value): value is string => Boolean(value));
  const inconsistentReferences = new Set(transactionReferences).size > 1;
  let orderNumber = "";
  let result: "PAID" | "PENDING" | "FAILED" | "VERIFICATION_FAILED" = "VERIFICATION_FAILED";
  try {
    const verified = await verifyKhaltiReturn(
      { userId: current.user.id, role: current.user.role },
      {
        pidx: params.get("pidx"),
        purchaseOrderId: params.get("purchase_order_id"),
        transactionReference: inconsistentReferences ? "invalid-callback-reference" : transactionReferences[0],
      },
    );
    orderNumber = verified.orderNumber;
    result = inconsistentReferences ? "VERIFICATION_FAILED" : verified.result;
  } catch {
    return NextResponse.redirect(getCanonicalAppUrl("/account/orders") ?? loginDestination);
  }

  const destination = getCanonicalAppUrl(`/order/success/${encodeURIComponent(orderNumber)}`);
  if (!destination) return Response.json({ error: "Payment return is unavailable." }, { status: 503 });
  destination.searchParams.set("payment", result.toLowerCase().replaceAll("_", "-"));
  return NextResponse.redirect(destination);
}
