# Spec Delta

## Purpose

The back office's HTTP surface as its clients observe it: issuing
connection tokens, connecting a device, authenticated sync, disconnecting,
isolation between lending businesses, and durability across restarts.

## ADDED Requirements

### Requirement: An admin issues connection tokens

An admin SHALL be able to issue a connection token for an existing lending
business (tenant), with an expiry (7 days unless set). The token SHALL be
shown once, and the server SHALL store only a hash of it.

#### Scenario: Issue a token

- **WHEN** an admin issues a token for business "mikro"
- **THEN** a token is printed once, and the server's store holds its hash, business and expiry, never the token itself

#### Scenario: Unknown business

- **WHEN** an admin issues a token for a business that has not been provisioned
- **THEN** issuing fails and no token is created

### Requirement: Connect trades a token for a device credential

`POST /v1/connect` SHALL take a connection token and a device id, and on
success return a device credential, the business's id and its display
name. The token SHALL be consumed. A used, expired or unknown token SHALL
get the same 401 answer.

#### Scenario: First use

- **WHEN** a device posts a valid, unused token
- **THEN** it receives a device credential and the business's name, and the token can't be used again

#### Scenario: Any bad token

- **WHEN** a device posts a used, expired or unknown token
- **THEN** the answer is 401 with the same body in every case

### Requirement: Sync requires a device credential and ignores tenant claims in the body

`POST /v1/sync` SHALL require a valid device credential in the
`Authorization` header. The business SHALL come only from the credential.
The batch's `deviceId` SHALL match the credential's device.

#### Scenario: No or revoked credential

- **WHEN** a sync arrives without a credential, or with a revoked one
- **THEN** it is answered 401 and nothing is applied

#### Scenario: Device id mismatch

- **WHEN** a batch's `deviceId` differs from the credential's device
- **THEN** it is answered 403 and nothing is applied

### Requirement: Businesses are isolated

Every change SHALL be applied only to the Fineract tenant and store of the
credential's business. No request SHALL read or change another business's
data.

#### Scenario: Same app id in two businesses

- **WHEN** two businesses each send a customer with the same app id
- **THEN** each lands in its own business, and neither sees the other's

### Requirement: Disconnect revokes the device

`POST /v1/disconnect` SHALL revoke the calling device's credential. Later
requests with it SHALL be answered 401. An admin SHALL also be able to
revoke a device.

#### Scenario: Device disconnects

- **WHEN** a device posts to `/v1/disconnect` with its credential
- **THEN** its next sync is answered 401

### Requirement: The server keeps its state across restarts

Results already given, id mappings, the cobro journal, waivers, visits,
cash closes, devices and tokens SHALL survive a back office restart.

#### Scenario: Restart between two syncs

- **WHEN** the back office restarts after applying a batch, and the app sends that same batch again
- **THEN** every change in it is answered "duplicate"
