# Manual test data

Fictional files for clicking through the operator app by hand. None of it is a real property.
The scenario list is in [TESTPLAN-phase2.md](TESTPLAN-phase2.md).

## `pinnad-import/` — spaces CSV in the demo v807 header (parts, amperes, parking spot numbers)

| File | Expected preview |
|---|---|
| `pinnad_naidis.csv` | 6 rows OK: parts sum to the rentable area, `elekter` in A, `parkimiskohad` are spot numbers (`1, 2`, `4-6`) that create the building's parking register and become the space's spots. |
| `pinnad_vigased.csv` | Row 2 OK; rows 3–7 rejected: missing üüripind, missing nimi, non-numeric area, parts don't sum, duplicate name (`pind 5`). Row 2's spot 3 is already on Pind 2 after `pinnad_naidis.csv`. |

## `plaanid/` — Objekt → Plaanid (bulk upload)

Generated plan drawings named for the spaces of `pinnad_naidis.csv`: `Naidis_Pind_01..03.pdf`, `Naidis_B1.pdf` (→ Büroo 1),
`Naidis_Pind_02.png` (same space as the PDF → skipped), `Naidis_Pind_04.png` (image-only plan), `koondplaan_korrus_1.pdf`
(no space in the name → koondplaan, the building/floor overview), `plaanid_pakk.zip` (Pind 3, Büroo 2 and the koondplaan inside a folder).

## `parkimine/` — Objekt → Parkimine → Impordi tabelist

`parkimiskohad.csv`: `nr;tsoon;tüüp;pind` rows with a range, an electric-vehicle group, a reserve + accessible spot,
and a last row pointing at a space that does not exist (rejected).

## `mallid/` — Seaded → Mallid

Fictional general terms (Näidise Kinnisvara OÜ) as Word auto-numbered paragraphs after the heading ÜLDTINGIMUSED, which is
what the DOCX ingest reads (level 0 = section, 1 = point, 2 = sub-point; unnumbered paragraphs join the previous point).

| File | Expected result |
|---|---|
| `uldtingimused_naidis.docx` | 6 sections, 27 points (33 punkti), numbers 1 … 6.4 incl. sub-points 2.2.1–2.2.2, 4.4.1, 6.3.1–6.3.2; point 2.2 absorbs an unnumbered continuation sentence. |
| `uldtingimused_naidis_v2.docx` | Same name again → version 2 (34 punkti): new point 3.4 (utilities prepayment), 5.3 deposit return 30 → 14 days. Version 1 stays in history. |
| `uldtingimused_laoboksid.docx` | A second, shorter template (4 sections, 9 points) for another company — upload under the second company. |
| `uldtingimused_ilma_pealkirjata.docx` | No ÜLDTINGIMUSED heading → rejected: „Dokumendist ei leitud üldtingimusi …”. |
| `uldtingimused_nummerdamata.docx` | Heading present but numbers typed as text, not Word numbering → rejected with the same message. |
| `vale_formaat.pdf` | Not a DOCX → rejected: „Fail ei ole Word-dokument (.docx)” (the file picker only offers .docx; drag it in or choose „All files”). |
| `eritingimuste_pohi.md` | Text to paste into „Loo mall” → Eritingimuste põhi. |
| `pakkumuse_pohi.md` | Text to paste into „Loo mall” → Pakkumuse põhi. |

## `uuripinnad-import/` — legacy spec-v2 header (netopind, koefitsient) — still accepted

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
