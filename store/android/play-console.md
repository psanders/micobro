# Google Play Console — ready-to-paste answers

Everything Play Console asks for under **Policy → App content** and
**Store presence**, answered from what the app actually does (see
`app.config.ts`, `lib/sync/`, and https://micobro.app/privacidad/). Listing text
and graphics are in `listing.es.md` and this folder.

App: **Micobro** · package `com.micobro.app` · default language **Español
(Latinoamérica) – es-419** · category **Business** (tag: Finance) · **Free** ·
countries: **Dominican Republic**.

---

## Privacy policy

`https://micobro.app/privacidad/`

## App access

> All or some functionality is restricted → **No special access needed.**

Instructions for the reviewer (paste into "Instructions"):

> Micobro has no account or login. On first launch create any 4-digit PIN
> (e.g. 1234) and confirm it. On "Conectar con Google" tap "Ahora no, tal vez
> después" — Google backup is optional. The whole app then works offline:
> Buscar → + to add a customer, + on the customer to create a loan, Cobrar to
> record a payment.

## Ads

**No**, the app does not contain ads.

## Content rating (IARC questionnaire)

- Category: **Utility, Productivity, Communication, or Other**
- Violence, sexuality, language, controlled substances, gambling: **No** to all
- User interaction / user-generated content shared with others: **No**
- Shares the user's location: **No**
- Digital purchases: **No**

Expected rating: **Everyone / PEGI 3**.

## Target audience and content

- Target age: **18 and over** only.
- Appeals to children: **No**.

## News app / Government app / Health / COVID-19

**No** to all.

## Financial features

Micobro is a **bookkeeping / CRM tool for an independent lender's own
business**. It does not originate, approve, fund, broker or service loans, it
never moves money, and the people recorded in it (the lender's customers) never
use the app.

- If asked to pick features: choose the option for apps that **do not offer
  any of the listed financial products or services** to users.
- If a free-text explanation is offered, paste the paragraph above.

> Risk to watch: reviewers can confuse "loan tracking" with the Personal
> Loans policy (licences, APR disclosure). The answer above plus the store
> description ("no presta dinero ni intermedia préstamos") is the defence.

## Data safety

Micobro has no developer server. Data only leaves the phone when the lender
turns on the optional Google backup, which writes to a spreadsheet in **their
own** Google Drive. Declared conservatively as "collected" for that backup.

**Does your app collect or share any of the required user data types?** → **Yes**

**Is all of the user data collected by your app encrypted in transit?** → **Yes** (HTTPS to Google)

**Do you provide a way for users to request that their data be deleted?** → **Yes**
— in-app _Mi cuenta → Eliminar mis datos_ and
`https://micobro.app/eliminar-datos/`

| Data type                                                                | Collected | Shared | Optional?                          | Purpose                               |
| ------------------------------------------------------------------------ | --------- | ------ | ---------------------------------- | ------------------------------------- |
| Personal info → **Name**                                                 | Yes       | No     | Optional (only with Google backup) | App functionality                     |
| Personal info → **Email address** (Google account)                       | Yes       | No     | Optional (only with Google backup) | App functionality, Account management |
| Personal info → **Phone number**                                         | Yes       | No     | Optional (only with Google backup) | App functionality                     |
| Personal info → **Address**                                              | Yes       | No     | Optional (only with Google backup) | App functionality                     |
| Personal info → **Other info** (cédula, if the lender records it)        | Yes       | No     | Optional                           | App functionality                     |
| Financial info → **Other financial info** (loans, payments, cash closes) | Yes       | No     | Optional (only with Google backup) | App functionality                     |

**Not collected:** location, contacts, photos/videos, audio (the feedback
recorder keeps its recording on the device), messages, app activity, web
browsing, app info and performance, device or other IDs.

Data is **not processed ephemerally** (it persists in the user's Drive) and is
**not used for ads, analytics or personalization**.

## Permissions

| Permission                                                  | Why (paste where asked)                                                                                                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`                       | Print payment receipts on a 58 mm Bluetooth thermal printer. Declared `neverForLocation`; never used to infer location.                                                                       |
| `RECORD_AUDIO`                                              | Only for the optional in-app "Enviar feedback" recorder, which records the screen with narration after the user explicitly consents on a dedicated screen.                                    |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Same feedback recorder: Android requires a media-projection foreground service while the user's own screen recording is in progress. Starts only from the user's tap, stops when they finish. |
| `POST_NOTIFICATIONS`                                        | The ongoing notification Android requires while that recording runs.                                                                                                                          |
| `INTERNET`                                                  | Optional backup to the user's own Google Sheet.                                                                                                                                               |

**Foreground service declaration (media projection)** — Play asks for a
description and a **short video** of the feature in use:

> The user opens Mi cuenta → Enviar feedback, reads a consent screen and taps
> to start. The app records the screen (and microphone) so the user can show a
> problem; a persistent notification is shown and the user stops it at any
> time. The recording stays on the device.

Video: `feedback-recorder-demo.mp4` (19 s, this folder) — Mi cuenta → Enviar feedback →
consent → Android's "Start recording" dialog → recording pill while using the app.
Play asks for a link: upload it unlisted to YouTube (or share it from Drive) and paste the URL.

## Account deletion

- In-app path: **Mi cuenta → Eliminar mis datos** (confirmation + PIN).
- Web link: `https://micobro.app/eliminar-datos/`
- Data deleted: everything on the device (customers, loans, payments, visits,
  cash closes, profile, PIN) and the Google sign-in. Data kept: the backup
  spreadsheet in the user's own Drive (they delete it there; instructions on
  the page).

## After the first AAB upload (Play App Signing)

1. Play Console → **Test and release → App integrity → App signing**: copy the
   **App signing key certificate SHA-1** (it only exists after the first upload).
2. Google Cloud Console (Micobro project) → **Credentials → Create OAuth client
   → Android**: package `com.micobro.app` + that SHA-1. Without it Google
   Sign-In fails with `DEVELOPER_ERROR` for every Play install. (The upload-key
   SHA-1 `20:8A:07:C1:2A:D4:05:63:2E:BF:F6:25:A0:8F:42:8B:5A:65:62:36` is already
   registered.)

## Releases

- First AAB: upload by hand to **Internal testing** (Play requires the first one manually).
- Every upload after that: **Actions → Submit to stores** (`.github/workflows/submit.yml`),
  platform `android`, once the `GOOGLE_SERVICE_ACCOUNT_KEY` repo secret is set.
- New personal accounts: **Closed testing with ≥ 12–20 testers for 14 days**
  before production access can be requested.
