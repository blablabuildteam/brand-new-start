# MVP setup checklist (jij) + signal economics

## Wat jij nu aanmaakt (parallel)

### 1. Apify — **eerst** (kritisch voor LinkedIn)
1. Account: https://console.apify.com/sign-up  
2. Free plan is genoeg om te testen ($5 credit)  
3. Token: **Settings → Integrations → API token**  
4. Stuur/plak token in `.env.local` als `APIFY_TOKEN=...` (of Vercel env)  
5. Jeffrey’s LinkedIn-URL staat in code — niet in env  
6. Optioneel: actor 1× handmatig runnen op Jeffrey’s URL om te zien wat terugkomt  

### 2. Firecrawl — **daarna** (careers / open web)
1. Account: https://www.firecrawl.dev  
2. API key → `FIRECRAWL_API_KEY=...`  
3. Hobby is genoeg voor MVP (alleen watchlist careers, geen full crawl)  

### 3. TenderNed — **gratis, apart**
1. Mail `functioneelbeheer@tenderned.nl` voor API user/pass  
2. `TENDERNED_USER` / `TENDERNED_PASS`  

### 4. Vercel (als je deployt)
- Project env: `RECRUITER_PASSWORD`, `AUTH_SECRET`, `APIFY_TOKEN`, later Firecrawl + TenderNed  
- Cron in `vercel.json` staat uit — syncs alleen handmatig via Sync & meer  

---

## Slimme kostenarchitectuur (vastgelegd in code)

| Regel | Waarom |
|-------|--------|
| API > scraper | TenderNed gratis |
| Apify alleen “hard” | LinkedIn / job boards |
| Firecrawl alleen open web | Careers van bedrijven die al op radar staan |
| Cap + niche-filter | max 40 LinkedIn posts, BNS-rollen only |
| Dedup fingerprint | Geen dubbele kosten / noise |
| Regels vóór LLM | Kans-score is gratis; LLM later optioneel |

Zie `src/lib/costs.ts` + `GET /api/costs`.

---

## Kostenplaatje MVP (indicatie EUR/maand)

| Post | Low | High |
|------|-----|------|
| TenderNed | 0 | 0 |
| Jeffrey LinkedIn (Apify) | 3 | 15 |
| LinkedIn Jobs niche (later) | 10 | 40 |
| Job boards (later) | 5 | 25 |
| Careers Firecrawl | 8 | 25 |
| Pulse + hosting | 0 | 25 |
| **Totaal lean MVP (nu)** | **~€5** | **~€55** |
| **Totaal met alle bronnen** | **~€25** | **~€140** |

Lean MVP nu = Apify LinkedIn Jobs (+ Indeed) + seed/Pulse. Specialty = alleen niche-kader, niet radar. Firecrawl/TenderNed aanzetten wanneer keys er zijn.

---

## Rendement (business case)

Aanname fee per interim-plaatsing: **€4k–12k** (indicatief; vul jullie echte marge in).

- Worst-case stack €140/m → **€1.680/jaar**  
- Break-even bij fee €4k: **1 plaatsing/jaar**  
- Bij fee €8k: stack is < **3% van één deal**

**Investering eruit halen = kwaliteit van signalen, niet volume.**  
Één hot Adyen/Achmea-achtige hit die anders gemist werd, betaalt het jaar.

KPI’s voor MVP-review (na 4–6 weken):
1. % radar-rijen die Jeffrey/BNS als “klopt, interessant” markeert  
2. Tijd tot eerste outreach op een nieuw signaal  
3. Kosten per *geaccepteerd* hot-signaal (niet per raw scrape)  
4. Aantal plaatsingen / shortlists die aan radar te linken zijn  

---

## Volgorde live zetten

1. Apify token → **Sync markt** (LinkedIn Jobs) + **Specialisatie**
2. Firecrawl key → **Sync platforms** (`src/lib/platforms.ts` aanpassen)
3. TenderNed credentials (wacht)
4. Deploy + Postgres later

