# Beyond-Books server-only AI profile

This repository keeps the legacy profile as the compatibility path for existing clients, including Civilization-Epic-2. Beyond-Books selects a separate profile by sending the public `X-App-Id` header with the configured Beyond-Books app ID.

## Operator configuration

Set these variable **names** in the backend service environment. Do not put provider credentials in the Beyond-Books repository, a static bundle, or a tracked `.env` file.

| Variable name | Purpose |
| --- | --- |
| `BEYOND_BOOKS_APP_ID` | Stable public app ID accepted by the profile selector |
| `BEYOND_BOOKS_ALLOWED_MODEL` | Deployment assertion for the single allowed model; it must remain the official `deepseek-flash` ID |
| `BEYOND_BOOKS_DEEPSEEK_API_KEY` | New server-only DeepSeek credential for Beyond-Books |
| `BEYOND_BOOKS_DEEPSEEK_BASE_URL` | Direct DeepSeek base URL for the Beyond-Books profile |
| `CORS_ADDITIONAL_ORIGINS` | Optional public frontend origin allowlist, if the deployed Beyond-Books origin is not already configured |

The operator must insert the actual new value for `BEYOND_BOOKS_DEEPSEEK_API_KEY` out-of-band on the server. This task does not read, copy, or deploy that value. The existing legacy provider variables and their deployed defaults are unchanged.

`BEYOND_BOOKS_DEEPSEEK_BASE_URL` must point at the official direct DeepSeek API endpoint. The profile itself always permits only `deepseek-flash`; the browser cannot select a provider or expand the model allowlist.

## Request contract

Beyond-Books sends:

- `POST /v1/chat/completions` (or the existing `/api/v1/chat/completions` compatibility path);
- `X-App-Id` identifying the Beyond-Books profile;
- the normal OpenAI-compatible JSON body and optional `stream: true`.

The server selects the profile, model, provider, and credential. A model outside the profile allowlist receives a safe HTTP 400 response before any upstream request. Existing clients that omit `X-App-Id` use the legacy provider and model routing unchanged.

Provider authorization is constructed only by the backend. Client-supplied provider credential headers are not forwarded upstream. Anonymous sessions, quotas, rate limits, authentication, Turnstile, and both JSON/SSE response paths remain in the existing request pipeline.

## Safe rollout

1. Deploy the backend code while leaving the legacy environment unchanged.
2. Add the Beyond-Books variable names and values out-of-band to the service environment; never commit them.
3. Verify the backend focused tests, full build, and a non-secret health check. Live AI success is a separate operator check and is not established by this change.
4. Build Beyond-Books with its public `VUE_APP_API_URL` value and publish the static artifact through its existing workflow.
5. Confirm the public endpoint and frontend origin are actually reachable before calling the feature live. The previously disabled `tyo.tobenot.top` domain is intentionally not reopened by this task.

## Rollback

1. Stop sending the Beyond-Books app ID from the frontend by rolling back the Beyond-Books static artifact.
2. Remove or disable the Beyond-Books profile variables on the server out-of-band, without changing legacy provider variables.
3. Roll back only the backend release if necessary. Clients without `X-App-Id` continue to use the legacy path.
4. Keep the new key out of logs, source control, browser storage, and support tickets; rotate it separately if it was exposed.
