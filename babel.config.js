module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // O plugin de worklets (Reanimated v4) PRECISA ser o último da lista.
    plugins: ["react-native-worklets/plugin"],
  };
};
