import { ScheduleAt } from 'spacetimedb';
import { schema, table, t, SenderError } from 'spacetimedb/server';

const SEVEN_DAYS = 7n * 24n * 60n * 60n * 1_000_000n;
const MARGARET = 'Margaret Chen';

const member = table(
  { name: 'member', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    role: t.string(), // 'elder' | 'guardian'
    slot: t.string(),
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
    status: t.string(),
    createdAt: t.u64(),
  }
);

const secret_limit = table(
  { name: 'secret_limit' },
  {
    id: t.u64().primaryKey().autoInc(),
    ownerId: t.identity().index('btree'),
    dealOrListingId: t.u64().index('btree'),
    kind: t.string(),
    cents: t.u64(),
  }
);

const payment = table(
  { name: 'payment', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    elderId: t.identity(),
    payeeName: t.string(),
    payeeNessieId: t.option(t.string()),
    amountCents: t.u64(),
    score: t.u32(),
    reasonsJson: t.string(),
    status: t.string(),
    secretFlag: t.bool(),
    paidBy: t.option(t.identity()),
    pausedBy: t.option(t.identity()),
    stoppedBy: t.option(t.string()),
    transferId: t.option(t.string()),
    createdAt: t.u64(),
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
    paymentId: t.u64(),
    kind: t.string(), // 'hold' | 'release' | 'refund'
    scheduledAt: t.scheduleAt(),
  }
);

const release_timer = table(
  { name: 'release_timer' },
  {
    id: t.u64().primaryKey().autoInc(),
    paymentId: t.u64(),
    scheduledAt: t.scheduleAt(),
  }
);

const spacetime = schema({
  member,
  account,
  listing,
  secret_limit,
  payment,
  nessie_log,
  audit_event,
  config,
  outbox,
  release_timer,
});

function nowMicros(ctx: any): bigint {
  return ctx.timestamp.microsSinceUnixEpoch;
}

function senderHex(ctx: any): string {
  return ctx.sender.toHexString();
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

function requireWorker(ctx: any) {
  const row = ctx.db.config.key.find('worker_identity');
  if (!row || row.value !== senderHex(ctx)) throw new SenderError('Worker only');
}

function requireElderOwner(ctx: any, row: any) {
  requireRole(ctx, 'elder');
  if (!ctx.sender.equals(row.elderId)) throw new SenderError('Only the elder who created this payment can do that');
}

function dollars(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2);
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function asArray(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.results)) return body.results;
  return [];
}

function customerName(row: any): string {
  return `${row?.first_name ?? row?.firstName ?? ''} ${row?.last_name ?? row?.lastName ?? ''}`.trim();
}

function objectId(body: any): string | undefined {
  return body?.object_created?._id ?? body?.objectCreated?._id ?? body?._id;
}

function nessieConfig(db: any): { key: string; base: string } {
  const keyRow = db.config.key.find('nessie_api_key');
  if (!keyRow) throw new SenderError('Nessie API key not set');
  const baseRow = db.config.key.find('nessie_base');
  return { key: keyRow.value, base: baseRow?.value ?? 'https://api.nessieisreal.com' };
}

function logNessie(db: any, at: bigint, method: string, path: string, status: number, note: string) {
  db.nessie_log.insert({ id: 0n, method, path, status, note, at });
}

function findPayeeAccount(db: any, row: any) {
  if (row.payeeNessieId) {
    for (const accountRow of db.account.iter()) {
      if (accountRow.nessieAccountId === row.payeeNessieId) return accountRow;
    }
  }
  for (const accountRow of db.account.iter()) {
    if (sameName(accountRow.label, row.payeeName)) return accountRow;
  }
  return undefined;
}

function applyPaymentHeld(db: any, at: bigint, paymentId: bigint, transferId: string) {
  const row = db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'cleared') throw new SenderError('Payment not cleared');
  db.payment.id.update({ ...row, transferId });
  db.release_timer.insert({
    id: 0n,
    paymentId,
    scheduledAt: ScheduleAt.time(at + SEVEN_DAYS),
  });
  db.audit_event.insert({ id: 0n, text: `Payment held. Transfer ${transferId}.`, at });
}

