/**
 * SeletorDataNascimento.jsx — ConnectAll Angola
 * Componente partilhado para seleccionar a Data de Nascimento através de
 * um mini calendário nativo, em vez de um campo de texto livre.
 *
 * - Android: abre o calendário nativo do sistema (display="calendar").
 * - iOS: abre um modal com o calendário inline (display="inline") e
 *   botões "Cancelar" / "Confirmar", para não fechar sozinho a cada toque.
 *
 * Usa @react-native-community/datetimepicker.
 * Se ainda não estiver instalado no projeto, corre:
 *   npx expo install @react-native-community/datetimepicker
 *
 * Valor guardado/devolvido no formato "DD/MM/AAAA" (mesmo formato que
 * já era usado nos campos de texto), para não quebrar nada que já
 * dependa deste formato (validações, Firestore, etc.).
 */

import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const C = { azul: '#0A66C2', cinza2: '#E0DDD8', cinza3: '#666360', cinza4: '#1B1B1B' };

const HOJE     = new Date();
const DATA_MIN = new Date(HOJE.getFullYear() - 100, 0, 1);

function paraDate(valorDDMMAAAA) {
  if (!valorDDMMAAAA || typeof valorDDMMAAAA !== 'string') return null;
  const partes = valorDDMMAAAA.split('/');
  if (partes.length !== 3) return null;
  const [dd, mm, aaaa] = partes.map(Number);
  if (!dd || !mm || !aaaa) return null;
  const data = new Date(aaaa, mm - 1, dd);
  return isNaN(data.getTime()) ? null : data;
}

function paraTexto(data) {
  const dd   = String(data.getDate()).padStart(2, '0');
  const mm   = String(data.getMonth() + 1).padStart(2, '0');
  const aaaa = data.getFullYear();
  return `${dd}/${mm}/${aaaa}`;
}

export default function SeletorDataNascimento({ value, onChange, placeholder = 'Selecionar data' }) {
  const [aberto, setAberto] = useState(false);
  const [temp, setTemp]     = useState(paraDate(value) || new Date(2000, 0, 1));

  const abrir = () => {
    setTemp(paraDate(value) || new Date(2000, 0, 1));
    setAberto(true);
  };

  // Android: o próprio diálogo do sistema fecha-se sozinho ao escolher/cancelar
  const aoMudarAndroid = (event, selecionada) => {
    setAberto(false);
    if (event.type === 'set' && selecionada) onChange(paraTexto(selecionada));
  };

  // iOS: calendário inline dentro do modal — só confirma no botão
  const aoMudarIOS = (event, selecionada) => {
    if (selecionada) setTemp(selecionada);
  };

  const confirmarIOS = () => {
    onChange(paraTexto(temp));
    setAberto(false);
  };

  return (
    <>
      <TouchableOpacity style={st.campo} onPress={abrir} activeOpacity={0.75}>
        <Text style={[st.texto, !value && st.placeholder]}>{value || placeholder}</Text>
        <Feather name="calendar" size={18} color={C.azul} />
      </TouchableOpacity>

      {Platform.OS === 'android' && aberto && (
        <DateTimePicker
          value={temp}
          mode="date"
          display="calendar"
          maximumDate={HOJE}
          minimumDate={DATA_MIN}
          onChange={aoMudarAndroid}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
          <View style={st.overlay}>
            <View style={st.modalBox}>
              <Text style={st.modalTitulo}>Data de Nascimento</Text>
              <DateTimePicker
                value={temp}
                mode="date"
                display="inline"
                maximumDate={HOJE}
                minimumDate={DATA_MIN}
                onChange={aoMudarIOS}
              />
              <View style={st.modalBotoes}>
                <TouchableOpacity style={st.btnCancelar} onPress={() => setAberto(false)}>
                  <Text style={st.btnCancelarTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.btnConfirmar} onPress={confirmarIOS}>
                  <Text style={st.btnConfirmarTxt}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const st = StyleSheet.create({
  campo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: C.cinza2, paddingVertical: 12,
  },
  texto:       { fontSize: 15, color: C.cinza4 },
  placeholder: { color: C.cinza3 },

  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '100%' },

  modalTitulo: { fontSize: 15, fontWeight: '700', color: C.cinza4, marginBottom: 4, textAlign: 'center' },
  modalBotoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  btnCancelar:    { paddingVertical: 10, paddingHorizontal: 16 },
  btnCancelarTxt: { color: C.cinza3, fontWeight: '600', fontSize: 14 },
  btnConfirmar:    { backgroundColor: C.azul, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
  btnConfirmarTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});