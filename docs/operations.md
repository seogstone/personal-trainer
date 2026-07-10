# Operations

- Run the web app on Vercel.
- Run the worker on a persistent host, not as a Vercel Function.
- Store provider credentials in platform secrets where possible.
- Do not log raw provider payloads, cookies or tokens.
- Use bounded, resumable sync windows for backfills.
