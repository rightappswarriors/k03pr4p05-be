#!/bin/sh
redis-server --daemonize yes
npx prisma migrate deploy
npm run build
node ./dist/index.js