import got, { Got, Options } from 'got';
import { IClientResponse, ILogger, IProxyConfig, RetryOnStatusCode } from '../model';
import { HttpsProxyAgent } from 'https-proxy-agent';
export class HttpClient {
    private static readonly AUTHORIZATION_HEADER: string = 'Authorization';
    private static readonly USER_AGENT_HEADER: string = 'User-Agent';
    private static readonly DEFAULT_RETRIES: number = 5;
    // Delay between retries, in milliseconds
    private static readonly DEFAULT_RETRY_DELAY_IN_MILLISECONDS: number = 1000;
    // Specifies the number of milliseconds before the request times out.
    // If the request takes longer than `DEFAULT_TIMEOUT_IN_MILLISECONDS`, the request will be aborted.
    public static readonly DEFAULT_TIMEOUT_IN_MILLISECONDS: number = 60000;
    private readonly _basicAuth: BasicAuth;
    private readonly _accessToken: string;
    private readonly _gotClient: Got;

    constructor(config: IHttpConfig, private logger?: ILogger) {
        config.headers = config.headers || {};
        this.addUserAgentHeader(config.headers);
        // Determine effective proxy config considering NO_PROXY
        const effectiveProxy: IProxyConfig | false | undefined = this.getEffectiveProxyConfig(
            config.proxy,
            config.serverUrl
        );
        const gotOptions: Options = {
            ...(config.serverUrl ? { prefixUrl: config.serverUrl } : {}),
            headers: config.headers,
            ...(config.timeout ? { timeout: config.timeout } : {}),
            retry: {
                limit: config.retries ?? HttpClient.DEFAULT_RETRIES,
                calculateDelay: ({ attemptCount }) => {
                    this.logger?.debug(`Retrying (attempt #${attemptCount})...`);
                    return config.retryDelay ?? HttpClient.DEFAULT_RETRY_DELAY_IN_MILLISECONDS;
                },
                methods: ['GET', 'POST', 'PUT', 'HEAD', 'DELETE', 'OPTIONS', 'TRACE'],
                statusCodes: [408, 413, 429, 500, 502, 503, 504],
                errorCodes: ['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'],
            },
            hooks: {
                beforeRetry: [
                    (options: Options, error?: any, retryCount?: number) => {
                        if (error && error.response && (error.response.statusCode === 403 || error.response.statusCode === 407)) {
                            throw new Error('Do not retry on proxy/auth errors'); // Prevent retry
                        }
                        if (config.retryOnStatusCode && error && error.response) {
                            if (!config.retryOnStatusCode(error.response.statusCode)) {
                                throw new Error('Do not retry'); // Prevent retry
                            }
                        }
                    }
                ]
            }
        };

        if (effectiveProxy !== false && effectiveProxy) {
            const proxyUrl = `http://${effectiveProxy.host}:${effectiveProxy.port}`;
            const proxyAgent = new HttpsProxyAgent(proxyUrl);
            gotOptions.agent = {
                http: proxyAgent,
                https: HttpClient.getHttpToHttpsProxyConfig(effectiveProxy) || proxyAgent
            };
        }

        this._gotClient = got.extend(gotOptions);
        this._basicAuth = {
            username: config.username,
            password: config.password,
        } as BasicAuth;
        this._accessToken = config.accessToken || '';
    }

    public async doRequest(requestParams: IRequestParams): Promise<IClientResponse> {
        const url = requestParams.url.startsWith('/') ? requestParams.url.slice(1) : requestParams.url;
        const body = requestParams.data ? (typeof requestParams.data === 'string' ? requestParams.data : JSON.stringify(requestParams.data)) : undefined;
        const options: Options = {
            method: requestParams.method,
            ...(body ? { body } : {}),
            headers: requestParams.headers,
            ...(requestParams.timeout ? { timeout: requestParams.timeout } : {}),
            responseType: requestParams.responseType === 'json' ? 'json' : 'text',
            followRedirect: false, // Handle manually if needed
        };

        if (requestParams.validateStatus) {
            options.throwHttpErrors = false;
        }

        const response = await this._gotClient(url, options) as any;

        if (requestParams.validateStatus && !requestParams.validateStatus(response.statusCode)) {
            throw new Error(`Request failed with status code ${response.statusCode}`);
        }

        return {
            data: response.body,
            headers: response.headers,
            status: response.statusCode
        };
    }

    public async doAuthRequest(requestParams: IRequestParams): Promise<IClientResponse> {
        const url = requestParams.url.startsWith('/') ? requestParams.url.slice(1) : requestParams.url;
        const body = requestParams.data ? (typeof requestParams.data === 'string' ? requestParams.data : JSON.stringify(requestParams.data)) : undefined;
        const options: Options = {
            method: requestParams.method,
            ...(body ? { body } : {}),
            headers: requestParams.headers,
            ...(requestParams.timeout ? { timeout: requestParams.timeout } : {}),
            responseType: requestParams.responseType === 'json' ? 'json' : 'text',
            followRedirect: false,
        };

        if (this._accessToken !== '') {
            this.addAuthHeader(options);
        } else if (requestParams.auth) {
            options.username = requestParams.auth.username;
            options.password = requestParams.auth.password;
        }

        if (requestParams.validateStatus) {
            options.throwHttpErrors = false;
        }

        const response = await this._gotClient(url, options) as any;

        if (requestParams.validateStatus && !requestParams.validateStatus(response.statusCode)) {
            throw new Error(`Request failed with status code ${response.statusCode}`);
        }

        return {
            data: response.body,
            headers: response.headers,
            status: response.statusCode
        };
    }