function applyReleased(db: any, at: bigint, paymentId: bigint, transferId: string) {
  const row = db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'releasing') throw new SenderError('Payment not releasing');
  db.payment.id.update({ ...row, status: 'released', transferId });
  db.audit_event.insert({ id: 0n, text: `Released. Transfer ${transferId}.`, at });
}

function applyRefunded(db: any, at: bigint, paymentId: bigint, transferId: string) {
  const row = db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'refunding') throw new SenderError('Payment not refunding');
  db.payment.id.update({ ...row, status: 'refunded', transferId });
  db.audit_event.insert({ id: 0n, text: `Refunded. Transfer ${transferId}.`, at });
}

export const onConnect = spacetime.clientConnected(ctx => {
  const row = ctx.db.member.identity.find(ctx.sender);
  if (!row) return;
  ctx.db.member.identity.update({ ...row, online: true });
});

export const onDisconnect = spacetime.clientDisconnected(ctx => {
  const row = ctx.db.member.identity.find(ctx.sender);
  if (!row) return;
  ctx.db.member.identity.update({ ...row, online: false });
});

export const join = spacetime.reducer(
  { name: t.string(), role: t.string(), slot: t.string() },
  (ctx, { name, role, slot }) => {
    if (role !== 'elder' && role !== 'guardian') throw new SenderError('Role must be elder or guardian');
    const existing = ctx.db.member.identity.find(ctx.sender);
    if (existing) {
      ctx.db.member.identity.update({ ...existing, name, role, slot });
    } else {
      ctx.db.member.insert({
        identity: ctx.sender,
        name,
        role,
        slot,
        online: false,
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
    const elder = requireRole(ctx, 'elder');
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
      text: `${elder.name} listed ${emoji} ${title} for $${dollars(listCents)}`,
      at: nowMicros(ctx),
    });
  }
);

export const requestPayment = spacetime.reducer(
  {
    payeeName: t.string(),
    amountCents: t.u64(),
    score: t.u32(),
    reasonsJson: t.string(),
  },
  (ctx, { payeeName, amountCents, score, reasonsJson }) => {
    requireRole(ctx, 'elder');
    const payee = findPayeeAccount(ctx.db, { payeeName, payeeNessieId: undefined });
    const held = score >= 60;
    const created = ctx.db.payment.insert({
      id: 0n,
      elderId: ctx.sender,
      payeeName,
      payeeNessieId: payee?.nessieAccountId,
      amountCents,
      score,
      reasonsJson,
      status: held ? 'held' : 'cleared',
      secretFlag: false,
      paidBy: undefined,
      pausedBy: undefined,
      stoppedBy: undefined,
      transferId: undefined,
      createdAt: nowMicros(ctx),
    });
    if (!held) {
      ctx.db.outbox.insert({
        id: 0n,
        paymentId: created.id,
        kind: 'hold',
        scheduledAt: ScheduleAt.time(nowMicros(ctx)),
      });
    }
    ctx.db.audit_event.insert({
      id: 0n,
      text: held
        ? `Payment to ${payeeName} held. Score ${score}.`
        : `Payment to ${payeeName} cleared. Score ${score}.`,
      at: nowMicros(ctx),
    });
  }
);

export const pausePayment = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  const guardian = requireRole(ctx, 'guardian');
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'held') throw new SenderError('Only a held payment can be paused');
  ctx.db.payment.id.update({ ...row, status: 'paused', pausedBy: ctx.sender });
  ctx.db.audit_event.insert({
    id: 0n,
    text: `${guardian.name} paused payment ${paymentId}.`,
    at: nowMicros(ctx),
  });
});

