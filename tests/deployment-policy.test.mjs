import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pm2Deploy = fs.readFileSync(new URL('../deploy/pm2/deploy.sh', import.meta.url), 'utf8');
const supervisorGuard = fs.readFileSync(new URL('../deploy/pm2/assert-no-systemd-owner.sh', import.meta.url), 'utf8');
const packScript = fs.readFileSync(new URL('../scripts/pack.js', import.meta.url), 'utf8');

test('PM2 deployment refuses to compete with an active systemd owner', () => {
  assert.match(`${pm2Deploy}\n${supervisorGuard}`, /systemd/i);
  assert.match(`${pm2Deploy}\n${supervisorGuard}`, /Refusing|refus/i);
  assert.match(`${pm2Deploy}\n${supervisorGuard}`, /cgroup|systemctl.*active|list-units/i);
});

test('generated Linux deployment includes the same supervisor guard', () => {
  assert.match(packScript, /systemd/i);
  assert.match(packScript, /Refusing|refus/i);
  assert.match(packScript, /cgroup|systemctl.*active|list-units/i);
  assert.doesNotMatch(packScript, /src:\s*['"]\.env\.publish['"]/);
});

test('canonical systemd deployment assets exist and do not start PM2', () => {
  const unit = fs.readFileSync(new URL('../deploy/systemd/basic-web-game.service', import.meta.url), 'utf8');
  const deploy = fs.readFileSync(new URL('../deploy/systemd/deploy.sh', import.meta.url), 'utf8');

  assert.match(unit, /ExecStart=.*dist\/server\.js/);
  assert.doesNotMatch(unit, /pm2/i);
  assert.match(deploy, /systemctl/);
  assert.doesNotMatch(deploy, /pm2\s+(start|restart|reload)/i);
});
