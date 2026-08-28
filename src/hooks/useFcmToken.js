/**
 * hooks/useFcmToken.js — ConnectAll Angola
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const eChamada = data?.tipo === 'chamada_recebida';
    return {
      shouldShowAlert: true,
      shouldPlaySound: eChamada,
      shouldSetBadge:  false,
    };
  },
});

export function useFcmToken() {
  const { user } = useUser();

  useEffect(() => {
    if (!user?.uid) return;

    async function registar() {
      // Não escreve nada enquanto um registo (OTP) estiver a decorrer —
      // evita criar/atualizar o documento users/{uid} com um estado parcial
      // que possa entrar em corrida com o setDoc do perfil completo em
      // verificar-codigo.jsx.
      try {
        const registoAtivo = await AsyncStorage.getItem('_registoConcluindo');
        if (registoAtivo === '1') {
          console.log('[FCM] Registo a decorrer — a adiar registo do token.');
          return;
        }
      } catch (_) {}

      const { status: existente } = await Notifications.getPermissionsAsync();
      let statusFinal = existente;
      if (existente !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        statusFinal = status;
      }
      if (statusFinal !== 'granted') {
        console.log('[FCM] Permissão negada.');
        return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('chamadas', {
          name:               'Chamadas',
          importance:         Notifications.AndroidImportance.MAX,
          vibrationPattern:   [0, 250, 250, 250],
          lightColor:         '#25D366',
          sound:              null,
          bypassDnd:          true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      if (!token) return;

      // ✅ setDoc com merge em vez de updateDoc — funciona mesmo sem documento existente
      await setDoc(doc(db, 'users', user.uid), {
        fcmToken:         token,
        fcmTokenPlatform: Platform.OS,
        fcmTokenUpdated:  new Date().toISOString(),
      }, { merge: true }).catch((err) => console.log('[FCM] Erro ao guardar token:', err));

      console.log('[FCM] Token registado:', token);
    }

    registar();
  }, [user?.uid]);
}