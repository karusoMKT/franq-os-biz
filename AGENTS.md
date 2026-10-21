# Architecture
- Manual and AI payable entry share company-scoped unit options and unit validation so both save the explicitly selected store.
- Company subscription status and the shared trial in `companies` are the sole entitlement source; profile billing fields are compatibility data only, so invited members cannot have independent trials.
- Keep Efí mTLS payment execution isolated in root Vercel `api/` functions; never import `src/` from them because the Vercel deployment must resolve all function dependencies.
- Confirm Efí payments by querying the provider with mTLS and checking stored company charge references and the exact amount; callback payloads alone never authorize access.