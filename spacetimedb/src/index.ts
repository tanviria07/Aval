import { ScheduleAt } from 'spacetimedb';
import { schema, table, t, SenderError } from 'spacetimedb/server';

const OBJECTION_SECONDS = 60;
const HOLD_SECONDS = 120; // demo value; production would be 86400
const OBJECTION_MICROS = BigInt(OBJECTION_SECONDS) * 1_000_000n;
const HOLD_MICROS = BigInt(HOLD_SECONDS) * 1_000_000n;
const HIGH_RISK_SCORE = 30;
const MARGARET = 'Margaret Chen';

const member = table(
  { name: 'member', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    role: t.string(), // 'mom' | 'guardian'
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

const payee_cache = table(
  { name: 'payee_cache' },
  {
    nameKey: t.string().primaryKey(),
    nessieAccountId: t.string(),
    score: t.u32(),
    reasonsJson: t.string(),
    knownBiller: t.bool(),
    momBalanceCents: t.u64(),
    updatedAt: t.u64(),
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
    round: t.u32(),
    momRound: t.u32(),
    approveRound: t.u32(),
    approvedBy: t.option(t.identity()),
    windowRound: t.u32(),
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
    kind: t.string(), // 'direct' | 'hold' | 'release' | 'refund'
    scheduledAt: t.scheduleAt(),
  }
);

const release_timer = table(
  { name: 'release_timer' },
  {
    id: t.u64().primaryKey().autoInc(),
    paymentId: t.u64(),
    round: t.u32(),
    scheduledAt: t.scheduleAt(),
  }
);

const hold_timer = table(
  { name: 'hold_timer' },
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
  payee_cache,
  payment,
  nessie_log,
  audit_event,
  config,
  outbox,
  release_timer,
  hold_timer,
});

function nowMicros(ctx: any): bigint {
  return ctx.timestamp.microsSinceUnixEpoch;
}

function senderHex(ctx: any): string {
  return ctx.sender.toHexString();
}

function me(ctx: any) {
  const m = ctx.db.member.identity.find(ctx.sender);
  if (!m) throw new SenderError('Join as Mom or a guardian first');
  return m;
}

function requireRole(ctx: any, role: string) {
  const m = me(ctx);
  if (m.role !== role) {
    throw new SenderError(role === 'mom' ? 'Only Mom can do that' : 'Only a guardian can do that');
  }
  return m;
}

function requireMomOwner(ctx: any, row: any) {
  const mom = requireRole(ctx, 'mom');
  if (!ctx.sender.equals(row.elderId)) throw new SenderError('Only the Mom who created this payment can do that');
  return mom;
}

function dollars(cents: bigint): string {
  return (Number(cents) / 100).toFixed(2);
}

function dollarNumber(cents: bigint): number {
  return Number(cents) / 100;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function normName(name: string): string {
  return name.trim().toLowerCase();
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
  const id = body?.object_created?._id ?? body?.objectCreated?._id ?? body?._id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function transferCreatedId(body: any): string | undefined {
  const id = body?.object_created?._id ?? body?.objectCreated?._id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function nessieConfig(db: any): { key: string; base: string } {
  const keyRow = db.config.key.find('nessie_api_key');
  if (!keyRow) throw new SenderError('Nessie API key not set');
  const baseRow = db.config.key.find('nessie_base');
  return { key: keyRow.value, base: baseRow?.value ?? 'https://api.nessieisreal.com' };
}

function logNessie(db: any, at: bigint, method: string, path: string, status: number, note: string) {
  db.nessie_log.insert({ id: 0n, method, path: path.split('?')[0], status, note, at });
}

function audit(db: any, at: bigint, text: string) {
  db.audit_event.insert({ id: 0n, text, at });
}

function isHighRisk(score: number, knownBiller: boolean): boolean {
  if (knownBiller) return false;
  return score >= HIGH_RISK_SCORE;
}

function scamPattern(name: string): boolean {
  return /tech\s*support|\bgift\s*cards?\b|\birs\b|social security|warranty|refund department/i.test(name);
}

function requireMomSender(db: any, sender: any) {
  const memberRow = db.member.identity.find(sender);
  if (!memberRow || memberRow.role !== 'mom') throw new SenderError('Only Mom can do that');
}

function requireScheduler(ctx: any) {
  if (ctx.connectionId != null) throw new SenderError('Only the server can do that');
}

function momKeyCounts(row: any): boolean {
  return !row.secretFlag && row.momRound === row.round && row.momRound !== 0;
}

function guardianApproved(row: any): boolean {
  return row.approveRound === row.round && row.approvedBy != null;
}

function windowOpen(row: any): boolean {
  return row.status === 'objection' && row.windowRound === row.round;
}

function clearObjectionTimers(db: any, paymentId: bigint) {
  for (const timer of [...db.release_timer.iter()]) {
    if (timer.paymentId === paymentId) db.release_timer.id.delete(timer.id);
  }
}

function pauseRound(db: any, row: any, at: bigint, who: any, text: string) {
  clearObjectionTimers(db, row.id);
  db.payment.id.update({
    ...row,
    status: 'held',
    round: row.round + 1,
    windowRound: 0,
    paidBy: undefined,
    pausedBy: who,
  });
  audit(db, at, text);
}

function queueRefund(db: any, row: any, at: bigint, text: string) {
  clearObjectionTimers(db, row.id);
  db.payment.id.update({ ...row, status: 'refunding', windowRound: 0 });
  db.outbox.insert({
    id: 0n,
    paymentId: row.id,
    kind: 'refund',
    scheduledAt: ScheduleAt.time(at),
  });
  audit(db, at, text);
}

function openObjectionWindow(db: any, row: any, at: bigint) {
  clearObjectionTimers(db, row.id);
  db.payment.id.update({ ...row, status: 'objection', windowRound: row.round });
  db.release_timer.insert({
    id: 0n,
    paymentId: row.id,
    round: row.round,
    scheduledAt: ScheduleAt.time(at + OBJECTION_MICROS),
  });
  audit(db, at, `Objection window opened for payment ${row.id}.`);
}

function maybeOpenWindow(db: any, row: any, at: bigint) {
  if (row.status !== 'held') return;
  if (!momKeyCounts(row) || !guardianApproved(row)) return;
  openObjectionWindow(db, row, at);
}

function expectedStatus(kind: string): string | undefined {
  if (kind === 'direct') return 'cleared';
  if (kind === 'hold') return 'holding';
  if (kind === 'release') return 'releasing';
  if (kind === 'refund') return 'refunding';
  return undefined;
}

function finalStatus(kind: string): string | undefined {
  if (kind === 'direct') return 'sent';
  if (kind === 'hold') return 'held';
  if (kind === 'release') return 'released';
  if (kind === 'refund') return 'refunded';
  return undefined;
}

function accountBySlot(db: any, slot: string) {
  return db.account.slot.find(slot);
}

function setBalanceByNessieId(db: any, nessieAccountId: string, balanceCents: bigint) {
  for (const row of [...db.account.iter()]) {
    if (row.nessieAccountId === nessieAccountId) {
      db.account.slot.update({ ...row, balanceCents });
    }
  }
}

function upsertPayeeCache(db: any, row: any) {
  const existing = db.payee_cache.nameKey.find(row.nameKey);
  if (existing) db.payee_cache.nameKey.update({ ...existing, ...row });
  else db.payee_cache.insert(row);
}

function rememberMomBalance(db: any, balanceCents: bigint) {
  const row = db.account.slot.find('MARGARET');
  if (!row || row.balanceCents === balanceCents) return;
  const ledgerMoved = [...db.payment.iter()].some(payment =>
    payment.status === 'sent' ||
    payment.status === 'held' ||
    payment.status === 'objection' ||
    payment.status === 'releasing' ||
    payment.status === 'released' ||
    payment.status === 'refunding' ||
    payment.status === 'refunded'
  );
  if (ledgerMoved) return;
  db.account.slot.update({ ...row, balanceCents });
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
    if (role !== 'mom' && role !== 'guardian') throw new SenderError('Pick Mom or Guardian');
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
    audit(ctx.db, nowMicros(ctx), `${name} joined as ${role}`);
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
    const mom = requireRole(ctx, 'mom');
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
    audit(ctx.db, nowMicros(ctx), `${mom.name} listed ${emoji} ${title} for $${dollars(listCents)}`);
  }
);

export const requestPayment = spacetime.reducer(
  { payeeName: t.string(), amountCents: t.u64() },
  (ctx, { payeeName, amountCents }) => {
    requireRole(ctx, 'mom');
    const trimmed = payeeName.trim();
    if (!trimmed) throw new SenderError('Choose a payee');
    if (amountCents <= 0n) throw new SenderError('Enter an amount');
    const cache = ctx.db.payee_cache.nameKey.find(normName(trimmed));
    if (!cache) throw new SenderError('This payee has not been checked yet');
    const momAccount = accountBySlot(ctx.db, 'MARGARET');
    const available = momAccount?.balanceCents ?? cache.momBalanceCents;
    if (available < amountCents) throw new SenderError("Margaret's balance cannot cover this payment");
    const high = isHighRisk(cache.score, cache.knownBiller);
    const payeeNessieId = cache.nessieAccountId || undefined;
    if (high) {
      const escrow = accountBySlot(ctx.db, 'ESCROW');
      if (!escrow?.nessieAccountId) throw new SenderError('Escrow is not set up');
    } else if (!payeeNessieId) {
      throw new SenderError('This payee has no account to pay');
    }
    const at = nowMicros(ctx);
    const created = ctx.db.payment.insert({
      id: 0n,
      elderId: ctx.sender,
      payeeName: trimmed,
      payeeNessieId,
      amountCents,
      score: cache.score,
      reasonsJson: cache.reasonsJson,
      status: high ? 'holding' : 'cleared',
      secretFlag: false,
      paidBy: undefined,
      pausedBy: undefined,
      stoppedBy: undefined,
      transferId: undefined,
      createdAt: at,
      round: 1,
      momRound: 0,
      approveRound: 0,
      approvedBy: undefined,
      windowRound: 0,
    });
    ctx.db.outbox.insert({
      id: 0n,
      paymentId: created.id,
      kind: high ? 'hold' : 'direct',
      scheduledAt: ScheduleAt.time(at),
    });
    audit(
      ctx.db,
      at,
      high
        ? `High risk payment to ${trimmed}. Holding $${dollars(amountCents)}. Score ${cache.score}.`
        : `Low risk payment to ${trimmed}. Sending $${dollars(amountCents)}. Score ${cache.score}.`
    );
  }
);

export const confirmPayment = spacetime.reducer(
  { paymentId: t.u64(), toldToKeepSecret: t.bool() },
  (ctx, { paymentId, toldToKeepSecret }) => {
    const row = ctx.db.payment.id.find(paymentId);
    if (!row) throw new SenderError('Payment not found');
    const mom = requireMomOwner(ctx, row);
    if (row.status !== 'held') throw new SenderError('You can confirm once the payment is held');
    const at = nowMicros(ctx);
    const next = {
      ...row,
      secretFlag: toldToKeepSecret,
      momRound: toldToKeepSecret ? 0 : row.round,
      paidBy: toldToKeepSecret ? undefined : ctx.sender,
    };
    ctx.db.payment.id.update(next);
    audit(
      ctx.db,
      at,
      toldToKeepSecret
        ? `${mom.name} confirmed payment ${paymentId} and kept it secret.`
        : `${mom.name} confirmed payment ${paymentId}.`
    );
    if (!toldToKeepSecret) maybeOpenWindow(ctx.db, next, at);
  }
);

export const releasePayment = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  const guardian = requireRole(ctx, 'guardian');
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (windowOpen(row) || (row.approveRound === row.round && row.approvedBy)) {
    throw new SenderError('Someone already acted');
  }
  if (row.status !== 'held') throw new SenderError('This payment is not held');
  const at = nowMicros(ctx);
  const next = { ...row, approvedBy: ctx.sender, approveRound: row.round };
  ctx.db.payment.id.update(next);
  audit(ctx.db, at, `${guardian.name} approved payment ${paymentId}.`);
  maybeOpenWindow(ctx.db, next, at);
});

export const pausePayment = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  const guardian = requireRole(ctx, 'guardian');
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'held' && !windowOpen(row)) throw new SenderError('You can only pause a held payment');
  pauseRound(ctx.db, row, nowMicros(ctx), ctx.sender, `${guardian.name} paused payment ${paymentId}.`);
});

