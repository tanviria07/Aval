import { ScheduleAt } from 'spacetimedb';
import { schema, table, t, SenderError } from 'spacetimedb/server';

const member = table(
  { name: 'member', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    role: t.string(), // 'buyer' | 'seller'
    slot: t.string(), // 'A' | 'B' | 'C' | 'D'
    online: t.bool(),
  }
);

const account = table(
  { name: 'account', public: true },
  {
    slot: t.string().primaryKey(),
    label: t.string(),
    nessieAccountId: t.string(),
    balanceCents: t.u64(),
  }
);

const listing = table(
  { name: 'listing', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    sellerId: t.identity(),
    title: t.string(),
    emoji: t.string(),
    listCents: t.u64(),
    status: t.string(), // 'open' | 'in_deal' | 'sold'
    createdAt: t.u64(),
  }
);

const secret_limit = table(
  { name: 'secret_limit' },
  {
    id: t.u64().primaryKey().autoInc(),
    ownerId: t.identity().index('btree'),
    dealOrListingId: t.u64().index('btree'),
    kind: t.string(), // 'floor' | 'ceiling'
    cents: t.u64(),
  }
);

const deal = table(
  { name: 'deal', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    listingId: t.u64().index('btree'),
    buyerId: t.identity(),
    sellerId: t.identity(),
    status: t.string(),
    round: t.u32(),
    bidCents: t.u64(),
    askCents: t.u64(),
    priceCents: t.option(t.u64()),
    buyerAccepted: t.bool(),
    sellerAccepted: t.bool(),
    shipByAt: t.option(t.u64()),
    tracking: t.option(t.string()),
    holdTransferId: t.option(t.string()),
    releaseTransferId: t.option(t.string()),
    refundTransferId: t.option(t.string()),
    createdAt: t.u64(),
  }
);

const message = table(
  { name: 'message', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    dealId: t.u64().index('btree'),
    from: t.string(), // 'buyer_agent' | 'seller_agent' | 'system'
    text: t.string(),
    cents: t.option(t.u64()),
    at: t.u64(),
  }
);

const nessie_log = table(
  { name: 'nessie_log', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    method: t.string(),
    path: t.string(),
    status: t.u32(),
    note: t.string(),
    at: t.u64(),
  }
);

const audit_event = table(
  { name: 'audit_event', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    text: t.string(),
    at: t.u64(),
  }
);

const config = table(
  { name: 'config' },
  {
    key: t.string().primaryKey(),
    value: t.string(),
  }
);

const outbox = table(
  { name: 'outbox' },
  {
    id: t.u64().primaryKey().autoInc(),
    dealId: t.u64(),
    kind: t.string(), // 'hold' | 'release' | 'refund'
    scheduledAt: t.scheduleAt(),
  }
);

const negotiation_tick = table(
  { name: 'negotiation_tick' },
  t.row('NegotiationTickRow', {
    id: t.u64().primaryKey().autoInc(),
    dealId: t.u64(),
    scheduledAt: t.scheduleAt(),
  })
);

const ship_timer = table(
  { name: 'ship_timer' },
  {
    id: t.u64().primaryKey().autoInc(),
    dealId: t.u64(),
    scheduledAt: t.scheduleAt(),
  }
);

const spacetime = schema({
  member,
  account,
  listing,
  secret_limit,
  deal,
  message,
  nessie_log,
  audit_event,
  config,
  outbox,
  negotiation_tick,
  ship_timer,
});

function nowMicros(ctx: any): bigint {
  return ctx.timestamp.microsSinceUnixEpoch;
}

function me(ctx: any) {
  const m = ctx.db.member.identity.find(ctx.sender);
  if (!m) throw new SenderError('Not a member');
  return m;
}

function requireRole(ctx: any, role: string) {
  const m = me(ctx);
  if (m.role !== role) throw new SenderError(`Only ${role} can do that`);
  return m;
}

