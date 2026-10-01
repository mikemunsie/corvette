# Corvette

Personal garage for one 1988 Corvette convertible: service tracking, a synthwave car diagram, and a power curve. Hosted as a static site plus one small API.

Uses Node 26.10.0, pinned in `.nvmrc`. Run `nvm install` once, then `nvm use`.

## Local

```bash
nvm install
nvm use
npm install
cp .env.example .env.local   # set SETUP_CODE
npm run dev                  # web on :3000, API on :3001
```

Choose your own setup code in `.env.local`. Do not commit that file. Localhost opens the garage without asking. The live site asks for the setup code and keeps a session cookie.

## Deploy

The monthly ceiling is $20. You get an email at 75%. At 100% the API pauses and `/api/*` returns 503, except `/api/health`.

```bash
./scripts/init.sh            # first time: alert email, setup code, then deploy
npm run deploy               # later deploys
npm run destroy              # teardown
```

Both scripts take an optional stage and AWS profile: `./scripts/init.sh prod my-profile`.

The production hostname, DNS zone, and region live in gitignored `sst.config.ts`. The API trusts `ORIGIN` from the environment. Do not put those values in this repository.

To turn the API back on after the budget cap, set `apiEnabled` to `true` on the DynamoDB stats item `pk=site`. Do not redeploy for that.

A normal prod remove retains S3 and DynamoDB. `npm run destroy` redeploys with `SST_DESTROY=1` first so the data is deleted, then removes the stack. It asks you to type the stage name.