export const stopPayment = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  const guardian = requireRole(ctx, 'guardian');
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'held' && !windowOpen(row)) throw new SenderError('This payment cannot be stopped');
  const hex = senderHex(ctx);
  const prior = row.stoppedBy ? row.stoppedBy.split(',').filter(Boolean) : [];
  if (prior.includes(hex)) throw new SenderError('You already stopped this payment');
  prior.push(hex);
  const stoppedBy = prior.join(',');
  const at = nowMicros(ctx);
  if (prior.length >= 2) {
    queueRefund(ctx.db, { ...row, stoppedBy }, at, `Two guardians stopped payment ${paymentId}. Refund queued.`);
    return;
  }
  pauseRound(
    ctx.db,
    { ...row, stoppedBy },
    at,
    ctx.sender,
    `${guardian.name} stopped payment ${paymentId}. Waiting for another guardian.`
  );
});

export const cancelPayment = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  const mom = requireMomOwner(ctx, row);
  if (row.status !== 'held' && !windowOpen(row)) throw new SenderError('Mom can cancel while the payment is held');
  queueRefund(ctx.db, row, nowMicros(ctx), `${mom.name} cancelled payment ${paymentId}. Refund queued.`);
});

export const objectionElapsed = spacetime.reducer(
  { onSchedule: release_timer },
  { arg: release_timer.rowType },
  (ctx, { arg }) => {
    requireScheduler(ctx);
    const row = ctx.db.payment.id.find(arg.paymentId);
    if (!row) return;
    if (row.status !== 'objection') return;
    if (row.windowRound !== arg.round || row.round !== arg.round) return;
    const at = nowMicros(ctx);
    ctx.db.payment.id.update({ ...row, status: 'releasing' });
    ctx.db.outbox.insert({
      id: 0n,
      paymentId: row.id,
      kind: 'release',
      scheduledAt: ScheduleAt.time(at),
    });
    audit(ctx.db, at, `Objection window ended. Release queued for payment ${row.id}.`);
  }
);

