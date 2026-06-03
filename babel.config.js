module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // O plugin do Reanimated PRECISA ser o último da lista.
    plugins: ["react-native-reanimated/plugin"],
  };
};
