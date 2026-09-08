---
title: Migration notes
description: Read about migration notes from previous versions, which could solve problems while updating
keywords: [local network, sandbox, aztec, notes, migration, updating, upgrading]
tags: [migration, updating, sandbox, local network]
---

Aztec is in active development. Each version may introduce breaking changes that affect compatibility with previous versions. This page documents common errors and difficulties you might encounter when upgrading, along with guidance on how to resolve them.

## 5.0.1

### [Aztec.nr] History note nullification helpers renamed and restricted to own-contract notes

The `history::note` helpers that recompute a note's nullifier have been renamed with a `local_` prefix and now assert that the note belongs to the executing contract:

| Old                                | New                                      |
| ---------------------------------- | ---------------------------------------- |
| `assert_note_was_valid_by`         | `assert_local_note_was_valid_by`         |
| `assert_note_was_nullified_by`     | `assert_local_note_was_nullified_by`     |
| `assert_note_was_not_nullified_by` | `assert_local_note_was_not_nullified_by` |

These helpers derive the note's nullifier from the executing contract's app-siloed nullifier key, and it is not possible for a contract to retrieve the app-siloed nullifier for a different contract, as this would constitute leakage of key material. These helpers incorrectly used the local contract's key siloing, which for a note of a different contract resulted in the non-inclusion check passing unconditionally and wrongly reporting a nullified note as not nullified. The helpers now assert `contract_address == context.this_address()` and fail with "Note nullification history is only supported for the executing contract's own notes" otherwise.

**Impact**: Update call sites to the new names. Own-contract usage (the common case) is unaffected beyond the rename. `assert_note_existed_by` is unchanged and still supports notes of any contract, since note-hash inclusion involves no keys.

### [Aztec.nr] `set_as_fee_payer` now asserts it is called during the setup phase

`PrivateContext::set_as_fee_payer` now asserts that execution is still in the setup (non-revertible) phase, i.e. that `end_setup` has not yet been called by any function in the transaction. Electing a fee payer in the revertible phase was never safe: compensation collected by the fee payer after `end_setup` can be discarded if a public call later reverts, while the protocol still debits the fee payer's fee-juice balance.

**Impact**: A transaction in which `set_as_fee_payer` runs after the setup phase has ended now fails with `fee payer must be elected during the setup phase`. Standard fee payment flows, which call `set_as_fee_payer` before or together with `end_setup`, are unaffected.

### [PXE] Stores are now selected by `(l1ChainId, rollupAddress, schemaVersion)` instead of being wiped on mismatch

Previously, connecting a PXE or embedded wallet to a different or redeployed rollup, or bumping the store schema version, wiped the existing on-disk store in place. That meant master account keys could be destroyed simply by pointing a wallet at a different network. PXE data stores now exist per `(l1ChainId, rollupAddress, schemaVersion)` triple, and switching networks (or upgrading) selects or creates the matching store instead of overwriting previous ones. The embedded wallet's `wallet_data` store is partitioned the same way, so accounts and aliases are per network: switching networks starts with an empty account list until accounts are re-imported, and switching back finds the originals intact.

**Impact**: The first start after upgrading to this version begins with a fresh, empty store; the pre-upgrade data is not deleted. On Node.js environments (lmdb-v2) pre-upgrade data stays at `<dataDirectory>/<name>` while new per-identity `pxe_data` stores live under `<dataDirectory>/<name>-stores/`. The embedded Node.js wallet previously stored data in cwd-relative, rollup-address-suffixed directories instead (`pxe_data_<rollupAddress>/pxe_data` for the PXE store, `wallet_data_<rollupAddress>/wallet_data` for the wallet store): if you used it before this release, that is where the old data lives. The embedded wallet now defaults its data root to `aztec-wallet-data/`, with per-identity wallet stores under `<dataDirectory>/wallet_data-stores/` on Node.js and OPFS store names prefixed `wallet_data_` in the browser. Browser apps can enumerate and clean up `pxe_data` and `wallet_data` stores for networks no longer in use with the new `listStores()` / `deleteStore()` utilities:

```ts
import { deleteStore, listStores } from "@aztec/kv-store/sqlite-opfs";

const names = await listStores();
await deleteStore(names[0]);
```

This change also removes `createStore` from `@aztec/kv-store/sqlite-opfs` and `@aztec/kv-store/deprecated/indexeddb`: stores are now opened by name with `AztecSQLiteOPFSStore.open` / `AztecIndexedDBStore.open`.

## 5.0.0

### [PXE] Local PXE database is reset on upgrade

The persisted tagging stores now key every entry by the self-describing `<kind>:<secret>:<app>` form of `AppTaggingSecret`; unconstrained secrets previously used a two-part `<secret>:<app>` key. This bumps the PXE data schema version, and there is no forward migration for the old keys: on first open the PXE clears any database whose stored schema version differs from the current one. The wipe resets the entire PXE store, not just the tagging data, because all of it shares one backing database.

**Impact**: On upgrade your local PXE state is reset. You must re-register accounts and re-sync from genesis. Wallets should surface a "your local state was reset, please re-register accounts and re-sync" path.

### [Aztec.nr] `TestEnvironmentOptions::with_tagging_secret_strategy` replaced

`TestEnvironmentOptions::with_tagging_secret_strategy` is now `with_default_tag_secret_strategy_all_modes` for tests
that want the same default wallet strategy for both onchain delivery modes. The new naming reflects that these helpers
configure the TXE default wallet strategy hook; contract-fixed delivery derivations bypass that default.

