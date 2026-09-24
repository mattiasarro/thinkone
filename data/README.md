# Manual test data

Fictional files for clicking through the operator app by hand. None of it is a real property.

## `uuripinnad-import/` — Objekt → Üüripinnad → Impordi tabelist

| File | Expected preview |
|---|---|
| `uuripinnad_test.csv` | 11 rows OK (every space type, decimal commas, `1 200,0`, empty optionals, floor `-1`). Import it a second time to see "11 uuendatud" instead of "lisatud". |
| `uuripinnad_vigased.csv` | Row 2 OK; rows 3–7 rejected: missing üüripind, missing nimi, non-numeric üüripind, üüripind `-5`, duplicate name `A-101`. |

## `manused/` — Objekt → Seaded

Everything belongs to the fictional "Näidise Ärimaja" and matches the spaces in `uuripinnad_test.csv`.

| File | Upload as |
|---|---|
| `objekt/asendiplaan.pdf` | Asendiplaan |
| `objekt/parkimisskeem.pdf` | Parkimisskeem (spots per space match the CSV's `parkimiskohad`) |
| `objekt/logo.png` | Logo (transparent PNG) |
| `objekt/logo.jpg` | Logo (JPEG variant) |
| `objekt/hoone_tutvustus.pdf` | Muu lisa |
| `objekt/fassaad.jpg` | Muu lisa (image) |
| `pinnad/pinnaplaan_<nimi>.pdf` | Pinnaplaan (PDF) on the space with that name |
