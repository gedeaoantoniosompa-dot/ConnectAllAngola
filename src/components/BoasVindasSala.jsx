/**
 * BoasVindasSala.jsx
 * Ecrã de boas-vindas antes de entrar numa sala de voz
 * Aparece apenas na primeira vez que o utilizador entra numa sala
 * Chave AsyncStorage: 'saber_boasVindas_visto'
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const BOAS_VINDAS_KEY = 'saber_boasVindas_visto';

function Item({ icon, titulo, desc }) {
  return (
    <View style={s.item}>
      <View style={s.itemIcon}>
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.itemTitulo}>{titulo}</Text>
        <Text style={s.itemDesc}>{desc}</Text>
      </View>
    </View>
  );
}

/**
 * Props:
 *   onEntrar  — callback chamado quando o utilizador toca "Entendido"
 *               (a lógica de entrar na sala deve estar aqui)
 */
export default function BoasVindasSala({ onEntrar }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    setVisivel(true);
  }, []);

  const handleEntrar = async () => {
    await AsyncStorage.setItem(BOAS_VINDAS_KEY, '1');
    setVisivel(false);
    onEntrar();
  };

  if (!visivel) return null;

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="slide"
      onRequestClose={handleEntrar}
    >
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Botão fechar */}
          <TouchableOpacity style={s.btnFechar} onPress={handleEntrar}>
            <Ionicons name="close" size={22} color="#333" />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
          >
            <Text style={s.titulo}>
              Bem-vindo à{'\n'}
              <Text style={s.tituloNeg}>Feira do Saber!</Text>
            </Text>

            <Text style={s.sub}>
              Você participa de{' '}
              <Text style={s.subNeg}>como Ouvinte</Text>
              . Isso é o que você pode fazer na Feira:
            </Text>

            <View style={s.lista}>
              <Item
                icon="headset"
                titulo="Ouça e reaja à conversa"
                desc='Todas as pessoas que você pode ouvir se encontram na secção "Anfitriões e Oradores" da Feira. Mostre que entende reagindo com um coração!'
              />
              <Item
                icon="hand-left"
                titulo="Levante a mão para falar"
                desc="Os anfitriões vão te convidar a participar da conversa assim que perceberem que sua mão está levantada."
              />
              <Item
                icon="person-add"
                titulo="Conecte-se com outros membros"
                desc='Clica na foto de perfil de um membro e seleciona "Seguir".'
              />
              <Item
                icon="call"
                titulo="Saia, quando quiser!"
                desc="Saia da Feira tocando no ícone do telefone vermelho no canto superior esquerdo."
              />
            </View>

            <Text style={s.nota}>
              Se algum comportamento deixar você desconfortável, não hesite em
              denunciar o membro responsável. Basta clicar em sua foto de perfil
              e clicar em 'Denunciar'.
            </Text>

            <TouchableOpacity style={s.btn} onPress={handleEntrar} activeOpacity={0.85}>
              <Text style={s.btnTxt}>Entendido</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#F5F0EB',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
    paddingTop: 16,
  },
  btnFechar: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginBottom: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  titulo: {
    fontSize: 28,
    color: '#1A1A1A',
    lineHeight: 36,
    marginBottom: 12,
  },
  tituloNeg: {
    fontWeight: '800',
  },
  sub: {
    fontSize: 15,
    color: '#444',
    lineHeight: 23,
    marginBottom: 24,
  },
  subNeg: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  lista: {
    gap: 20,
    marginBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2D2D2D',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  itemTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  nota: {
    fontSize: 12,
    color: '#777',
    lineHeight: 19,
    marginBottom: 28,
  },
  btn: {
    backgroundColor: '#1677F2',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
  },
  btnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});