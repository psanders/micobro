# App Review information (App Store Connect)

Pushed with `eas metadata:push` once a contact phone is set — the EAS schema
requires `apple.review.phone`. Until then, paste these into App Store Connect →
App Review Information.

- **Contact:** Pedro Sanders · equipo@mikro.do · phone: _(add)_
- **Sign-in required:** No (no demo account; the app has no login)

## Notes

Micobro is a bookkeeping / CRM tool for independent lenders in the Dominican Republic. It is NOT a lending product: it does not originate, broker, fund or service loans, and it never moves money (guideline 3.2.1). Lenders use it to record their own customers, loans and payments.

There is no account or login. The app is protected by a local 4-digit PIN:

1. Open the app, create any 4-digit PIN (e.g. 1234) and confirm it.
2. On "Conectar con Google" tap "Ahora no, tal vez después". Google is optional.
3. The app is fully functional offline: Buscar → + to add a customer, then + on the customer to create a loan, then Cobrar to record a payment.

Google Sign-In is NOT a way to sign in to Micobro. It is an optional backup that writes the lender's own data to a spreadsheet in their own Google Drive (drive.file scope only). The app works completely without it, so Sign in with Apple (4.8) does not apply, and it is never required (5.1.1(v)).

Data stays on the device; there is no developer server, no ads and no tracking. Bluetooth is used only for 58 mm thermal receipt printers; microphone and screen recording only for the optional in-app feedback recorder, after explicit consent. Users can erase everything in Mi cuenta → Eliminar mis datos (PIN required).

Privacy policy: https://micobro.app/privacidad/
Contact: equipo@mikro.do
