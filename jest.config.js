/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleNameMapper: {
    "^(\.{1,2}/.*)\.js$": "$1",
  },
  transform: {
    "^.+.tsx?$": ["ts-jest", { useESM: true }],
  },
};