function dollars(cents: bigint): string {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function findSecretLimit(ctx: any, ownerId: any, dealOrListingId: bigint, kind: string) {
  for (const s of ctx.db.secret_limit.iter()) {
    if (s.ownerId.equals(ownerId) && s.dealOrListingId === dealOrListingId && s.kind === kind) return s;
  }
  return undefined;
}

function nextRound(
  bidCents: bigint, askCents: bigint,
  floorCents: bigint, ceilingCents: bigint
): { bid: bigint; ask: bigint; crossed: boolean; price: bigint } {
  const buyerGap = ceilingCents > bidCents ? ceilingCents - bidCents : 0n;
  const newBid = bidCents + buyerGap / 4n;

  const sellerGap = askCents > floorCents ? askCents - floorCents : 0n;
  const newAsk = askCents - sellerGap / 4n;

  const crossed = newBid >= newAsk;
  const price = crossed ? (newBid + newAsk) / 2n : 0n;

  return { bid: newBid, ask: newAsk, crossed, price };
}

function getNessieKey(ctx: any): string {
  const row = ctx.db.config.key.find('nessie_api_key');
  if (!row) throw new SenderError('Nessie API key not set');
  return row.value;
}

function scheduleTick(ctx: any, dealId: bigint) {
  ctx.db.negotiation_tick.insert({
    id: 0n,
    dealId,
    scheduledAt: ScheduleAt.time(nowMicros(ctx) + 2_500_000n),
  });
}

export const join = spacetime.reducer(
  { name: t.string(), role: t.string(), slot: t.string() },
  (ctx, { name, role, slot }) => {
    const existing = ctx.db.member.identity.find(ctx.sender);
    if (existing) {
      ctx.db.member.identity.update({ ...existing, name, role, slot, online: true });
    } else {
      ctx.db.member.insert({
        identity: ctx.sender,
        name,
        role,
        slot,
        online: true,
      });
    }
    ctx.db.audit_event.insert({
      id: 0n,
      text: `${name} joined as ${role}`,
      at: nowMicros(ctx),
    });
  }
);

export const createListing = spacetime.reducer(
  {
    title: t.string(),
    emoji: t.string(),
    listCents: t.u64(),
    floorCents: t.u64(),
  },
  (ctx, { title, emoji, listCents, floorCents }) => {
    const seller = requireRole(ctx, 'seller');
    const listingRow = ctx.db.listing.insert({
      id: 0n,
      sellerId: ctx.sender,
      title,
      emoji,
      listCents,
      status: 'open',
      createdAt: nowMicros(ctx),
    });
    ctx.db.secret_limit.insert({
      id: 0n,
      ownerId: ctx.sender,
      dealOrListingId: listingRow.id,
      kind: 'floor',
      cents: floorCents,
    });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `${seller.name} listed ${emoji} ${title} for ${dollars(listCents)}`,
      at: nowMicros(ctx),
    });
  }
);

export const startDeal = spacetime.reducer(
  { listingId: t.u64(), ceilingCents: t.u64() },
  (ctx, { listingId, ceilingCents }) => {
    requireRole(ctx, 'buyer');
    const listingRow = ctx.db.listing.id.find(listingId);
    if (!listingRow) throw new SenderError('Listing not found');
    if (listingRow.status !== 'open') {
      throw new SenderError("Someone's already negotiating this.");
    }
    const floor = findSecretLimit(ctx, listingRow.sellerId, listingId, 'floor');
    if (!floor) throw new SenderError('Seller floor not found');

    const bidCents = listingRow.listCents * 7n / 10n;
    const askCents = listingRow.listCents;
    const created = ctx.db.deal.insert({
      id: 0n,
      listingId,
      buyerId: ctx.sender,
      sellerId: listingRow.sellerId,
      status: 'negotiating',
      round: 0,
      bidCents,
      askCents,
      priceCents: undefined,
      buyerAccepted: false,
      sellerAccepted: false,
      shipByAt: undefined,
      tracking: undefined,
      holdTransferId: undefined,
      releaseTransferId: undefined,
      refundTransferId: undefined,
      createdAt: nowMicros(ctx),
    });
    ctx.db.listing.id.update({ ...listingRow, status: 'in_deal' });
    ctx.db.secret_limit.insert({
      id: 0n,
      ownerId: ctx.sender,
      dealOrListingId: created.id,
      kind: 'ceiling',
      cents: ceilingCents,
    });
    const at = nowMicros(ctx);
    ctx.db.message.insert({
      id: 0n,
      dealId: created.id,
      from: 'seller_agent',
      text: `Asking ${dollars(askCents)}.`,
      cents: askCents,
      at,
    });
    ctx.db.message.insert({
      id: 0n,
      dealId: created.id,
      from: 'buyer_agent',
      text: `Offering ${dollars(bidCents)}.`,
      cents: bidCents,
      at,
    });
    scheduleTick(ctx, created.id);
  }
);

