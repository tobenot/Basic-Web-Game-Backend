const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const { execSync } = require('child_process')

function getAppName() {
	try {
		const pkg = require('../package.json')
		const raw = typeof pkg.name === 'string' ? pkg.name : 'bwb'
		const cleaned = raw.replace(/^@.*\//, '')
		return cleaned || 'bwb'
	} catch (_) {
		return 'bwb'
	}
}

function getVersionTag() {
	const now = new Date()
	const y = String(now.getFullYear())
	const m = String(now.getMonth() + 1).padStart(2, '0')
	const d = String(now.getDate()).padStart(2, '0')
	const hh = String(now.getHours()).padStart(2, '0')
	const mm = String(now.getMinutes()).padStart(2, '0')
	const ss = String(now.getSeconds()).padStart(2, '0')
	return `${y}${m}${d}_${hh}${mm}${ss}`
}

function detectEnvFile(cwd) {
	const envPath = path.join(cwd, '.env')
	const publishPath = path.join(cwd, '.env.publish')
	if (fs.existsSync(envPath)) return '.env'
	if (fs.existsSync(publishPath)) return '.env.publish'
	return null
}

function runBuildIfNeeded(buildType) {
	if (buildType === 'modules') return
	const cwd = process.cwd()
	const envFile = detectEnvFile(cwd)
	if (envFile && fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'dotenv'))) {
		execSync(`npx dotenv -e ${envFile} -- npm run build`, { stdio: 'inherit' })
		return
	}
	execSync('npm run build', { stdio: 'inherit' })
}

function createWindowsDeployScript(appName, version, buildType) {
	if (buildType === 'modules') {
		return `@echo off
chcp 65001 > nul
echo Installing node modules for ${appName} v${version}...

if exist node_modules rd /s /q node_modules

if exist package-lock.json (
	echo Installing dependencies...
	call npm ci --omit=dev || goto :fail
) else (
	echo Installing dependencies...
	call npm i --production || goto :fail
)

echo.
echo Node modules installation completed! Version: ${version}
pause > nul
exit /b 0

:fail
echo Failed to install dependencies.
pause > nul
exit /b 1
`
	}
	const useDepsInstall = buildType === 'server'
	return `@echo off
chcp 65001 > nul
set APP_NAME=${appName}
set BUILD_VERSION=${version}
set ENV_FILE=.env
if not exist %ENV_FILE% if exist .env.publish set ENV_FILE=.env.publish
echo Deploying %APP_NAME% v%BUILD_VERSION%...

where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
	echo Installing pm2...
	call npm i -g pm2
)

${useDepsInstall ? `if exist package-lock.json (
	echo Installing dependencies...
	call npm ci --omit=dev || goto :fail
) else (
	echo Installing dependencies...
	call npm i --production || goto :fail
)` : `echo Using bundled node_modules`}

echo Stopping service...
call pm2 delete %APP_NAME% 2>nul

for %%I in (prisma\\migrations) do (
	if exist %%I (
		for /f "tokens=2 delims==" %%A in ('findstr /R /C:"^MIGRATE_ON_DEPLOY=" %ENV_FILE% 2^>nul') do set MIGRATE_ON_DEPLOY=%%A
		if "%MIGRATE_ON_DEPLOY%"=="1" (
			echo Running Prisma migrations...
			call npx dotenv -e %ENV_FILE% -- npx prisma migrate deploy || goto :fail
		)
	)
)

echo Starting service...
call npx dotenv -e %ENV_FILE% -- pm2 start dist/server.js --name %APP_NAME% --env production --update-env || goto :fail
call pm2 save

echo.
echo Deployment completed! Version: %BUILD_VERSION%
pause > nul
exit /b 0

:fail
echo Deployment failed.
pause > nul
exit /b 1
`
}

