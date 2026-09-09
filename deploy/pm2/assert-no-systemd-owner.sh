#!/usr/bin/env bash
# Shared guard for the legacy PM2 deployment path.
# A production process must have exactly one supervisor.

assert_no_systemd_owner() {
  local port="${1:-3000}"
  local app_root="${BWB_APP_ROOT:-${BASE:-}}"
  local active_units unit exec_start working_dir

  command -v systemctl >/dev/null 2>&1 || return 0

  active_units="$(systemctl list-units --type=service --state=active --no-legend --no-pager 2>/dev/null | awk '{print $1}' || true)"
  while IFS= read -r unit; do
    [[ -z "$unit" ]] && continue
    case "$unit" in
      pm2-*.service|user@*.service|session-*.scope) continue ;;
    esac

    exec_start="$(systemctl show "$unit" -p ExecStart --value 2>/dev/null || true)"
    working_dir="$(systemctl show "$unit" -p WorkingDirectory --value 2>/dev/null || true)"
    if [[ "$exec_start" == *"dist/server.js"* || ( -n "$app_root" && "$working_dir" == "$app_root"* ) ]]; then
      echo "Refusing PM2 deployment: active systemd unit '$unit' appears to own this application." >&2
      echo "Choose one supervisor; stop/disable the systemd owner before using the legacy PM2 path." >&2
      return 1
    fi
  done <<< "$active_units"

  if command -v ss >/dev/null 2>&1; then
    local listeners pid cgroup_unit
    listeners="$(ss -ltnpH "sport = :$port" 2>/dev/null || true)"
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      [[ -r "/proc/$pid/cgroup" ]] || continue
      cgroup_unit="$(awk -F/ '{for (i = 1; i <= NF; i++) if ($i ~ /\.service$/) print $i}' "/proc/$pid/cgroup" | tail -n 1)"
      if [[ "$cgroup_unit" == *.service && "$cgroup_unit" != pm2-*.service ]]; then
        echo "Refusing PM2 deployment: port $port is already owned by systemd unit '$cgroup_unit'." >&2
        echo "Choose one supervisor; do not run PM2 beside systemd." >&2
        return 1
      fi
    done < <(grep -oE 'pid=[0-9]+' <<< "$listeners" | cut -d= -f2 | sort -u || true)
  fi
}
