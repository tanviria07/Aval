import { useEffect, useState } from 'react';
import { DbConnection } from './module_bindings';

export type Role = 'elder' | 'guardian';

export type PaymentStatus =
  | 'held'
  | 'cleared'
  | 'paused'
  | 'stopped'
  | 'releasing'
  | 'released'
  | 'refunding'
  | 'refunded';

export type Member = { id: string; name: string; role: Role; slot: string; online: boolean };

export type Account = { slot: string; label: string; balanceCents: number };

export type Payment = {
  id: string;
  elderId: string;
  payeeName: string;
  payeeNessieId?: string;
  amountCents: number;
  score: number;
  reasonsJson: string;
  status: PaymentStatus;
  secretFlag: boolean;
  paidBy?: string;
  pausedBy?: string;
  stoppedBy?: string;
  transferId?: string;
  createdAt: number;
};

export type ReasonChip = { code: string; text: string; points: number; source: string };

export type MomBill = { payee: string; paymentAmount: number; status: string; paymentDate: string };

export type MomCustomer = { id: string; name: string };

export type MomAccount = { balanceCents: number; bills: MomBill[]; customers: MomCustomer[] };

export type NessieLog = {
  id: string;
  method: string;
  path: string;
  status: number;
  note: string;
  at: number;
};

let conn: DbConnection | null = null;
let connected = false;
let identityHex = '';
let connectResolvers: (() => void)[] = [];

function getConnection(): DbConnection {
  if (conn) return conn;
  conn = DbConnection.builder()
    .withUri('ws://127.0.0.1:3000')
    .withDatabaseName('aval')
    .onConnect((c, identity) => {
      identityHex = identity.toHexString();
      c.subscriptionBuilder()
        .onError(ctx => console.error('Aval subscription error', ctx.event))
        .subscribe([
          'SELECT * FROM member',
          'SELECT * FROM account',
          'SELECT * FROM payment',
          'SELECT * FROM nessie_log',
          'SELECT * FROM audit_event',
        ]);
      connected = true;
      connectResolvers.forEach(r => r());
      connectResolvers = [];
    })
    .onDisconnect(() => {
      connected = false;
    })
    .build();
  return conn;
}

export function currentIdentity() {
  getConnection();
  return identityHex;
}

function whenConnected(): Promise<void> {
  getConnection();
  if (connected) return Promise.resolve();
  return new Promise(resolve => connectResolvers.push(resolve));
}

type TableHandle<Row> = {
  iter: () => Iterable<Row>;
  onInsert: (cb: () => void) => void;
  onUpdate: (cb: () => void) => void;
  onDelete: (cb: () => void) => void;
  removeOnInsert: (cb: () => void) => void;
  removeOnUpdate: (cb: () => void) => void;
  removeOnDelete: (cb: () => void) => void;
};

function subscribeRows<Row, Out>(
  table: TableHandle<Row>,
  mapRow: (row: Row) => Out,
  cb: (rows: Out[]) => void,
): () => void {
  const emit = () => {
    const rows: Out[] = [];
    for (const row of table.iter()) rows.push(mapRow(row));
    cb(rows);
  };
  emit();
  table.onInsert(emit);
  table.onUpdate(emit);
  table.onDelete(emit);
  return () => {
    table.removeOnInsert(emit);
    table.removeOnUpdate(emit);
    table.removeOnDelete(emit);
  };
}

export const join = async (name: string, role: Role, slot: string) => {
  await whenConnected();
  await getConnection().reducers.join({ name, role, slot });
};

export const requestPayment = async (payeeName: string, amountCents: number, score: number, reasonsJson: string) => {
  await whenConnected();
  await getConnection().reducers.requestPayment({
    payeeName,
    amountCents: BigInt(amountCents),
    score,
    reasonsJson,
  });
};

export const pausePayment = async (paymentId: string) => {
  await whenConnected();
  await getConnection().reducers.pausePayment({ paymentId: BigInt(paymentId) });
};

export const stopPayment = async (paymentId: string) => {
  await whenConnected();
  await getConnection().reducers.stopPayment({ paymentId: BigInt(paymentId) });
};

export const confirmPayment = async (paymentId: string) => {
  await whenConnected();
  await getConnection().reducers.confirmPayment({ paymentId: BigInt(paymentId) });
};

export const releasePayment = async (paymentId: string) => {
  await whenConnected();
  await getConnection().reducers.releasePayment({ paymentId: BigInt(paymentId) });
};

export const computeRiskScore = async (payeeName: string, amountCents: number) => {
  await whenConnected();
  return getConnection().procedures.computeRiskScore({ payeeName, amountCents: BigInt(amountCents) });
};

export const fetchMomAccount = async (): Promise<MomAccount & { error?: string }> => {
  await whenConnected();
  const raw = await getConnection().procedures.fetchMomAccount({});
  return JSON.parse(raw) as MomAccount & { error?: string };
};

export const onMembers = (cb: (members: Member[]) => void) => {
  const c = getConnection();
  return subscribeRows(c.db.member, row => ({
    id: row.identity.toHexString(),
    name: row.name,
    role: row.role as Role,
    slot: row.slot,
    online: row.online,
  }), cb);
};

export const onAccounts = (cb: (accounts: Account[]) => void) => {
  const c = getConnection();
  return subscribeRows(c.db.account, row => ({
    slot: row.slot,
    label: row.label,
    balanceCents: Number(row.balanceCents),
  }), cb);
};

export const onPayments = (cb: (payments: Payment[]) => void) => {
  const c = getConnection();
  return subscribeRows(c.db.payment, row => ({
    id: row.id.toString(),
    elderId: row.elderId.toHexString(),
    payeeName: row.payeeName,
    payeeNessieId: row.payeeNessieId,
    amountCents: Number(row.amountCents),
    score: row.score,
    reasonsJson: row.reasonsJson,
    status: row.status as PaymentStatus,
    secretFlag: row.secretFlag,
    paidBy: row.paidBy?.toHexString(),
    pausedBy: row.pausedBy?.toHexString(),
    stoppedBy: row.stoppedBy,
    transferId: row.transferId,
    createdAt: Number(row.createdAt),
  }), cb);
};

export const onNessieLog = (cb: (logs: NessieLog[]) => void) => {
  const c = getConnection();
  return subscribeRows(c.db.nessieLog, row => ({
    id: row.id.toString(),
    method: row.method,
    path: row.path,
    status: row.status,
    note: row.note,
    at: Number(row.at),
  }), cb);
};

export function useRows<T>(subscribe: (cb: (rows: T[]) => void) => () => void): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => subscribe(setRows), [subscribe]);
  return rows;
}

export function parseReasons(reasonsJson: string): ReasonChip[] {
  try {
    const parsed = JSON.parse(reasonsJson) as ReasonChip[] | { reasons?: ReasonChip[] };
    if (Array.isArray(parsed)) return parsed;
    return parsed.reasons ?? [];
  } catch {
    return [];
  }
}
