#!/usr/bin/env node

const isServerMode =
  !process.stdin.isTTY ||
  (!!process.env.DB_HOST && !!process.env.DB_USER && !!process.env.DB_NAME);

if (isServerMode) {
  require('./server.js');
} else {
  require('./wizard-menu.js');
}
