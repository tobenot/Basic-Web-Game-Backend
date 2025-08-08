const https = require('https');
const { execSync } = require('child_process');

function getRegistryUrl() {
  return process.env.REGISTRY_URL || 'https://npm.pkg.github.com';
}

function getLatestVersionViaNpmView(packageName) {
  const registryUrl = getRegistryUrl();
  try {
    const cmd = `npm view ${packageName} version --registry=${registryUrl}`;
    const output = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    const lines = output.split(/\r?\n/);
    const version = lines[lines.length - 1].trim();
    if (/^\d+\.\d+\.\d+(-.+)?$/.test(version)) {
      return version;
    }
    throw new Error('Unexpected npm view output');
  } catch (error) {
    return null;
  }
}

async function getPackageInfoFromNpmJs(packageName) {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const packageInfo = JSON.parse(data);
          resolve(packageInfo);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

function incrementVersion(version, type = 'patch') {
  const parts = version.split('.').map(Number);

  switch (type) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
    default:
      parts[2]++;
      break;
  }

  return parts.join('.');
}

async function getNextVersion(packageName, versionType = 'patch') {
  try {
    // 1) Prefer querying the configured registry (default GitHub Packages)
    const latestFromConfigured = getLatestVersionViaNpmView(packageName);
    if (latestFromConfigured) {
      const nextVersion = incrementVersion(latestFromConfigured, versionType);
      console.log(`Current version (registry ${getRegistryUrl()}): ${latestFromConfigured}`);
      console.log(`Next version: ${nextVersion}`);
      return nextVersion;
    }

    // 2) Fallback to public npmjs.org
    try {
      const packageInfo = await getPackageInfoFromNpmJs(packageName);
      const currentVersion = packageInfo['dist-tags'].latest;
      const nextVersion = incrementVersion(currentVersion, versionType);
      console.log(`Current version (npmjs.org): ${currentVersion}`);
      console.log(`Next version: ${nextVersion}`);
      return nextVersion;
    } catch (_) {}

    // 3) Fallback to local package.json
    const packageJson = require('../package.json');
    const currentVersion = packageJson.version;
    const nextVersion = incrementVersion(currentVersion, versionType);
    console.log(`Using local package.json version: ${currentVersion}`);
    console.log(`Next version: ${nextVersion}`);
    return nextVersion;
  } catch (error) {
    console.error('Error determining next version:', error.message);
    process.exit(1);
  }
}

// If run directly
if (require.main === module) {
  const packageName = process.argv[2] || '@tobenot/basic-web-game-backend-contract';
  const versionType = process.argv[3] || 'patch';

  getNextVersion(packageName, versionType)
    .then(nextVersion => {
      console.log(nextVersion);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = { getNextVersion, incrementVersion };