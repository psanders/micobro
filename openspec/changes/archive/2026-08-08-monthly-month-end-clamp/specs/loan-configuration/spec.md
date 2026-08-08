## ADDED Requirements

### Requirement: Monthly schedule month-end clamp

A mensual loan's cuota due dates (term loans) and cycle windows
(open-credit loans) SHALL fall on the same day-of-month as the loan's
`startDate`. When a later month is too short to contain that day, the date
SHALL clamp to that month's last day instead of rolling over into the
following month. A later month long enough for the original day SHALL
return to it — the anchor day is never permanently lost to an earlier
clamp.

#### Scenario: Clamps into a short month

- **WHEN** a mensual loan starts 31 Jul and its 2nd cuota/cycle date (two
  calendar months later, September, which has 30 days) is computed
- **THEN** the date is 30 Sep, not 01 Oct

#### Scenario: Anchor day returns once the month is long enough again

- **WHEN** the same loan's 3rd cuota/cycle date (October, 31 days) is
  computed
- **THEN** the date is 31 Oct — the original day-of-month, not stuck at 30

#### Scenario: A short first month doesn't skip straight to the following one

- **WHEN** a mensual loan starts 30 Jan and its 1st cuota/cycle date
  (February, 28 days in a non-leap year) is computed
- **THEN** the date is 28 Feb, not 02 Mar

#### Scenario: Leap-year February gets its 29th day

- **WHEN** a mensual loan starts 31 Jan in a leap year and its 1st
  cuota/cycle date (February, 29 days) is computed
- **THEN** the date is 29 Feb, not 01 Mar
