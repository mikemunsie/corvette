# Site plan

**Status:** approved — the user asked to implement this plan.
**Deploy:** the agent will not deploy. The user runs `./scripts/init.sh` or `npm run deploy` later.

## Summary

- **Name:** corvette-mechanic
- **Purpose:** Personal garage for one 1988 Corvette convertible: maintenance status, a neon car diagram, and a power/torque curve.
- **Audience:** The owner only.
- **Region and domain:** set only in gitignored `sst.config.ts`. The API reads the public origin from `ORIGIN`. Do not copy either value into this repo.

## Pages and flows

| Route | Who | What happens |
| --- | --- | --- |
| `/` | public or owner | Login with the setup code. Localhost skips the form and opens the garage. Once signed in, the car diagram, odometer, and first-visit questions for age-critical parts. |
| `/maintenance` | owner | Service list, mark an item done, edit intervals, add and resolve open problems. |
| `/power` | owner | Build sheet, stock comparison, crate-rating markers, in-car estimate, optional measured dyno points. |

## API

- **Needed:** yes
- **Why:** One shared copy of the car, instead of data stuck in a single browser.
- **Auth:** setup code, then a session cookie

Routes:

- `GET /api/health` — public, stays up when the API is paused
- `GET /api/auth/me` — session
- `POST /api/auth/login` — setup code, then a session cookie
- `POST /api/auth/logout` — clears the session
- `GET /api/garage` — owner, car state
- `PUT /api/garage` — owner, replace car state
- `GET /api/garage/export` — owner, download the same JSON

The setup code is `SETUP_CODE` from the environment. Localhost sessions do not apply in production.

## Data

- **DynamoDB:** yes
  - `StatsTable`: `pk` (string). Item `pk=site` holds `apiEnabled`.
  - `GarageTable`: `pk` + `sk`. Garage state is one item. Sessions use `pk=auth`.
- **Uploads / media:** no

Locally, with no table names set, the API stores the same records in `.data/db.json`.

## Cost controls

- **Monthly budget:** $20
- **Email at:** 75% of budget (`AlertEmail` secret)
- **At 100%:** SNS sets `apiEnabled=false` on stats item `pk=site`
- **API when paused:** 503 on all `/api/*` except `/api/health`
- **Re-enable:** set `apiEnabled=true` on that item by hand

## Stack

- Vite, React, React Router, Tailwind, shadcn
- S3 + CloudFront (`sst.aws.StaticSite` + `sst.aws.Router`)
- One Hono Lambda Function URL
- SST v3
- Scripts: `dev`, `build`, `deploy`, `destroy`, `./scripts/init.sh`

## Out of scope

- Deploying from this chat
- Next.js, Vercel, RDS, API Gateway
- A chat bot, repair procedures, PROM or VATS instructions, emissions work, multiple cars, photo uploads

## Build checklist

- [ ] SST app with budget + retain/remove rules
- [ ] Frontend pages listed above
- [ ] API + `apiEnabled` kill switch
- [ ] Dynamo only as listed
- [ ] `package.json` deploy/destroy scripts
- [ ] README with local, init, deploy, destroy, re-enable
