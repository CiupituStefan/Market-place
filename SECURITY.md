# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub:
**Security → Report a vulnerability**
(<https://github.com/CiupituStefan/Market-place/security/advisories/new>).

Please include:

- what is affected (service, endpoint, workflow or infrastructure file);
- how to reproduce it;
- the impact you expect.

You will get an acknowledgement within 3 working days. You will also get an assessment
(accepted or declined, with reasons) within 10 working days.

Fixes are developed in a private fork attached to the advisory. Once the fix is released, the
advisory is published, with credit to you unless you prefer otherwise.

## Scope

Any of the following:

- the code in this repository;
- its GitHub Actions workflows;
- its container images;
- the infrastructure it defines.

Especially:

- authentication and sessions;
- payments and webhooks;
- authorization at the gateway;
- injection of any kind;
- secrets exposure;
- CI/CD privilege escalation, for example a pull request that could reach the AWS roles,
  the registry or the deployment.

Out of scope:

- findings that need a compromised developer machine or AWS account;
- volumetric denial of service;
- missing best-practice headers with no demonstrated impact;
- the local development defaults in `docker-compose.yml` and `.env.example` files, which are
  intentionally public, local-only values.

## Supported versions

Only `main`, the version deployed to production, receives fixes.

## How the project protects itself

[docs/security.md](docs/security.md) covers the application, data, AWS, supply-chain and
deployment controls. [docs/ci.md](docs/ci.md) covers what every pull request is scanned for.