export const timeoutPayment = spacetime.reducer(
  { onSchedule: hold_timer },
  { arg: hold_timer.rowType },
  (ctx, { arg }) => {
    requireScheduler(ctx);
    const row = ctx.db.payment.id.find(arg.paymentId);
    if (!row) return;
    if (row.status !== 'held') return;
    queueRefund(ctx.db, row, nowMicros(ctx), `Hold expired. Refund queued for payment ${row.id}.`);
  }
);

export const demoReset = spacetime.reducer(ctx => {
  requireRole(ctx, 'mom');
  for (const row of [...ctx.db.payment.iter()]) ctx.db.payment.id.delete(row.id);
  for (const row of [...ctx.db.secret_limit.iter()]) ctx.db.secret_limit.id.delete(row.id);
  for (const row of [...ctx.db.payee_cache.iter()]) ctx.db.payee_cache.nameKey.delete(row.nameKey);
  for (const row of [...ctx.db.nessie_log.iter()]) ctx.db.nessie_log.id.delete(row.id);
  for (const row of [...ctx.db.audit_event.iter()]) ctx.db.audit_event.id.delete(row.id);
  for (const row of [...ctx.db.outbox.iter()]) ctx.db.outbox.id.delete(row.id);
  for (const row of [...ctx.db.release_timer.iter()]) ctx.db.release_timer.id.delete(row.id);
  for (const row of [...ctx.db.hold_timer.iter()]) ctx.db.hold_timer.id.delete(row.id);
  for (const row of [...ctx.db.listing.iter()]) {
    ctx.db.listing.id.update({ ...row, status: 'open' });
  }
});

