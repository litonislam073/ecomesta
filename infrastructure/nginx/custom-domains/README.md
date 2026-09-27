# Custom domain server blocks

Nginx loads every `*.conf` file in this directory (mounted read-only at
`/etc/nginx/custom-domains`). Each verified custom store domain needs:

1. The merchant's DNS pointing at the VPS and the domain verified + activated
   in Ecomesta (see `docs/custom-domains.md`).
2. A Let's Encrypt certificate for that exact hostname.
3. A `<domain>.conf` file created from `custom-domain.conf.example`.

`*.conf` files here are VPS-local configuration and are ignored by git.
Until a domain has a server block, HTTPS requests for it are refused by the
catch-all server — the storefront never serves a domain nginx does not know.

Full procedure: `docs/deployment.md` §10.
