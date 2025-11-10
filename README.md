# quickqa

Small API checker service — POST a URL and the service will try to fetch it and return the upstream status and timing.

## Quick start

Install dependencies:

```bash
npm install
```

Run the server:

```bash
node server.js
```

Or run in background and capture logs:

```bash
nohup node server.js > server.log 2>&1 & echo $!
tail -f server.log
```

## Environment

Copy `.env.example` to `.env` and update any values:

```
PORT=5050
MY_API_KEY=your_api_key_here
```

`dotenv` is used in development to load `.env`.

## API

POST /api/check
- Body (JSON): `{ "url": "https://example.com" }`
- Example:

```bash
curl -i -X POST http://localhost:5050/api/check \
  -H "Content-Type: application/json" \
  -d '{"url":"https://jsonplaceholder.typicode.com/posts/1"}'
```

Responses:
- `200` — success; JSON: `{ status, time, message }`
- `400` — bad request (missing/invalid JSON body)
- `502` — upstream/network error
- `504` — upstream timeout (8s)

## Notes

- `.env` is ignored by `.gitignore`. Use `.env.example` to document required vars.
- Upstream requests use an 8000 ms timeout to avoid long hangs.

## License

This project is available under the MIT License — see `LICENSE`.
