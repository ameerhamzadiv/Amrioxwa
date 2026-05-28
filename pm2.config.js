'use strict';

module.exports = {
  apps: [
    {
      name: 'amrioxwa',
      script: 'src/app.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true,
      kill_timeout: 30000,
      listen_timeout: 10000,
    },
  ],
};
