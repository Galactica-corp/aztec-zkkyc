# Emitting Events

Source: https://docs.aztec.network/developers/docs/aztec-nr/framework-description/events_and_logs

# Emitting Events

Events allow contracts to communicate with offchain applications. Private events are encrypted and delivered to specific recipients, while public events are visible to everyone.

- An Aztec contract project set up with `aztec-nr` dependency
- Understanding of private vs public functions in Aztec

Declare events using the `#[event]` attribute:

```
#[event]struct Transfer {    from: AztecAddress,    to: AztecAddress,    amount: u128,}
```

In private functions, emit events using `self.emit()` and deliver them to recipients:

```
use aztec::messages::message_delivery::MessageDelivery;#[external("private")]fn transfer(to: AztecAddress, amount: u128) {    let from = self.msg_sender().unwrap();    // ... transfer logic ...    self.emit(Transfer { from, to, amount }).deliver_to(        to,        MessageDelivery.UNCONSTRAINED_ONCHAIN,    );}
```

warningYou **must** call `deliver_to()` on the returned `EventMessage`. If you don't, the event information is lost forever. The compiler will warn you about unused `EventMessage` values.

You can deliver the same event to multiple recipients with different delivery modes:

```
let message = self.emit(Transfer { from, to, amount });message.deliver_to(from, MessageDelivery.UNCONSTRAINED_OFFCHAIN);message.deliver_to(to, MessageDelivery.CONSTRAINED_ONCHAIN);
```

The `MessageDelivery` options are:

- **`CONSTRAINED_ONCHAIN`** - Constrained encryption with onchain delivery. Slowest proving but provides cryptographic guarantees that recipients can decrypt messages.
- **`UNCONSTRAINED_ONCHAIN`** - Unconstrained encryption with onchain delivery. Faster proving, but trusts the sender to encrypt correctly.
- **`UNCONSTRAINED_OFFCHAIN`** - Unconstrained encryption with offchain delivery. Lowest cost, but requires custom infrastructure to deliver messages to recipients.

noteEmitting private events is optional. Onchain delivery publishes encrypted data to Ethereum blobs, inheriting Ethereum's data availability guarantees. You can choose to share information offchain instead.

In public functions, emit events using `self.emit()`:

```
#[external("public")]fn update_value(value: Field) {    // ... update logic ...    self.emit(ValueUpdated { value });}
```

Public events are emitted as plaintext logs, similar to Solidity events.

For unstructured data, use `emit_public_log` directly on the context:

```
self.context.emit_public_log("My message");self.context.emit_public_log([1, 2, 3]);
```

Query public logs from offchain applications using the Aztec node:

```
const fromBlock = await node.getBlockNumber();const logFilter = {  fromBlock,  toBlock: fromBlock + 1,};const publicLogs = (await node.getPublicLogs(logFilter)).logs;
```

Event data published onchain is stored in Ethereum blobs, which incurs costs. Consider:

- Use `UNCONSTRAINED_OFFCHAIN` delivery for lower costs when you have custom delivery infrastructure
- Only emit events when necessary for your application's functionality

- Learn about [storage](https://docs.aztec.network/developers/docs/aztec-nr/framework-description/state_variables) to persist data in your contracts
- Explore [calling other contracts](https://docs.aztec.network/developers/docs/aztec-nr/framework-description/calling_contracts) for cross-contract interactions
- Understand [cross-chain communication](https://docs.aztec.network/developers/docs/aztec-nr/framework-description/ethereum_aztec_messaging) between Ethereum and Aztec