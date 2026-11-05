# Physical receipts in multiple batches

V20 removes one-receipt-per-assignment and one-receipt-per-load-line restrictions, keeps unique `(return_id, load_item_id)`, and adds unique `request_id` and request hash. V1–V4 remain unchanged. Existing receipts keep their quantities/history.

`POST /api/v1/delivery/attempts/{id}/return-inspection` accepts:

```json
{
  "requestId": "0480e2ca-c740-4409-b00a-798e79f16732",
  "lines": [{ "loadItemId": 123, "quantity": 2, "sellable": 1 }],
  "note": "One bottle damaged"
}
```

- `quantity` is physically received **in this receipt**. `sellable` must be between zero and quantity. The remainder of the actual receipt is damaged/non-sellable, not missing goods.
- A new requestId is required for each new explicit-quantity receipt. Retrying the same requestId/payload returns the saved receipt without repeating stock movements. Reusing it with a different actor/payload or assignment is rejected. This also works after the final receipt closes the order.
- One or more outstanding load lines can be submitted. Zero, negative, foreign/duplicate lines, quantities exceeding the remainder, and sellable quantities above actual received are rejected. Omit lines not received in this batch. Expired stock cannot be marked sellable; damaged stock requires a note.
- Order locking serializes concurrent receipt requests. Cumulative `quantity_returned` grows by actual received; only sellable quantity increases onHand and generates RETURN. Reservations and previous quantityDispatched are not reversed. Any error rolls back the complete receipt.
- Pending lines expose `quantity` as the remaining quantity: loaded minus delivered minus returned. Historical receipt lines expose their immutable actual receipt quantity.
- Partial receipt leaves the order OUT_FOR_DELIVERY and in the pending queue. Only complete physical return closes the order to CANCELLED and enables redelivery reservations. Missing goods stay outstanding; this feature does not silently write off lost goods or allow excess goods into the order's return. Financial compensation/write-off is outside this flow.
- Legacy requests without quantity preserve the old full-remainder inspection behavior. They cannot mix explicit and omitted quantity fields. The FE always uses explicit quantities and requestId.
- The legacy order-based inventory return endpoint supports the same payload plus orderId. The attempt endpoint derives ownership/order from the original failed attempt.

The warehouse form starts actual/sellable counts at zero, shows remaining quantities and actual damage separately, and refreshes pending receipts/history/inventory after success. Each saved receipt is read-only. To receive a later batch, open the refreshed pending order again.
