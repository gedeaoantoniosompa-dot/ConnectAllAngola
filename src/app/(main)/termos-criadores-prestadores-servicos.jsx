/**
 * app/(main)/termos-criadores-prestadores-servicos.jsx — ConnectAll Angola
 * Termos para Criadores de Conteúdo e Prestadores de Serviços
 * HTML embutido como string (resolve tela branca no Android com WebView local)
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const HTML_TERMOS = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      color: #1B1B1B;
      background: #fff;
      padding: 20px 18px 40px;
      line-height: 1.7;
    }
    h1 { font-size: 20px; font-weight: 800; color: #0b0b0b; margin-bottom: 6px; }
    .data { font-size: 12px; color: #666360; margin-bottom: 24px; }
    h2 { font-size: 15px; font-weight: 700; color: #0b0c0c; margin: 24px 0 8px; }
    p { color: #1B1B1B; }
    ul { color: #1B1B1B; }
    li { color: #1B1B1B; }
    p { margin-bottom: 12px; color: #333; }
    ul { padding-left: 18px; margin-bottom: 12px; }
    li { margin-bottom: 6px; color: #333; }
    .destaque {
      background: #EEF3FB;
      border-left: 3px solid #0A66C2;
      border-radius: 6px;
      padding: 12px 14px;
      margin: 16px 0;
      font-size: 13px;
      color: #004182;
    }
    .aviso {
      background: #FEF9EC;
      border-left: 3px solid #D97706;
      border-radius: 6px;
      padding: 12px 14px;
      margin: 16px 0;
      font-size: 13px;
      color: #92400E;
    }
    hr { border: none; border-top: 1px solid #E4E2DF; margin: 20px 0; }
  </style>
</head>
<body>

  <h1>Termos para Criadores de Conteúdo e Prestadores de Serviços</h1>
  <p class="data">ConnectAll Angola · Última atualização: Junho de 2026</p>

  <div class="destaque">
    Estes Termos aplicam-se a todos os utilizadores que ativem o Perfil Profissional, tendo a conta Pro na plataforma ConnectAll Angola.
    Ao ativar, aceitas integralmente as condições aqui descritas.
  </div>

  <h2>1. Objetivo do Programa</h2>
  <p>
    O ConnectAll Angola oferece aos utilizadores a possibilidade de criar conteúdos, partilhar conhecimentos, promover serviços,
    participar em comunidades e contribuir para o crescimento da plataforma através das suas atividades e interações.
  </p>

  <h2>2. Natureza das Compensações</h2>
  <p>O utilizador reconhece e concorda que:</p>
  <ul>
    <li>O ConnectAll Angola não estabelece salários fixos para criadores de conteúdo ou prestadores de serviços;</li>
    <li>Não existe qualquer vínculo laboral entre o utilizador e o ConnectAll Angola;</li>
    <li>Os valores eventualmente atribuídos pela plataforma têm caráter de oferta, incentivo, recompensa ou reconhecimento pelo contributo prestado;</li>
    <li>Não existe garantia de pagamento mensal, semanal ou periódico;</li>
    <li>O valor das ofertas poderá variar de acordo com diversos fatores definidos pela equipa da plataforma.</li>
  </ul>

  <h2>3. Critérios de Avaliação</h2>
  <p>
    A atribuição de qualquer oferta ou recompensa dependerá da análise realizada pela equipa do ConnectAll Angola, considerando,
    entre outros fatores:
  </p>
  <ul>
    <li>Qualidade dos conteúdos publicados;</li>
    <li>Frequência de participação na plataforma;</li>
    <li>Relevância dos temas abordados;</li>
    <li>Nível de interação com a comunidade;</li>
    <li>Comportamento e cumprimento das regras da plataforma;</li>
    <li>Contribuição para o crescimento e desenvolvimento da comunidade;</li>
    <li>Participação em atividades, debates, salas de conversa e eventos promovidos pela plataforma.</li>
  </ul>

  <h2>4. Verificação de Conta</h2>
  <p>A verificação de conta é um processo voluntário que confere o Selo de Criador Verificado ConnectAll. Para ser elegível:</p>
  <ul>
    <li>Ter o Perfil Profissional ativo há pelo menos 30 dias;</li>
    <li>Publicar conteúdo regularmente (mínimo 3 publicações por semana);</li>
    <li>Atingir entre 100 e 200 seguidores reais na plataforma;</li>
    <li>Manter atividade frequente e respeitar as políticas da comunidade;</li>
    <li>Não ter violações ativas de termos ou políticas.</li>
  </ul>
  <p>A aprovação é feita pela equipa ConnectAll Angola e pode ser recusada sem necessidade de justificação.</p>

  <h2>5. Elegibilidade</h2>
  <p>Para ativar e manter o Perfil Profissional, o utilizador deve:</p>
  <ul>
    <li>Ter pelo menos 18 anos de idade;</li>
    <li>Possuir uma conta ConnectAll Angola verificada com e-mail válido;</li>
    <li>Residir em território angolano ou ter atividade profissional documentada em Angola;</li>
    <li>Concordar com os Termos Gerais de Utilização do ConnectAll Angola.</li>
  </ul>

  <h2>6. Responsabilidades do Utilizador</h2>
  <p>O utilizador com Perfil Profissional compromete-se a:</p>
  <ul>
    <li>Publicar conteúdo original, verídico e que não viole direitos de terceiros;</li>
    <li>Não divulgar informações falsas, enganosas ou que possam prejudicar outros utilizadores;</li>
    <li>Respeitar as Políticas da Comunidade ConnectAll em todas as publicações;</li>
    <li>Não utilizar a plataforma para promoção de conteúdo ilícito, discriminatório ou ofensivo;</li>
    <li>Manter os dados de contacto e informações profissionais atualizados e verídicos.</li>
  </ul>

  <h2>7. Conteúdo Publicado</h2>
  <p>
    O utilizador mantém os direitos sobre o conteúdo que publica, mas concede ao ConnectAll Angola uma licença não exclusiva,
    gratuita e transferível para exibir, distribuir e promover esse conteúdo dentro da plataforma.
  </p>
  <div class="aviso">
    Conteúdo que viole os direitos de autor, contenha desinformação, incite ao ódio ou promova atividades ilegais será removido sem aviso prévio
    e poderá resultar na suspensão do Perfil Profissional.
  </div>

  <h2>8. Monetização de Conteúdos</h2>
  <p>O utilizador compreende que:</p>
  <ul>
    <li>Nem todos os conteúdos publicados serão elegíveis para monetização.</li>
    <li>A decisão sobre quais conteúdos poderão receber recompensas cabe exclusivamente ao ConnectAll Angola.</li>
    <li>A publicação de conteúdos não garante qualquer compensação financeira.</li>
    <li>A plataforma poderá alterar os critérios de monetização a qualquer momento para melhorar a experiência da comunidade.</li>
  </ul>

  <h2>9. Participação na Comunidade Feira do Saber</h2>
  <p>
    Os criadores e prestadores de serviços são incentivados a participar ativamente no espaço comunitário denominado <strong>Feira do Saber</strong>,
    onde poderão:
  </p>
  <ul>
    <li>Criar discussões e conversas;</li>
    <li>Partilhar conhecimentos e experiências;</li>
    <li>Participar em salas de voz ao vivo;</li>
    <li>Interagir com outros membros;</li>
    <li>Desenvolver conteúdos educativos, profissionais e informativos.</li>
  </ul>
  <p>A participação ativa poderá ser considerada durante os processos de avaliação para atribuição de recompensas.</p>

  <h2>10. Suspensão e Desativação</h2>
  <p>O ConnectAll Angola pode suspender ou desativar o Perfil Profissional nos seguintes casos:</p>
  <ul>
    <li>Violação dos presentes Termos ou das Políticas da Comunidade;</li>
    <li>Inatividade prolongada (mais de 60 dias sem publicações);</li>
    <li>Uso da plataforma para fins fraudulentos ou ilegais;</li>
    <li>Solicitação do próprio utilizador.</li>
  </ul>
  <p>Em caso de suspensão, os ganhos pendentes podem ser retidos durante o período de análise.</p>

  <h2>11. Alterações aos Termos</h2>
  <p>
    O ConnectAll Angola pode atualizar estes Termos a qualquer momento. As alterações serão comunicadas via notificação na plataforma.
    A utilização continuada do Perfil Profissional após a publicação das alterações constitui aceitação das novas condições.
  </p>

  <h2>12. Contacto e Suporte</h2>
  <p>
    Para questões relacionadas com o Perfil Profissional, verificação ou monetização, contacta a equipa ConnectAll Angola através da secção de Suporte na aplicação.
  </p>

  <hr />
  <p style="font-size: 12px; color: #888; text-align: center;">
    Mayangue Service ConnectAll Angola · Todos os direitos reservados · 2026
  </p>

</body>
</html>
`;

export default function TermosCriadoresPrestadoresServicosScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(main)/perfil-profissional')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1F1F1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Termos — Criadores e Prestadores</Text>
        <View style={{ width: 36 }} />
      </View>

      <WebView
        originWhitelist={['*']}
        source={{ html: HTML_TERMOS }}
        style={{ flex: 1 }}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EAEAEA',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
  },
});

