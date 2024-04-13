/**
 * @description pm2 configuration file.
 * @example
 *  production mode :: pm2 start ecosystem.config.js --only prod
 *  development mode :: pm2 start ecosystem.config.js --only dev
 */

module.exports = {
  apps: [
    {
      name: 'express-file-upload-9000', // pm2 start App name
      script: './app/server.js',
      // script: "nodemon dist/server.js cross-env NODE_ENV=production",
      exec_mode: 'cluster', // 'cluster' or 'fork'
      instances: 1, // pm2 instance count
      autorestart: true, // auto restart if process crash
      watch: false, // files change automatic restart
      max_memory_restart: '1G', // restart if process use more than 1G memory
      merge_logs: true, // if true, stdout and stderr will be merged and sent to pm2 log
      output: './logs/access.log', // pm2 log file
      error: './logs/error.log', // pm2 error log file
      env: {
        NODE_ENV: 'production',
        PORT: '9000',
        WRITE_PATH: '../../uploads/',
      },
    },
  ],
};
