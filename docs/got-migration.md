# Got Migration Notes

## Overview
This document outlines the migration from `axios` to `got` in the `jfrog-client-js` library, completed to improve proxy handling and resolve issues with `NO_PROXY` bypass.

## Background
The original implementation used `axios` for HTTP requests, but it had bugs with proxy configuration:
- `proxy: false` did not reliably disable proxy for HTTPS requests.
- Environment variables (`HTTP_PROXY`, `HTTPS_PROXY`) were not properly bypassed for `NO_PROXY` hosts.
- This led to proxy usage even when bypass was intended.

## Migration Details

### Package Changes
- **Removed**: `axios` (~0.27.2), `axios-retry` (~3.2.5)
- **Added**: `got` (^11.8.6)
- **Kept**: `https-proxy-agent` (^5.0.1) for proxy tunneling

### Code Changes in `HttpClient.ts`

#### Constructor
- Replaced `axios.create()` with `got.extend()`.
- Set up `got` options with prefixUrl, headers, timeout, and retry configuration.
- For proxy-enabled requests, added `HttpsProxyAgent` for both HTTP and HTTPS agents.

#### Request Methods (`doRequest`, `doAuthRequest`)
- Replaced `axiosInstance.request()` with `got()` calls.
- Updated parameter mapping: `body` instead of `data`, `responseType` for parsing.
- Added logic to stringify request data if it's an object.
- Mapped response: `response.body` to `data`, `response.headers` and `response.statusCode`.

#### Retry Logic
- Used `got`'s built-in retry with `beforeRetry` hook.
- Aborts retries on status codes 403 (Forbidden) and 407 (Proxy Authentication Required) to avoid wasting attempts on permanent proxy failures.
- Allows retries for network errors and other recoverable status codes (408, 429, 500-504).

#### Proxy Handling
- For explicit proxy configs, sets `HttpsProxyAgent` for HTTP and HTTPS requests.
- Relies on `shouldBypassProxy()` to check `NO_PROXY` environment variable.
- When bypassing, no proxy agents are set, ensuring direct connections.

### TypeScript Configuration
- Updated `tsconfig.json` to set `"moduleResolution": "node"` for `got` compatibility.

## Benefits
- **Improved Proxy Support**: `got` handles `NO_PROXY` correctly for explicit proxy configurations.
- **Better Performance**: `got` is faster and has native retry support.
- **Reliability**: Eliminates axios proxy bugs, ensuring selective bypass works as expected.
- **Maintenance**: Simpler codebase with fewer dependencies.

## Testing
- Unit tests updated to work with `got`'s response structure.
- Integration tests with mock server and Squid proxy validate bypass behavior.
- Verified that retries abort on 403/407 but continue for other errors.

## Compatibility
- API remains the same; `IClientResponse` interface unchanged.
- Existing code using `jfrog-client-js` should work without modifications.
- Tested with existing test suite.

## Files Changed
- `package.json`: Dependency updates
- `src/HttpClient.ts`: Core migration
- `tsconfig.json`: Module resolution
- `test/tests/HttpClient.spec.ts`: Test updates (if needed)

## Future Considerations
- Monitor `got` updates for any breaking changes.
- Consider adding more proxy-related status codes to abort list if needed (e.g., 407 variants).
- Evaluate `got` v12+ in future for ESM benefits, but v11 provides stable CommonJS support.