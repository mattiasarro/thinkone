# Addendum arhitektuurile — platvormi vaade

**Kontekst:** ThinkOne pikem eesmärk ei ole kinnisvaratarkvara. Eesmärk on **lepingute platvorm** (haldus + dokumendid + hiljem RAG). Kinnisvara on lihtsalt **esimene vertikaal**, mida testime emaettevõtte peal. Järgmised vertikaalid (nt teenuslepingud, seadmete rent, parkimine) peavad tulema peale **konfiguratsioonina, mitte uue arendusena**.

Praegune architecture.md on hea. Klauslimootor, olekumasinad, audit ja kihistamine sobivad muutmata kujul. Probleem on ainult üks: **andmemudel kirjutab kinnisvara tuuma sisse.** Seda on praegu odav parandada (tabeleid pole veel olemas) ja hiljem väga kallis.

---

## Põhiidee: tuum ei tea, mis on "pind"

```
┌─────────────────────────────────────────────────────────────┐
│  TUUM (kernel) — ühine kõigile lepingutele                  │
│                                                             │
│  contract        leping: tüüp, pooled, olek, versioonid     │
│  clause          klauslipuu, ülimuslikkus, kommentaarid     │
│  claim           hõive: leping ─── ese (vt allpool)         │
│  unit            ese/üksus registris (tüübitud)             │
│  document        renderdatud, külmutatud, allkirjastatud    │
│  key_date        tähtajad, kohustused                       │
│  audit_event     kõik muutused                              │
│                                                             │
│  Siin EI OLE: m², üür, parkimine, EHR, property, space      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ kasutab (mitte vastupidi!)
                            │
┌─────────────────────────────────────────────────────────────┐
│  VERTIKAAL: kinnisvara (esimene pakett)                     │
│                                                             │
│  • üksusetüübid:  hoone, üüripind (atribuudid: m², hind…)   │
│  • lepingutüübid: hinnapakkumine, üürileping                │
│  • parameetriskeem: üüripind, hind, tagatis, indeks…        │
│  • arvutused: üür = m² × hind, KM, astmeline graafik        │
│  • mallid: üldtingimused, pakkumuse põhi                    │
│  • integratsioonid: EHR, äriregister, Moderan, riskiraport  │
└─────────────────────────────────────────────────────────────┘
```

**Reegel koodis:** `domain/contracts/` (tuum) **ei tohi kunagi importida** `domain/realestate/` (vertikaal). Vertikaal impordib tuuma. See on üks rida kihistamisreeglisse, aga see ongi kogu platvorm.

---

## 5 muudatust enne esimest koodirida

### 1. `contract` + `contract_type`, mitte ainult `lease`

Praegu: `quote` ja `lease` on ainsad lepinguvormid, põhitingimused arvutatakse koodis property/space väljadest.

Uus: tuumas on `contract`, mille **tüüp** ütleb, mis parameetreid ta kannab.

```
ENNE                              PÄRAST

lease                             contract
├─ space_id      ← kinnisvara     ├─ contract_type   (nt "yyrileping")
├─ rent          ← kinnisvara     ├─ status, parties, clauses…
├─ utility       ← kinnisvara     └─ params (JSONB, valideeritud
└─ indexation                          tüübi skeemiga)
                                          │
                                          ▼
                                  yyrileping skeem:
                                  { hind, tagatis_kuud,
                                    indeks: {...},
                                    hinnagraafik: [...] }
```

V1-s on ainult üks tüüp — see on OK. Oluline on, et **õmblus eksisteerib**.

> **Tõestus demost:** lame `rent`-veerg purunes juba prototüübis. Vajasime astmelist üüri (1.–12. kuu 7,50 €/m², edasi 8,00), pakkumuse-põhist erihinda ja kontaktisiku ülekirjutust — kõik nõudsid struktuuri, mitte numbrit veerus. Parameetrid **peavad** olema skeemiga struktuur.

### 2. Hõive (`claim`) tabel, mitte `lease.space_id`

Leping ei viita esemele veeruga, vaid **hõivab** eset. Hõivel on iseloom, periood ja kogus.

```
ENNE                              PÄRAST

lease.space_id (täpselt 1)        claim
                                  ├─ contract_id
                                  ├─ unit_id
                                  ├─ iseloom:  exclusive | quota | shared
                                  ├─ periood:  algus … lõpp
                                  └─ kogus:    (quota puhul)
```

Miks see loeb — **sama primitiiv katab kõik tulevased juhud:**

| Leping            | Ese            | Hõive                     |
| ----------------- | -------------- | ------------------------- |
| Üürileping        | Pind 4         | exclusive, 60 kuud        |
| Parkimise annekst | Tsoon A        | quota: 4 kohta            |
| Hooldusleping     | Hoone T6B      | shared                    |
| Teenusleping      | Teenus "IT-tugi" | quota: 20 kasutajat     |

Reegel "üürileping = täpselt 1 eksklusiivne pind" jääb alles — aga **vertikaali valideerimisreeglina**, mitte tabeliskeemas.

`space.parking_spots INT` kaotada: parkimine on tulevikus omaette üksusetüüp (tsoon) + quota-hõive, mitte number pinna küljes.

### 3. Pinna staatus on tuletis, mitte väli

```
staatus("Pind 4") =  projektsioon aktiivsetest hõivetest ajas

  ei ühtegi hõivet        → Vaba
  hõive pakkumusest       → Pakkumusel
  hõive lepingust (draft) → Lepingus
  hõive lepingust (live)  → Üüritud
```

Staatust ei salvestata ega uuendata käsitsi — siis ei saa ta kunagi valeks minna. (Vajadusel cache, aga tõde on hõivetes.)

### 4. Mallid lepingutüübi, mitte objekti külge

`template.property_id` → `template.contract_type` (+ konto). Objektipõhine mall võib olla valikuline ülekirjutus, aga mitte ainus koht.

### 5. Klausli päritolu laiendatav

`clause.source: template | negotiated | imported`

`imported` on tulevase pärand-lepingute impordi (ja kogu RAG-visiooni) uks. Praegu maksab see ühe enum-väärtuse; hiljem avab terve tootesuuna: vanad PDF-lepingud loetakse **samasse klauslimudelisse**, mille peal kõik muu juba töötab.

---

## Mida praegu MITTE ehitada

Et scope ei paisuks — need on teadlikult hiljem:

- teist vertikaali (aga skeem peab teda *kandma* — ülaltoodu ongi selle test)
- üldist registri-UI-d ega reeglimootorit
- import-konveierit ja portfelli-RAG-i
- parkimise geomeetriat/jooniseid

## Mis jääb architecture.md-st täpselt samaks

Klauslipuu + tuletatud numbrid + id-viited, kolm renderdajat, olekumasinad ühe teega, Procrastinate-outbox, audit, allkirjastamine, agendi tööriistad, deploy. **Kõik see on juba platvormi-kvaliteediga.**
