# Aval Data Contract

## Reducers (web calls these)
- join(name, role, slot)
- createListing(title, emoji, listCents, floorCents)
- startDeal(listingId, ceilingCents)
- accept(dealId)
- decline(dealId)
- markShipped(dealId, tracking)
- confirmDelivery(dealId)
- demoReset()
- demoFastForward(dealId)

## Procedures
- seedBank() — creates 4 Nessie accounts and funds buyers
- sendTransfer() — bound to outbox, calls Nessie

## Public tables (subscribable)
member, account, listing, deal, message, nessie_log, audit_event

## Private tables
secret_limit, config, negotiation_tick, ship_timer, outbox

## Views
my_limits — returns the caller's own sealed limits only
