# Security Policy

## Supported versions

Security fixes are applied to the `main` branch of Night of Witnesses.

## Reporting a vulnerability

Please open a private security advisory on GitHub (or contact the maintainers) rather than filing a public issue for:

- Credential / secret exposure
- Multiplayer seat hijacking or role information leakage
- Remote code execution or dependency supply-chain issues

## Production checklist

- Never commit `.env` files or API keys. Only `.env.example` templates belong in git.
- Set `CORS_ORIGIN` to your web origin(s) when `NODE_ENV=production` on the game server.
- Do not enable Colyseus realtime room listing in production.
- Treat `NEXT_PUBLIC_*` values as public; they must never hold secrets.
- Multiplayer reconnect tokens are session credentials — do not log or embed them in URLs.

## Architecture notes

- Solo and Multiplayer share `@now/game-engine` and `getView` privacy filtering.
- Hidden roles must remain private until the Result phase (or intentional ability reveals).
- Game server issues player IDs and reconnect tokens; clients cannot claim arbitrary seats.