export const accept = spacetime.reducer({ dealId: t.u64() }, (ctx, { dealId }) => {
  const m = me(ctx);
  const d = ctx.db.deal.id.find(dealId);
  if (!d) throw new SenderError('Deal not found');
  if (d.status !== 'agreed') throw new SenderError('Not ready for acceptance');
  const isBuyer = ctx.sender.equals(d.buyerId);
  const isSeller = ctx.sender.equals(d.sellerId);
  if (!isBuyer && !isSeller) throw new SenderError('Not a party to this deal');
  if (isBuyer && d.buyerAccepted) throw new SenderError('Already accepted');
  if (isSeller && d.sellerAccepted) throw new SenderError('Already accepted');

  const updated = {
    ...d,
    buyerAccepted: isBuyer ? true : d.buyerAccepted,
    sellerAccepted: isSeller ? true : d.sellerAccepted,
  };

  if (updated.buyerAccepted && updated.sellerAccepted) {
    ctx.db.deal.id.update({ ...updated, status: 'funding' });
    ctx.db.outbox.insert({
      id: 0n,
      dealId,
      kind: 'hold',
      scheduledAt: ScheduleAt.time(nowMicros(ctx)),
    });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `Both accepted. Escrow funding queued.`,
      at: nowMicros(ctx),
    });
  } else {
    ctx.db.deal.id.update(updated);
    ctx.db.audit_event.insert({
      id: 0n,
      text: `${m.name} accepted.`,
      at: nowMicros(ctx),
    });
  }
});

export const decline = spacetime.reducer({ dealId: t.u64() }, (ctx, { dealId }) => {
  const d = ctx.db.deal.id.find(dealId);
  if (!d) throw new SenderError('Deal not found');
  if (!ctx.sender.equals(d.buyerId) && !ctx.sender.equals(d.sellerId)) {
    throw new SenderError('Not a party to this deal');
  }
  if (!['negotiating', 'agreed', 'funding'].includes(d.status)) {
    throw new SenderError('Deal cannot be declined now');
  }
  ctx.db.deal.id.update({ ...d, status: 'declined' });
  if (d.status === 'agreed' || d.status === 'funding') {
    const listing = ctx.db.listing.id.find(d.listingId);
    if (listing) ctx.db.listing.id.update({ ...listing, status: 'open' });
  }
  ctx.db.audit_event.insert({
    id: 0n,
    text: `Deal declined.`,
    at: nowMicros(ctx),
  });
});

export const markShipped = spacetime.reducer(
  { dealId: t.u64(), tracking: t.string() },
  (ctx, { dealId, tracking }) => {
    const d = ctx.db.deal.id.find(dealId);
    if (!d) throw new SenderError('Deal not found');
    if (!ctx.sender.equals(d.sellerId)) throw new SenderError('Only the seller can ship');
    if (d.status !== 'escrowed') throw new SenderError('Not escrowed yet');
    ctx.db.deal.id.update({ ...d, status: 'shipped', tracking });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `Shipped. Tracking: ${tracking}.`,
      at: nowMicros(ctx),
    });
  }
);

