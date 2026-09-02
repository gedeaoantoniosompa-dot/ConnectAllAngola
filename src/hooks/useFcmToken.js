/**
 * hooks/useFcmToken.js — ConnectAll Angola
 *
 * Nota: o campo chama-se "fcmToken" por histórico. No mobile, o valor
 * gravado é um Expo Push Token (getExpoPushTokenAsync) — é isso que a
 * Cloud Function usa para enviar o push via API do Expo.
 *
 * Na web, o Expo push service não é usado (getExpoPushTokenAsync exige
 * applicationId, que não existe no browser). Em vez disso, usamos
 * getDevicePushTokenAsync(), que devolve a subscription/token nativo do
 * navegador (via VAPID + service worker configurados no app.json). Esse
 * token deve ser tratado no backend com a lib `web-push`, não com a API
 * de push da Expo.
 *
 * O setNotificationHandler foi movido para o _layout.tsx (fica só um,
 * lá, com a lógica de só tocar som em chamadas) — tê-lo aqui também
 * causava dois handlers a competir, e o daqui nunca chegava a ganhar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';

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

      let token = null;

      try {
        if (Platform.OS === 'web') {
          // Web: token nativo do navegador (VAPID + service worker), não passa
          // pelo serviço de push da Expo (que exige applicationId inexistente na web).
          const tokenData = await Notifications.getDevicePushTokenAsync();
          token = tokenData?.data ?? null;
        } else {
          // Mobile (Android/iOS): fluxo normal via serviço de push da Expo.
          // projectId explícito — sem isto, getExpoPushTokenAsync() pode falhar
          // ou devolver token errado em builds standalone/EAS (fora do Expo Go).
          const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ||
            Constants.easConfig?.projectId;

          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
          token = tokenData?.data ?? null;
        }
      } catch (err) {
        // Na web isto pode falhar em dev (http/IP local, rede a bloquear o
        // serviço de push, etc.) — não deve derrubar o resto da app.
        console.log('[FCM] Erro ao obter token de push:', err?.message || err);
        return;
      }

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