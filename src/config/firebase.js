import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC2qcgZK-Ip_xBsdUewE_bsgd7BausAS4Y",
  authDomain: "connectallangola.firebaseapp.com",
  projectId: "connectallangola",
  storageBucket: "connectallangola.firebasestorage.app",
  messagingSenderId: "90320321734",
  appId: "1:90320321734:web:865cd2b8bf50a1b43a6bc7"
};

// Inicializa a app só uma vez
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// Inicializa o auth só uma vez com persistência AsyncStorage
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Já foi inicializado — reutiliza
  auth = getAuth(app);
}

const db = getFirestore(app);

export { auth, db };
export default app;