export const confirmDelivery = spacetime.reducer({ dealId: t.u64() }, (ctx, { dealId }) => {
  const d = ctx.db.deal.id.find(dealId);
  if (!d) throw new SenderError('Deal not found');
  if (!ctx.sender.equals(d.buyerId)) throw new SenderError('Only the buyer can confirm');
  if (d.status !== 'shipped') throw new SenderError('Not shipped yet');
  ctx.db.deal.id.update({ ...d, status: 'releasing' });
  ctx.db.outbox.insert({
    id: 0n,
    dealId,
    kind: 'release',
    scheduledAt: ScheduleAt.time(nowMicros(ctx)),
  });
  ctx.db.audit_event.insert({
    id: 0n,
    text: `Delivery confirmed. Payout queued.`,
    at: nowMicros(ctx),
  });
});

export const demoReset = spacetime.reducer(ctx => {
  for (const row of [...ctx.db.deal.iter()]) ctx.db.deal.id.delete(row.id);
  for (const row of [...ctx.db.message.iter()]) ctx.db.message.id.delete(row.id);
  for (const row of [...ctx.db.secret_limit.iter()]) ctx.db.secret_limit.id.delete(row.id);
  for (const row of [...ctx.db.nessie_log.iter()]) ctx.db.nessie_log.id.delete(row.id);
  for (const row of [...ctx.db.audit_event.iter()]) ctx.db.audit_event.id.delete(row.id);
  for (const row of [...ctx.db.outbox.iter()]) ctx.db.outbox.id.delete(row.id);
  for (const row of [...ctx.db.negotiation_tick.iter()]) ctx.db.negotiation_tick.id.delete(row.id);
  for (const row of [...ctx.db.ship_timer.iter()]) ctx.db.ship_timer.id.delete(row.id);
  for (const row of [...ctx.db.listing.iter()]) {
    ctx.db.listing.id.update({ ...row, status: 'open' });
  }
});

export const demoFastForward = spacetime.reducer({ dealId: t.u64() }, (ctx, { dealId }) => {
  const d = ctx.db.deal.id.find(dealId);
  if (!d) throw new SenderError('Deal not found');
  if (d.status === 'escrowed') {
    ctx.db.deal.id.update({ ...d, status: 'refunding' });
    ctx.db.outbox.insert({
      id: 0n,
      dealId,
      kind: 'refund',
      scheduledAt: ScheduleAt.time(nowMicros(ctx)),
    });
  }
});

export const setConfig = spacetime.reducer(
  { key: t.string(), value: t.string() },
  (ctx, { key, value }) => {
    if (ctx.db.config.key.find(key)) return;
    ctx.db.config.insert({ key, value });
  }
);

export const negotiationTick = spacetime.reducer(
  { onSchedule: negotiation_tick },
  { arg: negotiation_tick.rowType },
  (ctx, { arg }) => {
    const row = ctx.db.deal.id.find(arg.dealId);
    if (!row || row.status !== 'negotiating') return;

    const ceiling = findSecretLimit(ctx, row.buyerId, row.id, 'ceiling');
    const floor = findSecretLimit(ctx, row.sellerId, row.listingId, 'floor');
    if (!ceiling || !floor) {
      ctx.db.deal.id.update({ ...row, status: 'no_deal' });
      return;
    }

    const { bid, ask, crossed, price } = nextRound(
      row.bidCents,
      row.askCents,
      floor.cents,
      ceiling.cents
    );
    if (crossed) {
      ctx.db.deal.id.update({
        ...row,
        status: 'agreed',
        priceCents: price,
        bidCents: bid,
        askCents: ask,
      });
      ctx.db.message.insert({
        id: 0n,
        dealId: row.id,
        from: 'system',
        text: `Deal at ${dollars(price)}.`,
        cents: price,
        at: nowMicros(ctx),
      });
      return;
    }

    const round = row.round + 1;
    if (round >= 8) {
      ctx.db.deal.id.update({ ...row, status: 'no_deal', round });
      return;
    }
    ctx.db.deal.id.update({
      ...row,
      bidCents: bid,
      askCents: ask,
      round,
    });
    const at = nowMicros(ctx);
    ctx.db.message.insert({
      id: 0n,
      dealId: row.id,
      from: 'seller_agent',
      text: `Counter at ${dollars(ask)}.`,
      cents: ask,
      at,
    });
    ctx.db.message.insert({
      id: 0n,
      dealId: row.id,
      from: 'buyer_agent',
      text: `Counter at ${dollars(bid)}.`,
      cents: bid,
      at,
    });
    scheduleTick(ctx, row.id);
  }
);