export const stopPayment = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  const guardian = requireRole(ctx, 'guardian');
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'held' && row.status !== 'paused') throw new SenderError('Payment cannot be stopped');
  const hex = senderHex(ctx);
  const prior = row.stoppedBy ? row.stoppedBy.split(',').filter(Boolean) : [];
  if (!prior.includes(hex)) prior.push(hex);
  const distinct = new Set(prior);
  const stoppedBy = [...distinct].join(',');
  if (distinct.size >= 2) {
    ctx.db.payment.id.update({ ...row, status: 'stopped', stoppedBy });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `Two guardians stopped payment ${paymentId}. No transfer.`,
      at: nowMicros(ctx),
    });
  } else {
    ctx.db.payment.id.update({ ...row, stoppedBy });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `${guardian.name} voted to stop payment ${paymentId}.`,
      at: nowMicros(ctx),
    });
  }
});

export const confirmPayment = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  requireElderOwner(ctx, row);
  if (row.status !== 'held') throw new SenderError('Only a held payment can be confirmed');
  ctx.db.payment.id.update({ ...row, paidBy: ctx.sender });
  ctx.db.audit_event.insert({
    id: 0n,
    text: `Elder confirmed payment ${paymentId}.`,
    at: nowMicros(ctx),
  });
});

export const releasePayment = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  requireElderOwner(ctx, row);
  if (!row.paidBy || !row.paidBy.equals(ctx.sender)) throw new SenderError('Elder must confirm before release');
  if (row.status !== 'held') throw new SenderError('Payment is not held');
  ctx.db.payment.id.update({ ...row, status: 'releasing' });
  ctx.db.outbox.insert({
    id: 0n,
    paymentId,
    kind: 'release',
    scheduledAt: ScheduleAt.time(nowMicros(ctx)),
  });
  ctx.db.audit_event.insert({
    id: 0n,
    text: `Release queued for payment ${paymentId}.`,
    at: nowMicros(ctx),
  });
});

export const timeoutPayment = spacetime.reducer(
  { onSchedule: release_timer },
  { arg: release_timer.rowType },
  (ctx, { arg }) => {
    const row = ctx.db.payment.id.find(arg.paymentId);
    if (!row) return;
    if (row.status !== 'cleared') return;
    ctx.db.payment.id.update({ ...row, status: 'refunding' });
    ctx.db.outbox.insert({
      id: 0n,
      paymentId: arg.paymentId,
      kind: 'refund',
      scheduledAt: ScheduleAt.time(nowMicros(ctx)),
    });
    ctx.db.audit_event.insert({
      id: 0n,
      text: `Release window ended. Refund queued for payment ${arg.paymentId}.`,
      at: nowMicros(ctx),
    });
  }
);

export const markPaymentHeld = spacetime.reducer(
  { paymentId: t.u64(), transferId: t.string() },
  (ctx, { paymentId, transferId }) => {
    requireWorker(ctx);
    applyPaymentHeld(ctx.db, nowMicros(ctx), paymentId, transferId);
  }
);

export const markReleased = spacetime.reducer(
  { paymentId: t.u64(), transferId: t.string() },
  (ctx, { paymentId, transferId }) => {
    requireWorker(ctx);
    applyReleased(ctx.db, nowMicros(ctx), paymentId, transferId);
  }
);

export const markRefunded = spacetime.reducer(
  { paymentId: t.u64(), transferId: t.string() },
  (ctx, { paymentId, transferId }) => {
    requireWorker(ctx);
    applyRefunded(ctx.db, nowMicros(ctx), paymentId, transferId);
  }
);

export const demoReset = spacetime.reducer(ctx => {
  requireRole(ctx, 'elder');
  for (const row of [...ctx.db.payment.iter()]) ctx.db.payment.id.delete(row.id);
  for (const row of [...ctx.db.secret_limit.iter()]) ctx.db.secret_limit.id.delete(row.id);
  for (const row of [...ctx.db.nessie_log.iter()]) ctx.db.nessie_log.id.delete(row.id);
  for (const row of [...ctx.db.audit_event.iter()]) ctx.db.audit_event.id.delete(row.id);
  for (const row of [...ctx.db.outbox.iter()]) ctx.db.outbox.id.delete(row.id);
  for (const row of [...ctx.db.release_timer.iter()]) ctx.db.release_timer.id.delete(row.id);
  for (const row of [...ctx.db.listing.iter()]) {
    ctx.db.listing.id.update({ ...row, status: 'open' });
  }
});

