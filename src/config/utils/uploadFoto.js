import * as FileSystem from 'expo-file-system/legacy';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function uploadFotoPerfil(uid, uri) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const dataUri = `data:image/jpeg;base64,${base64}`;

  // setDoc com merge:true cria o documento se não existir, ou atualiza se já existir
  await setDoc(doc(db, 'users', uid), { fotoURL: dataUri }, { merge: true });

  return dataUri;
}