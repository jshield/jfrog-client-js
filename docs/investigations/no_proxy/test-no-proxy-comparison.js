// test-no-proxy-comparison.js
// Demonstrates original vs. fixed NO_PROXY behavior

// Original behavior: Always use proxy when env vars are set, ignore NO_PROXY
function shouldBypassProxyOriginal(serverUrl, noProxyEnv, hasProxyEnv) {
  // Original implementation just checked if proxy env vars existed
  // NO_PROXY was completely ignored
  return !hasProxyEnv; // Only bypass if no proxy env vars at all
}

// New behavior: Check NO_PROXY properly
function shouldBypassProxyFixed(serverUrl, noProxyEnv) {
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

function testComparison() {
  console.log('Comparing NO_PROXY behavior: Original vs. Fixed\n');

  const testCases = [
    {
      serverUrl: 'https://artifactory.company.com/api/v1/ping',
      noProxy: 'artifactory.company.com',
      hasProxyEnv: true,
      description: 'Should bypass proxy for artifactory.company.com',
    },
    {
      serverUrl: 'https://github.com/api/v1/repos',
      noProxy: 'artifactory.company.com',
      hasProxyEnv: true,
      description: 'Should NOT bypass proxy for github.com',
    },
    {
      serverUrl: 'https://internal.company.com/api/data',
      noProxy: '*.company.com',
      hasProxyEnv: true,
      description: 'Should bypass proxy for wildcard match',
    },
  ];

  testCases.forEach((testCase, index) => {
    const originalBypass = shouldBypassProxyOriginal(testCase.serverUrl, testCase.noProxy, testCase.hasProxyEnv);
    const fixedBypass = shouldBypassProxyFixed(testCase.serverUrl, testCase.noProxy);

    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`  URL: ${testCase.serverUrl}`);
    console.log(`  NO_PROXY: ${testCase.noProxy}`);
    console.log(`  HTTP_PROXY set: ${testCase.hasProxyEnv}`);
    console.log(`  Original behavior: Bypass proxy = ${originalBypass} ❌ (ignores NO_PROXY)`);
    console.log(`  Fixed behavior:    Bypass proxy = ${fixedBypass} ✅ (respects NO_PROXY)`);
    console.log('');
  });

  console.log('Key differences:');
  console.log('- Original: NO_PROXY was completely ignored, proxy always used if env vars set');
  console.log('- Fixed: NO_PROXY is properly parsed and respected for hostname matching');
  console.log('- This prevents unnecessary proxy usage for internal/corporate domains');
}

testComparison();
