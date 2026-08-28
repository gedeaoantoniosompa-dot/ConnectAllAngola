import { doc, setDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { db } from '../firebase';

const storage = getStorage();

async function uriParaBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Erro ao ler ficheiro'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

export const uploadFotoPerfil = async (userId, uriLocal) => {
  if (!userId || !uriLocal) throw new Error('ID ou URI inválidos.');
  try {
    const blob = await uriParaBlob(uriLocal);
    const storageRef = ref(storage, `fotos_perfil/${userId}/perfil.jpg`);
    await uploadBytes(storageRef, blob);
    blob.close?.();
    const urlPublica = await getDownloadURL(storageRef);
    await setDoc(doc(db, 'users', userId), { fotoURL: urlPublica }, { merge: true });
    return urlPublica;
  } catch (error) {
    console.error('Erro upload foto perfil:', error);
    throw error;
  }
};

export const uploadFotoCapa = async (userId, uriLocal) => {
  if (!userId || !uriLocal) throw new Error('ID ou URI inválidos.');
  try {
    const blob = await uriParaBlob(uriLocal);
    const storageRef = ref(storage, `fotos_perfil/${userId}/capa.jpg`);
    await uploadBytes(storageRef, blob);
    blob.close?.();
    const urlPublica = await getDownloadURL(storageRef);
    await setDoc(doc(db, 'users', userId), { capaURL: urlPublica }, { merge: true });
    return urlPublica;
  } catch (error) {
    console.error('Erro upload foto capa:', error);
    throw error;
  }
};