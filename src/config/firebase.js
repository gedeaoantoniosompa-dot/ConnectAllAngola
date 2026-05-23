import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
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

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Evita erro de "auth already initialized"
export const auth = getApps().length === 1 && !getApps()[0].name.includes('auth')
  ? initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    })
  : getAuth(app);

export const db = getFirestore(app);