export const demoFastForward = spacetime.reducer({ paymentId: t.u64() }, (ctx, { paymentId }) => {
  requireRole(ctx, 'mom');
  const row = ctx.db.payment.id.find(paymentId);
  if (!row) throw new SenderError('Payment not found');
  if (row.status !== 'held') return;
  queueRefund(ctx.db, row, nowMicros(ctx), `Demo fast-forward refund queued for payment ${paymentId}.`);
});

export const setConfig = spacetime.reducer(
  { key: t.string(), value: t.string() },
  (ctx, { key, value }) => {
    requireRole(ctx, 'mom');
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

function movedBalance(previous: bigint | undefined, fetched: bigint | undefined, delta: bigint): bigint | undefined {
  if (previous == null) return fetched == null ? undefined : fetched + delta;
  const expected = previous + delta;
  if (fetched != null && fetched === expected) return fetched;
  return expected;
}

function balanceCentsOf(body: any): bigint | undefined {
  if (body == null || body.balance == null || Number.isNaN(Number(body.balance))) return undefined;
  return BigInt(Math.round(Number(body.balance) * 100));
}

function pushReason(reasons: any[], code: string, text: string, points: number, source: string, score: number) {
  reasons.push({ code, text, points, source });
  return score + points;
}

const SEEDED_SLOTS = new Set(['MARGARET', 'PALO_ALTO_ELECTRIC', 'DANIEL', 'ESCROW', 'TECH_SUPPORT']);

export const seedBank = spacetime.procedure(t.unit(), ctx => {
  const { key, base } = ctx.withTx(tx => {
    requireMomSender(tx.db, ctx.sender);
    return nessieConfig(tx.db);
  });
  const today = new Date().toISOString().slice(0, 10);
  const slots = [
    { slot: 'MARGARET', first: 'Margaret', last: 'Chen', label: MARGARET, start: 1_000_000 },
    { slot: 'PALO_ALTO_ELECTRIC', first: 'Palo Alto', last: 'Electric', label: 'Palo Alto Electric', start: 0 },
    { slot: 'DANIEL', first: 'Priya', last: 'Chen', label: 'Priya Chen', start: 0 },
    { slot: 'ESCROW', first: 'Aval', last: 'Escrow', label: 'Escrow', start: 0 },
    { slot: 'TECH_SUPPORT', first: 'Tech Support', last: 'LLC', label: 'Tech Support LLC', start: 0 },
  ];

  let margaretAccountId = '';
  let createdMargaret = false;

  for (const s of slots) {
    const priorId = ctx.withTx(tx => tx.db.account.slot.find(s.slot)?.nessieAccountId ?? '');
    if (priorId) {
      if (s.slot === 'MARGARET') margaretAccountId = priorId;
      ctx.withTx(tx => {
        const row = tx.db.account.slot.find(s.slot);
        if (row && row.label !== s.label) tx.db.account.slot.update({ ...row, label: s.label });
      });
      continue;
    }
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
    let nessieAccountId = objectId(accountRes.body) ?? '';
    ctx.withTx(tx => {
      logNessie(
        tx.db,
        ctx.timestamp.microsSinceUnixEpoch,
        'POST',
        `/customers/${customerId}/accounts`,
        accountRes.status,
        `${s.label} checking`
      );
    });
    if (!nessieAccountId) continue;
    if (s.slot === 'MARGARET') {
      margaretAccountId = nessieAccountId;
      createdMargaret = true;
    }

    let balanceCents = 0n;
    const readPath = `/accounts/${nessieAccountId}`;
    const readRes = nessieFetch(ctx, base, key, 'GET', readPath);
    const readCents = balanceCentsOf(readRes.body);
    ctx.withTx(tx => {
      logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'GET', readPath, readRes.status, `${s.label} balance`);
    });
    balanceCents = readCents ?? 0n;
    if (balanceCents < BigInt(s.start)) {
      const depositPath = `/accounts/${nessieAccountId}/deposits`;
      const depositRes = nessieFetch(ctx, base, key, 'POST', depositPath, {
        medium: 'balance',
        transaction_date: today,
        amount: (s.start - Number(balanceCents)) / 100,
        description: 'Aval seed',
      });
      ctx.withTx(tx => {
        logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'POST', depositPath, depositRes.status, `${s.label} deposit`);
      });
      const again = nessieFetch(ctx, base, key, 'GET', readPath);
      const againCents = balanceCentsOf(again.body);
      ctx.withTx(tx => {
        logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'GET', readPath, again.status, `${s.label} balance after deposit`);
      });
      if (againCents != null) balanceCents = againCents;
    }

    const savedId = nessieAccountId;
    const savedCents = balanceCents;
    ctx.withTx(tx => {
      const existing = tx.db.account.slot.find(s.slot);
      const next = {
        slot: s.slot,
        label: s.label,
        nessieAccountId: savedId,
        balanceCents: savedCents,
      };
      if (existing) tx.db.account.slot.update(next);
      else tx.db.account.insert(next);
    });
  }

  if (createdMargaret && margaretAccountId) {
    const billPath = `/accounts/${margaretAccountId}/bills`;
    const billRes = nessieFetch(ctx, base, key, 'POST', billPath, {
      nickname: 'Palo Alto Electric',
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
      if (!SEEDED_SLOTS.has(row.slot)) tx.db.account.slot.delete(row.slot);
    }
    audit(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'Payees ready. Priya Chen is family. Tech Support LLC is the scam-pattern payee.');
  });

  return {};
});

