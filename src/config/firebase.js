import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyC2qcgZK-Ip_xBsdUewE_bsgd7BausAS4Y",
  authDomain: "connectallangola.firebaseapp.com",
  projectId: "connectallangola",
  storageBucket: "connectallangola.firebasestorage.app",
  messagingSenderId: "90320321734",
  appId: "1:90320321734:web:865cd2b8bf50a1b43a6bc7",
  databaseURL: "https://connectallangola-default-rtdb.firebaseio.com",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth com persistencia AsyncStorage
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

// Firestore sem persistentLocalCache (nao suportado no React Native)
// A cache e feita manualmente via AsyncStorage no ConversaScreen
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
} catch (e) {
  db = getFirestore(app);
}

const storage = getStorage(app);
const rtdb    = getDatabase(app);

export { auth, db, rtdb, storage };
export default app;