export const shipTimeout = spacetime.reducer(
  { onSchedule: ship_timer },
  { arg: ship_timer.rowType },
  (ctx, { arg }) => {
    const d = ctx.db.deal.id.find(arg.dealId);
    if (!d) return;
    if (d.status !== 'escrowed') return;
    ctx.db.deal.id.update({ ...d, status: 'refunding' });
    ctx.db.outbox.insert({
      id: 0n,
      dealId: arg.dealId,
      kind: 'refund',
      scheduledAt: ScheduleAt.time(nowMicros(ctx)),
    });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `Ship deadline missed. Refund queued.`,
      at: nowMicros(ctx),
    });
  }
);

export const markPaymentHeld = spacetime.reducer(
  { dealId: t.u64(), transferId: t.string() },
  (ctx, { dealId, transferId }) => {
    const d = ctx.db.deal.id.find(dealId);
    if (!d) throw new SenderError('Deal not found');
    if (d.status !== 'funding') throw new SenderError('Deal not awaiting payment');
    const shipBy = nowMicros(ctx) + 7n * 24n * 60n * 60n * 1_000_000n;
    ctx.db.deal.id.update({
      ...d,
      status: 'escrowed',
      holdTransferId: transferId,
      shipByAt: shipBy,
    });
    ctx.db.ship_timer.insert({
      id: 0n,
      dealId,
      scheduledAt: ScheduleAt.time(shipBy),
    });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `Escrow held. Transfer ${transferId}.`,
      at: nowMicros(ctx),
    });
  }
);

export const markReleased = spacetime.reducer(
  { dealId: t.u64(), transferId: t.string() },
  (ctx, { dealId, transferId }) => {
    const d = ctx.db.deal.id.find(dealId);
    if (!d) throw new SenderError('Deal not found');
    if (d.status !== 'releasing') throw new SenderError('Deal not in releasing state');
    ctx.db.deal.id.update({
      ...d,
      status: 'released',
      releaseTransferId: transferId,
    });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `Released. Transfer ${transferId}.`,
      at: nowMicros(ctx),
    });
  }
);

export const markRefunded = spacetime.reducer(
  { dealId: t.u64(), transferId: t.string() },
  (ctx, { dealId, transferId }) => {
    const d = ctx.db.deal.id.find(dealId);
    if (!d) throw new SenderError('Deal not found');
    if (d.status !== 'refunding') throw new SenderError('Deal not in refunding state');
    ctx.db.deal.id.update({
      ...d,
      status: 'refunded',
      refundTransferId: transferId,
    });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `Refunded. Transfer ${transferId}.`,
      at: nowMicros(ctx),
    });
  }
);