export const sendTransfer = spacetime.procedure(
  { onSchedule: outbox },
  { arg: outbox.rowType },
  t.unit(),
  (ctx, { arg }) => {
    if (ctx.connectionId != null) return {};
    const plan = ctx.withTx(tx => {
      const expected = expectedStatus(arg.kind);
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
      if (!expected || !row || row.status !== expected) return { skip: true as const };
      const mom = accountBySlot(tx.db, 'MARGARET');
      const escrow = accountBySlot(tx.db, 'ESCROW');
      const payeeId = row.payeeNessieId ?? '';
      let fromId = '';
      let toId = '';
      if (arg.kind === 'direct') {
        fromId = mom?.nessieAccountId ?? '';
        toId = payeeId;
      } else if (arg.kind === 'hold') {
        fromId = mom?.nessieAccountId ?? '';
        toId = escrow?.nessieAccountId ?? '';
      } else if (arg.kind === 'release') {
        fromId = escrow?.nessieAccountId ?? '';
        toId = payeeId;
      } else if (arg.kind === 'refund') {
        fromId = escrow?.nessieAccountId ?? '';
        toId = mom?.nessieAccountId ?? '';
      }
      return {
        skip: false as const,
        key,
        base,
        fromId,
        toId,
        amountCents: row.amountCents,
        kind: arg.kind,
        paymentId: row.id,
        fromBalance: balanceFor(tx.db, fromId),
        toBalance: balanceFor(tx.db, toId),
      };
    });

    if (plan.skip) return {};

    const at = () => ctx.timestamp.microsSinceUnixEpoch;
    const path = `/accounts/${plan.fromId}/transfers`;
    if (!plan.key || !plan.fromId || !plan.toId) {
      ctx.withTx(tx => {
        const row = tx.db.payment.id.find(plan.paymentId);
        const expected = expectedStatus(plan.kind);
        if (!row || row.status !== expected) return;
        tx.db.payment.id.update({ ...row, status: 'failed' });
        logNessie(tx.db, at(), 'POST', path, 0, `${plan.kind} missing account`);
      });
      return {};
    }

    // Live TransferCreate accepts transaction_date, status, amount, and description.
    // medium and payee_id are rejected, and the recorded transfer does not name a
    // counterparty, so the destination account id is carried in the description.
    const res = nessieFetch(ctx, plan.base, plan.key, 'POST', path, {
      transaction_date: new Date().toISOString().slice(0, 10),
      status: 'completed',
      amount: dollarNumber(plan.amountCents),
      description: `Aval ${plan.kind} payment ${plan.paymentId} to ${plan.toId}`,
    });
    const transferId = transferCreatedId(res.body);
    const ok = res.status >= 200 && res.status < 300 && !!transferId;
    if (!ok) {
      ctx.withTx(tx => {
        const row = tx.db.payment.id.find(plan.paymentId);
        const expected = expectedStatus(plan.kind);
        if (!row || row.status !== expected) return;
        tx.db.payment.id.update({ ...row, status: 'failed' });
        logNessie(tx.db, at(), 'POST', path, res.status, `${plan.kind} failed`);
      });
      return {};
    }

    const fromPath = `/accounts/${plan.fromId}`;
    const toPath = `/accounts/${plan.toId}`;
    const fromRes = nessieFetch(ctx, plan.base, plan.key, 'GET', fromPath);
    const toRes = nessieFetch(ctx, plan.base, plan.key, 'GET', toPath);
    const fromCents = balanceCentsOf(fromRes.body);
    const toCents = balanceCentsOf(toRes.body);

    ctx.withTx(tx => {
      const row = tx.db.payment.id.find(plan.paymentId);
      const expected = expectedStatus(plan.kind);
      const done = finalStatus(plan.kind);
      if (!row || !expected || !done || row.status !== expected) return;
      const stamp = at();
      logNessie(tx.db, stamp, 'POST', path, res.status, `${plan.kind} $${dollars(plan.amountCents)}`);
      logNessie(tx.db, stamp, 'GET', fromPath, fromRes.status, 'balance');
      logNessie(tx.db, stamp, 'GET', toPath, toRes.status, 'balance');
      const fromNext = movedBalance(plan.fromBalance, fromCents, -plan.amountCents);
      const toNext = movedBalance(plan.toBalance, toCents, plan.amountCents);
      if (fromNext != null) setBalanceByNessieId(tx.db, plan.fromId, fromNext);
      if (toNext != null) setBalanceByNessieId(tx.db, plan.toId, toNext);
      tx.db.payment.id.update({ ...row, status: done, transferId });
      if (plan.kind === 'hold') {
        tx.db.hold_timer.insert({
          id: 0n,
          paymentId: row.id,
          scheduledAt: ScheduleAt.time(BigInt(Date.now()) * 1000n + HOLD_MICROS),
        });
      }
      audit(tx.db, stamp, `${plan.kind} settled for payment ${row.id}. Transfer ${transferId}.`);
    });

    return {};
  }
);

