import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // Unused vars are errors, but allow the _ prefix escape hatch.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Type safety is the point of strict mode; don't let `any` leak back in.
      "@typescript-eslint/no-explicit-any": "error",
      // Public pages are photo-forward and LCP-sensitive: next/image only.
      "@next/next/no-img-element": "error",
    },
  },

  // Prettier last so formatting rules always win.
  prettier,

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
