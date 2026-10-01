# Agents

This repository is public on GitHub. Every committed file is world-readable. Do not put sensitive information in source, docs, comments, commits, or pull requests.

## Keep out of git

- Hostnames, domains, DNS zones, AWS account details, email addresses, setup codes, session cookies, and passkey material
- Real environment values. `.env.example` stays placeholders only
- These paths are gitignored. Do not force-add them: `.env`, `.env.local`, `.data/`, `.sst/`, `sst.config.ts`

Secrets belong in `.env.local` or in SST secrets (`sst secret set`). The production hostname is configured only in gitignored `sst.config.ts` and passed to the API as `ORIGIN`.

## When editing

- Browser origins are localhost plus `process.env.ORIGIN`. Do not hardcode a production URL.
- Garage data is saved through the API, not browser storage. Locally that file is `.data/db.json`.
- Do not deploy unless the user asks.
- Do not add tests.
