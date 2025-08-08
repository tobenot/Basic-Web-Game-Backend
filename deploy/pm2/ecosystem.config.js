module.exports = {
  apps: [
    {
      name: 'bwb', // must match APP in scripts if you use pm2 commands by name
      script: './bin/start',
      cwd: '.',
      instances: 1, // set to 2 or 'max' for zero-downtime reloads
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: '/var/log/bwb/out.log',
      error_file: '/var/log/bwb/err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};