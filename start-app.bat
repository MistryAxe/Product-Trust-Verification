@echo off
set NODE_OPTIONS=--max-old-space-size=2048
npx expo start --go --lan --max-workers 1 -c
