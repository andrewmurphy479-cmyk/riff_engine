const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-audio-api 0.13.2 pulls gesture-handler and reanimated in through
// its <AudioControls> component without declaring them as dependencies. We use
// only the audio graph, never the library's UI, so resolve them to an empty
// module rather than installing two native libraries we'd never render.
// See lib/audioApiUiStub.js for the full explanation.
const STUBBED_MODULES = new Set([
  'react-native-gesture-handler',
  'react-native-reanimated',
]);

const stubPath = path.resolve(__dirname, 'lib/audioApiUiStub.js');
const upstreamResolveRequest = config.resolver.resolveRequest;

// Ad and purchase SDKs have no browser implementation.
const NATIVE_ONLY_MODULES = new Set([
  'react-native-google-mobile-ads',
  'expo-iap',
  'expo-tracking-transparency',
]);
const nativeUnavailablePath = path.resolve(__dirname, 'lib/nativeUnavailable.web.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (STUBBED_MODULES.has(moduleName)) {
    return { type: 'sourceFile', filePath: stubPath };
  }
  if (platform === 'web' && NATIVE_ONLY_MODULES.has(moduleName)) {
    return { type: 'sourceFile', filePath: nativeUnavailablePath };
  }

  const resolve = upstreamResolveRequest ?? context.resolveRequest;
  return resolve(context, moduleName, platform);
};

module.exports = config;
