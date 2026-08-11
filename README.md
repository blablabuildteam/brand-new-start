# Brand New Start — Command Center (MVP)

Live **radar** for contracting signals in the **Scrum Master / agile delivery** niche (NL).

## What’s in this MVP

- Recruiter login (password)
- Radar + kans-score from real signal objects (seeded + ingest API)
- Niche filter: Scrum Master, Agile Coach, Delivery Manager, RTE, …
- Sources wired: TenderNed stub/live, job payload ingest, Pulse ingest
- Old static prototype kept in `/prototype`

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → login with password `bns-demo`.

## Ingest

```bash
# TenderNed (needs TENDERNED_USER / TENDERNED_PASS)
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -H 'Cookie: …' \
  -d '{"action":"tenderned"}'

# Jobs (manual / Apify later)
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"action":"jobs","jobs":[{"company":"ING","title":"Scrum Master ZZP","employmentType":"contract"}]}'
```

## Next (when ready)

1. Connect Vercel Postgres and apply `drizzle/0001_init.sql`
2. Request TenderNed API credentials
3. Add Apify/Adzuna job cron for contract SM roles
4. Persist store to Postgres (schema already drafted)
