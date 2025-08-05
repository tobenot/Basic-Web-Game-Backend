const fs = require('fs');
const path = require('path');
const { getNextVersion } = require('./get-next-version');

async function updateVersion(versionType = 'patch') {
  const packageJsonPath = path.join(__dirname, '../package.json');
  
  try {
    // Get the next version
    const nextVersion = await getNextVersion('@tobenot/basic-web-game-backend-contract', versionType);
    
    // Read current package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Update version
    packageJson.version = nextVersion;
    
    // Write back to package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(`✅ Version updated to ${nextVersion}`);
    return nextVersion;
  } catch (error) {
    console.error('❌ Error updating version:', error.message);
    process.exit(1);
  }
}

// If run directly
if (require.main === module) {
  const versionType = process.argv[2] || 'patch';
  
  updateVersion(versionType)
    .then(() => {
      console.log('Version update completed successfully');
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = { updateVersion };