function balanceFor(db: any, nessieAccountId: string): bigint | undefined {
  if (!nessieAccountId) return undefined;
  for (const row of db.account.iter()) {
    if (row.nessieAccountId === nessieAccountId) return row.balanceCents;
  }
  return undefined;
}

function localAccountId(db: any, payeeName: string): string {
  for (const row of db.account.iter()) {
    if (sameName(row.label, payeeName) && row.nessieAccountId) return row.nessieAccountId;
  }
  return '';
}

export const computeRiskScore = spacetime.procedure(
  { payeeName: t.string(), amountCents: t.u64() },
  t.string(),
  (ctx, { payeeName, amountCents }) => {
    const { key, base, margaretAccountId, localPayeeId } = ctx.withTx(tx => {
      requireMomSender(tx.db, ctx.sender);
      const cfg = nessieConfig(tx.db);
      return {
        key: cfg.key,
        base: cfg.base,
        margaretAccountId: tx.db.account.slot.find('MARGARET')?.nessieAccountId ?? '',
        localPayeeId: localAccountId(tx.db, payeeName),
      };
    });
    const at = () => ctx.timestamp.microsSinceUnixEpoch;
    const reasons: { code: string; text: string; points: number; source: string }[] = [];
    let score = 0;
    let payeeAccountId = localPayeeId;
    if (scamPattern(payeeName)) {
      score = pushReason(reasons, 'scam_pattern', 'Name matches a common scam pattern', 30, 'payee name', score);
    }

    if (!payeeAccountId) {
      const customersRes = nessieFetch(ctx, base, key, 'GET', '/customers');
      ctx.withTx(tx => logNessie(tx.db, at(), 'GET', '/customers', customersRes.status, 'customers'));
      if (customersRes.status < 200 || customersRes.status >= 300) {
        return JSON.stringify({ error: 'nessie_http', source: 'GET /customers', status: customersRes.status });
      }
      const payee = asArray(customersRes.body).find(row => sameName(customerName(row), payeeName));
      const payeeId = payee?._id ?? payee?.id;
      if (!payee || !payeeId) {
        score = pushReason(reasons, 'payee_not_registered', 'Payee is not a registered merchant', 40, 'GET /customers', score);
      } else {
        const accountsPath = `/customers/${payeeId}/accounts`;
        const accountsRes = nessieFetch(ctx, base, key, 'GET', accountsPath);
        ctx.withTx(tx => logNessie(tx.db, at(), 'GET', accountsPath, accountsRes.status, 'payee accounts'));
        if (accountsRes.status < 200 || accountsRes.status >= 300) {
          return JSON.stringify({ error: 'nessie_http', source: `GET ${accountsPath}`, status: accountsRes.status });
        }
        const accounts = asArray(accountsRes.body);
        if (accounts.length === 0) {
          score = pushReason(reasons, 'payee_no_accounts', 'Payee has no active accounts', 30, `GET ${accountsPath}`, score);
        } else {
          payeeAccountId = accounts[0]._id ?? accounts[0].id ?? '';
        }
      }
    }

    if (payeeAccountId) {
      const transfersPath = `/accounts/${payeeAccountId}/transfers`;
      const transfersRes = nessieFetch(ctx, base, key, 'GET', transfersPath);
      ctx.withTx(tx => logNessie(tx.db, at(), 'GET', transfersPath, transfersRes.status, 'payee transfers'));
      const transfersOk = transfersRes.status >= 200 && transfersRes.status < 300;
      if (!transfersOk && transfersRes.status !== 404) {
        return JSON.stringify({ error: 'nessie_http', source: `GET ${transfersPath}`, status: transfersRes.status });
      }
      const count = transfersOk ? asArray(transfersRes.body).length : 0;
      if (count === 0) {
        score = pushReason(reasons, 'never_paid', 'Never paid', 30, `GET ${transfersPath}`, score);
      } else if (count < 4) {
        score = pushReason(reasons, 'few_transfers', `Payee has only received ${count} transfers`, 15, `GET ${transfersPath}`, score);
      } else if (count >= 50) {
        score = pushReason(reasons, 'established_merchant', `Established merchant (${count} transfers)`, -20, `GET ${transfersPath}`, score);
      }

      const accountPath = `/accounts/${payeeAccountId}`;
      const accountRes = nessieFetch(ctx, base, key, 'GET', accountPath);
      ctx.withTx(tx => logNessie(tx.db, at(), 'GET', accountPath, accountRes.status, 'payee balance'));
      if (accountRes.status < 200 || accountRes.status >= 300) {
        return JSON.stringify({ error: 'nessie_http', source: `GET ${accountPath}`, status: accountRes.status });
      }
      const balance = Number(accountRes.body?.balance ?? 0);
      if (balance === 0) {
        score = pushReason(reasons, 'zero_balance', 'Payee has never held a balance', 20, `GET ${accountPath}`, score);
      }
    }

    if (!margaretAccountId) return JSON.stringify({ error: 'insufficient_funds' });

    const billsPath = '/enterprise/bills';
    const billsRes = nessieFetch(ctx, base, key, 'GET', billsPath);
    ctx.withTx(tx => logNessie(tx.db, at(), 'GET', billsPath, billsRes.status, 'Margaret bills'));
    if (billsRes.status < 200 || billsRes.status >= 300) {
      return JSON.stringify({ error: 'nessie_http', source: `GET ${billsPath}`, status: billsRes.status });
    }
    const margaretBills = asArray(billsRes.body).filter(bill => bill?.account_id === margaretAccountId);
    const known = margaretBills.some(bill => sameName(String(bill?.payee ?? ''), payeeName));
    if (known) {
      score = pushReason(reasons, 'known_biller', 'Known monthly biller', -40, `GET ${billsPath}`, score);
    }
    let usualCents = 0;
    for (const bill of margaretBills) {
      const cents = Math.round(Number(bill?.payment_amount ?? bill?.paymentAmount ?? 0) * 100);
      if (cents > usualCents) usualCents = cents;
    }
    if (usualCents > 0 && Number(amountCents) > usualCents * 2) {
      score = pushReason(
        reasons,
        'over_usual',
        `Over the usual $${(usualCents / 100).toFixed(2)}`,
        20,
        `GET ${billsPath}`,
        score
      );
    }

    const margaretPath = `/accounts/${margaretAccountId}`;
    const margaretRes = nessieFetch(ctx, base, key, 'GET', margaretPath);
    ctx.withTx(tx => logNessie(tx.db, at(), 'GET', margaretPath, margaretRes.status, 'Margaret balance'));
    if (margaretRes.status < 200 || margaretRes.status >= 300) {
      return JSON.stringify({ error: 'nessie_http', source: `GET ${margaretPath}`, status: margaretRes.status });
    }
    const margaretCents = Math.round(Number(margaretRes.body?.balance ?? 0) * 100);
    const storedScore = Math.max(0, score);
    const high = isHighRisk(score, known);
    ctx.withTx(tx => {
      const stamp = at();
      rememberMomBalance(tx.db, BigInt(margaretCents));
      upsertPayeeCache(tx.db, {
        nameKey: normName(payeeName),
        nessieAccountId: payeeAccountId,
        score: storedScore,
        reasonsJson: JSON.stringify(reasons),
        knownBiller: known,
        momBalanceCents: BigInt(margaretCents),
        updatedAt: stamp,
      });
    });
    if (margaretCents < Number(amountCents)) return JSON.stringify({ error: 'insufficient_funds' });
    return JSON.stringify({ score: storedScore, held: high, reasons });
  }
);

