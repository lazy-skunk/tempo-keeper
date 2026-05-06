import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettier,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "src/types/cache-life.d.ts",
      "src/types/routes.d.ts",
      "src/types/validator.ts",
    ],
  },
];

export default eslintConfig;
