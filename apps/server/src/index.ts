import { bootConfig } from './platform/config.js';

bootConfig({
  env: process.env,
  writeError: (text) => {
    process.stderr.write(text);
  },
  exit: (code) => process.exit(code),
});
