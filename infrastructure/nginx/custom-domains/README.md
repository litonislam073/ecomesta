# Custom domain server blocks

Nginx loads every `*.conf` file in this directory (mounted read-only at
`/etc/nginx/custom-domains`). Each verified custom store domain needs a
`<domain>.conf` file. On the shared-host VPS this is created automatically by
`scripts/provision-custom-domain-shared-host.sh` (and the domain-edge agent)
when a merchant activates a domain — see `docs/custom-domains.md`.

Manual templates (files ending in `.example` are not loaded):

- **Standalone** (nginx on 80/443): `custom-domain.conf.example` — needs a
  Let's Encrypt certificate (`docs/deployment.md` §10).
- **Shared host** (OLS → `127.0.0.1:8480`): `custom-domain.shared-host.conf.example`
  — plain HTTP; TLS stays on the host web server.

`*.conf` files here are VPS-local and gitignored. Until a domain has a server
block, unmatched Host headers hit the catch-all and are refused.
