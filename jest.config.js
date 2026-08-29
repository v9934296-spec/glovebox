/** Domain/unit tests run in node; component tests use jest-expo. */
module.exports = {
  preset: 'jest-expo',
  // pnpm nests real packages under node_modules/.pnpm/<pkg>@<version>/node_modules/,
  // so the ignore pattern must tolerate the optional .pnpm/<anything>/ segment.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/)?((jest-)?react-native|@react-native(-community)?|jest-expo|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/files/', '/onflow-v1/'],
};
