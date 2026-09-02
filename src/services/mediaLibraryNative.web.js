/**
 * services/mediaLibraryNative.web.js — stub Web do expo-media-library
 *
 * O expo-media-library não tem implementação na Web. Este ficheiro é
 * escolhido automaticamente pelo Metro quando a build é para Web (por
 * causa do sufixo .web.js), em vez de mediaLibraryNative.js — por isso
 * o módulo nativo real nunca é importado nem incluído no bundle da Web.
 * Qualquer chamada aqui (requestPermissionsAsync, saveToLibraryAsync,
 * etc.) nunca deve ser feita na Web; o código que usa isto já verifica
 * Platform.OS === 'web' antes de chamar estas funções.
 */
export default null;