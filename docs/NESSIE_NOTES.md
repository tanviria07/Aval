# Nessie notes

Aval talks to Capital One’s Nessie API at `https://api.nessieisreal.com`. These are the behaviors the local tests actually hit.

## Transfer request that works

`POST /accounts/{fromAccountId}/transfers` with exactly these four fields:

```json
{
  "transaction_date": "YYYY-MM-DD",
  "status": "completed",
  "amount": 2400.0,
  "description": "Aval hold payment 3 to {destinationAccountId}"
}
```

`medium` and `payee_id` are not sent. Nessie rejects them as extra fields. The transfer record itself does not name a counterparty, so Aval puts the destination account id in `description`. A 201 response looks like `{ "code": 201, "message": "...", "objectCreated": { "_id": "<transfer id>", ... } }`. Aval stores `objectCreated._id`.

## Balances do not move

A successful transfer does not change the balance Nessie returns from `GET /accounts/{id}`. The opening balance stays put. Aval therefore keeps its own ledger: Mom, the payee, and escrow balances are updated in the `account` table when a transfer returns 201. If a later `GET` balance equals the previous ledger balance plus the transfer delta, Aval uses the GET. Otherwise it keeps the arithmetic ledger.

## Bills

`GET /accounts/{id}/bills` is not usable here. A bill created without a nickname makes that list return 400 (`nickname field required`). Aval reads bills with `GET /enterprise/bills` and keeps the rows whose `account_id` is Margaret’s seeded account. `GET /bills/{id}` also works for a single bill.

An empty transfer list is `GET /accounts/{id}/transfers` → 404 `No transfers found`. Aval treats that as zero transfers, not an error.

## Real transfer ids from tests A–D

Every hold, release, and refund is a real Nessie transfer. The direct send in test D is included because it is the same call.

| Test | Payment | What moved | Nessie transfer id |
|---|---|---|---|
| D | 1 | direct $145.00 Palo Alto Electric | `e10ec2dd-56de-444c-9691-ec6c1af82520` |
| A | 3 | hold $2,400.00 Mom → escrow | `98fbe6f5-4052-4273-a388-bf616741daa5` |
| A | 3 | refund $2,400.00 escrow → Mom | `48a78b35-631b-4b8a-affb-c1c95d8a89bc` |
| B | 4 | hold $2,400.00 Mom → escrow | `2993936e-8ce2-4cd5-9910-65c33a546de0` |
| B | 4 | release $2,400.00 escrow → Priya Chen | `83643f53-2314-4b26-b921-c483bdd5623c` |
| C | 5 | hold $2,400.00 Mom → escrow | `d09a5721-4013-4fe7-98fe-10064f2278ed` |
| C | 5 | refund $2,400.00 escrow → Mom | `3f529a66-dd70-41cb-ba87-6e764c249f7f` |

Payment 2 was an interrupted first attempt at test A (the hold timer refunded it during a republish). It is not the passing run. Its ids were hold `d497f9f6-8875-4031-90b7-2fafe46b4b1c` and refund `3225e420-6fa6-41c2-a762-03a4b3ffca5c`.