export const seedBank = spacetime.procedure(t.unit(), ctx => {
  const key = ctx.withTx(tx => {
    const row = tx.db.config.key.find('nessie_api_key');
    if (!row) throw new SenderError('Nessie API key not set');
    return row.value;
  });

  const base = ctx.withTx(tx => {
    const row = tx.db.config.key.find('nessie_base');
    return row?.value ?? 'https://api.nessieisreal.com';
  });

  const slots = [
    { slot: 'A', first: 'Mateo', last: 'Alvarez', label: 'Seller', start: 0 },
    { slot: 'B', first: 'Judge', last: 'A', label: 'Buyer A', start: 166000 },
    { slot: 'C', first: 'Judge', last: 'B', label: 'Buyer B', start: 166000 },
    { slot: 'D', first: 'Spare', last: 'Buyer', label: 'Spare Buyer', start: 166000 },
    { slot: 'ESCROW', first: 'Aval', last: 'Escrow', label: 'Escrow', start: 0 },
  ];

  for (const s of slots) {
    const customerRes = ctx.http.fetch(`${base}/customers?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: s.first,
        last_name: s.last,
        address: {
          street_number: '1',
          street_name: 'Main St',
          city: 'Ann Arbor',
          state: 'MI',
          zip: '48104',
        },
      }),
    });
    const customerBody = customerRes.json();
    const customerId = customerBody?.object_created?._id ?? customerBody?.objectCreated?._id;
    if (!customerId) continue;

    const accountRes = ctx.http.fetch(`${base}/customers/${customerId}/accounts?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'Checking',
        nickname: `${s.label} account`,
        rewards: 0,
        balance: s.start / 100,
      }),
    });
    const accountBody = accountRes.json();
    const nessieAccountId = accountBody?.object_created?._id ?? accountBody?.objectCreated?._id;

    ctx.withTx(tx => {
      const existing = tx.db.account.slot.find(s.slot);
      if (existing) {
        tx.db.account.slot.update({
          slot: s.slot,
          label: s.label,
          nessieAccountId: nessieAccountId ?? '',
          balanceCents: BigInt(s.start),
        });
      } else {
        tx.db.account.insert({
          slot: s.slot,
          label: s.label,
          nessieAccountId: nessieAccountId ?? '',
          balanceCents: BigInt(s.start),
        });
      }
      tx.db.nessie_log.insert({
        id: 0n,
        method: 'POST',
        path: `/customers/${customerId}/accounts`,
        status: accountRes.status,
        note: `${s.label} seeded`,
        at: ctx.timestamp.microsSinceUnixEpoch,
      });
    });
  }

  ctx.withTx(tx => {
    tx.db.audit_event.insert({
      id: 0n,
      text: 'Bank seeded. 5 accounts created.',
      at: ctx.timestamp.microsSinceUnixEpoch,
    });
  });

  return {};
});

