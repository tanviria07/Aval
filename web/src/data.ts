import { DbConnection } from './module_bindings';

export type Role = 'buyer' | 'seller';

export type DealStatus =
  | 'negotiating' | 'agreed' | 'funding' | 'escrowed'
  | 'shipped' | 'releasing' | 'released'
  | 'refunding' | 'refunded' | 'no_deal' | 'declined';

export type Member = { id: string; name: string; role: Role; slot: string; online: boolean };

export type Account = { slot: string; label: string; balanceCents: number };

export type Listing = {
  id: string; sellerId: string; title: string; emoji: string;
  listCents: number; status: 'open' | 'in_deal' | 'sold';
};

export type Deal = {
  id: string; listingId: string; buyerId: string; sellerId: string;
  status: DealStatus; round: number; bidCents: number; askCents: number;
  priceCents?: number; buyerAccepted: boolean; sellerAccepted: boolean;
  shipByAt?: number; tracking?: string;
};

export type Message = {
  id: string; dealId: string; from: 'buyer_agent' | 'seller_agent' | 'system';
  text: string; cents?: number; at: number;
};

export type NessieLog = {
  id: string; method: string; path: string; status: number; note: string; at: number;
};

let conn: DbConnection | null = null;
let connected = false;
let connectResolvers: (() => void)[] = [];

function getConnection(): DbConnection {
  if (conn) return conn;
  conn = DbConnection.builder()
    .withUri('ws://127.0.0.1:3000')
    .withDatabaseName('aval')
    .onConnect((c, identity) => {
      console.log('Aval connected as', identity.toHexString());
      c.subscriptionBuilder()
        .onError(ctx => console.error('Aval subscription error', ctx.event))
        .subscribe([
          'SELECT * FROM member',
          'SELECT * FROM account',
          'SELECT * FROM listing',
          'SELECT * FROM deal',
          'SELECT * FROM message',
          'SELECT * FROM nessie_log',
          'SELECT * FROM audit_event',
          'SELECT * FROM my_limits',
        ]);
      connected = true;
      connectResolvers.forEach(r => r());
      connectResolvers = [];
    })
    .onDisconnect(() => {
      console.log('Aval disconnected');
      connected = false;
    })
    .build();
  return conn;
}

function whenConnected(): Promise<void> {
  getConnection();
  if (connected) return Promise.resolve();
  return new Promise(resolve => connectResolvers.push(resolve));
}

function num(value: bigint | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
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

export const createListing = async (title: string, emoji: string, listCents: number, floorCents: number) => {
  await whenConnected();
  await getConnection().reducers.createListing({
    title,
    emoji,
    listCents: BigInt(listCents),
    floorCents: BigInt(floorCents),
  });
};

export const startDeal = async (listingId: string, ceilingCents: number) => {
  await whenConnected();
  await getConnection().reducers.startDeal({
    listingId: BigInt(listingId),
    ceilingCents: BigInt(ceilingCents),
  });
};

export const accept = async (dealId: string) => {
  await whenConnected();
  await getConnection().reducers.accept({ dealId: BigInt(dealId) });
};

export const decline = async (dealId: string) => {
  await whenConnected();
  await getConnection().reducers.decline({ dealId: BigInt(dealId) });
};

export const markShipped = async (dealId: string, tracking: string) => {
  await whenConnected();
  await getConnection().reducers.markShipped({ dealId: BigInt(dealId), tracking });
};

export const confirmDelivery = async (dealId: string) => {
  await whenConnected();
  await getConnection().reducers.confirmDelivery({ dealId: BigInt(dealId) });
};

export const demoReset = async () => {
  await whenConnected();
  await getConnection().reducers.demoReset({});
};

export const demoFastForward = async (dealId: string) => {
  await whenConnected();
  await getConnection().reducers.demoFastForward({ dealId: BigInt(dealId) });
};

export const seedBank = async () => {
  await whenConnected();
  await getConnection().procedures.seedBank({});
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

export const onListings = (cb: (listings: Listing[]) => void) => {
  const c = getConnection();
  return subscribeRows(c.db.listing, row => ({
    id: row.id.toString(),
    sellerId: row.sellerId.toHexString(),
    title: row.title,
    emoji: row.emoji,
    listCents: Number(row.listCents),
    status: row.status as Listing['status'],
  }), cb);
};

export const onDeals = (cb: (deals: Deal[]) => void) => {
  const c = getConnection();
  return subscribeRows(c.db.deal, row => ({
    id: row.id.toString(),
    listingId: row.listingId.toString(),
    buyerId: row.buyerId.toHexString(),
    sellerId: row.sellerId.toHexString(),
    status: row.status as DealStatus,
    round: row.round,
    bidCents: Number(row.bidCents),
    askCents: Number(row.askCents),
    priceCents: num(row.priceCents),
    buyerAccepted: row.buyerAccepted,
    sellerAccepted: row.sellerAccepted,
    shipByAt: num(row.shipByAt),
    tracking: row.tracking,
  }), cb);
};

export const onMessages = (cb: (messages: Message[]) => void) => {
  const c = getConnection();
  return subscribeRows(c.db.message, row => ({
    id: row.id.toString(),
    dealId: row.dealId.toString(),
    from: row.from as Message['from'],
    text: row.text,
    cents: num(row.cents),
    at: Number(row.at),
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

export const myLimits = () => {
  const c = getConnection();
  const limits = [...c.db.myLimits.iter()];
  const ceiling = limits.find(l => l.kind === 'ceiling');
  const floor = limits.find(l => l.kind === 'floor');
  return {
    ceilingCents: ceiling ? Number(ceiling.cents) : undefined,
    floorCents: floor ? Number(floor.cents) : undefined,
  };
};
