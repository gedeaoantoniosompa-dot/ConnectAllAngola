import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Cria uma nova notificação em tempo real no Firestore.
 * @param {string} userIdRecebe - ID do utilizador que vai receber a notificação.
 * @param {string} userIdFezAcao - ID do utilizador que realizou a ação.
 * @param {string} tipo - Tipo da notificação ('comentario', 'gosto', 'conexao', etc.).
 * @param {string} titulo - O texto descritivo que vai aparecer no card.
 * @param {string|null} remetenteFoto - URL da foto de perfil de quem fez a ação.
 * @param {string|null} postId - O ID do post que recebeu a interação para redirecionamento.
 */
export const enviarNotificacao = async (userIdRecebe, userIdFezAcao, tipo, titulo, remetenteFoto = null, postId = null) => {
  try {
    // Regra de Ouro: Se o utilizador estiver a interagir na sua própria publicação, não envia notificação
    if (userIdRecebe === userIdFezAcao) {
      return;
    }

    // Insere o documento na coleção com o campo da foto e do postId incluídos
    await addDoc(collection(db, 'notificacoes'), {
      userId: userIdRecebe,         // Dono do ecrã de notificações
      senderId: userIdFezAcao,       // Quem gerou a ação
      tipo: tipo,                    // 'comentario', 'gosto', etc.
      titulo: titulo,                // Mensagem real descritiva
      remetenteFoto: remetenteFoto,  // Guarda o link da foto de perfil no documento
      postId: postId,                // <-- O link/ID do post guardado para o redirecionamento
      lida: false,                   // Estado inicial
      createdAt: serverTimestamp(),  // Hora exata do servidor
    });

    console.log(`Notificação do tipo [${tipo}] enviada com sucesso para: ${userIdRecebe}`);
  } catch (error) {
    console.error('Erro ao criar notificação no Firestore:', error);
  }
};
