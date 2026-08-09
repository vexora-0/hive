module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Web only. On native, `babel-preset-expo` already hard-errors on
          // `import.meta` at build time, so nothing reaches the bundle and this
          // transform would be dead weight (worse: the note in its own types
          // warns it can shadow a native implementation). On web the preset
          // deliberately leaves `import.meta` alone, assuming the bundle is
          // served as an ES module — but `expo start --web` serves it as a
          // classic `<script defer>`. One `import.meta` anywhere then makes the
          // whole bundle a parse error and nothing runs at all.
          //
          // zustand 4.5.7 is the offender: Metro picks its `esm/*.mjs` build on
          // web, and those guard dev warnings with `import.meta.env.MODE`.
          //
          // The transform rewrites it to `globalThis.__ExpoImportMetaRegistry`,
          // which `expo/src/winter/runtime` installs in the first module the
          // bundle executes.
          web: { unstable_transformImportMeta: true },
        },
      ],
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
