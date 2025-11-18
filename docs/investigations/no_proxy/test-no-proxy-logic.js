// test-no-proxy-logic.js
// Demonstrates the NO_PROXY logic extracted from the JFrog client

function shouldBypassProxy(serverUrl, noProxyEnv) {
  if (!serverUrl) {
    return false;
  }
  const noProxy = noProxyEnv;
  if (!noProxy) {
    return false;
  }
  try {
    const url = new URL(serverUrl);
    const host = url.hostname;
    const port = url.port;
    // For default ports, don't include them in comparison
    const isDefaultPort = (url.protocol === 'https:' && port === '443') || (url.protocol === 'http:' && port === '80');
    const effectivePort = isDefaultPort ? '' : port;
    const hostWithPort = effectivePort ? `${host}:${effectivePort}` : host;

    // NO_PROXY is comma-separated list of hosts
    const noProxyHosts = noProxy.split(',').map((h) => h.trim().toLowerCase());
    return noProxyHosts.some((pattern) => {
      const lowerPattern = pattern.toLowerCase();
      // Simple matching: exact match or wildcard
      if (lowerPattern === host.toLowerCase() || lowerPattern === hostWithPort.toLowerCase()) {
        return true;
      }
      // Support *.domain.com pattern
      if (lowerPattern.startsWith('*.')) {
        const domain = lowerPattern.slice(2);
        return host.toLowerCase().endsWith(domain) || hostWithPort.toLowerCase().endsWith(domain);
      }
      return false;
    });
  } catch (error) {
    // Invalid URL, don't bypass
    return false;
  }
}

function testNoProxyLogic() {
  console.log('Testing NO_PROXY logic...\n');

  const testCases = [
    {
      serverUrl: 'https://artifactory.example.com/api/v1/ping',
      noProxy: 'artifactory.example.com',
      expected: true,
      description: 'Exact hostname match',
    },
    {
      serverUrl: 'https://artifactory.example.com:8080/api/v1/ping',
      noProxy: 'artifactory.example.com:8080',
      expected: true,
      description: 'Hostname with non-default port match',
    },
    {
      serverUrl: 'https://sub.artifactory.example.com/api/v1/ping',
      noProxy: '*.artifactory.example.com',
      expected: true,
      description: 'Wildcard domain match',
    },
    {
      serverUrl: 'https://artifactory.example.com/api/v1/ping',
      noProxy: 'other.example.com,artifactory.example.com,different.com',
      expected: true,
      description: 'Match in comma-separated list',
    },
    {
      serverUrl: 'https://artifactory.example.com/api/v1/ping',
      noProxy: 'other.example.com,different.com',
      expected: false,
      description: 'No match in list',
    },
    {
      serverUrl: 'https://artifactory.example.com/api/v1/ping',
      noProxy: '',
      expected: false,
      description: 'Empty NO_PROXY',
    },
    {
      serverUrl: 'https://192.168.1.100/api/v1/ping',
      noProxy: '192.168.1.100',
      expected: true,
      description: 'IP address match',
    },
  ];

  testCases.forEach((testCase, index) => {
    const result = shouldBypassProxy(testCase.serverUrl, testCase.noProxy);
    const status = result === testCase.expected ? '✅ PASS' : '❌ FAIL';

    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`  URL: ${testCase.serverUrl}`);
    console.log(`  NO_PROXY: ${testCase.noProxy}`);
    console.log(`  Expected: ${testCase.expected}, Got: ${result} ${status}`);
    console.log('');
  });
}

// Run the tests
testNoProxyLogic();
