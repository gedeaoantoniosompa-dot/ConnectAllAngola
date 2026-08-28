import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useUser } from '../../context/UserContext';

import MyProfileEmpresaScreen from './my-profile-empresa';
import MyProfileRecrutadorScreen from './my-profile-recrutador';
import MyProfileUtilizadorScreen from './my-profile-utilizador';

export default function MyProfileRouter() {
  const { perfil, carregando } = useUser();

  if (carregando) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color="#1677F2" />
      </View>
    );
  }

  const tipo = perfil?.tipoPerfil || 'utilizador';

  if (tipo === 'recrutador') return <MyProfileRecrutadorScreen />;
  if (tipo === 'empresa')    return <MyProfileEmpresaScreen />;
  return <MyProfileUtilizadorScreen />;
}

const s = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});