export const sendTransfer = spacetime.procedure(
  { onSchedule: outbox },
  { arg: outbox.rowType },
  t.unit(),
  (ctx, { arg }) => {
    const data = ctx.withTx(tx => {
      const keyRow = tx.db.config.key.find('nessie_api_key');
      const baseRow = tx.db.config.key.find('nessie_base');
      const d = tx.db.deal.id.find(arg.dealId);
      const escrow = tx.db.account.slot.find('ESCROW');
      let buyerSlot: string | undefined;
      let sellerSlot: string | undefined;
      if (d) {
        const buyerM = tx.db.member.identity.find(d.buyerId);
        const sellerM = tx.db.member.identity.find(d.sellerId);
        buyerSlot = buyerM?.slot;
        sellerSlot = sellerM?.slot;
      }
      return {
        key: keyRow?.value,
        base: baseRow?.value ?? 'https://api.nessieisreal.com',
        deal: d,
        escrow,
        buyerSlot,
        sellerSlot,
      };
    });

    if (!data.key || !data.deal || !data.escrow) {
      ctx.withTx(tx => {
        tx.db.nessie_log.insert({
          id: 0n,
          method: 'SKIP',
          path: `outbox ${arg.kind} deal ${arg.dealId}`,
          status: 0,
          note: 'Missing deal, escrow, or key',
          at: ctx.timestamp.microsSinceUnixEpoch,
        });
      });
      return {};
    }

    const sourceSlot = arg.kind === 'hold' ? data.buyerSlot : 'ESCROW';
    const destSlot = arg.kind === 'hold' ? 'ESCROW' : arg.kind === 'release' ? data.sellerSlot : data.buyerSlot;

    if (sourceSlot === undefined || destSlot === undefined) {
      ctx.withTx(tx => {
        tx.db.nessie_log.insert({
          id: 0n,
          method: 'SKIP',
          path: `outbox ${arg.kind} deal ${arg.dealId}`,
          status: 0,
          note: 'Missing buyer or seller slot',
          at: ctx.timestamp.microsSinceUnixEpoch,
        });
      });
      return {};
    }

    const source = ctx.withTx(tx => tx.db.account.slot.find(sourceSlot));
    const dest = ctx.withTx(tx => tx.db.account.slot.find(destSlot));

    if (!source) {
      ctx.withTx(tx => {
        tx.db.nessie_log.insert({
          id: 0n,
          method: 'SKIP',
          path: `no source ${sourceSlot}`,
          status: 0,
          note: 'Source account missing',
          at: ctx.timestamp.microsSinceUnixEpoch,
        });
      });
      return {};
    }

    const amountCents = data.deal.priceCents ?? 0n;
    const amountDollars = Number(amountCents) / 100;

    const res = ctx.http.fetch(
      `${data.base}/accounts/${source.nessieAccountId}/transfers?key=${data.key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          amount: amountDollars,
          description: `Aval ${arg.kind} deal ${arg.dealId}`,
        }),
      }
    );

    const body = res.json();
    const transferId =
      body?.object_created?._id ??
      body?.objectCreated?._id ??
      `txn_${Date.now()}`;

    ctx.withTx(tx => {
      const currentSource = tx.db.account.slot.find(sourceSlot);
      const currentDest = tx.db.account.slot.find(destSlot);

      if (currentSource) {
        tx.db.account.slot.update({
          ...currentSource,
          balanceCents: currentSource.balanceCents - amountCents,
        });
      }
      if (currentDest) {
        tx.db.account.slot.update({
          ...currentDest,
          balanceCents: currentDest.balanceCents + amountCents,
        });
      }

      tx.db.nessie_log.insert({
        id: 0n,
        method: 'POST',
        path: `/accounts/${source.nessieAccountId}/transfers`,
        status: res.status,
        note: `${arg.kind} $${amountDollars.toFixed(2)} ${sourceSlot} to ${destSlot}`,
        at: ctx.timestamp.microsSinceUnixEpoch,
      });

      const d = tx.db.deal.id.find(arg.dealId);
      if (d) {
        if (arg.kind === 'hold') {
          const shipBy = ctx.timestamp.microsSinceUnixEpoch + 7n * 24n * 60n * 60n * 1_000_000n;
          tx.db.deal.id.update({
            ...d,
            status: 'escrowed',
            holdTransferId: transferId,
            shipByAt: shipBy,
          });
          tx.db.ship_timer.insert({
            id: 0n,
            dealId: arg.dealId,
            scheduledAt: ScheduleAt.time(shipBy),
          });
        } else if (arg.kind === 'release') {
          tx.db.deal.id.update({
            ...d,
            status: 'released',
            releaseTransferId: transferId,
          });
        } else if (arg.kind === 'refund') {
          tx.db.deal.id.update({
            ...d,
            status: 'refunded',
            refundTransferId: transferId,
          });
        }
      }

      tx.db.audit_event.insert({
        id: 0n,
        text: `${arg.kind} complete. Transfer ${transferId}.`,
        at: ctx.timestamp.microsSinceUnixEpoch,
      });
    });

    return {};
  }
);

export const my_limits = spacetime.view(
  { name: 'my_limits', public: true },
  t.array(t.row('MyLimit', { kind: t.string(), cents: t.u64() })),
  ctx => {
    const out: { kind: string; cents: bigint }[] = [];
    for (const row of ctx.db.secret_limit.iter()) {
      if (row.ownerId.equals(ctx.sender)) {
        out.push({ kind: row.kind, cents: row.cents });
      }
    }
    return out;
  }
);

export default spacetime;