export const demoFastForward = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  requireRole(ctx, 'elder');
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'cleared') return;
  ctx.db.payment.id.update({ ...row, status: 'refunding' });
  ctx.db.outbox.insert({
    id: 0n,
    paymentId,
    kind: 'refund',
    scheduledAt: ScheduleAt.time(nowMicros(ctx)),
  });
});

export const setConfig = spacetime.reducer(
  { key: t.string(), value: t.string() },
  (ctx, { key, value }) => {
    if (ctx.db.config.key.find(key)) return;
    ctx.db.config.insert({ key, value });
  }
);

function nessieFetch(ctx: any, base: string, key: string, method: string, path: string, body?: unknown) {
  const url = `${base}${path}${path.includes('?') ? '&' : '?'}key=${key}`;
  const res = ctx.http.fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed: any = undefined;
  try {
    parsed = res.json();
  } catch {
    parsed = undefined;
  }
  return { status: Number(res.status), body: parsed };
}

export const seedBank = spacetime.procedure(t.unit(), ctx => {
  const { key, base } = ctx.withTx(tx => nessieConfig(tx.db));
  const today = new Date().toISOString().slice(0, 10);
  const slots = [
    { slot: 'MARGARET', first: 'Margaret', last: 'Chen', label: MARGARET, start: 166000 },
    { slot: 'PALO_ALTO_ELECTRIC', first: 'Palo Alto', last: 'Electric', label: 'Palo Alto Electric', start: 0 },
    { slot: 'DANIEL', first: 'Daniel', last: 'Chen', label: 'Daniel Chen', start: 0 },
  ];

  let margaretAccountId = '';

  for (const s of slots) {
    const customerRes = nessieFetch(ctx, base, key, 'POST', '/customers', {
      first_name: s.first,
      last_name: s.last,
      address: {
        street_number: '1',
        street_name: 'Main St',
        city: 'Ann Arbor',
        state: 'MI',
        zip: '48104',
      },
    });
    const customerId = objectId(customerRes.body);
    ctx.withTx(tx => {
      logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'POST', '/customers', customerRes.status, `${s.label} customer`);
    });
    if (!customerId) continue;

    const accountRes = nessieFetch(ctx, base, key, 'POST', `/customers/${customerId}/accounts`, {
      type: 'Checking',
      nickname: `${s.label} checking`,
      rewards: 0,
      balance: s.start / 100,
    });
    const nessieAccountId = objectId(accountRes.body) ?? '';
    if (s.slot === 'MARGARET') margaretAccountId = nessieAccountId;

    ctx.withTx(tx => {
      const existing = tx.db.account.slot.find(s.slot);
      const next = {
        slot: s.slot,
        label: s.label,
        nessieAccountId,
        balanceCents: BigInt(s.start),
      };
      if (existing) tx.db.account.slot.update(next);
      else tx.db.account.insert(next);
      logNessie(
        tx.db,
        ctx.timestamp.microsSinceUnixEpoch,
        'POST',
        `/customers/${customerId}/accounts`,
        accountRes.status,
        `${s.label} checking`
      );
    });
  }

  if (margaretAccountId) {
    const billPath = `/accounts/${margaretAccountId}/bills`;
    const billRes = nessieFetch(ctx, base, key, 'POST', billPath, {
      payee: 'Palo Alto Electric',
      payment_amount: 145,
      payment_date: today,
      recurring_date: 15,
      status: 'recurring',
    });
    ctx.withTx(tx => {
      logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'POST', billPath, billRes.status, 'Margaret recurring bill');
    });
  }

  ctx.withTx(tx => {
    for (const row of [...tx.db.account.iter()]) {
      if (row.slot !== 'MARGARET' && row.slot !== 'PALO_ALTO_ELECTRIC' && row.slot !== 'DANIEL') {
        tx.db.account.slot.delete(row.slot);
      }
    }
    tx.db.audit_event.insert({
      id: 0n,
      text: 'Bank seeded. 3 customers and 1 bill.',
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
      let key = '';
      let base = 'https://api.nessieisreal.com';
      try {
        const cfg = nessieConfig(tx.db);
        key = cfg.key;
        base = cfg.base;
      } catch {
        key = '';
      }
      const row = tx.db.payment.id.find(arg.paymentId);
      const buyer = tx.db.account.slot.find('MARGARET');
      const payee = row ? findPayeeAccount(tx.db, row) : undefined;
      return { key, base, row, buyer, payee };
    });

    if (!data.key || !data.row || !data.buyer || !data.payee) {
      ctx.withTx(tx => {
        logNessie(
          tx.db,
          ctx.timestamp.microsSinceUnixEpoch,
          'SKIP',
          `outbox ${arg.kind} payment ${arg.paymentId}`,
          0,
          'Missing payment, Margaret, payee, or key'
        );
      });
      return {};
    }

    const forward = arg.kind === 'hold' || arg.kind === 'release';
    const source = forward ? data.buyer : data.payee;
    const dest = forward ? data.payee : data.buyer;
    const amountCents = data.row.amountCents;
    const path = `/accounts/${source.nessieAccountId}/transfers`;
    const res = nessieFetch(ctx, data.base, data.key, 'POST', path, {
      transaction_date: new Date().toISOString().slice(0, 10),
      status: 'completed',
      amount: Number(amountCents) / 100,
      description: `Aval ${arg.kind} payment ${arg.paymentId}`,
      payee_id: dest.nessieAccountId,
    });

    if (res.status < 200 || res.status >= 300) {
      ctx.withTx(tx => {
        logNessie(
          tx.db,
          ctx.timestamp.microsSinceUnixEpoch,
          'POST',
          path,
          res.status,
          `${arg.kind} rejected`
        );
      });
      return {};
    }

    const transferId = objectId(res.body) ?? '';
    if (!transferId) {
      ctx.withTx(tx => {
        logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'POST', path, res.status, `${arg.kind} missing transfer id`);
      });
      return {};
    }

    ctx.withTx(tx => {
      const at = ctx.timestamp.microsSinceUnixEpoch;
      const currentSource = tx.db.account.slot.find(source.slot);
      const currentDest = tx.db.account.slot.find(dest.slot);
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
      logNessie(
        tx.db,
        at,
        'POST',
        path,
        res.status,
        `${arg.kind} $${dollars(amountCents)} ${source.slot} to ${dest.slot}`
      );
      if (arg.kind === 'hold') applyPaymentHeld(tx.db, at, arg.paymentId, transferId);
      else if (arg.kind === 'release') applyReleased(tx.db, at, arg.paymentId, transferId);
      else if (arg.kind === 'refund') applyRefunded(tx.db, at, arg.paymentId, transferId);
    });

    return {};
  }
);

