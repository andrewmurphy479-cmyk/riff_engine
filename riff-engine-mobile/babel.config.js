module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', {
      // Zustand's ESM entry uses import.meta; Metro serves a classic web bundle.
      web: { unstable_transformImportMeta: true },
    }]],
  };
};
