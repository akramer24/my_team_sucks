module.exports = {
  root: true,
  env: {
    es6: true,
    jest: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    "quotes": ["error", "double"],
    "max-len": "off",
    "require-jsdoc": "off",
  },
};
