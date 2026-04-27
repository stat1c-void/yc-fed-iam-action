import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import jest from "eslint-plugin-jest";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["**/coverage", "**/dist", "**/node_modules"],
  },
  js.configs.recommended,
  {
    files: ["**/*.test.js"],
    ...jest.configs["flat/recommended"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...jest.environments.globals.globals,
      },
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      camelcase: "off",
      "i18n-text/no-en": "off",
      "import/no-namespace": "off",
      "no-console": "off",
      "no-shadow": "off",
      "no-unused-vars": "warn",
    },
  },
]);
