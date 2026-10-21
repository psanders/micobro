# Store assets and metadata

Everything the App Store and Google Play listings need, kept in the repo so it
can be regenerated and reviewed like code.

| Path                          | What                                                                                   | How it's made                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `../store.config.json`        | App Store listing (es-ES, es-MX), categories, age rating, copyright                    | `eas metadata:push` (uses the App Store Connect key in EAS). Pull first with `eas metadata:pull` |
| `app-review-notes.md`         | App Review contact + reviewer notes (PIN gate, not a lending product, Google optional) | Moves into `store.config.json` `apple.review` once a contact phone is set                        |
| `ios/screenshots/`            | 6.9" iPhone screenshots, 1320×2868, real app (mock data)                               | `.maestro/store/screenshots.yaml` + `screenshots-2.yaml` on an iPhone 17 Pro Max simulator       |
| `ios/icon-1024.png`           | App Store icon, 1024×1024, no alpha                                                    | copy of `assets/icon.png`                                                                        |
| `android/listing.es.md`       | Play title, short and full description, links                                          | written from the App Store copy                                                                  |
| `android/feature-graphic.png` | Play feature graphic, 1024×500                                                         | `designs/exports.pen` → "Store · Google Play"                                                    |
| `android/screenshots/`        | Play phone screenshots, 1080×1920 (24-bit, no alpha)                                   | same Pencil container, exported at 1×                                                            |
| `android/icon-512.png`        | Play hi-res icon, 512×512                                                              | `sips -z 512 512 assets/icon.png`                                                                |

Submitting a release's bundles: `.github/workflows/submit.yml` (manual).
