## ADDED Requirements

### Requirement: A committed EAS build configuration exists

The repository SHALL contain a committed `eas.json` at its root defining the
build profiles that `package.json`'s `build:*` scripts reference, and
`app.config.ts` SHALL declare `extra.eas.projectId`. A clean checkout SHALL be
able to run any `build:*` script without the developer creating or supplying
additional build configuration.

#### Scenario: Clean checkout can start an Android build

- **WHEN** a developer clones the repository, installs dependencies, and runs `npm run build:android`
- **THEN** EAS resolves the `preview` profile and the project id from committed configuration, and the build starts without prompting to create `eas.json`

#### Scenario: Every referenced profile is defined

- **WHEN** any `build:*` script in `package.json` is inspected for the profile it passes to `--profile`
- **THEN** a profile of that name exists in `eas.json`

### Requirement: Three build profiles covering both platforms

`eas.json` SHALL define `development`, `preview`, and `production` profiles,
each usable for both `--platform android` and `--platform ios`:

- `development` SHALL set `developmentClient: true`, `distribution: "internal"`,
  and `ios.simulator: true`.
- `preview` SHALL set `distribution: "internal"` and produce an artifact
  installable on a registered device.
- `production` SHALL produce a store-signed artifact and SHALL be the profile
  referenced by the `submit` configuration.

Build numbers SHALL be managed remotely (`cli.appVersionSource: "remote"`) so
that the app version continues to come from `package.json` via the release
workflow and no build identifier is hand-maintained.

#### Scenario: iOS development profile builds for the simulator

- **WHEN** a developer runs the `development` profile for iOS
- **THEN** the build produces a simulator-installable artifact and does not require Apple Developer Program signing credentials

#### Scenario: Version is not duplicated in build config

- **WHEN** `eas.json` and `app.config.ts` are inspected for a hardcoded version, `buildNumber`, or `versionCode`
- **THEN** none is present, and the app version resolves from `package.json`

### Requirement: Build scripts exist for both platforms

`package.json` SHALL expose iOS build scripts alongside the existing Android
ones, naming the same profiles (`build:ios` → `preview`, `build:ios:dev` →
`development`), so neither platform's build path depends on a developer
remembering ad-hoc CLI flags.

#### Scenario: iOS build scripts are discoverable

- **WHEN** a developer lists the available npm scripts
- **THEN** `build:ios` and `build:ios:dev` appear alongside `build:android` and `build:android:dev`