export const fetchMomAccount = spacetime.procedure(t.string(), ctx => {
  const { key, base, accountId, payeeLabels } = ctx.withTx(tx => {
    requireMomSender(tx.db, ctx.sender);
    const cfg = nessieConfig(tx.db);
    const labels: string[] = [];
    for (const row of tx.db.account.iter()) {
      if (row.slot === 'MARGARET' || row.slot === 'ESCROW') continue;
      if (row.label) labels.push(row.label);
    }
    return {
      key: cfg.key,
      base: cfg.base,
      accountId: tx.db.account.slot.find('MARGARET')?.nessieAccountId ?? '',
      payeeLabels: labels,
    };
  });
  const customersRes = nessieFetch(ctx, base, key, 'GET', '/customers');
  ctx.withTx(tx => logNessie(tx.db, ctx.timestamp.microsSinceUnixEpoch, 'GET', '/customers', customersRes.status, 'mom customers'));
  if (customersRes.status < 200 || customersRes.status >= 300) {
    return JSON.stringify({ error: 'nessie_http', source: 'GET /customers', status: customersRes.status });
  }
  const seen = new Set<string>();
  const customers = [];
  for (const row of asArray(customersRes.body)) {
    const name = customerName(row);
    const keyName = normName(name);
    if (!keyName || seen.has(keyName) || keyName === 'daniel chen') continue;
    seen.add(keyName);
    customers.push({ id: String(row._id ?? row.id ?? ''), name });
  }
  for (const label of payeeLabels) {
    const keyName = normName(label);
    if (!keyName || seen.has(keyName)) continue;
    seen.add(keyName);
    customers.push({ id: keyName, name: label });
  }
  if (!accountId) return JSON.stringify({ balanceCents: 0, bills: [], customers });

  const accountPath = `/accounts/${accountId}`;
  const billsPath = '/enterprise/bills';
  const accountRes = nessieFetch(ctx, base, key, 'GET', accountPath);
  const billsRes = nessieFetch(ctx, base, key, 'GET', billsPath);
  const bills = asArray(billsRes.body)
    .filter(bill => bill?.account_id === accountId)
    .map(bill => ({
    payee: String(bill.payee ?? ''),
    paymentAmount: Number(bill.payment_amount ?? bill.paymentAmount ?? 0),
    status: String(bill.status ?? ''),
    paymentDate: String(bill.payment_date ?? bill.paymentDate ?? ''),
  }));
  const balanceCents = Math.round(Number(accountRes.body?.balance ?? 0) * 100);
  ctx.withTx(tx => {
    const stamp = ctx.timestamp.microsSinceUnixEpoch;
    logNessie(tx.db, stamp, 'GET', accountPath, accountRes.status, 'mom balance');
    logNessie(tx.db, stamp, 'GET', billsPath, billsRes.status, 'mom bills');
    if (accountRes.status >= 200 && accountRes.status < 300) rememberMomBalance(tx.db, BigInt(balanceCents));
    if (billsRes.status >= 200 && billsRes.status < 300) {
      for (const bill of bills) {
        const nameKey = normName(bill.payee);
        if (!nameKey) continue;
        const existing = tx.db.payee_cache.nameKey.find(nameKey);
        if (existing) {
          tx.db.payee_cache.nameKey.update({ ...existing, knownBiller: true, updatedAt: stamp });
        } else {
          tx.db.payee_cache.insert({
            nameKey,
            nessieAccountId: '',
            score: 0,
            reasonsJson: JSON.stringify([
              { code: 'known_biller', text: 'Known monthly biller', points: -40, source: `GET ${billsPath}` },
            ]),
            knownBiller: true,
            momBalanceCents: BigInt(balanceCents),
            updatedAt: stamp,
          });
        }
      }
    }
  });
  return JSON.stringify({ balanceCents, bills, customers });
});

export const my_limits = spacetime.view(
  { name: 'my_limits', public: true },
  t.array(t.row('MyLimit', { kind: t.string(), cents: t.u64() })),
  ctx => {
    const memberRow = ctx.db.member.identity.find(ctx.sender);
    if (!memberRow || (memberRow.role !== 'mom' && memberRow.role !== 'guardian')) return [];
    const out: { kind: string; cents: bigint }[] = [];
    for (const row of ctx.db.secret_limit.iter()) {
      if (row.ownerId.equals(ctx.sender)) out.push({ kind: row.kind, cents: row.cents });
    }
    return out;
  }
);

export default spacetime;
