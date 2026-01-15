'use strict';

/* eslint-env node */
/* eslint-disable no-undef */
const baseConfig = require('@silvermine/standardization/commitlint');

// Extend scope-enum to include package names
const baseScopes = baseConfig.rules['scope-enum'][2];

module.exports = {
   ...baseConfig,
   rules: {
      ...baseConfig.rules,
      'scope-enum': [
         2,
         'always',
         baseScopes.concat([
            'tauri-mcp-server',
            'tauri-plugin-mcp-bridge',
         ]),
      ],
      'header-max-length': [ 2, 'always', 100 ],
   },
};
