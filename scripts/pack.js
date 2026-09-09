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
	return `@echo off
chcp 65001 > nul

echo PM2-based Windows deployment is retired for this application.
echo Provision exactly one Windows Service supervisor, then deploy the release through that service.
echo This package will not install, start, reload, or save PM2 state.
exit /b 1
`
}

const linuxPm2Guard = [
  '# systemd is canonical; refuse any online PM2 process.',
  'APP_USER="${BWB_APP_USER:-bwb}"',
  'if command -v pm2 >/dev/null 2>&1 && id -u "$APP_USER" >/dev/null 2>&1; then',
  '  pm2_state="$(su - "$APP_USER" -c "pm2 jlist 2>/dev/null" || true)"',
  '  if grep -q "online" <<< "$pm2_state"; then',
  '    echo "Refusing systemd deployment: PM2 has an online process for $APP_USER." >&2',
  '    echo "Choose one supervisor and remove the PM2 app before continuing." >&2',
  '    exit 1',
  '  fi',
  'fi',
].join('\n');

function createLinuxDeployScript(appName, version, buildType) {
	if (buildType === 'modules') {
		return `#!/usr/bin/env bash
set -euo pipefail
echo "Installing locked production modules for ${appName} v${version}..."
[[ -f package-lock.json ]] || { echo "package-lock.json is required" >&2; exit 1; }
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
[[ -x node_modules/.bin/prisma ]] || { echo "Prisma CLI missing" >&2; exit 1; }
./node_modules/.bin/prisma generate --schema=prisma/schema.prisma
echo "Node modules installation completed! Version: ${version}"
`
	}
	return `#!/usr/bin/env bash
set -euo pipefail

APP_ID="\${BWB_APP_ID:-bwb}"
APP_USER="\${BWB_APP_USER:-bwb}"
APP_GROUP="\${BWB_APP_GROUP:-$APP_USER}"
BASE="\${BWB_BASE:-/opt/$APP_ID}"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
UNIT="\${BWB_SYSTEMD_UNIT:-basic-web-game.service}"
ETC_DIR="\${BWB_ETC_DIR:-/etc/$APP_ID}"
ENV_FILE="\${BWB_ENV_FILE:-$ETC_DIR/$APP_ID.env}"
SOURCE_DIR=$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd)
BUILD_VERSION="${version}"

[[ $EUID -eq 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ -r "$ENV_FILE" ]] || { echo "Missing runtime environment: $ENV_FILE" >&2; exit 1; }
command -v systemctl >/dev/null 2>&1 || { echo "systemctl is required" >&2; exit 1; }
[[ -f "$SOURCE_DIR/package-lock.json" ]] || { echo "package-lock.json is required" >&2; exit 1; }
${linuxPm2Guard}

if [[ ! -f "/etc/systemd/system/$UNIT" && -f "$SOURCE_DIR/basic-web-game.service" ]]; then
  install -m 0644 "$SOURCE_DIR/basic-web-game.service" "/etc/systemd/system/$UNIT"
fi
id -u "$APP_USER" >/dev/null 2>&1 || { echo "Missing app user: $APP_USER" >&2; exit 1; }
id -g "$APP_GROUP" >/dev/null 2>&1 || { echo "Missing app group: $APP_GROUP" >&2; exit 1; }

mkdir -p "$RELEASES"
NEW_DIR="$APP_ID-$BUILD_VERSION"
NEW_PATH="$RELEASES/$NEW_DIR"
rm -rf -- "$NEW_PATH"
mkdir -p "$NEW_PATH"
cp -a "$SOURCE_DIR/." "$NEW_PATH/"
chown -R "$APP_USER:$APP_GROUP" "$NEW_PATH"
chmod +x "$NEW_PATH/deploy/pre_deploy.sh" 2>/dev/null || true

PREV_PATH=$(readlink -f "$CURRENT" || true)
printf -v q_new_path '%q' "$NEW_PATH"
printf -v q_etc_dir '%q' "$ETC_DIR"
printf -v q_env_file '%q' "$ENV_FILE"
su - "$APP_USER" -c "cd $q_new_path && BWB_APP_NAME='$APP_ID' BWB_ETC_DIR=$q_etc_dir BWB_ENV_FILE=$q_env_file bash deploy/pre_deploy.sh"

ln -sfn "$NEW_PATH" "$CURRENT"
systemctl daemon-reload
systemctl enable --now "$UNIT" >/dev/null
systemctl restart "$UNIT"

PORT=3000
port_candidate=$(grep -E '^PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)
if [[ "\${port_candidate:-}" =~ ^[0-9]+$ ]]; then PORT=$port_candidate; fi
health_ok=0
deadline=$((SECONDS+60))
while (( SECONDS < deadline )); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null; then health_ok=1; break; fi
  sleep 2
done

if (( health_ok == 0 )); then
  echo "Health check failed; rolling back release." >&2
  if [[ -n "\${PREV_PATH:-}" && -d "$PREV_PATH" ]]; then
    ln -sfn "$PREV_PATH" "$CURRENT"
    systemctl restart "$UNIT" || true
  fi
  exit 1
fi

find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\\n' \\
  | sort -nr | tail -n +6 | cut -d' ' -f2- \\
  | xargs -r rm -rf --

echo "Deployed $NEW_DIR with $UNIT"
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
		const linuxOnly = buildType === 'modules' ? [] : [
			{ type: 'file', src: 'deploy/systemd/pre_deploy.sh', dest: 'deploy/pre_deploy.sh' },
			{ type: 'file', src: 'deploy/systemd/basic-web-game.service', dest: 'basic-web-game.service' },
		]
		const linuxEntries = entriesBase.concat(linuxOnly, [{ type: 'content', content: shScript, dest: 'deploy.sh', mode: 0o755 }])
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