function pushReason(reasons: any[], code: string, text: string, points: number, source: string, score: number) {
  reasons.push({ code, text, points, source });
  return score + points;
}

export const computeRiskScore = spacetime.procedure(
  { payeeName: t.string(), amountCents: t.u64() },
  t.string(),
  (ctx, { payeeName, amountCents }) => {
    const { key, base } = ctx.withTx(tx => nessieConfig(tx.db));
    const at = () => ctx.timestamp.microsSinceUnixEpoch;
    const reasons: { code: string; text: string; points: number; source: string }[] = [];
    let score = 0;

    const customersPath = 'GET /customers';
    const customersRes = nessieFetch(ctx, base, key, 'GET', '/customers');
    ctx.withTx(tx => logNessie(tx.db, at(), 'GET', '/customers', customersRes.status, 'customers'));
    if (customersRes.status < 200 || customersRes.status >= 300) {
      return JSON.stringify({ error: 'nessie_http', source: customersPath, status: customersRes.status });
    }

    const customers = asArray(customersRes.body);
    const payee = customers.find(row => sameName(customerName(row), payeeName));
    const margaret = customers.find(row => sameName(customerName(row), MARGARET));
    const payeeId = payee?._id ?? payee?.id;

    if (!payee || !payeeId) {
      score = pushReason(reasons, 'payee_not_registered', 'Payee is not a registered merchant', 40, customersPath, score);
    } else {
      const accountsPath = `GET /customers/${payeeId}/accounts`;
      const accountsRes = nessieFetch(ctx, base, key, 'GET', `/customers/${payeeId}/accounts`);
      ctx.withTx(tx => logNessie(tx.db, at(), 'GET', `/customers/${payeeId}/accounts`, accountsRes.status, 'payee accounts'));
      if (accountsRes.status < 200 || accountsRes.status >= 300) {
        return JSON.stringify({ error: 'nessie_http', source: accountsPath, status: accountsRes.status });
      }
      const accounts = asArray(accountsRes.body);
      if (accounts.length === 0) {
        score = pushReason(reasons, 'payee_no_accounts', 'Payee has no active accounts', 30, accountsPath, score);
      } else {
        const accountId = accounts[0]._id ?? accounts[0].id;
        const transfersPath = `GET /accounts/${accountId}/transfers`;
        const transfersRes = nessieFetch(ctx, base, key, 'GET', `/accounts/${accountId}/transfers`);
        ctx.withTx(tx => logNessie(tx.db, at(), 'GET', `/accounts/${accountId}/transfers`, transfersRes.status, 'payee transfers'));
        if (transfersRes.status < 200 || transfersRes.status >= 300) {
          return JSON.stringify({ error: 'nessie_http', source: transfersPath, status: transfersRes.status });
        }
        const count = asArray(transfersRes.body).length;
        if (count === 0) {
          score = pushReason(
            reasons,
            'no_transfers',
            'Payee has never received a transfer from anyone',
            30,
            transfersPath,
            score
          );
        } else if (count < 4) {
          score = pushReason(
            reasons,
            'few_transfers',
            `Payee has only received ${count} transfers`,
            15,
            transfersPath,
            score
          );
        } else if (count >= 50) {
          score = pushReason(
            reasons,
            'established_merchant',
            `Established merchant (${count} transfers)`,
            -20,
            transfersPath,
            score
          );
        }

        const accountPath = `GET /accounts/${accountId}`;
        const accountRes = nessieFetch(ctx, base, key, 'GET', `/accounts/${accountId}`);
        ctx.withTx(tx => logNessie(tx.db, at(), 'GET', `/accounts/${accountId}`, accountRes.status, 'payee balance'));
        if (accountRes.status < 200 || accountRes.status >= 300) {
          return JSON.stringify({ error: 'nessie_http', source: accountPath, status: accountRes.status });
        }
        const balance = Number(accountRes.body?.balance ?? 0);
        if (balance === 0) {
          score = pushReason(reasons, 'zero_balance', 'Payee has never held a balance', 20, accountPath, score);
        }
      }
    }

    const margaretId = margaret?._id ?? margaret?.id;
    if (!margaretId) {
      return JSON.stringify({ error: 'insufficient_funds' });
    }

    const margaretAccountsPath = `GET /customers/${margaretId}/accounts`;
    const margaretAccountsRes = nessieFetch(ctx, base, key, 'GET', `/customers/${margaretId}/accounts`);
    ctx.withTx(tx => logNessie(tx.db, at(), 'GET', `/customers/${margaretId}/accounts`, margaretAccountsRes.status, 'Margaret accounts'));
    if (margaretAccountsRes.status < 200 || margaretAccountsRes.status >= 300) {
      return JSON.stringify({ error: 'nessie_http', source: margaretAccountsPath, status: margaretAccountsRes.status });
    }
    const margaretAccounts = asArray(margaretAccountsRes.body);
    const margaretAccountId = margaretAccounts[0]?._id ?? margaretAccounts[0]?.id;
    if (!margaretAccountId) {
      return JSON.stringify({ error: 'insufficient_funds' });
    }

    const billsPath = `GET /accounts/${margaretAccountId}/bills`;
    const billsRes = nessieFetch(ctx, base, key, 'GET', `/accounts/${margaretAccountId}/bills`);
    ctx.withTx(tx => logNessie(tx.db, at(), 'GET', `/accounts/${margaretAccountId}/bills`, billsRes.status, 'Margaret bills'));
    if (billsRes.status < 200 || billsRes.status >= 300) {
      return JSON.stringify({ error: 'nessie_http', source: billsPath, status: billsRes.status });
    }
    const known = asArray(billsRes.body).some(bill => sameName(String(bill?.payee ?? ''), payeeName));
    if (known) {
      score = pushReason(reasons, 'known_biller', 'Known monthly biller', -40, billsPath, score);
    }

    const margaretPath = `GET /accounts/${margaretAccountId}`;
    const margaretRes = nessieFetch(ctx, base, key, 'GET', `/accounts/${margaretAccountId}`);
    ctx.withTx(tx => logNessie(tx.db, at(), 'GET', `/accounts/${margaretAccountId}`, margaretRes.status, 'Margaret balance'));
    if (margaretRes.status < 200 || margaretRes.status >= 300) {
      return JSON.stringify({ error: 'nessie_http', source: margaretPath, status: margaretRes.status });
    }
    const margaretCents = Math.round(Number(margaretRes.body?.balance ?? 0) * 100);
    if (margaretCents < Number(amountCents)) {
      return JSON.stringify({ error: 'insufficient_funds' });
    }

    return JSON.stringify({ score, held: score >= 60, reasons });
  }
);

