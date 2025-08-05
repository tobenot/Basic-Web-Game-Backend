const https = require('https');
const { execSync } = require('child_process');

async function getPackageInfo(packageName) {
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
    const packageInfo = await getPackageInfo(packageName);
    const currentVersion = packageInfo['dist-tags'].latest;
    const nextVersion = incrementVersion(currentVersion, versionType);
    
    console.log(`Current version: ${currentVersion}`);
    console.log(`Next version: ${nextVersion}`);
    
    return nextVersion;
  } catch (error) {
    console.error('Error fetching package info:', error.message);
    
    // Fallback: read from local package.json
    try {
      const packageJson = require('../package.json');
      const currentVersion = packageJson.version;
      const nextVersion = incrementVersion(currentVersion, versionType);
      
      console.log(`Using local package.json version: ${currentVersion}`);
      console.log(`Next version: ${nextVersion}`);
      
      return nextVersion;
    } catch (fallbackError) {
      console.error('Error reading local package.json:', fallbackError.message);
      process.exit(1);
    }
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