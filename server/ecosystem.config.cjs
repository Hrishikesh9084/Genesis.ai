module.exports = {
  apps: [
    {
      name: 'genesis-server',
      script: 'index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.PM2_MAX_MEMORY_RESTART || '700M',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    },
  ],
};