export const fetchMomAccount = spacetime.procedure(t.string(), ctx => {
  const { key, base } = ctx.withTx(tx => nessieConfig(tx.db));
  const customersRes = nessieFetch(ctx, base, key, 'GET', '/customers');
  ctx.withTx(tx => logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'GET', '/customers', customersRes.status, 'mom customers'));
  if (customersRes.status < 200 || customersRes.status >= 300) {
    return JSON.stringify({ error: 'nessie_http', source: 'GET /customers', status: customersRes.status });
  }
  const customers = asArray(customersRes.body).map(row => ({
    id: row._id ?? row.id ?? '',
    name: customerName(row),
  }));
  const margaret = asArray(customersRes.body).find(row => sameName(customerName(row), MARGARET));
  const margaretId = margaret?._id ?? margaret?.id;
  if (!margaretId) {
    return JSON.stringify({ balanceCents: 0, bills: [], customers });
  }
  const accountsRes = nessieFetch(ctx, base, key, 'GET', `/customers/${margaretId}/accounts`);
  ctx.withTx(tx => {
    logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'GET', `/customers/${margaretId}/accounts`, accountsRes.status, 'mom accounts');
  });
  const accountId = asArray(accountsRes.body)[0]?._id ?? asArray(accountsRes.body)[0]?.id;
  if (!accountId) {
    return JSON.stringify({ balanceCents: 0, bills: [], customers });
  }
  const accountRes = nessieFetch(ctx, base, key, 'GET', `/accounts/${accountId}`);
  const billsRes = nessieFetch(ctx, base, key, 'GET', `/accounts/${accountId}/bills`);
  ctx.withTx(tx => {
    const at = ctx.timestamp.microsSinceUnixEpoch;
    logNessie(tx.db, at, 'GET', `/accounts/${accountId}`, accountRes.status, 'mom balance');
    logNessie(tx.db, at, 'GET', `/accounts/${accountId}/bills`, billsRes.status, 'mom bills');
  });
  const bills = asArray(billsRes.body).map(bill => ({
    payee: bill.payee ?? '',
    paymentAmount: Number(bill.payment_amount ?? bill.paymentAmount ?? 0),
    status: bill.status ?? '',
    paymentDate: bill.payment_date ?? bill.paymentDate ?? '',
  }));
  const balanceCents = Math.round(Number(accountRes.body?.balance ?? 0) * 100);
  return JSON.stringify({ balanceCents, bills, customers });
});

export const my_limits = spacetime.view(
  { name: 'my_limits', public: true },
  t.array(t.row('MyLimit', { kind: t.string(), cents: t.u64() })),
  ctx => {
    const out: { kind: string; cents: bigint }[] = [];
    for (const row of ctx.db.secret_limit.iter()) {
      if (row.ownerId.equals(ctx.sender)) out.push({ kind: row.kind, cents: row.cents });
    }
    return out;
  }
);

export default spacetime;
