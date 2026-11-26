# AGENTS.md
## Specs
Read [./spec](spec/) first. Update it with the code.
## Tests
Integration tests for every case in the spec.
## Definition of done
- All tests pass locally

## Commands
- `npm ci`: first, in a fresh checkout
- `npm test`: the tests
- `npm run test:e2e`: the CLI against live GitHub, at fixed commits; set `GITHUB_TOKEN` for the rate limit