For mode-specific defaults and hook semantics, see the
[`resolveTaggingSecretStrategy` test helper docs](../foundational-topics/pxe/execution_hooks.md#resolvetaggingsecretstrategy).

### [Aztec.nr] L1-to-L2 message consumption takes the secret as an array

`PrivateContext::consume_l1_to_l2_message` and `PublicContext::consume_l1_to_l2_message` now take the message secret as an arbitrary-length array `[Field; N]` instead of a single `Field`, so a consumer can derive its secret hash from more than one field. The helpers `compute_secret_hash` and `compute_l1_to_l2_message_nullifier` are likewise now generic over the secret length. A single-field secret behaves exactly as before (the hashes are unchanged for `N = 1`) — just wrap it in an array.

**Migration:**

```diff
- context.consume_l1_to_l2_message(content, secret, sender, leaf_index);
+ context.consume_l1_to_l2_message(content, [secret], sender, leaf_index);
```

```diff
- let secret_hash = compute_secret_hash(secret);
+ let secret_hash = compute_secret_hash([secret]);
```

**Impact**: Contracts that consume L1-to-L2 messages, or that call `compute_secret_hash` / `compute_l1_to_l2_message_nullifier`, must wrap their single-field secret in an array. Already-deployed contracts are unaffected: their unchanged bytecode keeps working, as PXE serves the previous L1-to-L2 membership-witness oracle through a compatibility adaptor.

### [Aztec.js] `computeL1ToL2MessageNullifier` replaced by `computeFeeJuiceMessageNullifier`

The `@aztec/stdlib` helper `computeL1ToL2MessageNullifier(contract, messageHash, secret)`, which returned the siloed message nullifier, has been removed. Its replacement `computeFeeJuiceMessageNullifier(messageHash, secret)` returns the **unsiloed** nullifier — siloing now happens at the point where the nullifier is looked up. `getL1ToL2MessageWitness` accordingly takes an optional `{ contractAddress, nullifier }` (unsiloed) and silos internally. `computeSecretHash` is unchanged, and `getNonNullifiedL1ToL2MessageWitness` keeps the same signature.

**Migration:**

```diff
- const nullifier = await computeL1ToL2MessageNullifier(contract, messageHash, secret);
+ // computeFeeJuiceMessageNullifier returns the UNSILOED nullifier; silo it before looking it up, or hand the
+ // unsiloed value to getL1ToL2MessageWitness which silos for you.
+ const nullifier = await siloNullifier(contract, await computeFeeJuiceMessageNullifier(messageHash, secret));
```

**Impact**: Only affects code calling these low-level messaging helpers directly - most integrations use `getNonNullifiedL1ToL2MessageWitness`, which is unchanged.

### [Aztec.js] Account signing keys are no longer derived from the privacy secret

Schnorr account signing keys used to be derived from the account's privacy secret (via the now-removed `deriveSigningKey`), which meant the ownership key could be reconstructed from a value the PXE holds. The relationship is now reversed: the signing key is the root, and the privacy secret is derived from it with `deriveSecretKeyFromSigningKey` (exported from `@aztec/accounts/utils`).

As a result:

- `deriveSigningKey` is removed.
- `getSchnorrAccountContractAddress` and `getSchnorrInitializerlessAccountContractAddress` now take the signing key first and an optional secret: `(signingPrivateKey, salt, secretKey?)`. When `secretKey` is omitted it is derived from the signing key.
- The embedded wallet's `createSchnorrAccount` and `createSchnorrInitializerlessAccount` now require an explicit signing key argument.

**Migration:**

```diff
- import { deriveSigningKey } from '@aztec/stdlib/keys';
- const signingKey = deriveSigningKey(secret);
- const address = await getSchnorrAccountContractAddress(secret, salt, signingKey);
+ import { GrumpkinScalar } from '@aztec/aztec.js/fields';
+ const signingKey = GrumpkinScalar.random(); // supply your own signing key
+ const address = await getSchnorrAccountContractAddress(signingKey, salt, secret);
```

**Impact**: Account addresses change, since both the signing key and the privacy secret feed the address. Code that derived the signing key from the secret, or passed the secret first to the address helpers, no longer compiles.

### [Aztec.nr] `MessageContext` removed: message processing uses `ResolvedTx`

`aztec::messages::processing::MessageContext` has been removed in favor of the new `ResolvedTx`, which carries the same `tx_hash`, `unique_note_hashes_in_tx`, and `first_nullifier_in_tx`, plus `block_number` and `block_hash`. The offchain handoff type `OffchainMessageWithContext` is likewise renamed to `OffchainMessageWithTx`.

This affects contracts that implement a custom message handler (registered via `AztecConfig::custom_message_handler`): the handler's context parameter is now a `ResolvedTx`.

**Migration:**

```diff
  use aztec::messages::processing::{
-     enqueue_event_for_validation, MessageContext,
+     enqueue_event_for_validation, ResolvedTx,
  };

  unconstrained fn handle_my_message(
      // ...
-     message_context: MessageContext,
+     resolved_tx: ResolvedTx,
      scope: AztecAddress,
  ) {
-     // ...message_context.tx_hash...
+     // ...resolved_tx.tx_hash...
  }
```

### [PXE] `pxe.updateContract` removed and `pxe.registerContract` no longer takes an artifact

Registering classes and instances are now separate, unvalidated operations. `registerContractClass(artifact)` registers a class, `registerContract(instance)` registers an instance and no longer takes an artifact. `registerContract` does not check that PXE knows the contract's artifact: a missing artifact surfaces only when the contract is later simulated.

**Migration:**

- `pxe.registerContract` now takes the instance directly (its address preimage) and returns the derived address. Register the class separately via `registerContractClass`:

```diff
- await pxe.registerContract({ instance, artifact });
+ await pxe.registerContractClass(artifact);
+ await pxe.registerContract(instance);
```

If you were calling it without an artifact, just drop the wrapping object: `pxe.registerContract({ instance })` becomes `pxe.registerContract(instance)`. The `wallet.registerContract(instance, artifact?, secretKeyOrKeys?)` convenience is unchanged and performs both registrations for you.

- To make a new class's code available after an onchain upgrade, register the new artifact instead of calling `updateContract`:

```diff
- await pxe.updateContract(address, newArtifact);
+ await pxe.registerContractClass(newArtifact);
```

The new class is used automatically once the upgrade takes effect on chain; no further PXE action is needed. Registering it beforehand is harmless: until the update activates, the node still resolves the contract's current class to the previous one, so it keeps running its old code.

- `pxe.getContractInstance(address)` and `wallet.getContractMetadata(address).instance` now return the contract's **address preimage**, which no longer includes `currentContractClassId`.

### [Aztec.js] `AccountWithSecretKey` removed, read account keys from the `AccountManager` or PXE

`AccountWithSecretKey` was a thin wrapper that bundled an account's transaction signer with its master secret key, used mainly to print or export the secret. It has been removed, and `AccountManager.getAccount()` now returns the plain `Account` signer. The wrapper's extra methods are no longer available on that value:

- `getSecretKey()`: read it from the `AccountManager`, which still exposes `getSecretKey()`.
- `getEncryptionSecret()`: this was unused and has been removed. To recover an account's encryption (address) secret, pass its master incoming viewing secret key to `computeAddressSecret`. You can read that key, along with the account's other master secret keys, from `pxe.getAccountSecretKeys(address)`.

**Migration:**

```diff

- import { AccountWithSecretKey } from '@aztec/aztec.js/account';
-
- const account = await accountManager.getAccount();
- const secretKey = account.getSecretKey();
+ const secretKey = accountManager.getSecretKey();
```

To do what `AccountWithSecretKey` was meant for (exporting an account into a separate PXE or wallet), account registration accepts a full set of master secret keys instead of only a single seed. `wallet.registerContract(instance, artifact?, secretKeyOrKeys?)` takes either an `Fr` seed (as before) or a `MasterSecretKeys` object (exported from `@aztec/aztec.js/keys`), for an account whose privacy keys were generated independently rather than from one seed.

The PXE never receives the seed nor the message-signing and fallback secret keys: it is not trusted to hold them. The wallet derives the account's privacy keys and passes the PXE only the four privacy secret keys (nullifier-hiding, incoming-viewing, outgoing-viewing, tagging) plus the message-signing and fallback _public_ keys. Accordingly, `pxe.getAccountSecretKeys(address)` returns only those four privacy secret keys.

**Impact**: Importing `AccountWithSecretKey`, or calling `getSecretKey()`/`getEncryptionSecret()` on the result of `getAccount()`, no longer compiles. The signer `getAccount()` returns is otherwise unchanged, and passing a single `Fr` or a `MasterSecretKeys` to `wallet.registerContract` keeps working.

### [CLI] `aztec-wallet` `--secret-key` is renamed to `--signing-key`

`aztec-wallet` accounts are now rooted on their signing key rather than on a privacy secret. The `--secret-key` option (on `create-account` and `simulate`) is renamed to `--signing-key`, and the `SECRET_KEY` environment variable to `SIGNING_KEY`. When creating an account, a random signing key is generated by default and the privacy secret is derived from it.

**Migration:**

```diff
- aztec-wallet create-account --secret-key 0x...
+ aztec-wallet create-account --signing-key 0x...
```

**Impact**: The value you save and restore for an account is now its signing key, and account addresses change, so existing wallet databases and funded addresses are not carried over.

### [Bot] `senderPrivateKey` is now the account signing key

The transaction bot previously derived its account's signing key from the configured `senderPrivateKey`. That value is now used directly as the signing key, with the privacy secret derived from it.

**Impact**: The bot's account address changes for a given `senderPrivateKey`, so the account must be re-funded at its new address.

### [PXE] Unconstrained delivery defaults to a non-interactive handshake for external recipients

When no `resolveTaggingSecretStrategy` hook is configured, onchain unconstrained delivery now defaults to a non-interactive handshake when the recipient is external (an account whose keys the wallet does not hold), instead of an address-derived shared secret. A self-send (the recipient is one of the wallet's own accounts) still uses an address-derived secret, which needs no handshake and leaves no onchain trace.

**Impact**: An external recipient can now discover unconstrained-delivered messages without having registered the sender in advance, but establishing the handshake publishes an onchain marker derived from the recipient's address (anyone who knows that address can tell a handshake was created for them, though not by whom nor the contents). Wallets that want the previous behavior can configure a `resolveTaggingSecretStrategy` hook that returns an `address-derived` strategy.

### [Aztec.nr] `PrivateContext` data fields are no longer public

`PrivateContext`'s data fields are now private (or crate-internal): its public API is now exclusively its methods. Contracts that read these fields directly must switch to the corresponding getter. A new `get_side_effect_counter()` getter exposes the side-effect counter, and a new `is_static_call()` getter replaces reaching into `inputs.call_context`. The `get_anchor_block_header()` getter already existed.

**Migration:**

```diff
- let header = context.anchor_block_header;
+ let header = context.get_anchor_block_header();

- let counter = context.side_effect_counter;
+ let counter = context.get_side_effect_counter();

- let is_static = context.inputs.call_context.is_static_call;
+ let is_static = context.is_static_call();
```

**Impact**: Direct field access on `PrivateContext` (e.g. `context.anchor_block_header`, `context.side_effect_counter`, `context.inputs`) no longer compiles. Contract state should be read through the context's methods.

### [PXE] Browser KV-store default is now SQLite-OPFS; the IndexedDB entrypoint moved and will be deprecated

The browser PXE data store and the embedded wallet (`@aztec/wallets`) now persist to SQLite-OPFS instead of IndexedDB by default. The recommended way to obtain the browser backend is `@aztec/kv-store/sqlite-opfs`.

**Migration:**

```diff
- import { createStore } from '@aztec/kv-store/indexeddb';
+ import { createStore } from '@aztec/kv-store/sqlite-opfs';
```

If you must stay on IndexedDB for now, import from the deprecated entrypoint instead:

```diff
- import { createStore } from '@aztec/kv-store/indexeddb';
+ import { createStore } from '@aztec/kv-store/deprecated/indexeddb';
```

**Impact**: Existing IndexedDB-backed data is not migrated, so browser PXE and wallet state starts fresh on SQLite-OPFS (the v5 protocol upgrade wipes local state regardless). SQLite-OPFS also holds an exclusive, origin-wide lock on its store directory, so a second browser tab opening the same store will fail. Consequently, we recommend to explicitly manage this case in your app if it uses `EmbeddedWallet`.

### [Aztec.js] `getPublicEvents` is now cursor-paginated

`getPublicEvents` returns a single page of events (at most `MAX_LOGS_PER_TAG`, the node's per-tag page size) and pages instead of the `maxLogsHit` flag, which didn't provide any way to fetch the next page of events:

- The result's `maxLogsHit` boolean is replaced by `nextCursor`. When `nextCursor` is present, more events might exist; pass it as the next query's `afterEvent` to fetch the following page. When it is absent, the range is exhausted.
- The filter's `afterLog` cursor is renamed to `afterEvent`.
- Both cursors are the new `EventCursor` type (exported from `@aztec/aztec.js/events`), not the node-layer `LogCursor`.

**Migration:**

```diff
- const { events, maxLogsHit } = await getPublicEvents(node, MyContract.events.MyEvent, { contractAddress });
+ // One page:
+ const { events, nextCursor } = await getPublicEvents(node, MyContract.events.MyEvent, { contractAddress });
+
+ // All events:
+ const all = [];
+ let afterEvent;
+ do {
+   const page = await getPublicEvents(node, MyContract.events.MyEvent, { contractAddress, afterEvent });
+   all.push(...page.events);
+   afterEvent = page.nextCursor;
+ } while (afterEvent);
```

**Impact**: Reading `maxLogsHit` or passing `afterLog` no longer compiles. Previously a single call was silently capped at `MAX_LOGS_PER_TAG` events with no usable way to continue, so the old API was unusable anyway. You can now page through the full set with `afterEvent`/`nextCursor`.

### [PXE] Sender and shared-secret registration unified into `TaggingSecretSource`

The PXE methods for registering tagging-secret sources have been replaced by a single set that takes a `TaggingSecretSource` discriminated union. `registerSender`/`getSenders`/`removeSender` and `registerSharedSecret`/`removeSharedSecret` are gone; use `registerTaggingSecretSource`/`removeTaggingSecretSource`/`getTaggingSecretSources` instead. The `Wallet` interface (`wallet.registerSender`, `getAddressBook`) is unchanged, so this only affects code that talks to a `PXE` instance directly.

| Before                                        | After                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pxe.registerSender(address)`                 | `pxe.registerTaggingSecretSource({ kind: 'address-derived', sender: address })`    |
| `pxe.removeSender(address)`                   | `pxe.removeTaggingSecretSource({ kind: 'address-derived', sender: address })`      |
| `pxe.getSenders()`                            | `pxe.getTaggingSecretSources({ kind: 'address-derived' })`                         |
| `pxe.registerSharedSecret(recipient, secret)` | `pxe.registerTaggingSecretSource({ kind: 'arbitrary-secret', recipient, secret })` |
| `pxe.removeSharedSecret(recipient, secret)`   | `pxe.removeTaggingSecretSource({ kind: 'arbitrary-secret', recipient, secret })`   |

### [Aztec.js] Unchecked `AztecAddress` constructors renamed with an `Unsafe` suffix

The synchronous `AztecAddress` constructors that build an address from a raw value do not verify that the value is a valid address (the x-coordinate of a point on the Grumpkin curve, which is what allows it to be encrypted to). An invalid value is accepted silently and only fails later, when a transaction is sent. To make this obvious at the call site, they now carry an `Unsafe` suffix:

| Before                    | After                           |
| ------------------------- | ------------------------------- |
| `AztecAddress.fromField`  | `AztecAddress.fromFieldUnsafe`  |
| `AztecAddress.fromBigInt` | `AztecAddress.fromBigIntUnsafe` |
| `AztecAddress.fromNumber` | `AztecAddress.fromNumberUnsafe` |
| `AztecAddress.fromString` | `AztecAddress.fromStringUnsafe` |

**Migration:**

```diff
- const address = AztecAddress.fromBigInt(123n);
+ const address = AztecAddress.fromBigIntUnsafe(123n);
```

For a random, genuinely valid address in tests use `AztecAddress.random()`, and to check an untrusted value use `address.isValid()`. The serialization constructors `fromBuffer` and `fromFields` keep their names (they are part of the (de)serialization interface and read addresses from already-validated data), but their docs now note that they perform no validation either.

### Cross-contract utility calls now have a `msg_sender`

A utility function called by another contract (utility to utility, or private to utility) can read the calling contract's address via `self.msg_sender()`, mirroring private and public functions. A top-level utility call (e.g. invoked directly by a wallet or dapp) has no caller: `self.msg_sender()` panics, and `self.context.maybe_msg_sender()` returns `Option::none()`.

`msg_sender` is only set for cross-contract calls, where it is taken from the call graph and so cannot be forged. A directly-invoked utility (from a wallet or dapp) has no verifiable caller, so it exposes none rather than trusting a value the caller could pick freely.

#### [Aztec.nr] `ExecuteUtilityOptions` gains `with_from` to simulate a cross-contract caller in tests

In `TestEnvironment`, use `execute_utility_opts` with the new `ExecuteUtilityOptions::with_from` builder method to set the `msg_sender` a utility observes, simulating a cross-contract caller without routing through an actual nested call (by default it observes no caller):

```rust
let secret = env.execute_utility_opts(
    ExecuteUtilityOptions::new().with_from(caller),
    Registry::at(registry_address).get_app_siloed_secret(sender, recipient),
).map(|secrets| secrets.shared);
```

### [Prover Node JSON-RPC] Prover API moved to the admin endpoint; `getL2Tips`/`getWorldStateSyncStatus` removed

The prover node's JSON-RPC methods (`prover_*`) have moved off the public node RPC server and onto the admin RPC server. They now require the admin API key and are served on the admin port (8880) instead of the public port (8080).

In addition, `prover_getL2Tips` and `prover_getWorldStateSyncStatus` have been removed from the prover API. They duplicated data already served by the node: use `aztec_getChainTips` (same shape as the old `getL2Tips`) and `aztec_getWorldStateSyncStatus` instead.

If you call the prover RPC directly (e.g. via `curl`), point at the admin endpoint with the API key and use the remaining methods:

- `prover_startProof` — schedule proving for an epoch
- `prover_getJobs` — list proving jobs

A client factory `createProverNodeAdminClient(url, versions?, fetch?, apiKey?)` is now exported from `@aztec/stdlib/interfaces/server`, and the CLI exposes `aztec prover start-proof --epoch <n> --admin-url <url> --api-key <key>` and `aztec prover get-jobs` (the API key defaults to `AZTEC_ADMIN_API_KEY`).

### [Aztec.nr] `ContractInstance.contract_class_id` renamed to `original_contract_class_id`

The `contract_class_id` field of the `ContractInstance` struct (returned by `get_contract_instance`) has been renamed to `original_contract_class_id`. The struct is the contract's _address preimage_, so this field is the class id the contract was deployed with: for contracts whose class was later updated via the `ContractInstanceRegistry`, it is NOT the class currently executing. The rename makes that explicit.

**Migration:**

```diff
let instance = get_contract_instance(address);
- let class_id = instance.contract_class_id;
+ let class_id = instance.original_contract_class_id;
```

Note that this value is not available during public execution, which only has access to the _current_ contract class.

### [Aztec.nr] `get_contract_instance_class_id_avm` renamed to `get_contract_instance_current_class_id_avm`

The AVM contract-instance class id getter has been renamed to make explicit that it returns the _current_ class id, i.e. it reflects updates performed via the `ContractInstanceRegistry`.

**Migration:**

```diff
- use aztec::oracle::get_contract_instance::get_contract_instance_class_id_avm;
+ use aztec::oracle::get_contract_instance::get_contract_instance_current_class_id_avm;

- let class_id = get_contract_instance_class_id_avm(address);
+ let class_id = get_contract_instance_current_class_id_avm(address);
```

### [Aztec.nr] `for_each` visits elements in order; removing during iteration no longer supported

`CapsuleArray::for_each` and `EphemeralArray::for_each` previously iterated backwards (from the last element to the first) so that the callback could safely remove the current element. They now visit elements in order, from first to last, as is usually expected in other languages. Structurally mutating the array (e.g. via `push` or `remove`) from inside the callback is no longer supported.

For `EphemeralArray`, replace remove-during-iteration with `filter`:

```diff
- array.for_each(|index, value| {
-     if should_remove(value) {
-         array.remove(index);
-     }
- });
+ let kept = array.filter(|value| !should_remove(value));
```

`filter` collects the kept elements into a fresh array at a new slot. If the original slot matters (e.g. a `TransientArray` slot shared with other call frames), rebuild it from the filtered result:

```noir
let kept = array.filter(|value| !should_remove(value));
let _ = array.clear();
kept.for_each(|_index, value| array.push(value));
```

`EphemeralArray`'s are cheap and by nature not persistent though, so in most cases you probably can just work with the new copy instead of going through this hassle.

`CapsuleArray` has no `filter`, so iterate manually, backwards. Removing the current element is safe in a backward loop because it only shifts elements at higher indices:

```noir
let mut i = array.len();
while i > 0 {
    i -= 1;
    if should_remove(array.get(i)) {
        array.remove(i);
    }
}
```

### [Protocol] `PrivateCircuitPublicInputs` and `PrivateContextInputs` gain a `tx_request_salt` field

The init kernel now always injects the protocol nullifier (`H(tx_request)`) as the transaction's first nullifier and binds the entry-point proof to the tx request's salt. To support this, `PrivateCircuitPublicInputs` and `PrivateContextInputs` each carry a new `tx_request_salt` field (set by the framework), and the `first_nullifier_hint` input to the init kernel is removed. This is handled automatically by the framework and PXE; contracts using the standard entrypoint need no changes beyond recompiling against the new protocol circuits.

The salt serves two purposes. It keeps `H(tx_request)` (the protocol nullifier) unpredictable, preventing a dictionary attack that guesses the tx-request preimage to recompute the nullifier. It also lets the init kernel bind the proof to a specific tx request: the kernel asserts `tx_request_salt` equals `tx_request.salt`, so a third party holding the proof cannot rebind it to a different request (and thus a different protocol nullifier).

Because `tx_request_salt` is now part of the private function's public inputs, an app or account contract can read it. Together with the other public inputs (the call context, `args_hash`, `tx_context`, and the function selector), an entrypoint can reconstruct the full `tx_request` and verify a signature over `tx_request.hash()`, instead of over a separate payload. This lets an account authorize the complete, kernel-checked transaction request rather than just the calls it contains. Building on that, the protocol nullifier can be made to provide a transaction's replay protection and cancellation directly, reducing the number of nullifiers an account needs to emit. This is not done by the standard entrypoint today; see issues #461 (the protocol/design direction) and #462 (the Aztec.nr account-layer work) for the full picture.

### [Aztec.js] Prefunded local network test accounts are now initializerless

The genesis-funded test accounts in the local network (sandbox), returned by `getInitialTestAccountsData()`, are now initializerless Schnorr accounts (`schnorr_initializerless`). An initializerless account has no onchain deployment transaction: its address commits to the signing public key (through `immutables_hash`) and its contract state is materialized locally in the PXE, so these accounts are usable right away.

Because their address is derived differently from a regular Schnorr account, register them with `createSchnorrInitializerlessAccount` rather than `createSchnorrAccount`.

**Migration:**

```diff
const [alice] = await getInitialTestAccountsData();
- await wallet.createSchnorrAccount(alice.secret, alice.salt);
+ await wallet.createSchnorrInitializerlessAccount(alice.secret, alice.salt);
```

### [Aztec.js] `AccountContract` interface adds `getImmutablesHash()`

The `AccountContract` interface now declares `getImmutablesHash(): Promise<Fr | undefined>`, which returns the hash of the account's immutable instantiation parameters committed into its address, or `undefined` if the feature is not used. `getAccountContractAddress()` and `AccountManager.create()` call it to derive the address when an `immutablesHash` is not passed explicitly, so the address of an initializerless account is now resolved from the contract itself.

Account contracts that extend `DefaultAccountContract` inherit a default implementation that returns `undefined` and need no changes.

### [Aztec.js] Wallets validate declared gas limits against the network's per-tx admission limit

Wallets now reject a transaction whose declared `gasLimits` exceed the network's per-tx admission limit (the node-advertised `txsLimits.gas`), throwing before the tx is sent — e.g. `Declared DA gas limit (X) exceeds the maximum this network allows per tx (Y)`. When you declare no gas limits, the wallet fills in the network's admission limits for you. This mirrors the node's inbound `GasLimitsValidator`, surfacing the rejection locally instead of on submission.

**Impact**: Transactions that previously over-declared gas (and were silently skipped by the proposer) now fail fast with a descriptive error. Declare limits at or below `txsLimits.gas`, or declare none and let the wallet fill them in.

### [Aztec.js] `estimateGas` / `estimatedGasPadding` simulate options and the `estimatedGas` result field removed

The `estimateGas` and `estimatedGasPadding` fee options are gone, and the `estimatedGas` field on simulation results is replaced by `gasUsed` (the raw gas the simulation consumed). Apps that want explicit gas limits read `gasUsed` and pad it themselves; otherwise the wallet fills in the network's admission limits automatically.

**Migration:**

```diff
- const { estimatedGas } = await contract.methods.foo(args).simulate({
-   from,
-   fee: { estimateGas: true, estimatedGasPadding: 0.1 },
- });
- const gasLimits = estimatedGas.gasLimits;
+ const { gasUsed } = await contract.methods.foo(args).simulate({ from, includeMetadata: true });
+ const gasLimits = gasUsed.totalGas.mul(1.1); // pad yourself
```

### [Aztec.js] `getGasLimits` moved to `@aztec/wallet-sdk` and is no longer exported from `@aztec/aztec.js`

`getGasLimits` is no longer exported from `@aztec/aztec.js`. It now lives in `@aztec/wallet-sdk/base-wallet`, takes the simulated `gasUsed` and the network's per-tx admission limit, and clamps the padded estimates to it. If the simulated usage already exceeds the network limit, it throws immediately rather than returning a limit the node would reject.

**Migration:**

```diff
- import { getGasLimits } from '@aztec/aztec.js';
- const { gasLimits, teardownGasLimits } = getGasLimits(simulationResult, 0.1);
+ import { getGasLimits } from '@aztec/wallet-sdk/base-wallet';
+ const { txsLimits } = await node.getNodeInfo();
+ const { gasLimits, teardownGasLimits } = getGasLimits(simulationResult.gasUsed, Gas.from(txsLimits.gas), 0.1);
```

### [Aztec.js / PXE] `NodeInfo.txsLimits` is now required

`NodeInfo` now carries a required `txsLimits` field: every node advertises the maximum gas a single tx may declare (`{ gas: { daGas, l2Gas } }`) and wallets rely on it for fallback gas limits. Clients built against this version cannot talk to nodes that predate the field.

### [Aztec.js] `GasSettings.fallback` requires explicit `gasLimits`

`GasSettings.fallback` no longer supplies a default value for `gasLimits`. Callers must pass the network's per-tx admission limit explicitly — read it from the node's `txsLimits.gas`.

**Migration:**

```diff
- const settings = GasSettings.fallback({ maxFeesPerGas });
+ const { txsLimits } = await node.getNodeInfo();
+ const settings = GasSettings.fallback({ gasLimits: Gas.from(txsLimits.gas), maxFeesPerGas });
```

### [Aztec.js / stdlib] Removed legacy fallback gas constants

The following exports have been removed from `@aztec/stdlib`:

- `APPROXIMATE_MAX_DA_GAS_PER_BLOCK`
- `FALLBACK_TEARDOWN_L2_GAS_LIMIT`
- `FALLBACK_TEARDOWN_DA_GAS_LIMIT`

**Impact**: Any code that imported these symbols must switch to the live node-advertised limits via the node's `txsLimits.gas`.

### [Aztec.nr] `messages::message_delivery` module moved to `messages::delivery`

The `message_delivery` module has been renamed to `delivery`. Update imports accordingly:

```diff
- use aztec::messages::message_delivery::MessageDelivery;
+ use aztec::messages::delivery::MessageDelivery;
```

### [Node JSON-RPC] Method prefixes changed to `aztec_*` and `aztecAdmin_*`

All Aztec node JSON-RPC method prefixes have changed:

- `node_*` → `aztec_*` (public node methods, port 8080)
- `nodeAdmin_*` → `aztecAdmin_*` (admin methods, port 8880)
- `nodeDebug_*` → `aztecDebug_*` (debug methods, port 8080, local-network or `--node-debug` only)
- `p2p_*` namespace removed; P2P queries are on `aztec_*`: `getPeers`, `getCheckpointAttestationsForSlot`, `getProposalsForSlot`
- New archiver sync helpers on `aztec_*`: `getL1Constants`, `getSyncedL2SlotNumber`, `getSyncedL2EpochNumber`, `getSyncedL1Timestamp`

If you call the node RPC directly (e.g. via `curl` or a custom client), update all method names accordingly.
Clients created via `createAztecNodeClient`, `createAztecNodeAdminClient`, and `createAztecNodeDebugClient` are updated automatically.

### [Node RPC] `registerContractFunctionSignatures` moved to the debug API

`registerContractFunctionSignatures` is no longer part of the main node JSON-RPC API (`aztec_` namespace). It is now a debug-only method exposed under the `aztecDebug_` namespace, which is only mounted when the node runs with debug endpoints enabled (`--node-debug`, always on in the in-process sandbox). This removes an unauthenticated write to node memory from prod-like nodes.

Clients that registered public function signatures over `aztec_registerContractFunctionSignatures` should call `aztecDebug_registerContractFunctionSignatures` against a debug-enabled node instead. In the PXE, this is now driven by an optional debug client: pass a `nodeDebug` client (e.g. `createAztecNodeDebugClient(nodeUrl)`) when creating the PXE to keep named public-execution traces; when it is absent, signature registration is skipped. Client-side error enrichment from the contract ABI is unaffected.

### [Aztec.nr] `get_pending_tagged_logs` oracle interface updated (oracle version 28)

The `aztec_utl_getPendingTaggedLogs` oracle now takes an additional `provided_secrets` parameter of type `EphemeralArray<ProvidedSecret>`. This lets apps pass tagging secrets that PXE cannot derive on its own (e.g. handshake-derived secrets) alongside the secrets PXE manages internally.

### [Aztec.nr] `set_sender_for_tags` oracle removed

The `set_sender_for_tags` oracle has been removed. Contracts that used it to override the sender for discovery tag derivation should now use the `with_sender` builder method on `MessageDelivery`:

```diff
- use aztec::oracle::notes::set_sender_for_tags;
+ use aztec::messages::delivery::MessageDelivery;

- unsafe { set_sender_for_tags(some_address) };
- note.deliver(MessageDelivery::onchain_constrained());
+ note.deliver(MessageDelivery::onchain_constrained().with_sender(some_address));
```

When `with_sender` is not called, `MessageDelivery` uses the wallet-supplied default sender.

### [Aztec.nr] `MessageDelivery` API syntax change

`MessageDelivery` variants are now accessed via constructor functions instead of dot notation:

```diff
- MessageDelivery.OFFCHAIN
+ MessageDelivery::offchain()

- MessageDelivery.ONCHAIN_UNCONSTRAINED
+ MessageDelivery::onchain_unconstrained()

- MessageDelivery.ONCHAIN_CONSTRAINED
+ MessageDelivery::onchain_constrained()
```

### [Aztec.js] `getTxReceipt` returns a lifecycle union and takes `GetTxReceiptOptions`

`AztecNode.getTxReceipt` now takes an optional `GetTxReceiptOptions` argument and returns a `PendingTxReceipt | DroppedTxReceipt | MinedTxReceipt` union instead of a single `TxReceipt` class. Mined-only fields (`transactionFee`, `blockHash`, `blockNumber`, `txIndexInBlock`, and the execution result) are only guaranteed once the transaction is mined, so narrow with `isMined()`, `isPending()`, or `isDropped()` before reading variant-specific fields. The full `TxEffect` is attached only when you request it via `{ includeTxEffect: true }`.

`AztecNode.getTxEffect` is deprecated. Replace direct calls with `getTxReceipt(txHash, { includeTxEffect: true })` and read the `.txEffect` field.

`TxReceipt.empty()` and `TxReceipt.schema` no longer exist, since `TxReceipt` is now a union type rather than a class. Use `DroppedTxReceipt.empty()` and `TxReceiptSchema` instead.

```diff
- const effect = await node.getTxEffect(txHash);
- if (effect) {
-   console.log(effect.data.nullifiers.length);
- }
+ const receipt = await node.getTxReceipt(txHash, { includeTxEffect: true });
+ if (receipt.isMined() && receipt.txEffect) {
+   console.log(receipt.txEffect.nullifiers.length);
+ }

- const empty = TxReceipt.empty();
- const schema = TxReceipt.schema;
+ const empty = DroppedTxReceipt.empty();
+ const schema = TxReceiptSchema;
```

**Impact**: This is a breaking change to the public node RPC with no wire back-compat. Callers that read mined fields off a bare receipt must narrow with the `is*` guards first, callers of `getTxEffect` should migrate to `getTxReceipt`, and references to `TxReceipt.empty()` / `TxReceipt.schema` must move to `DroppedTxReceipt.empty()` / `TxReceiptSchema`.

### [Aztec.js] `ExtendedDirectionalAppTaggingSecret` renamed to `AppTaggingSecret`

`ExtendedDirectionalAppTaggingSecret` has been renamed to `AppTaggingSecret`.

**Migration:**

```diff
- import { ExtendedDirectionalAppTaggingSecret } from '@aztec/stdlib/logs';
+ import { AppTaggingSecret } from '@aztec/stdlib/logs';

- ExtendedDirectionalAppTaggingSecret.fromString(value)
+ AppTaggingSecret.fromString(value)
```

**Impact**: Code importing or referencing `ExtendedDirectionalAppTaggingSecret` should update to `AppTaggingSecret`.

### [Protocol] Remaining protocol-contract addresses compacted to 1-3

After the `auth_registry`, `public_checks`, and `multi_call_entrypoint` demotions freed up address slots `1`, `4`, and `6`, the three remaining protocol contracts have been compacted into the lowest slots: `ContractClassRegistry` moves from `3` to `1`, `ContractInstanceRegistry` stays at `2`, and `FeeJuice` moves from `5` to `3`. Code that hardcoded the previous values must be updated. `MAX_PROTOCOL_CONTRACTS` is unchanged (still `11`); only the assigned addresses moved.

### [Aztec.nr] `multi_call_entrypoint` demoted from protocol contract

`multi_call_entrypoint` is no longer a protocol contract; its address is derived from its artifact rather than hardcoded at `6`, and PXE no longer auto-registers it. It is now a standard contract that PXE _preloads_: both `createPXE` and `EmbeddedWallet` preload the standard MultiCallEntrypoint automatically (and `EmbeddedWallet` additionally preloads `AuthRegistry`). **If you use the standard PXE or `EmbeddedWallet`, no changes are needed** — multicall keeps working out of the box.

To preload a different set of standard contracts (for example to also preload `PublicChecks`, which is not preloaded by default), a wallet or app passes its own `preloadedContractsProvider` through the wallet's PXE options:

```ts
const wallet = await EmbeddedWallet.create(node, {
  pxe: {
    preloadedContractsProvider: {
      // EmbeddedWallet's built-in default preloads only MultiCallEntrypoint + AuthRegistry.
      // A custom provider REPLACES that default (it is not additive), so re-list the ones you
      // still want and add the extras — here, PublicChecks.
      getPreloadedContracts: async () => [
        await getStandardMultiCallEntrypoint(),
        await getStandardAuthRegistry(),
        await getStandardPublicChecks(),
      ],
    },
  },
});
```

The provider _replaces_ the default list (it is not additive), so include every standard contract you want available.

### [Aztec.nr] `public_checks` demoted from protocol contract

`public_checks` is no longer a protocol contract. Its address is now derived from its artifact rather than hardcoded at `6`. The aztec-nr constant has moved and been renamed:

```diff
- use protocol_types::constants::PUBLIC_CHECKS_ADDRESS;
+ use crate::standard_addresses::STANDARD_PUBLIC_CHECKS_ADDRESS;
```

Unlike MultiCallEntrypoint and AuthRegistry, `PublicChecks` is **not** preloaded by `createPXE` or `EmbeddedWallet`. If your contract uses `privately_check_timestamp` or `privately_check_block_number`, `PublicChecks` must be deployed and made available to your PXE — either include it in a custom `preloadedContractsProvider` (see the `multi_call_entrypoint` note above) or register it directly:

```ts
import { getStandardPublicChecks } from "@aztec/standard-contracts/public-checks";

const { instance, artifact } = await getStandardPublicChecks();
await pxe.registerContract({ instance, artifact });
```

For browser bundles, import from `@aztec/standard-contracts/public-checks/lazy` instead.

Deploy `PublicChecks` once per fresh rollup: `aztec-wallet deploy public_checks_contract@PublicChecks --salt 1 --universal -f <fee-paying-account>`.

### [Aztec.nr] `auth_registry` demoted from protocol contract

`auth_registry` is no longer a protocol contract. Its address is now derived from its artifact rather than hardcoded at `1`. The aztec-nr constant has moved and been renamed:

```diff
- use protocol_types::constants::CANONICAL_AUTH_REGISTRY_ADDRESS;
+ use crate::standard_addresses::STANDARD_AUTH_REGISTRY_ADDRESS;
```

PXE no longer auto-registers `AuthRegistry` on startup. `EmbeddedWallet` preloads it automatically (alongside the MultiCallEntrypoint — see the `multi_call_entrypoint` note above), so apps using the standard wallet need no changes. If you use a PXE setup that doesn't preload it, add it to a custom `preloadedContractsProvider` or register it explicitly:

```ts
import { getStandardAuthRegistry } from "@aztec/standard-contracts/auth-registry";

const { instance, artifact } = await getStandardAuthRegistry();
await pxe.registerContract({ instance, artifact });
```

For browser bundles, import from `@aztec/standard-contracts/auth-registry/lazy` instead.

Deploy `AuthRegistry` once per fresh rollup: `aztec-wallet deploy auth_registry_contract@AuthRegistry --salt 1 --universal -f <fee-paying-account>`.

### [Aztec.nr] `public_checks` helpers moved to `aztec-nr`

The `privately_check_timestamp`, `privately_check_block_number`, and related caller helpers previously in `noir-contracts/contracts/protocol/public_checks_contract/src/utils.nr` are now in `aztec-nr/aztec/src/public_checks.nr`. Consumer contracts should update their imports:

```diff
- use public_checks::utils::privately_check_timestamp;
+ use aztec::public_checks::privately_check_timestamp;
```

### [Aztec Node / Aztec.js / CLI] Log retrieval API consolidated to two tag-based methods

The four log-retrieval methods on `AztecNode` have been collapsed into two. `getContractClassLogs` and the `LogFilter`-shaped `getPublicLogs` are removed entirely; the surviving methods are `getPrivateLogsByTags(query)` and `getPublicLogsByTags(query)`, both taking a single query object and returning `LogResult[][]` (one inner array per requested tag, in input order).

**Removed methods on `AztecNode`:**

| Removed                                                                   | Replacement                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------- |
| `getPublicLogs(filter: LogFilter)`                                        | `getPublicLogsByTags({ contractAddress, tags, ... })` |
| `getContractClassLogs(filter: LogFilter)`                                 | none — RPC removed; no production consumer existed    |
| `getPrivateLogsByTags(tags, page?, referenceBlock?)`                      | `getPrivateLogsByTags({ tags, ... })`                 |
| `getPublicLogsByTagsFromContract(contract, tags, page?, referenceBlock?)` | `getPublicLogsByTags({ contractAddress, tags, ... })` |

**New query and response shapes:**

```ts
// Query
type TagQuery<T> = T | { tag: T; afterLog?: LogCursor };

type LogsQueryBase = {
  fromBlock?: BlockNumber; // inclusive
  toBlock?: BlockNumber; // exclusive
  txHash?: TxHash; // mutually exclusive with fromBlock/toBlock
  referenceBlock?: BlockHash; // reorg-safety anchor; throws if missing
  includeEffects?: boolean; // attach noteHashes + all nullifiers
};

type PrivateLogsQuery = LogsQueryBase & { tags: TagQuery<SiloedTag>[] };
type PublicLogsQuery = LogsQueryBase & {
  contractAddress: AztecAddress;
  tags: TagQuery<Tag>[];
};

// Response (per log)
type LogResult = {
  logData: Fr[];
  blockNumber: BlockNumber;
  blockHash: BlockHash;
  blockTimestamp: UInt64;
  txHash: TxHash;
  logIndexWithinTx: number;
  noteHashes?: Fr[]; // present only when includeEffects is set
  nullifiers?: Fr[]; // all nullifiers of the tx, not just the first
};
```

**Public queries now require a contract address.** Tag-only / contract-less public queries are no longer supported (the public log index is keyed on `(contract, tag)`).

**Per-tag `afterLog` cursors replace the global `page` argument.** Each tag advances independently — pass `{ tag, afterLog: LogCursor.fromLog(lastLog) }` to resume that tag, and omit it for tags that are already exhausted.

**Aztec.js wallet — `PublicEventFilter.contractAddress` is now required, and `afterLog` is a `LogCursor`:**

```diff
- type PublicEventFilter = EventFilterBase & { contractAddress?: AztecAddress };
+ type PublicEventFilter = EventFilterBase & { contractAddress: AztecAddress };

  type EventFilterBase = {
    txHash?: TxHash;
    fromBlock?: BlockNumber;
    toBlock?: BlockNumber;
-   afterLog?: LogId;
+   afterLog?: LogCursor;
  };
```

`LogId`, `LogFilter`, `TxScopedL2Log`, `ExtendedPublicLog`, `ExtendedContractClassLog`, `GetPublicLogsResponse`, and `GetContractClassLogsResponse` are no longer exported from `@aztec/aztec.js`. Build cursors with `LogCursor.fromLog(log)` and decode public-event payloads from `result.logData.slice(1)` (the tag is field 0).

**CLI — `aztec get-logs` now requires `--contract-address` and `--tag`:**

```diff
- aztec get-logs [--tx-hash <tx>] [--from-block <n>] [--to-block <n>] [--after-log <id>]
+ aztec get-logs --contract-address <address> --tag <tag> \
+               [--tx-hash <tx>] [--from-block <n>] [--to-block <n>] [--after-log <cursor>]
```

`--after-log` now takes a `LogCursor` of the form `<blockNumber>-<txIndexWithinBlock>-<logIndexWithinTx>` (formerly a `LogId`).

**Mutual exclusion**: setting both `txHash` and `fromBlock`/`toBlock` is rejected (a `txHash` already pins a block). `txHash` + `afterLog` is allowed and paginates within the tx's logs for a tag.

**Impact**: Any consumer of `getPublicLogs(LogFilter)`, `getContractClassLogs`, the old tag-based methods, `PublicEventFilter` without a `contractAddress`, or `EventFilterBase.afterLog: LogId` must be updated. The CLI rejects calls missing `--contract-address` or `--tag`.

### [Aztec.js] `AccountManager.create` takes an options bag

`AccountManager.create` no longer takes `salt` as a positional argument. The trailing `salt?: Salt` parameter has been folded into a new `AccountManagerCreateOptions` bag alongside `immutablesHash` and `deployer`:

```diff
- AccountManager.create(wallet, secret, accountContract, salt)
+ AccountManager.create(wallet, secret, accountContract, { salt })
```

`immutablesHash` lets callers commit a non-zero immutables hash on the resulting `ContractInstance` (folded into the salted initialization hash, so it affects the derived address). `deployer` overrides the deployer address recorded on the instance (defaults to `AztecAddress.ZERO`). The same `immutablesHash` field is now also threaded through `DeployMethod` / `DeployAccountMethod` so the address derived at deploy time matches the one on `accountManager.getInstance()`.

### [Aztec.nr] Defining a custom `sync_state` function now requires `AztecConfig`

Contracts that previously overrode the default `sync_state` by defining their own function with that name will now get a compile error. Use `AztecConfig::custom_sync_state()` instead.

The custom hook receives the same parameters as `do_sync_state` and is responsible for calling it if default behavior is also desired. You can perform work before and/or after the default `do_sync_state` call, or skip it entirely.

```diff
+ unconstrained fn my_custom_sync(
+     contract_address: AztecAddress,
+     compute_note_hash: ComputeNoteHash,
+     compute_note_nullifier: ComputeNoteNullifier,
+     process_custom_message: Option<CustomMessageHandler>,
+     offchain_inbox_sync: Option<OffchainInboxSync>,
+     scope: AztecAddress,
+ ) {
+     // optional: work before default sync
+     do_sync_state(contract_address, compute_note_hash, compute_note_nullifier, process_custom_message, offchain_inbox_sync, scope);
+     // optional: work after default sync
+ }

- #[aztec]
+ #[aztec(::aztec::macros::AztecConfig::new().custom_sync_state(crate::my_custom_sync))]
  contract MyContract {
-     use aztec::macros::functions::external;
-
-     #[external("utility")]
-     unconstrained fn sync_state(scope: AztecAddress) {
-         // custom sync logic
-     }
  }
```

**Impact**: Only contracts that manually defined a `sync_state` function are affected. Contracts using the default macro-generated `sync_state` require no changes.

### [Aztec.nr] `push_nullifier` renamed to `push_nullifier_unsafe`

`PrivateContext::push_nullifier` and `PublicContext::push_nullifier` have been renamed to `push_nullifier_unsafe` to
make it clear that they are low-level functions that require careful domain separation. This is consistent with the
`_unsafe` suffix already used by `emit_private_log_unsafe`, `emit_raw_note_log_unsafe`, and `emit_public_log_unsafe`.

```diff
- context.push_nullifier(nullifier);
+ context.push_nullifier_unsafe(nullifier);
```

Prefer higher-level abstractions like `SingleUseClaim` or `destroy_note` which handle domain separation automatically.

### [Aztec.nr] `LogRetrievalRequest` now includes `source`, `from_block`, and `to_block` fields

`LogRetrievalRequest` has been extended with three new fields to support filtering logs by source and block range. The `get_logs_by_tag` oracle now also returns all matching logs per tag instead of only the first match.

A `LogRetrievalRequest::new(contract_address, tag)` constructor is provided that defaults to querying both public and private logs with no block range filter:

```rust
LogRetrievalRequest::new(contract_address, my_tag)
```

If you need to customize source or block range, construct the struct manually with the new fields:

```diff
  LogRetrievalRequest {
      tag: my_tag,
+     source: LogSource.PUBLIC_AND_PRIVATE,
+     from_block: Option::none(),
+     to_block: Option::none(),
  }
```

`source` controls which RPCs are queried: `LogSource.PRIVATE`, `LogSource.PUBLIC`, or `LogSource.PUBLIC_AND_PRIVATE`. `from_block` and `to_block` define a half-open `[from, to)` block range filter. Both are `Option<Field>` and default to `Option::none()` (no filtering).

### [Protocol] Public-key hashes replace points in `PublicKeys`

Ships together with immutables hash changes (shown below).

Per [AZIP-8](https://github.com/AztecProtocol/governance/blob/main/AZIPs/azip-8.md), `PublicKeys` no longer carries the four master public keys as elliptic curve points. Three of them (`npk_m`, `ovpk_m`, `tpk_m`) are now exposed only as their poseidon2 hash digests; only `ivpk_m` (the master incoming viewing key) remains a point because address derivation needs it as a curve point.

**This is a hard fork:** every contract address and account address derived from a non-default `PublicKeys` changes.

**Contract author migration.** Read the master nullifier hash directly off `PublicKeys` instead of computing it from a point:

```diff
- let owner_npk_m = get_public_keys(owner).npk_m;
- let secret = context.request_nhk_app(owner_npk_m.hash());
+ let owner_npk_m_hash = get_public_keys(owner).npk_m_hash;
+ let secret = context.request_nhk_app(owner_npk_m_hash);
```

The same field-rename applies to `.ovpk_m` and `.tpk_m`: these are now `.ovpk_m_hash` and `.tpk_m_hash` respectively. Code that needed those keys as points will not compile; the points are no longer accessible to contract code.

**Custom account contracts.** Wallets that ship their own Noir account contracts must recompile. Macro-generated calldata extraction and the `request_nsk_app` / `request_ovsk_app` paths use the hash form natively.

**TS / wallet author migration.** The `PublicKeys` constructor signature changes from four `Point`s to `(npkMHash: Fr, ivpkM: Point, ovpkMHash: Fr, tpkMHash: Fr)`. `KeyValidationRequest` carries `pkMHash: Fr` instead of `pkM: Point`. `KeyStore.getMasterSecretKey` now takes a `pkMHash: Fr` rather than a `Point`. Callers using the auto-generated TS binding pick this up automatically; callers that hand-roll the arg buffer must update.

**Wallet UI.** Any panel that displayed `masterNullifierPublicKey`, `masterOutgoingViewingPublicKey`, or `masterTaggingPublicKey` as Grumpkin points will no longer compile against the new `PublicKeys` class. The points themselves are no longer in `ContractInstancePublished` and cannot be recovered from the onchain record. Switch to displaying the hashes (`npkMHash`, `ovpkMHash`, `tpkMHash`) or drop the display.

**PXE storage migration.** `DatabaseVersionManager` deletes pre-v6 databases on first open: users will see registered accounts, contacts, address aliases, and synced notes wiped. Wallets should surface a "your local state was reset, please re-register accounts and re-sync" path. There is no forward migration because the address derived from a given secret changes (the new `public_keys_hash` is over four single-key digests, not four raw points). Previous addresses are not recoverable from the same secret; assets and notes attached to them are inaccessible at the protocol level.

**Indexer / event-decoder migration.** The `ContractInstancePublished` private log payload is now 13 fields:

```text
[ MAGIC, address, version, salt, class_id, init_hash,
  immutables_hash,
  npk_m_hash,
  ivpk_m.x, ivpk_m.y,
  ovpk_m_hash,
  tpk_m_hash,
  deployer ]
```

`version` is `2`. v1 events should be rejected.

**Security note (PXE side).** The kernel circuit no longer checks that `npk_m`, `ovpk_m`, `tpk_m` are on-curve or non-infinity (those points are no longer in the witness). The PXE / key store relies on `deriveKeys`'s by-construction guarantee that derived points are on-curve and non-infinity. Account-creation flows that bypass `deriveKeys` (e.g. importing pre-derived public keys from an external source) must validate this themselves, or risk producing unspendable notes.

### [Contracts] `ContractInstance` gains `immutablesHash`, address derivation changes

`ContractInstance` now has a new `immutablesHash: Fr` field that commits to a contract's immutable storage values. The field is folded into the salted initialization hash, so contract addresses are impacted:

```
salted_initialization_hash = poseidon2(DOM_SEP__SALTED_INITIALIZATION_HASH, [salt, initialization_hash, deployer, immutables_hash])
```

**You may need to act if:**

- You hardcode contract addresses computed from instance fields outside the SDK. Recompute them under the new derivation.
- You parse the `ContractInstancePublished` private log directly. The event payload has an extra field, with `immutables_hash` inserted between `initialization_hash` and the public-keys block:

  ```
  [tag, address, version, salt, classId, initialization_hash, immutables_hash, ...publicKeys(5), deployer]
  ```

- You call `ContractInstanceRegistry.publish_for_public_execution` directly. The function now takes 6 arguments instead of 5, with `immutables_hash` inserted between `initialization_hash` and `public_keys`:

  ```diff
  - publish_for_public_execution(salt, contract_class_id, initialization_hash,                  public_keys, universal_deploy)
  + publish_for_public_execution(salt, contract_class_id, initialization_hash, immutables_hash, public_keys, universal_deploy)
  ```

- You call the `GetContractInstance` AVM opcode directly or use the per-member helpers in `aztec-nr`. A new enum value `ContractInstanceMember::IMMUTABLES_HASH = 3` selects `immutables_hash`. Use the wrapper helper from `aztec::oracle::get_contract_instance`:

  ```rust
  use aztec::oracle::get_contract_instance::get_contract_instance_immutables_hash_avm;
  let immutables_hash: Option<Field> = get_contract_instance_immutables_hash_avm(address);
  ```

The `aztec.js` `publishInstance` helper handles this automatically.

### [Aztec.nr] `emit_private_log_unsafe` / `emit_raw_note_log_unsafe` now take `BoundedVec`

The old array-based `emit_private_log_unsafe(tag, log: [Field; N], length)` and `emit_raw_note_log_unsafe(tag, log: [Field; N], length, note_hash_counter)` have been removed. The temporary `_vec_unsafe` variants introduced in a prior release have been renamed to take their place.

```diff
- context.emit_private_log_unsafe(tag, log_array, length);
+ context.emit_private_log_unsafe(tag, bounded_vec_log);

- context.emit_raw_note_log_unsafe(tag, log_array, length, note_hash_counter);
+ context.emit_raw_note_log_unsafe(tag, bounded_vec_log, note_hash_counter);
```

If you were already using `emit_private_log_vec_unsafe` / `emit_raw_note_log_vec_unsafe`, simply drop the `_vec` from the function name:

```diff
- context.emit_private_log_vec_unsafe(tag, log);
+ context.emit_private_log_unsafe(tag, log);

- context.emit_raw_note_log_vec_unsafe(tag, log, note_hash_counter);
+ context.emit_raw_note_log_unsafe(tag, log, note_hash_counter);
```

### [bb.js / accounts / aztec.nr] Schnorr signatures switched to Poseidon2

The Schnorr challenge hash function changed from `blake2s(pedersen(R.x, pubkey.x, pubkey.y) ‖ message)` to `Poseidon2(DST, R.x, pubkey.x, pubkey.y, message)`, where `DST = poseidon2_hash_bytes("schnorr_grumpkin_poseidon2")` is a domain separation tag binding signatures to this scheme. The change applies end-to-end across the native signer (`bb`), `@aztec/bb.js`, the noir verifier library (`noir-lang/schnorr` v0.2.0 → v0.4.0), and both standard Schnorr account contracts. The auth witness on-wire shape also changes from `[u8; 64]` (the serialized `(s, e)` bytes) to `[Field; 4]` (`[s.lo, s.hi, e.lo, e.hi]`, each scalar split into two 128-bit limbs).

**Impact:** A previously-deployed Schnorr account cannot be controlled by the new TypeScript code. Both the signature scheme and the auth witness format change, so signatures produced by the new code will fail in-circuit verification against the old account contract, and old-style 64-byte auth witnesses will not decode in the new contract. Users with existing Schnorr accounts on testnet must deploy a fresh account contract and migrate funds. ECDSA accounts (`ecdsa_k`, `ecdsa_r`) are unaffected.

**If you maintain a custom Schnorr account contract**, bump the `schnorr` dependency in `Nargo.toml`:

```diff
- schnorr = { tag = "v0.2.0", git = "https://github.com/noir-lang/schnorr" }
+ schnorr = { tag = "v0.4.0", git = "https://github.com/noir-lang/schnorr" }
```

and update `is_valid_impl` to consume the auth witness as four `Field` limbs and pass `outer_hash` directly:

```diff
- let signature: [u8; 64] = unsafe { get_auth_witness_as_bytes(outer_hash) };
- schnorr::verify_signature(pub_key, signature, outer_hash.to_be_bytes::<32>())
+ let limbs: [Field; 4] = unsafe { get_auth_witness(outer_hash) };
+ let signature = (
+     std::embedded_curve_ops::EmbeddedCurveScalar::new(limbs[0], limbs[1]),
+     std::embedded_curve_ops::EmbeddedCurveScalar::new(limbs[2], limbs[3]),
+ );
+ schnorr::verify_signature(pub_key, signature, outer_hash)
```

The `Schnorr` TypeScript API in `@aztec/foundation/crypto/schnorr` keeps the same surface (`constructSignature(msg: Uint8Array, ...)`, `verifySignature(msg, ...)`), but the `msg` parameter is now required to be exactly 32 bytes — a serialized field element (e.g. `Fr.toBuffer()` or `messageHash.toBuffer()`). Passing arbitrary-length byte strings will fail at the bb.js boundary.

### [Aztec.nr] `attempt_note_discovery` is no longer exposed; use `process_private_note_msg`

`attempt_note_discovery` is now crate-private. Custom message handlers (implementations of `CustomMessageHandler`) that previously called it directly should call `process_private_note_msg` instead, which runs the standard private note message decoding and discovery pipeline.

`process_private_note_msg` takes the raw `msg_metadata` and `msg_content` rather than already-decoded note fields, so it handles decoding (and silently discards undecodable messages) on your behalf:

```diff
- attempt_note_discovery(
-     contract_address,
-     tx_hash,
-     unique_note_hashes_in_tx,
-     first_nullifier_in_tx,
-     compute_note_hash,
-     compute_note_nullifier,
-     owner,
-     storage_slot,
-     randomness,
-     note_type_id,
-     packed_note,
- );
+ process_private_note_msg(
+     contract_address,
+     tx_hash,
+     unique_note_hashes_in_tx,
+     first_nullifier_in_tx,
+     compute_note_hash,
+     compute_note_nullifier,
+     msg_metadata,
+     msg_content,
+ );
```

**Impact**: Custom message handlers that reused the standard note message processing pipeline must switch to `process_private_note_msg`. Contracts using only built-in private note handling are unaffected.

### [Aztec.nr] TXE `call_public_incognito` no longer takes a `from` parameter

`TestEnvironment::call_public_incognito` previously accepted a `from` address that was silently ignored (the function always uses a null `msg_sender`). The `from` parameter has been removed.

```diff
- env.call_public_incognito(sender, SampleContract::at(addr).some_function());
+ env.call_public_incognito(SampleContract::at(addr).some_function());
```

If you need to call a public function _with_ a sender, use `call_public` instead.

### [Aztec.nr] TXE `view_public_incognito` is deprecated

`TestEnvironment::view_public_incognito` is now deprecated in favor of `view_public`, which has the same behavior (null `msg_sender`, static call).

```diff
- env.view_public_incognito(SampleContract::at(addr).some_view());
+ env.view_public(SampleContract::at(addr).some_view());
```

### [Aztec.js] `DeployMethod` address-affecting parameters move to construction time

Salt, deployer, and public keys are now passed when the `DeployMethod` is constructed, not on every call to `send` / `simulate` / `request` / `getInstance`. This locks the contract address once it is determined and prevents the silent salt-cache poisoning bug where the address could change between calls.

`contractAddressSalt`, `deployer`, and `universalDeploy` have been removed from `DeployOptions`, `RequestDeployOptions`, and `SimulateDeployOptions`. They now live on a new `DeployInstantiationOptions` argument passed at construction. `deployer` and `universalDeploy` are mutually exclusive; passing both throws. `Contract.deployWithPublicKeys` and the generated `MyContract.deployWithPublicKeys(...)` factories have been removed; pass `publicKeys` via the `instantiation` argument of `deploy(...)` instead. The buggy synchronous `address` and `partialAddress` getters have been removed and replaced with `getAddress()` and `getPartialAddress()` (both `async`).

The compact form keeps working: `MyContract.deploy(wallet, ...args).send({ from: alice })` deploys with `deployer = alice` and `salt = random()`, exactly as before. The deployer is locked the first time `send` / `simulate` / `profile` is called (from `options.from`, with `NO_FROM` or undefined → universal) and cannot change after that:

- Subsequent `send` / `simulate` / `profile` calls with a `from` that would imply a different deployer throw, instead of silently producing a different address.
- A lock to universal (`AztecAddress.ZERO`) is the only one compatible with any sender, since the universal address does not depend on `from`.
- A lock to a concrete address only accepts that exact `from` on subsequent calls.

**Migration:**

Universal deployment with a fixed salt:

```diff
- const deploy = MyContract.deploy(wallet, ...args);
- await deploy.send({
-   from: alice,
-   contractAddressSalt: salt,
-   universalDeploy: true,
- });
+ const deploy = MyContract.deploy(wallet, ...args, { salt, universalDeploy: true });
+ await deploy.send({ from: alice });
```

Non-universal deploy where `from` doubles as the deployer:

```diff
- const deploy = MyContract.deploy(wallet, ...args);
- await deploy.send({ from: alice, contractAddressSalt: salt });
+ const deploy = MyContract.deploy(wallet, ...args, { salt });
+ await deploy.send({ from: alice });
```

If you need to read the address before sending, lock the deployer at construction:

```typescript
const deploy = MyContract.deploy(wallet, ...args, { salt, deployer: alice });
const address = await deploy.getAddress(); // resolves; deployer was locked at construction
await deploy.send({ from: alice }); // deploys at the address `getAddress` returned
```

Universal deploys can be sent by any account, since the universal address does not depend on `from`:

```typescript
const deploy = MyContract.deploy(wallet, ...args, { universalDeploy: true });
await deploy.send({ from: bob }); // OK, universal accepts any sender
```

A lock to a concrete deployer rejects sending from a different account, instead of silently deploying at a different address:

```typescript
const deploy = MyContract.deploy(wallet, ...args, { deployer: alice });
await deploy.send({ from: bob }); // throws: deployer is locked to alice
```

`deployWithPublicKeys` is gone; pass `publicKeys` in the instantiation options instead:

```diff
- const deploy = MyContract.deployWithPublicKeys(publicKeys, wallet, ...args);
+ const deploy = MyContract.deploy(wallet, ...args, { publicKeys });
```

`ContractDeployer.deploy(...)` now takes the instantiation argument as its first parameter (pass `{}` to use defaults and rely on lazy locking from `from`):

```diff
- const cd = new ContractDeployer(artifact, wallet);
- await cd.deploy(...ctorArgs).send({ from: alice, contractAddressSalt: salt });
+ const cd = new ContractDeployer(artifact, wallet);
+ await cd.deploy(ctorArgs, { salt }).send({ from: alice });
```

The synchronous `address` / `partialAddress` getters are gone:

```diff
- const address = deploy.address;                       // sync, possibly undefined
- const partial = await deploy.partialAddress;          // sync getter wrapping async value
+ const address = await deploy.getAddress();            // requires the deployer to be locked
+ const partial = await deploy.getPartialAddress();     // requires the deployer to be locked
```

`getInstance()` no longer takes options; use the construction-time instantiation instead:

```diff
- const instance = await deploy.getInstance({ contractAddressSalt: salt });
+ const deploy = MyContract.deploy(wallet, ...args, { salt, deployer: alice });
+ const instance = await deploy.getInstance();
```

### [aztec-up] Bundled binaries are no longer exposed under bare names on `PATH`

The Aztec installer previously placed bundled binaries directly into `$HOME/.aztec/current/bin` under bare names (`forge`, `nargo`, `bb`, `pxe`, ...). Anything with the same name in your own `PATH` was silently shadowed in unrelated projects.

Every bundled binary is now exposed only under an `aztec-` prefixed name in `$HOME/.aztec/current/bin`. Bare names are not on `PATH` at all and resolve to your own install (if any).

| Was on `PATH`      | Now                      |
| ------------------ | ------------------------ |
| `forge`            | `aztec-forge`            |
| `cast`             | `aztec-cast`             |
| `anvil`            | `aztec-anvil`            |
| `chisel`           | `aztec-chisel`           |
| `nargo`            | `aztec-nargo`            |
| `noir-profiler`    | `aztec-noir-profiler`    |
| `bb`               | `aztec-bb`               |
| `bb-cli`           | `aztec-bb-cli`           |
| `pxe`              | `aztec-pxe`              |
| `txe`              | `aztec-txe`              |
| `validator-client` | `aztec-validator-client` |
| `blob-client`      | `aztec-blob-client`      |

`aztec`, `aztec-wallet`, and `aztec-up` keep their existing names.

If you relied on a bundled bare-name binary for general use:

- For Aztec contract work, prefer `aztec compile` and `aztec test`.
- For other Noir / Foundry commands, invoke the `aztec-*` symlink directly (e.g. `aztec-nargo fmt`, `aztec-forge build`).
- Or install Foundry / nargo separately via `foundryup` / `noirup`.

If you set `Noir: Nargo Path` in the VS Code Noir extension to `$HOME/.aztec/current/bin/nargo`, change it to `$HOME/.aztec/current/bin/aztec-nargo` (the symlink is a drop-in for `nargo`). See the [Noir VSCode Extension guide](../aztec-nr/installation.md) for details.

### [Stdlib] `SimulationOverrides.contracts` entries no longer carry an artifact

`ContractOverrides` entries are now `{ instance }` only. To override a contract's artifact, pre-register the target class via `pxe.registerContractClass(artifact)` and set the override instance's `currentContractClassId` to that class id:

```diff
- const instance = await getContractInstanceFromInstantiationParams(stubArtifact, { salt: Fr.random() });
+ const instance = await pxe.getContractInstance(addr);
+ await pxe.registerContractClass(stubArtifact);
+ const stubClassId = (await getContractClassFromArtifact(stubArtifact)).id;
- overrides = { contracts: { [addr.toString()]: { instance, artifact: stubArtifact } } };
+ overrides = { contracts: { [addr.toString()]: { instance: { ...instance, currentContractClassId: stubClassId } } } };
```

### [Aztec.js] `simulate` accepts `overrides` for testing "what if storage value was X?"

`Contract.methods.foo(...).simulate(...)` now accepts an `overrides` option that injects values into the simulator's (ephemeral) world-state fork and contract DB before the call runs. The supported field is `publicStorage`, which writes a `(contract, slot, value)` into the public-data tree as if a previous tx had set it. Overrides are thrown away after simulation completes.

```typescript
const result = await contract.methods.read_balance(account).simulate({
  overrides: {
    publicStorage: [
      {
        contract: contract.address,
        slot: BALANCE_SLOT,
        value: new Fr(1_000_000n),
      },
    ],
  },
});
```

The same option flows through `wallet.simulateTx` and eventually to `simulatePublicCalls` RPC on `AztecNode`.

Direct callers of the `SimulationOverrides` constructor must switch from a positional `contracts` argument to an options bag:

```diff
- new SimulationOverrides(contracts);
+ new SimulationOverrides({ contracts });
```

`overrides.contracts` swaps contract instances in the simulator's contract DB — useful for simulating a contract being on a different class than the one it was deployed with. To simulate a complete onchain upgrade flow, use the `fastForwardContractUpdate` helper which returns a `SimulationOverrides` covering both registry storage rewrites and the upgraded instance entry:

```typescript
import { fastForwardContractUpdate } from "@aztec/aztec.js";

const overrides = await fastForwardContractUpdate({
  instanceAddress: contract.address,
  newClassId: upgradedClass.id,
  node,
});
const result = await contract.methods.upgraded_method().simulate({ overrides });
```

### [PXE] `proveTx` takes an options bag

`PXE.proveTx` used to accept `scopes` as a positional argument; it now takes an options bag consistent with `simulateTx` and `profileTx`, and adds an optional `senderForTags` field. Update direct callers:

```diff
- pxe.proveTx(txRequest, scopes);
+ pxe.proveTx(txRequest, { scopes });
```

The new `senderForTags` field sets the address recipients use to find private messages (notes, events, logs) emitted by this tx. Most wallets don't need to set it; the wallet SDK derives it from the tx's `from` address:

```typescript
// Most callers: just migrate scopes
pxe.proveTx(txRequest, { scopes });

// When from === NO_FROM (e.g. self-paid account deploy), supply the tag sender explicitly:
pxe.proveTx(txRequest, { scopes, senderForTags: deployedAddress });
```

### [Aztec.nr] `set_sender_for_tags` is now scoped to the calling contract

`set_sender_for_tags` previously persisted through nested calls. It is now scoped to the contract that calls it: nested calls, siblings, and parents are unaffected and always start from the initial default. This closes a silent note-discovery DoS vector where any nested callee could overwrite the tag sender for legitimate contracts called below it.

The wallet SDK now supplies the default sender-for-tags from the transaction's `from` address, with an optional `sendMessagesAs` override for flows that don't have a signing account (e.g. self-paid deploys, which `DeployAccountMethod` sets automatically). Account contracts therefore no longer need to call `set_sender_for_tags(self.address)` in their entrypoints; those calls have been removed from the standard schnorr and ECDSA account contracts, and you can drop the equivalent call in any custom account contract.

The save/restore idiom previously used in account-contract constructors (`get` → `set(self.address)` → work → `set(prev)`) is also no longer needed and has been removed: the override never leaks out of the constructor, so there is nothing to restore.

### [Aztec Node] Unified `getBlock` / `getCheckpoint` RPC API

The Aztec Node JSON-RPC surface for fetching blocks and checkpoints has been consolidated. The unified `getBlock` and `getCheckpoint` methods return uniform `BlockResponse` / `CheckpointResponse` shapes. The extra fields a caller cares about (tx bodies, L1 publish info, committee attestations, nested blocks) are now controlled by an `options` argument rather than by picking the right method. `getBlocks` and `getCheckpoints` retain their names but now return the new response shapes.

**Removed methods:**

| Removed                            | Replacement                                  |
| ---------------------------------- | -------------------------------------------- |
| `getBlockByHash(hash)`             | `getBlock(hash)` or `getBlock({ hash })`     |
| `getBlockByArchive(archive)`       | `getBlock({ archive })`                      |
| `getBlockHeaderByArchive(archive)` | `getBlock({ archive }).then(r => r?.header)` |
| `getProvenBlockNumber()`           | `getBlockNumber('proven')`                   |
| `getCheckpointedBlockNumber()`     | `getBlockNumber('checkpointed')`             |

**Deprecated but still present** (scheduled for removal once internal consumers of the archiver shape are rewired): `getL2Tips` (use `getChainTips`), `getBlockHeader` (use `getBlock(param).then(r => r?.header)`), `getCheckpointedBlocks` (use `getBlocks(from, limit, { includeL1PublishInfo: true, includeAttestations: true })`). Do not adopt these in new code. (`getCheckpointsDataForEpoch` was previously listed here; see the dedicated checkpoint-API entry below for its removal.)

**New response shapes:** `BlockResponse` always carries `header`, `archive`, `hash`, `number`, `checkpointNumber`, and `indexWithinCheckpoint`. `body`, `l1` (an `L1PublishInfo` discriminated union), and `attestations` are present only when the matching include option is set. `CheckpointResponse` mirrors this for checkpoints, with `blocks` gated on `includeBlocks`, and always carries `feeAssetPriceModifier` as a base field. The response types are generic over the options object, so passing a literal `{ includeTransactions: true }` narrows the return type and `response.body` becomes non-optional.

**Nested blocks on `getCheckpoint`:** only `includeTransactions` is forwarded to the blocks embedded by `includeBlocks: true`. `includeL1PublishInfo` and `includeAttestations` on a checkpoint request attach L1 / attestation data to the checkpoint itself, not to its nested blocks.

**Return type changes for `getBlocks` / `getCheckpoints`:** the return type is now `BlockResponse[]` / `CheckpointResponse[]` instead of `L2Block[]` / `PublishedCheckpoint[]`. Callers that previously consumed fields of `L2Block` (e.g. `.body`) must now opt in via `{ includeTransactions: true }`; callers that consumed `PublishedCheckpoint.checkpoint.blocks` must opt in via `{ includeBlocks: true }`.

**Migration for wallet/SDK consumers (`@aztec/aztec.js`, `@aztec/wallet-sdk`):**

```diff
- const block = await node.getBlockByHash(hash);
+ const block = await node.getBlock(hash, { includeTransactions: true });

- const archiveBlock = await node.getBlockByArchive(archive);
+ const archiveBlock = await node.getBlock({ archive }, { includeTransactions: true });

- const provenNumber = await node.getProvenBlockNumber();
+ const provenNumber = await node.getBlockNumber('proven');

- const checkpointedNumber = await node.getCheckpointedBlockNumber();
+ const checkpointedNumber = await node.getBlockNumber('checkpointed');

- const tips = await node.getL2Tips();
+ const tips = await node.getChainTips();
```

`getBlockHeader`, `getCheckpointedBlocks`, `getCheckpointsDataForEpoch`, and `getL2Tips` continue to work in this release but are deprecated; migrate to the replacements above.

**Chain-tip selectors:** `getBlockNumber` and `getCheckpointNumber` now accept an optional `ChainTip` argument (`'proposed' | 'checkpointed' | 'proven' | 'finalized'`). The `'proposed'` semantics are described in the dedicated checkpoint-API entry below — they were tightened in this release to mean "the proposed-tip checkpoint" rather than "the latest L1-confirmed checkpoint."

**Block parameter variants:** `BlockParameter` now also accepts a block hash, an archive root, and chain-tip names. The existing `number | 'latest'` forms continue to work — `'latest'` is an alias for `'proposed'`.

**Impact**: Source changes are required anywhere the removed methods are called. Type changes are required anywhere `L2Block` / `BlockHeader` / `CheckpointedL2Block` were consumed from the RPC — those call sites now receive `BlockResponse` / `CheckpointResponse` and must request the fields they need via `options`. Production nodes will reject JSON-RPC calls to the removed method names.

### [Aztec Node] Checkpoint RPC: `'proposed'` is now strictly proposed; `'latest'` removed; `getCheckpointsData` takes a query

Follow-up to the unified-RPC change above. Tightens the checkpoint-side API surface: removes the old positional / per-shape entrypoints, drops the wire-level alias that conflated proposed and confirmed checkpoints, and replaces the deprecated epoch-only `getCheckpointsDataForEpoch` method with a unified query-shaped `getCheckpointsData` that mirrors the block-side API.

**`getCheckpointsDataForEpoch(epoch)` removed.** The previously-deprecated method is gone. Use `getCheckpointsData({ epoch })` instead. The new `getCheckpointsData` also accepts a contiguous range:

```diff
- const cps = await node.getCheckpointsDataForEpoch(epoch);
+ const cps = await node.getCheckpointsData({ epoch });

  // New: contiguous range
+ const cps = await node.getCheckpointsData({ from: 1, limit: 5 });
```

**`'latest'` removed from `CheckpointParameter`.** The `'latest'` literal previously accepted by `getCheckpoint('latest', options)` is no longer valid. Use `'checkpointed'` to address the latest confirmed checkpoint, or `'proposed'` for the proposed-tip semantics described below. (Block-side `'latest'` in `BlockParameter` is unaffected.)

```diff
- await node.getCheckpoint('latest');
+ await node.getCheckpoint('checkpointed');
```

**`'proposed'` semantics changed.** Previously `'proposed'` on the checkpoint side aliased to "latest L1-confirmed checkpoint" — a documented foot-gun. After this release:

- `getCheckpoint('proposed')` resolves to the proposed-tip checkpoint number and looks it up confirmed-first, then falls back to the proposed-checkpoint store. When a proposed entry exists at that number it is returned; when none exists, the proposed-tip falls back to the confirmed tip and the call returns the latest confirmed checkpoint. Returns `undefined` only when neither store has the resolved number.
- `getCheckpointNumber('proposed')` returns the proposed-tip checkpoint number, falling back to the latest confirmed checkpoint number when no proposed entry exists. Return type stays `Promise<CheckpointNumber>`.

If you want the latest L1-confirmed checkpoint regardless of proposed state, switch the call to `'checkpointed'`:

```diff
- const cp = await node.getCheckpoint('proposed');
- const n  = await node.getCheckpointNumber('proposed');
+ const cp = await node.getCheckpoint('checkpointed');
+ const n  = await node.getCheckpointNumber('checkpointed');
```

**By-number / by-slot lookups gain a confirmed→proposed fallback.** `getCheckpoint({ number: N })` and `getCheckpoint({ slot: S })` now check the confirmed store first, then fall back to the proposed store. Tag-based lookups (`'checkpointed'`, `'proven'`, `'finalized'`) do not fall back — those tags name confirmed-only positions.

**Throws on a proposed match + L1/attestations.** Proposed checkpoints have no L1 publish info or committee attestations (those data points only exist after L1 confirmation). The throw fires only when the lookup actually lands on a proposed entry — i.e. the confirmed store missed and the proposed store hit. When the proposed-tip falls back to the confirmed tip (no proposed entry exists), `'proposed' + includeAttestations` returns the latest confirmed checkpoint with attestations rather than throwing:

```ts
// Throws BadRequestError when a proposed entry exists at the resolved number:
await node.getCheckpoint("proposed", { includeAttestations: true });
await node.getCheckpoint("proposed", { includeL1PublishInfo: true });

// And when a by-number / by-slot lookup falls back to a proposed entry:
await node.getCheckpoint({ number: N }, { includeAttestations: true });
// → throws if N is matched only in the proposed store
```

If your code asks for `includeAttestations` / `includeL1PublishInfo` and might land on a proposed entry, gate the call on `getCheckpoint(param)` first, then re-issue with the include flags only after confirming the result is from the confirmed store (e.g. by checking that the tag-based equivalent returns the same checkpoint number).

**Impact**: Wallet, indexer, and tooling code that called `node.getCheckpoint('proposed')` or `node.getCheckpoint('latest')` will need to update their tag. Any code relying on the old "proposed = latest confirmed" alias should switch to `'checkpointed'`. Code that combined `'proposed'` (or by-number/by-slot fallbacks) with `includeAttestations` / `includeL1PublishInfo` will now throw at runtime; gate those flags as described above.

### [Aztec Node] `feeAssetPriceModifier` now correctly populated on confirmed checkpoints

Confirmed checkpoints previously reported `feeAssetPriceModifier = 0n` regardless of the value observed on L1, because the archiver dropped the field on checkpoint confirmation. The field is now persisted and returned correctly on `CheckpointResponse`. Any wallet or indexer logic that special-cased `0n` as a sentinel for "no modifier" will need to be updated; it is now a valid value in its own right.

### [CLI] `aztec-up` no longer exposes transitive npm bins on PATH

The `aztec-up` installer used to add `$HOME/.aztec/current/node_modules/.bin` to your shell `PATH`, which put ~40 transitive npm bins (`jest`, `tsc`, `tsserver`, `semver`, `uuid`, `json5`, ...) onto your interactive shell and silently shadowed your own installed versions of those tools. Only the seven `@aztec/*`-owned bins (`aztec`, `aztec-wallet`, `bb`, `bb-cli`, `blob-client`, `noir-codegen`, `txe`) are now exposed.

If you had an Aztec version installed before this release, your shell profile (`~/.bashrc` or `~/.zshrc`) still contains the old `PATH` line. Re-run the installer once (replacing `[VERSION]` with whichever toolchain version you're on, e.g. `4.2.0`) to replace it:

```bash
VERSION=[VERSION] bash -i <(curl -sL https://install.aztec.network)
```

Open a fresh shell and confirm the leak is gone:

```bash
echo $PATH
```

`$HOME/.aztec/current/node_modules/.bin` should no longer appear in the output. You'll also see your own `jest`, `tsc`, etc. again instead of the ones bundled with the Aztec toolchain.

### [Protocol] Domain separators introduced for merkle-node, block-headers, and blob hashes

Several protocol hashes that previously used bare `poseidon2_hash` are now domain-separated via `poseidon2_hash_with_separator`. This is a security hardening change — it prevents a value produced by one hash context from being reinterpreted in another (e.g. a sibling path from one tree being transported to another).

**New domain separators:**

- `DOM_SEP__MERKLE_HASH` — sibling-pair hash for append-only trees (note-hash, L1→L2, archive, VK tree, and the balanced/unbalanced tree hash helpers in `@aztec/foundation/trees`).
- `DOM_SEP__NULLIFIER_MERKLE`, `DOM_SEP__PUBLIC_DATA_MERKLE`, `DOM_SEP__WRITTEN_SLOTS_MERKLE`, `DOM_SEP__RETRIEVED_BYTECODES_MERKLE` — per-tree sibling-pair hash for each indexed tree. Each tree uses its own separator so sibling paths are non-transportable across trees.
- `DOM_SEP__BLOCK_HEADERS_HASH` — used when accumulating block headers into `blockHeadersHash`.
- `DOM_SEP__BLOB_HASHED_Y_LIMBS`, `DOM_SEP__BLOB_CHALLENGE_Z`, `DOM_SEP__BLOB_Z_ACC`, `DOM_SEP__BLOB_GAMMA_ACC`, `DOM_SEP__BLOB_GAMMA_FINAL` — blob accumulator and challenge derivations.

**:warning: Hard-coded test constants will no longer match.** Every value derived from any of the hashes above is new in this release. This includes (non-exhaustively):

- **All merkle tree roots** — note-hash, nullifier, public-data, L1→L2 message, archive, VK, and the AVM-internal written-slots and retrieved-bytecodes (class-ids) trees.
- **Genesis constants** — `GENESIS_BLOCK_HEADER_HASH`, `GENESIS_ARCHIVE_ROOT`, `AVM_WRITTEN_PUBLIC_DATA_SLOTS_TREE_INITIAL_ROOT`, `AVM_RETRIEVED_BYTECODES_TREE_INITIAL_ROOT`.
- **Every block hash and archive root** — they commit to tree roots and the new block-headers-hash.
- **Protocol contract addresses** — their derivation depends on the private-function tree root.
- **Blob commitments / challenges** — any test that pins `z`, `gamma`, or the accumulator outputs.

Regenerate these values from a fresh build of this release — do not copy them from previous release fixtures.

**If you re-implement any of these hashes off-circuit** (e.g. a wallet that computes nullifier low-leaf membership, or an indexer that derives block hashes / tree roots), update the call sites:

```diff
  // Merkle sibling-pair hash (append-only trees)
- poseidon2Hash([left, right])
+ poseidon2HashWithSeparator([left, right], DomainSeparator.MERKLE_HASH)

  // Indexed-tree sibling-pair hash — pick the matching tree separator
- poseidon2Hash([left, right])
+ poseidon2HashWithSeparator([left, right], DomainSeparator.NULLIFIER_MERKLE)
+ // or PUBLIC_DATA_MERKLE, WRITTEN_SLOTS_MERKLE, RETRIEVED_BYTECODES_MERKLE
```

`poseidon2HashWithSeparator` is exported from `@aztec/foundation/crypto/poseidon`; the `DomainSeparator` enum and the matching `DOM_SEP__*` constants are defined in `@aztec/constants`. The new entries listed above are additions — existing separator names are unchanged.

For TypeScript consumers, `@aztec/stdlib/hash` exports ready-made helpers that wrap the right separator: `computeMerkleHash` (append-only), `computeNullifierMerkleHash`, and `computePublicDataMerkleHash`. Prefer these over calling `poseidon2HashWithSeparator` directly so the separator choice stays colocated with the tree.

### [Aztec.nr] `emit_private_log_unsafe` / `emit_raw_note_log_unsafe` are deprecated

`emit_private_log_unsafe` and `emit_raw_note_log_unsafe` are deprecated and will be removed in a future release. Migrate to the new `emit_private_log_vec_unsafe` / `emit_raw_note_log_vec_unsafe` functions, which take a `BoundedVec<Field, PRIVATE_LOG_CIPHERTEXT_LEN>` instead of the `(log: [Field; PRIVATE_LOG_CIPHERTEXT_LEN], length: u32)` pair.

```diff
- context.emit_private_log_unsafe(tag, log, length);
+ context.emit_private_log_vec_unsafe(tag, bounded_vec_log);
- context.emit_raw_note_log_unsafe(tag, log, length, note_hash_counter);
+ context.emit_raw_note_log_vec_unsafe(tag, bounded_vec_log, note_hash_counter);
```

If you were manually padding an array and passing a shorter length, you can now create a `BoundedVec` from just the meaningful fields:

```diff
- let padded = payload.concat([0; PRIVATE_LOG_CIPHERTEXT_LEN - 2]);
- context.emit_private_log_unsafe(tag, padded, 2);
+ let log = BoundedVec::from_array(payload);
+ context.emit_private_log_vec_unsafe(tag, log);
```

If you were passing the full array, wrap it with `BoundedVec::from_array`:

```diff
- context.emit_private_log_unsafe(tag, ciphertext, ciphertext.len());
+ context.emit_private_log_vec_unsafe(tag, BoundedVec::from_array(ciphertext));
```

### [aztec-nr] Nullifier membership witness oracle returns split types

`get_nullifier_membership_witness` and `get_low_nullifier_membership_witness` now return `(NullifierLeafPreimage, MembershipWitness<NULLIFIER_TREE_HEIGHT>)` instead of the bundled `NullifierMembershipWitness` struct (which has been removed).

If you were using these oracle functions directly (e.g. in `schnorr_account_contract`'s `lookup_validity`), update your code to destructure the tuple:

```diff
- let witness = get_low_nullifier_membership_witness(block_header, siloed_nullifier);
- let nullifier_value = witness.leaf_preimage.nullifier;
- let index = witness.index;
- let path = witness.path;
+ let (leaf_preimage, witness) = get_low_nullifier_membership_witness(block_header, siloed_nullifier);
+ let nullifier_value = leaf_preimage.nullifier;
+ let index = witness.leaf_index;
+ let path = witness.sibling_path;
```

Note the field renames: `index` is now `leaf_index`, and `path` is now `sibling_path` (matching the protocol circuit's `MembershipWitness` type).

This has been done because this is the format expected by the functionality in protocol circuits and given that this is sensitive security-wise it made sense to reuse that functionality in Aztec.nr.

### [L1 Contracts] Empire slasher removed, slasher config simplified

The empire slashing model has been removed. Only the tally-based slashing model remains, and it has been renamed from `TallySlashingProposer` to `SlashingProposer`.

**L1 contract changes:**

- `SlasherFlavor` enum removed from `ISlasher.sol`
- `RollupConfigInput.slasherFlavor` (enum) replaced with `slasherEnabled` (bool)
- `TallySlashingProposer` contract renamed to `SlashingProposer`
- `TallySlasherDeploymentExtLib` library renamed to `SlasherDeploymentExtLib`
- `SlashFactory` periphery contract removed
- `SLASHING_PROPOSER_TYPE` constant removed from `SlashingProposer`
- All `TallySlashingProposer__` error prefixes renamed to `SlashingProposer__`

**Environment variable changes:**

```diff
- AZTEC_SLASHER_FLAVOR=tally    # was: "tally" | "empire" | "none"
+ AZTEC_SLASHER_ENABLED=true    # now a boolean
```

**Removed environment variables:** `SLASH_MIN_PENALTY_PERCENTAGE`, `SLASH_MAX_PENALTY_PERCENTAGE`

**Removed from deploy outputs:** `slashFactoryAddress`

**Node admin API:** `getSlashPayloads()` method removed.

**TypeScript config changes:**

```diff
- slasherFlavor: 'tally' | 'none'
+ slasherEnabled: boolean
```

`slashMinPenaltyPercentage` and `slashMaxPenaltyPercentage` removed from `SlasherConfig`.

### [Aztec Node] `getTxByHash`, `getTxsByHash` and `getPendingTxs` no longer return tx proofs by default

`AztecNode.getTxByHash`, `AztecNode.getTxsByHash` and `AztecNode.getPendingTxs` (also exposed on the P2P API) now take an optional `GetTxByHashOptions` argument with an `includeProof` flag. The proof is stripped from returned txs unless `includeProof: true` is passed, cutting roughly 35-52KB per tx over the wire.

**Migration:**

```diff
- const tx = await node.getTxByHash(txHash);
+ const tx = await node.getTxByHash(txHash, { includeProof: true });

- const txs = await node.getPendingTxs(limit, after);
+ const txs = await node.getPendingTxs(limit, after, { includeProof: true });
```

**Impact**: Callers that read the proof off returned txs (eg to re-broadcast or validate them) must now pass `{ includeProof: true }` explicitly; by default the returned txs carry an empty proof.

### [aztec.js] `DeployMethod.send()` always returns `{ contract, receipt, instance }`

The `returnReceipt` option in deploy wait options has been removed. `DeployMethod.send()` now always returns an object with `contract`, `receipt`, and `instance` at the top level, provided the user waits for the transaction to be included.

The `DeployTxReceipt` and `DeployWaitOptions` types have been removed.

**Migration:**

```diff
- const {
-   receipt: { contract, instance },
- } = await MyContract.deploy(wallet, ...args).send({
-   from: address,
-   wait: { returnReceipt: true },
- });

+ const { contract, instance } = await MyContract.deploy(wallet, ...args).send({
+   from: address,
+ });
```

### [CLI] `aztec init` now scaffolds a Counter example template

`aztec init` previously created a blank contract crate. It now scaffolds a runnable **Counter** example contract with a constructor, `increment`, and `get_counter` functions, plus a test suite, so new developers have a working starting point ([#22751](https://github.com/AztecProtocol/aztec-packages/pull/22751)).

- `aztec init` — scaffolds the Counter example (new default).
- `aztec new <NAME>` — still scaffolds a blank contract, either as a new standalone project or as a new crate added to an existing workspace.

**Impact**: any scripts, CI jobs, or onboarding docs that ran `aztec init` expecting an empty contract starting point now get the Counter example. Use `aztec new <NAME>` for the blank scaffold. The existing Counter tutorial under [`docs/tutorials/contract_tutorials`](../tutorials/contract_tutorials/counter_contract.md) is unaffected because it uses `aztec new`.

## 4.3.0

### `aztec new` and `aztec init` now create a 2-crate workspace

`aztec new` and `aztec init` now create a workspace with two crates instead of a single contract crate:

- A `contract` crate (type = "contract") for your smart contract code
- A `test` crate (type = "lib") for Noir tests, which depends on the contract crate

The new project structure looks like:

```
my_project/
├── Nargo.toml           # [workspace] members = ["contract", "test"]
├── contract/
│   ├── src/main.nr
│   └── Nargo.toml       # type = "contract"
└── test/
    ├── src/lib.nr
    └── Nargo.toml       # type = "lib"
```

**What changed:**

- The `--contract` and `--lib` flags have been removed from `aztec new` and `aztec init`. These commands now always create a contract workspace.
- Contract code is now at `contract/src/main.nr` instead of `src/main.nr`.
- The `Nargo.toml` in the project root is now a workspace file. Contract dependencies go in `contract/Nargo.toml`.
- Tests should be written in the separate `test` crate (`test/src/lib.nr`) and import the contract by package name (e.g., `use my_contract::MyContract;`) instead of using `crate::`.

### `aztec new` crate directories are now named after the contract

`aztec new` and `aztec init` now name the generated crate directories after the contract instead of using generic `contract/` and `test/` names. For example, `aztec new counter` now creates:

```
counter/
├── Nargo.toml                # [workspace] members = ["counter_contract", "counter_test"]
├── counter_contract/
│   ├── src/main.nr
│   └── Nargo.toml            # type = "contract"
└── counter_test/
    ├── src/lib.nr
    └── Nargo.toml            # type = "lib"
```

This enables adding multiple contracts to a single workspace. Running `aztec new <name>` inside an existing workspace (a directory with a `Nargo.toml` containing `[workspace]`) now adds a new `<name>_contract` and `<name>_test` crate pair to the workspace instead of creating a new directory.

**What changed:**

- Crate directories are now `<name>_contract/` and `<name>_test/` instead of `contract/` and `test/`.
- Contract code is now at `<name>_contract/src/main.nr` instead of `contract/src/main.nr`.
- Contract dependencies go in `<name>_contract/Nargo.toml` instead of `contract/Nargo.toml`.
- Tests import the contract by its new crate name (e.g., `use counter_contract::Main;` instead of `use counter::Main;`).

### [CLI] `--name` flag removed from `aztec new` and `aztec init`

The `--name` flag has been removed from both `aztec new` and `aztec init`. For `aztec new`, the positional argument now serves as both the contract name and the directory name. For `aztec init`, the directory name is always used as the contract name.

**Migration:**

```diff
- aztec new my_project --name counter
+ aztec new counter
```

```diff
- aztec init --name counter
+ aztec init
```

**Impact**: If you were using `--name` to set a contract name different from the directory name, rename your directory or use `aztec new` with the desired contract name directly.
