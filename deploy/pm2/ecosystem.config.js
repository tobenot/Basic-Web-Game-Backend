const pkg = require('../../package.json');

module.exports = {
  apps: [
    {
      name: pkg.name.replace(/^@.*\//, ''), // must match APP in scripts if you use pm2 commands by name
      script: 'dist/server.js',
      node_args: '-r dotenv/config',
      cwd: '.',
      instances: 1, // set to 2 or 'max' for zero-downtime reloads
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        DOTENV_CONFIG_PATH: './.env.publish',
      },
      out_file: `/var/log/${pkg.name.replace(/^@.*\//, '')}/out.log`,
      error_file: `/var/log/${pkg.name.replace(/^@.*\//, '')}/err.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};