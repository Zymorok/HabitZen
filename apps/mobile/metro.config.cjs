const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// NOTE: Expo сам видит рабочие пакеты; дополнительные копии React и ручной resolver не нужны.
const config = getDefaultConfig(__dirname);
const existing = config.resolver.blockList;
// NOTE: Нативная сборка создаёт тысячи файлов; наблюдение за ними замедляет Windows и перезагрузку UI.
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /[\\/]apps[\\/]mobile[\\/](?:android|ios|dist)[\\/]/,
  /[\\/]node_modules[\\/].+[\\/]android[\\/](?:build|\.cxx|\.gradle)[\\/]/,
  /[\\/]storage[\\/](?:reports|logs|runtime|tmp|backups)[\\/]/,
];
module.exports = withNativeWind(config, { input: './global.css' });
