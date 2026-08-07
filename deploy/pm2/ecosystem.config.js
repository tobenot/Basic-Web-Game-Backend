const pkg = require('../../package.json');

module.exports = {
  apps: [
    {
      name: pkg.name.replace(/^@.*\//, ''), // must match APP in scripts if you use pm2 commands by name
      // 经 bin/start 启动:它会 source /etc/bwb/bwb.env(唯一环境来源),
      // 不再用 DOTENV_CONFIG_PATH 指向包里不存在的 .env.publish
      script: 'bin/start',
      interpreter: 'bash',
      cwd: '.',
      instances: 1, // set to 2 or 'max' for zero-downtime reloads
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        CORS_PROVIDER: 'NGINX', // 告知应用，CORS由Nginx处理
      },
      out_file: `/var/log/bwb/out.log`,
      error_file: `/var/log/bwb/err.log`,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};