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
