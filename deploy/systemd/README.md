# systemd deployment (recommended)

Use systemd as the only supervisor for a production backend. Do not run the same `dist/server.js` under PM2 on the same host or port.

## Layout

- Releases: `/opt/bwb/releases/<version>`
- Current release: `/opt/bwb/current`
- Runtime environment: `/etc/bwb/bwb.env` (never package or commit it)
- Unit: `basic-web-game.service`
- Default listener: `127.0.0.1:3000`

## One-time setup

1. Create the unprivileged `bwb` user and the `/opt/bwb` and `/etc/bwb` directories.
2. Install `/etc/bwb/bwb.env` with mode `0640`, owned by `root:bwb`.
3. Review `basic-web-game.service` and confirm the Node executable is available through its `PATH`.
4. Install the unit and enable it:

```bash
sudo install -m 0644 deploy/systemd/basic-web-game.service /etc/systemd/system/basic-web-game.service
sudo systemctl daemon-reload
sudo systemctl enable basic-web-game.service
```

If the host previously used PM2, remove only the PM2 app and its startup entry before starting systemd. Never stop the currently healthy service blindly; verify the replacement unit and release first.

## Release

Build a Linux release package from a clean checkout:

```bash
npm run pack:linux:server
```

The generated Linux package is systemd-only. It contains the runtime manifest/lockfile, Prisma schema, systemd unit, and deployment hook; it never installs or starts PM2.

```bash
sudo bash deploy/systemd/deploy.sh /tmp/bwb-<version>.tar.gz
```

The script requires the external environment file, installs the locked production dependency tree with lifecycle scripts disabled, explicitly generates Prisma Client, switches the release atomically, restarts systemd, checks `/health`, and rolls back the symlink if the health check fails. It refuses to proceed when the `bwb` user's PM2 has an online process.

## Operations

```bash
systemctl status basic-web-game.service --no-pager
journalctl -u basic-web-game.service --since today --no-pager
curl --fail http://127.0.0.1:3000/health
```

The application emits bounded structured access events containing method, route, status, and duration only. It does not log request or response headers, query strings, cookies, or authorization values. Journald is the single log sink and the unit has rate limiting enabled.
