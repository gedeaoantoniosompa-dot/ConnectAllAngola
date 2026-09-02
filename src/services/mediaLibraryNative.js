/**
 * services/mediaLibraryNative.js — wrapper nativo do expo-media-library
 *
 * Segue o mesmo padrão já usado em services/agoraNative.js /
 * services/agoraNative.web.js: o Metro resolve automaticamente este
 * ficheiro (.js) em iOS/Android e o mediaLibraryNative.web.js na Web,
 * ANTES de gerar o bundle. Assim o módulo nativo do expo-media-library
 * nunca chega a entrar no bundle da Web, o que evita o erro
 * "Cannot find native module 'ExpoMediaLibraryNext'".
 */
import * as MediaLibrary from 'expo-media-library';

export default MediaLibrary;