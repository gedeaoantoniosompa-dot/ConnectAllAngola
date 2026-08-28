/**
 * components/NotificationSetup.jsx — ConnectAll Angola
 *
 * Componente invisível que:
 *  1. Chama useFcmToken() para registar/actualizar o token no Firestore
 *  2. Ouve toques em notificações push (app fechada/background)
 *     e navega para chamada-recebida
 *
 * Uso — cola dentro do teu _layout.jsx RAIZ (o que envolve tudo):
 *
 *   import { NotificationSetup } from '../components/NotificationSetup';
 *
 *   export default function RootLayout() {
 *     return (
 *       <UserProvider>
 *         <NotificationSetup />
 *         <Stack>...</Stack>
 *       </UserProvider>
 *     );
 *   }
 */

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useFcmToken } from '../hooks/useFcmToken';

export function NotificationSetup() {
  const router = useRouter();

  // Regista / actualiza o token FCM no Firestore
  useFcmToken();

  useEffect(() => {
    // Disparado quando o utilizador toca na notificação
    // com a app em background ou completamente fechada
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      if (data?.tipo === 'chamada_recebida') {
        router.push({
          pathname: '/(main)/chamada-recebida',
          params: {
            chatId:  data.chatId,
            deUid:   data.deUid,
            deNome:  data.deNome  ?? '',
            deFoto:  data.deFoto  ?? '',
            tipo:    data.tipoCham ?? 'voz',
            channel: data.channel  ?? data.chatId,
          },
        });
      }
    });

    return () => sub.remove();
  }, []);

  return null; // componente invisível — só lógica
}