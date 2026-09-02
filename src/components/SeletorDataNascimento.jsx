/**
 * components/SeletorDataNascimento.jsx — ConnectAll Angola
 *
 * ── PORQUÊ ESTA REESCRITA ──
 * A versão anterior dependia do calendário nativo do dispositivo/sistema
 * (ex: @react-native-community/datetimepicker). Isso causava dois problemas:
 *   1) Na web (computador ou telemóvel via browser) o calendário nativo
 *      simplesmente não existe / não abre — impossível preencher a data
 *      de nascimento e avançar no registo.
 *   2) No telemóvel, o visual muda consoante a marca/versão do sistema
 *      operativo e tende a parecer datado.
 *
 * Esta versão é um seletor de "rodas" (dia / mês / ano) construído só com
 * componentes RN puros (Modal, FlatList, TouchableOpacity) — sem NENHUMA
 * dependência nativa — por isso funciona de forma idêntica e garantida em
 * web, iOS e Android, com um visual moderno e consistente com o resto da
 * app (mesmo padrão de "bottom sheet" usado nos outros modais).
 *
 * API mantida igual à versão anterior, para não ser preciso mudar nada
 * onde já é usado (ex: profile.jsx):
 *   <SeletorDataNascimento value={dataNasc} onChange={setDataNasc} placeholder="Selecionar data" />
 *
 * `value` / valor devolvido em onChange: string no formato "DD/MM/AAAA".
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const C = {
  azul:      '#0A66C2',
  azulClaro: '#EEF3FB',
  branco:    '#FFFFFF',
  preto:     '#000000',
  cinza1:    '#F3F2EE',
  cinza2:    '#E0DDD8',
  cinza3:    '#666360',
  cinza4:    '#1B1B1B',
};

const ITEM_HEIGHT   = 44;
const VISIBLE_ITEMS  = 5; // ímpar, para haver um item central claro
const PICKER_HEIGHT  = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD_ITEMS       = Math.floor(VISIBLE_ITEMS / 2);

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function diasNoMes(mes, ano) {
  return new Date(ano, mes, 0).getDate();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function parseValor(valor, anoMin, anoMax) {
  if (typeof valor === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const [dStr, mStr, aStr] = valor.split('/');
    const d = parseInt(dStr, 10);
    const m = clamp(parseInt(mStr, 10), 1, 12);
    const a = clamp(parseInt(aStr, 10), anoMin, anoMax);
    const dClamped = clamp(d, 1, diasNoMes(m, a));
    return { dia: dClamped, mes: m, ano: a };
  }
  return null;
}

function formatarValor({ dia, mes, ano }) {
  const dd = String(dia).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return `${dd}/${mm}/${ano}`;
}

function calcularIdade({ dia, mes, ano }) {
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const aniversarioEsteAno = new Date(hoje.getFullYear(), mes - 1, dia);
  if (hoje < aniversarioEsteAno) idade -= 1;
  return idade;
}

// ── Uma coluna do seletor de rodas (usada para dia, mês e ano) ───────────
function ColunaRoda({ dados, indiceSelecionado, onSelecionar, largura }) {
  const listRef = useRef(null);
  const aArrastar = useRef(false);

  // Sempre que o índice muda "de fora" (ex: o dia deixa de existir porque
  // o mês mudou para Fevereiro), recentra a lista sem animação, desde que
  // o utilizador não esteja a arrastar esta coluna neste preciso momento.
  useEffect(() => {
    if (!aArrastar.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({
          offset: indiceSelecionado * ITEM_HEIGHT,
          animated: false,
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indiceSelecionado, dados.length]);

  const finalizarScroll = (evento) => {
    aArrastar.current = false;
    const offsetY = evento.nativeEvent.contentOffset.y;
    const indiceCru = Math.round(offsetY / ITEM_HEIGHT);
    const indice = clamp(indiceCru, 0, dados.length - 1);
    onSelecionar(indice);
    listRef.current?.scrollToOffset({ offset: indice * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={{ width: largura, height: PICKER_HEIGHT }}>
      <FlatList
        ref={listRef}
        data={dados}
        keyExtractor={(item) => String(item.valor)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScrollBeginDrag={() => { aArrastar.current = true; }}
        onMomentumScrollEnd={finalizarScroll}
        // Fallback importante para a web: em browsers (rato/trackpad) o
        // "momentum" nem sempre dispara de forma fiável, por isso também
        // corrigimos a posição quando o arrasto termina.
        onScrollEndDrag={finalizarScroll}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * PAD_ITEMS }}
        renderItem={({ item, index }) => {
          const selecionado = index === indiceSelecionado;
          return (
            <TouchableOpacity
              style={rd.item}
              activeOpacity={0.7}
              onPress={() => {
                onSelecionar(index);
                listRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: true });
              }}
            >
              <Text style={[rd.itemTxt, selecionado && rd.itemTxtAtivo]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const rd = StyleSheet.create({
  item:        { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemTxt:     { fontSize: 16, color: C.cinza3, fontWeight: '500' },
  itemTxtAtivo:{ fontSize: 19, color: C.preto, fontWeight: '800' },
});

// ══════════════════════════════════════════════════════════════════════════
export default function SeletorDataNascimento({
  value,
  onChange,
  placeholder = 'Selecionar data',
  idadeMinima = 16,
  idadeMaxima = 100,
}) {
  const [modalVisivel, setModalVisivel] = useState(false);

  const anoAtual = new Date().getFullYear();
  const anoMax = anoAtual - idadeMinima;
  const anoMin = anoAtual - idadeMaxima;

  const valorInicial = () => {
    const parseado = parseValor(value, anoMin, anoMax);
    if (parseado) return parseado;
    // Sem valor ainda: sugere uma data plausível (~25 anos) em vez de
    // abrir sempre no limite mais antigo.
    return { dia: 1, mes: 1, ano: clamp(anoMax - 9, anoMin, anoMax) };
  };

  const [dia, setDia] = useState(() => valorInicial().dia);
  const [mes, setMes] = useState(() => valorInicial().mes);
  const [ano, setAno] = useState(() => valorInicial().ano);

  // Sempre que o modal abre, sincroniza com o valor actual vindo de fora
  // (ex: se o ecrã já tinha uma data guardada).
  useEffect(() => {
    if (modalVisivel) {
      const v = valorInicial();
      setDia(v.dia);
      setMes(v.mes);
      setAno(v.ano);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisivel]);

  const anos = useMemo(() => {
    const lista = [];
    for (let a = anoMax; a >= anoMin; a--) lista.push({ valor: a, label: String(a) });
    return lista;
  }, [anoMax, anoMin]);

  const meses = useMemo(
    () => MESES.map((nome, i) => ({ valor: i + 1, label: nome })),
    []
  );

  const totalDiasMesAtual = diasNoMes(mes, ano);
  const dias = useMemo(() => {
    const lista = [];
    for (let d = 1; d <= totalDiasMesAtual; d++) lista.push({ valor: d, label: String(d) });
    return lista;
  }, [totalDiasMesAtual]);

  // Corrige o dia se deixou de existir no mês/ano escolhido (ex: 31 → Abril)
  useEffect(() => {
    if (dia > totalDiasMesAtual) setDia(totalDiasMesAtual);
  }, [totalDiasMesAtual]); // eslint-disable-line react-hooks/exhaustive-deps

  const indiceAno = Math.max(0, anos.findIndex((a) => a.valor === ano));

  const confirmar = () => {
    onChange(formatarValor({ dia, mes, ano }));
    setModalVisivel(false);
  };

  const idadePreview = calcularIdade({ dia, mes, ano });

  return (
    <>
      <TouchableOpacity style={s.campo} onPress={() => setModalVisivel(true)} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={18} color={C.azul} style={{ marginRight: 10 }} />
        <Text style={[s.campoTxt, !value && s.campoTxtVazio]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.azul} />
      </TouchableOpacity>

      <Modal
        visible={modalVisivel}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisivel(false)}
      >
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setModalVisivel(false)}
        >
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.handle} />
            <Text style={s.titulo}>Data de Nascimento</Text>

            <View style={s.rodaWrap}>
              <View pointerEvents="none" style={s.realceCentral} />

              <ColunaRoda
                dados={dias}
                indiceSelecionado={dia - 1}
                onSelecionar={(i) => setDia(dias[i].valor)}
                largura={64}
              />
              <ColunaRoda
                dados={meses}
                indiceSelecionado={mes - 1}
                onSelecionar={(i) => setMes(meses[i].valor)}
                largura={148}
              />
              <ColunaRoda
                dados={anos}
                indiceSelecionado={indiceAno}
                onSelecionar={(i) => setAno(anos[i].valor)}
                largura={88}
              />
            </View>

            <Text style={s.idadeTxt}>{idadePreview} anos</Text>

            <TouchableOpacity style={s.btnConfirmar} onPress={confirmar}>
              <Text style={s.btnConfirmarTxt}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: C.cinza2,
    paddingVertical: 12,
  },
  campoTxt:      { flex: 1, fontSize: 15, color: C.preto },
  campoTxtVazio: { color: C.cinza3 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.branco,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    alignItems: 'center',
  },
  handle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: C.cinza2, marginBottom: 14 },
  titulo:  { fontSize: 17, fontWeight: '800', color: C.preto, marginBottom: 10 },

  rodaWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: PICKER_HEIGHT,
    width: '100%',
  },
  realceCentral: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: ITEM_HEIGHT * PAD_ITEMS,
    height: ITEM_HEIGHT,
    backgroundColor: C.azulClaro,
    borderRadius: 10,
  },

  idadeTxt: {
    fontSize: 13,
    color: C.cinza3,
    marginTop: 10,
    marginBottom: 14,
    fontWeight: '600',
  },

  btnConfirmar: {
    width: '100%',
    backgroundColor: C.azul,
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnConfirmarTxt: { fontSize: 15, fontWeight: '700', color: C.branco },
});