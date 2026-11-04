# Spec Delta

## Purpose

Lets a lender connect the Micobro app to their lending business's back
office with a one-time token, keeps the device connected with a credential
bound to that business, and lets the lender disconnect.

## ADDED Requirements

### Requirement: Connect from settings with a one-time token

The app SHALL offer "Conectar al back office" in settings. The lender enters
a connection token (typed or pasted). On success, the app SHALL store a
device credential in the phone's secure storage and show the business's
name as connected.

#### Scenario: Valid token connects

- **WHEN** the lender enters a valid, unused connection token while online
- **THEN** the app shows it is connected to that business by name
- **AND** the device credential is stored in secure storage, never in SQLite or logs

#### Scenario: Offline when connecting

- **WHEN** the lender tries to connect without connectivity
- **THEN** the app explains in Spanish that connecting needs internet, and nothing changes

### Requirement: Connection tokens are single use and expire

A connection token SHALL work for exactly one device, once, and only
before it expires. A used, expired or unknown token SHALL be refused with
the same Spanish message, without revealing which case applied.

#### Scenario: Token used twice

- **WHEN** a second device enters a token that a first device already used
- **THEN** the second device is refused and stays disconnected

#### Scenario: Expired token

- **WHEN** the lender enters a token after its expiry
- **THEN** the app is refused with the same message as for an unknown token

### Requirement: One business per device

A device SHALL be connected to at most one lending business at a time.
While connected, the app SHALL NOT offer a second connection; the lender
has to disconnect first.

#### Scenario: Already connected

- **WHEN** the lender opens settings while connected
- **THEN** "Conectar al back office" is replaced by the connected business and a "Desconectar" action

### Requirement: Connecting replaces the Google Sheet

Connecting to the back office SHALL stop Google Sheet sync for this
device. The Sheet and its data SHALL be left untouched in the lender's
Drive. If Google was connected, the app SHALL say so before confirming the
connection.

#### Scenario: Lender had Google connected

- **WHEN** a lender with Google Sheets connected confirms a back office connection
- **THEN** the app warns that the Sheet stops receiving changes, and after confirming no more pushes or pulls go to the Sheet

### Requirement: Disconnect

The lender SHALL be able to disconnect from settings after confirming. The
app SHALL ask the back office to revoke the device credential, then erase
it from the phone even if the back office can't be reached. Local data and
the outbox SHALL be kept.

#### Scenario: Disconnect online

- **WHEN** the lender confirms "Desconectar" while online
- **THEN** the credential is revoked on the server and erased from the phone, and settings offer "Conectar al back office" again

#### Scenario: Disconnect offline

- **WHEN** the lender confirms "Desconectar" without connectivity
- **THEN** the credential is erased from the phone and the app stops sending, and local data is unchanged

### Requirement: A revoked device stops sending and says why

When the back office answers that the device credential is no longer
valid, the app SHALL stop sending, keep the outbox, and show in Spanish
that the device was disconnected from the business and must be connected
again.

#### Scenario: Credential revoked by an admin

- **WHEN** a sync is answered with "credential not valid"
- **THEN** the app shows it was disconnected, keeps every queued change, and offers to connect again