function createLinuxDeployScript(appName, version, buildType) {
	if (buildType === 'modules') {
		return `#!/usr/bin/env bash
set -euo pipefail
echo "Installing node modules for ${appName} v${version}..."
rm -rf node_modules || true
if [[ -f package-lock.json ]]; then
	echo "Installing dependencies..."
	npm ci --omit=dev
else
	echo "Installing dependencies..."
	npm i --production
fi
echo "Node modules installation completed! Version: ${version}"
`
	}
	const useDepsInstall = buildType === 'server'
	return `#!/usr/bin/env bash
set -euo pipefail
APP_NAME="${appName}"
BUILD_VERSION="${version}"
ENV_FILE=".env"
[[ -f "$ENV_FILE" ]] || { [[ -f ".env.publish" ]] && ENV_FILE=".env.publish"; }
echo "Deploying $APP_NAME v$BUILD_VERSION..."
if ! command -v pm2 >/dev/null 2>&1; then
	echo "Installing pm2..."
	npm i -g pm2
fi
${useDepsInstall ? `if [[ -f package-lock.json ]]; then
	echo "Installing dependencies..."
	npm ci --omit=dev
else
	echo "Installing dependencies..."
	npm i --production
fi` : `echo "Using bundled node_modules"`}
pm2 delete "$APP_NAME" 2>/dev/null || true
MIGRATE=0
if [[ -f "$ENV_FILE" ]]; then
	set -a
	. "$ENV_FILE"
	set +a
	MIGRATE=\${MIGRATE_ON_DEPLOY:-0}
fi
if [[ "$MIGRATE" == "1" && -d prisma/migrations ]]; then
	echo "Running Prisma migrations..."
	npx dotenv -e "$ENV_FILE" -- npx prisma migrate deploy
fi
echo "Starting service..."
npx dotenv -e "$ENV_FILE" -- pm2 start dist/server.js --name "$APP_NAME" --env production --update-env
pm2 save
echo "Deployment completed! Version: $BUILD_VERSION"
`
}

async function createZip(outputPath, entries) {
	await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
	return new Promise((resolve, reject) => {
		const output = fs.createWriteStream(outputPath)
		const archive = archiver('zip', { zlib: { level: 9 } })
		output.on('close', () => resolve())
		archive.on('error', reject)
		archive.pipe(output)
		for (const entry of entries) {
			if (entry.type === 'dir') archive.directory(entry.src, entry.dest)
			else if (entry.type === 'file') archive.file(entry.src, { name: entry.dest })
			else if (entry.type === 'content') archive.append(entry.content, { name: entry.dest, mode: entry.mode })
		}
		archive.finalize()
	})
}

async function main() {
	const platform = (process.argv[2] || 'win').toLowerCase()
	const buildType = (process.argv[3] || 'full').toLowerCase()
	if (!['win', 'linux', 'all'].includes(platform)) {
		console.error('Usage: node scripts/pack.js <win|linux|all> <full|server|modules>')
		process.exit(1)
	}
	if (!['full', 'server', 'modules'].includes(buildType)) {
		console.error('Usage: node scripts/pack.js <win|linux|all> <full|server|modules>')
		process.exit(1)
	}
	const appName = getAppName()
	const version = getVersionTag()
	runBuildIfNeeded(buildType)
	const entriesBase = []
	if (buildType !== 'modules') {
		entriesBase.push({ type: 'dir', src: 'dist', dest: 'dist' })
		if (fs.existsSync('prisma')) entriesBase.push({ type: 'dir', src: 'prisma', dest: 'prisma' })
		if (fs.existsSync('scripts/generate-prisma-schema.js')) entriesBase.push({ type: 'file', src: 'scripts/generate-prisma-schema.js', dest: 'scripts/generate-prisma-schema.js' })
		entriesBase.push({ type: 'file', src: 'package.json', dest: 'package.json' })
		if (fs.existsSync('package-lock.json')) entriesBase.push({ type: 'file', src: 'package-lock.json', dest: 'package-lock.json' })
		if (fs.existsSync('test.html')) entriesBase.push({ type: 'file', src: 'test.html', dest: 'test.html' })
		if (fs.existsSync('cors-test.html')) entriesBase.push({ type: 'file', src: 'cors-test.html', dest: 'cors-test.html' })
		if (fs.existsSync('.env.publish')) entriesBase.push({ type: 'file', src: '.env.publish', dest: '.env.publish' })
	}
	if (buildType === 'full' && fs.existsSync('node_modules')) {
		entriesBase.push({ type: 'dir', src: 'node_modules', dest: 'node_modules' })
	}
	const outputs = []
	if (platform === 'win' || platform === 'all') {
		const winScript = createWindowsDeployScript(appName, version, buildType)
		const winEntries = entriesBase.concat([{ type: 'content', content: winScript, dest: 'deploy.bat' }])
		const outPath = path.join('packages', `${appName}-win-${buildType}-v${version}.zip`)
		await createZip(outPath, winEntries)
		outputs.push(outPath)
	}
	if (platform === 'linux' || platform === 'all') {
		const shScript = createLinuxDeployScript(appName, version, buildType)
		const linuxEntries = entriesBase.concat([{ type: 'content', content: shScript, dest: 'deploy.sh', mode: 0o755 }])
		const outPath = path.join('packages', `${appName}-linux-${buildType}-v${version}.zip`)
		await createZip(outPath, linuxEntries)
		outputs.push(outPath)
	}
	for (const out of outputs) console.log(`Package: ${out}`)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})


