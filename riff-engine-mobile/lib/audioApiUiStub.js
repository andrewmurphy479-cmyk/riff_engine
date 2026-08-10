// Stub for react-native-gesture-handler / react-native-reanimated.
//
// react-native-audio-api 0.13.2 exports its <Audio> / <AudioControls> React
// components from the same barrel (src/api.ts) as the Web Audio graph, and
// those components import gesture-handler and reanimated without declaring
// either one in the package's dependencies or peerDependencies. Metro follows
// the barrel and fails to resolve them.
//
// We only use the audio graph (AudioContext, AudioBuffer, ConvolverNode, ...)
// and never render the library's UI components, so these imports need to
// resolve but never run. Both offending files -- Audio/controls/AudioControls
// .tsx and Audio/controls/audioControlUtils.ts -- reference the libraries only
// inside component bodies and hooks, never at module scope, so an empty module
// is enough. See metro.config.js for the resolver that points here.
//
// If we ever genuinely need gesture-handler or reanimated, install them for
// real and delete this stub along with the resolveRequest hook -- both ship
// native code, so that also means a new dev build.

module.exports = {};
