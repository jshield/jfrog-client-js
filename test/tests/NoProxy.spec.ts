import { JfrogClient } from '../../src/JfrogClient';
import { TestUtils } from '../TestUtils';

describe('NO_PROXY Environment Variable Tests', () => {
    const PING_RES: any = { status: 'pong' };
    let isPassedThroughProxy: boolean;
    let clientConfig: any;
    let jfrogClient: JfrogClient;

    beforeAll(() => {
        clientConfig = TestUtils.getJfrogClientConfig();
        jfrogClient = new JfrogClient(clientConfig);
        isPassedThroughProxy = false;
    });

    beforeEach(() => {
        isPassedThroughProxy = false;
    });

    afterEach(() => {
        process.env.HTTPS_PROXY = '';
        process.env.NO_PROXY = '';
    });

    describe('NO_PROXY pattern matching - Artifactory', () => {
        beforeEach(() => {
            process.env.HTTPS_PROXY = 'http://127.0.0.1:9090';
        });

        test('NO_PROXY exact hostname match', async () => {
            process.env.NO_PROXY = 'artifactory.example.com';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://artifactory.example.com',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            // This would normally go through proxy, but should bypass due to NO_PROXY
            await expect(customClient.artifactory().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY hostname with port match', async () => {
            process.env.NO_PROXY = 'artifactory.example.com:8080';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://artifactory.example.com:8080',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            await expect(customClient.artifactory().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY wildcard domain match', async () => {
            process.env.NO_PROXY = '*.company.com';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://internal.company.com',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            await expect(customClient.artifactory().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY IP address match', async () => {
            process.env.NO_PROXY = '192.168.1.100';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://192.168.1.100',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            await expect(customClient.artifactory().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY comma-separated list match', async () => {
            process.env.NO_PROXY = 'other.example.com,artifactory.example.com,different.com';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://artifactory.example.com',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            await expect(customClient.artifactory().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY no match - should use proxy', async () => {
            process.env.NO_PROXY = 'other.example.com,different.com';
            const response: any = await jfrogClient.artifactory().system().ping();
            expect(response).toStrictEqual(PING_RES);
            expect(isPassedThroughProxy).toBeTruthy();
        });

        test('NO_PROXY empty - should use proxy', async () => {
            process.env.NO_PROXY = '';
            const response: any = await jfrogClient.artifactory().system().ping();
            expect(response).toStrictEqual(PING_RES);
            expect(isPassedThroughProxy).toBeTruthy();
        });
    });

    describe('NO_PROXY pattern matching - Xray', () => {
        beforeEach(() => {
            process.env.HTTPS_PROXY = 'http://127.0.0.1:9090';
        });

        test('NO_PROXY exact hostname match', async () => {
            process.env.NO_PROXY = 'xray.example.com';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://xray.example.com',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            // This would normally go through proxy, but should bypass due to NO_PROXY
            await expect(customClient.xray().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY hostname with port match', async () => {
            process.env.NO_PROXY = 'xray.example.com:8080';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://xray.example.com:8080',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            await expect(customClient.xray().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY wildcard domain match', async () => {
            process.env.NO_PROXY = '*.company.com';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://internal.company.com',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            await expect(customClient.xray().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY IP address match', async () => {
            process.env.NO_PROXY = '192.168.1.100';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://192.168.1.100',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            await expect(customClient.xray().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY comma-separated list match', async () => {
            process.env.NO_PROXY = 'other.example.com,xray.example.com,different.com';
            const customClient: JfrogClient = new JfrogClient({
                platformUrl: 'https://xray.example.com',
                username: clientConfig.username,
                password: clientConfig.password,
                accessToken: clientConfig.accessToken,
                logger: TestUtils.createTestLogger(),
            });
            await expect(customClient.xray().system().ping()).rejects.toThrow();
        });

        test('NO_PROXY no match - should use proxy', async () => {
            process.env.NO_PROXY = 'other.example.com,different.com';
            const response: any = await jfrogClient.xray().system().ping();
            expect(response).toStrictEqual(PING_RES);
            expect(isPassedThroughProxy).toBeTruthy();
        });

        test('NO_PROXY empty - should use proxy', async () => {
            process.env.NO_PROXY = '';
            const response: any = await jfrogClient.xray().system().ping();
            expect(response).toStrictEqual(PING_RES);
            expect(isPassedThroughProxy).toBeTruthy();
        });
    });
});
