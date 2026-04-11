module.exports = {
  apps: [
    {
      name: 'ceo-backend',
      cwd: 'D:/SACHIN  GARG/CEO/ceo-react/backend',
      script: 'server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        PORT: 5210
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true
    },
    {
      name: 'ceo-frontend',
      cwd: 'D:/SACHIN  GARG/CEO/ceo-react/frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host 0.0.0.0 --port 5211',
      interpreter: 'node',
      env: {
        NODE_ENV: 'development'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true
    }
  ]
};
