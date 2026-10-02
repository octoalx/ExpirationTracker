# Active context

Updated: 2026-10-02

## Current milestone

Production deployment on VPS with Cloudflare Zero Trust tunnel and Access authentication.
- VPS host: Alex@146.103.42.228:34657
- Domain: https://expiry.axnode.xyz
- Tunnel: Dockerized `cloudflared` routing to `http://nginx:80`
- Access control: Cloudflare Zero Trust (Email OTP policy)
- Local deploy: port 8881 (Nginx reverse proxy with static caching)

## Known baseline gaps

- Application coverage currently tests startup isolation and tooling harness.
- Offline auth/ownership and product lifecycle regression tests should be added.
- Default admin credentials (`admin@localhost` / `admin`) require password change on first login.