    /**
     * Method to use for beforeRedirect attribute in IRequestParams.
     * Before redirecting checks if the target location for the redirect is for 'reactivate-server' and throws ServerNotActiveError if so.
     */
    public static validateServerIsActive(_: Record<string, any>, responseDetails: { headers: Record<string, string> }) {
        let movedLocation: string | undefined = responseDetails?.headers['location'];
        if (movedLocation && movedLocation.includes('reactivate-server')) {
            throw new ServerNotActiveError(movedLocation);
        }
    }

    private addUserAgentHeader(headers: { [key: string]: string }) {
        if (!headers[HttpClient.USER_AGENT_HEADER]) {
            headers[HttpClient.USER_AGENT_HEADER] = 'jfrog-client-js';
        }
    }

    private addAuthHeader(options: Options) {
        if (!options.headers) {
            options.headers = {};
        }
        if (!(options.headers as any)[HttpClient.AUTHORIZATION_HEADER]) {
            (options.headers as any)[HttpClient.AUTHORIZATION_HEADER] = 'Bearer ' + this._accessToken;
        }
    }

    /**
     * Get effective proxy config considering NO_PROXY environment variable.
     * @param proxyConfig - The configured proxy
     * @param serverUrl - The target server URL
     * @returns Effective proxy config
     */
    private getEffectiveProxyConfig(
        proxyConfig: IProxyConfig | false | undefined,
        serverUrl?: string
    ): IProxyConfig | false | undefined {
        if (proxyConfig !== undefined) {
            if (this.shouldBypassProxy(serverUrl)) {
                return false;  // Bypass proxy if URL matches NO_PROXY
            }
            return proxyConfig;
        }
        // No explicit proxy config, check environment variables
        if (this.shouldBypassProxy(serverUrl)) {
            return false; // Disable proxy
        }
        return undefined; // Use environment proxy
    }

    /**
     * Check if proxy should be bypassed for the given server URL based on NO_PROXY.
     * @param serverUrl - The target server URL
     * @returns true if proxy should be bypassed
     */
    private shouldBypassProxy(serverUrl?: string): boolean {
        if (!serverUrl) {
            return false;
        }
        const noProxy: string | undefined = process.env.NO_PROXY || process.env.no_proxy;
        if (!noProxy) {
            return false;
        }
        try {
            const url: URL = new URL(serverUrl);
            const host: string = url.hostname;
            const port: string = url.port;
            const hostWithPort: string = port ? `${host}:${port}` : host;

            // NO_PROXY is comma-separated list of hosts
            const noProxyHosts: string[] = noProxy.split(',').map((h) => h.trim().toLowerCase());
            return noProxyHosts.some((pattern: string) => {
                const lowerPattern: string = pattern.toLowerCase();
                // Simple matching: exact match or wildcard
                if (lowerPattern === host.toLowerCase() || lowerPattern === hostWithPort.toLowerCase()) {
                    return true;
                }
                // Support *.domain.com pattern
                if (lowerPattern.startsWith('*.')) {
                    const domain: string = lowerPattern.slice(2);
                    return host.toLowerCase().endsWith(domain) || hostWithPort.toLowerCase().endsWith(domain);
                }
                return false;
            });
        } catch (error) {
            // Invalid URL, don't bypass
            return false;
        }
    }

    /**
     * Use to create httpsAgent to handle Http proxy sending to a https server.
     * (Artifactory is https server, proxy protocol can be both)
     * @param proxyConfig - Receives on of the three:
     * 1. IProxyConfig to use specific proxy config.
     * 2. 'false' to disable proxy.
     * 3. 'undefined' to use environment variables if exist.
     * @returns if the proxy is http protocol return httpsAgent else return undefined
     */
    public static getHttpToHttpsProxyConfig(
        proxyConfig: IProxyConfig | false | undefined
    ): HttpsProxyAgent | undefined {
        if (
            !proxyConfig ||
            !proxyConfig.host ||
            !proxyConfig.port ||
            (proxyConfig.protocol && proxyConfig.protocol.includes('https'))
        ) {
            return undefined;
        }
        return new HttpsProxyAgent(`http://${proxyConfig.host}:${proxyConfig.port}`);
    }


}

export class ServerNotActiveError extends Error {
    constructor(public readonly activationUrl: string) {
        super('Server is not active');
    }
}

interface BasicAuth {
    username: string;
    password: string;
}

export interface IHttpConfig {
    serverUrl?: string;
    username?: string;
    password?: string;
    accessToken?: string;
    proxy?: IProxyConfig | false;
    headers?: { [key: string]: string };
    retries?: number;
    retryDelay?: number;
    timeout?: number;
    retryOnStatusCode?: RetryOnStatusCode;
}

export type method = 'GET' | 'POST' | 'HEAD' | 'PUT';
export type responseType = 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';

export interface IRequestParams {
    url: string;
    method: method;
    data?: any;
    auth?: BasicAuth;
    timeout?: number;
    headers?: any;
    responseType?: responseType;
    validateStatus?: ((status: number) => boolean) | null;
    beforeRedirect?: (options: Record<string, any>, responseDetails: { headers: Record<string, string> }) => void;
}
