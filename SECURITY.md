# Security Policy

## Supported versions

Security fixes are applied to the latest version on the `main` branch and the
latest published release. Older versions may contain known vulnerabilities and
should be upgraded before use.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub’s
private security advisory workflow for this repository:

<https://github.com/erolsenol/nodejs-file-server/security/advisories/new>

Include a reproduction, affected version, impact and a suggested mitigation if
available. You should receive an acknowledgement within 72 hours.

## Deployment guidance

The example server is a reference implementation, not a complete production
file-hosting service. Before exposing it publicly:

- add authentication and authorization to upload, download and delete routes;
- use TLS and a restricted CORS origin;
- keep the storage directory outside the application source tree;
- enforce quotas and content validation for your domain;
- use an object-storage adapter for durable, scalable storage;
- run the process with a non-privileged operating-system user.
