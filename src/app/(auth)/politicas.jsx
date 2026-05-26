import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const TITULOS = {
  contrato: 'Contrato do Utilizador',
  privacidade: 'Política de Privacidade',
  cookies: 'Política de Cookies',
};

const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Políticas Legais — ConnectAll Angola</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #F8F6F1; color: #0A0A0A; padding: 20px; }
    h1 { font-size: 22px; font-weight: 800; color: #CC0000; margin-bottom: 8px; }
    h2 { font-size: 16px; font-weight: 700; color: #0A0A0A; margin: 24px 0 8px; border-left: 4px solid #CC0000; padding-left: 10px; }
    h3 { font-size: 13px; font-weight: 700; margin: 16px 0 6px; text-transform: uppercase; }
    p { font-size: 14px; color: #333; line-height: 1.7; margin-bottom: 10px; }
    ul { margin: 8px 0 14px 0; padding-left: 0; list-style: none; }
    ul li { font-size: 14px; color: #444; margin-bottom: 6px; padding-left: 16px; position: relative; line-height: 1.6; }
    ul li::before { content: '—'; position: absolute; left: 0; color: #CC0000; font-weight: 700; }
    .tabs { display: flex; gap: 8px; margin-bottom: 24px; overflow-x: auto; }
    .tab { padding: 8px 16px; border-radius: 20px; border: 1.5px solid #DCDCDC; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; background: #fff; color: #6B6B6B; }
    .tab.active { background: #CC0000; color: #fff; border-color: #CC0000; }
    .section { display: none; }
    .section.active { display: block; }
    .badge { display: inline-block; background: #CC0000; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 3px; margin-bottom: 12px; }
    .doc-title { font-size: 24px; font-weight: 800; color: #0A0A0A; margin-bottom: 4px; }
    .doc-meta { font-size: 12px; color: #888; margin-bottom: 24px; }
    .highlight { background: #fff; border-left: 4px solid #F5C800; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .warning { background: #fff8f8; border-left: 4px solid #CC0000; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .contact { background: #0A0A0A; padding: 20px; margin-top: 28px; border-left: 5px solid #F5C800; border-radius: 4px; }
    .contact h3 { color: #F5C800; margin-bottom: 10px; }
    .contact p { color: #ccc; font-size: 13px; margin-bottom: 4px; }
    .contact a { color: #F5C800; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th { background: #0A0A0A; color: #F5C800; padding: 8px 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #E8E8E8; color: #333; }
    tr:nth-child(even) td { background: #fff; }
  </style>
</head>
<body>

<div class="tabs">
  <button class="tab active" onclick="showTab('termos', this)">Termos</button>
  <button class="tab" onclick="showTab('privacidade', this)">Privacidade</button>
  <button class="tab" onclick="showTab('cookies', this)">Cookies</button>
</div>

<!-- TERMOS -->
<div class="section active" id="termos">
  <div class="badge">Documento Legal</div>
  <div class="doc-title">Termos e Condições</div>
  <div class="doc-meta">Última atualização: 22 de Maio de 2026 | Versão 1.0</div>
  <div class="highlight"><p>Ao utilizar a ConnectAll Angola, concorda com os presentes Termos e Condições da <strong>Mayangue Service</strong>.</p></div>
  <h2>1. Identificação</h2>
  <p><strong>Mayangue Service</strong>, empresa angolana de tecnologia, detentora e responsável pela plataforma ConnectAll Angola.</p>
  <h2>2. Aceitação dos Termos</h2>
  <p>O acesso e uso da ConnectAll Angola implica a aceitação integral destes Termos. Caso não concorde, deverá abster-se de utilizar a plataforma.</p>
  <h2>3. Registo e Conta</h2>
  <ul>
    <li>O utilizador deve ter pelo menos 16 anos</li>
    <li>Os dados fornecidos devem ser verídicos e atualizados</li>
    <li>O utilizador é responsável pela confidencialidade da sua senha</li>
    <li>É proibida a criação de contas falsas ou em nome de terceiros</li>
  </ul>
  <h2>4. Conduta do Utilizador</h2>
  <p>É <strong>estritamente proibido</strong>:</p>
  <ul>
    <li>Publicar conteúdo ofensivo, discriminatório, racista ou violento</li>
    <li>Assediar, intimidar ou ameaçar outros utilizadores</li>
    <li>Partilhar informações falsas ou difamatórias</li>
    <li>Violar direitos de propriedade intelectual</li>
    <li>Usar a plataforma para spam ou publicidade não autorizada</li>
    <li>Realizar qualquer atividade ilegal ao abrigo da legislação angolana</li>
  </ul>
  <h2>5. Conteúdo Publicado</h2>
  <h3>5.1 Propriedade</h3>
  <p>O utilizador mantém a propriedade dos conteúdos que publica e concede à Mayangue Service uma licença não exclusiva para exibi-los na plataforma.</p>
  <h3>5.2 Responsabilidade</h3>
  <p>O utilizador é o único responsável pelos conteúdos que publica. A Mayangue Service pode remover qualquer conteúdo que viole estes Termos.</p>
  <h2>6. Propriedade Intelectual</h2>
  <p>Todos os elementos da ConnectAll Angola são propriedade exclusiva da <strong>Mayangue Service</strong>, protegidos pelas leis angolanas de propriedade intelectual.</p>
  <h2>7. Limitação de Responsabilidade</h2>
  <div class="warning"><p>⚠️ A Mayangue Service não garante disponibilidade ininterrupta e não se responsabiliza por perdas de dados ou danos indiretos, salvo nos casos previstos na lei angolana.</p></div>
  <h2>8. Lei Aplicável</h2>
  <p>Este contrato é regido pela legislação da <strong>República de Angola</strong>. Qualquer litígio será submetido aos tribunais angolanos competentes, sendo Luanda o foro eleito.</p>
  <div class="contact">
    <h3>Contacto — Mayangue Service</h3>
    <p>📧 <a href="mailto:privacidademayangueservicecta@gmail.com">privacidademayangueservicecta@gmail.com</a></p>
    <p>📍 Luanda, República de Angola</p>
  </div>
</div>

<!-- PRIVACIDADE -->
<div class="section" id="privacidade">
  <div class="badge">Documento Legal</div>
  <div class="doc-title">Política de Privacidade</div>
  <div class="doc-meta">Última atualização: 22 de Maio de 2026 | Versão 1.0</div>
  <div class="highlight"><p>A <strong>Mayangue Service</strong> compromete-se a proteger a privacidade dos utilizadores da ConnectAll Angola.</p></div>
  <h2>1. Dados Recolhidos</h2>
  <h3>Dados fornecidos pelo utilizador</h3>
  <ul>
    <li>Nome completo e foto de perfil</li>
    <li>Endereço de e-mail ou número de telefone</li>
    <li>Área profissional e biografia</li>
    <li>Cidade e localização</li>
    <li>Conteúdos publicados na plataforma</li>
  </ul>
  <h3>Dados recolhidos automaticamente</h3>
  <ul>
    <li>Endereço IP e tipo de dispositivo</li>
    <li>Sistema operativo e versão da aplicação</li>
    <li>Dados de uso e interações na plataforma</li>
    <li>Timestamps de acesso</li>
  </ul>
  <h2>2. Finalidade do Tratamento</h2>
  <ul>
    <li>Prestação e melhoria dos serviços da plataforma</li>
    <li>Personalização da experiência do utilizador</li>
    <li>Envio de notificações relevantes</li>
    <li>Segurança e prevenção de fraudes</li>
    <li>Cumprimento de obrigações legais</li>
  </ul>
  <h2>3. Partilha de Dados</h2>
  <p>Os dados dos utilizadores <strong>não são vendidos</strong> a terceiros. Podem ser partilhados apenas com:</p>
  <ul>
    <li>Fornecedores de serviços técnicos (Firebase/Google)</li>
    <li>Autoridades competentes, quando legalmente exigido</li>
  </ul>
  <h2>4. Segurança</h2>
  <p>Utilizamos encriptação SSL/TLS, autenticação segura via Firebase e controlos de acesso rigorosos para proteger os seus dados.</p>
  <h2>5. Direitos do Utilizador</h2>
  <ul>
    <li>Aceder aos seus dados pessoais</li>
    <li>Corrigir dados incorretos</li>
    <li>Solicitar a eliminação da conta</li>
    <li>Exportar os seus dados</li>
    <li>Retirar consentimento a qualquer momento</li>
  </ul>
  <h2>6. Retenção de Dados</h2>
  <p>Os dados são conservados enquanto a conta estiver ativa. Após eliminação, os dados são apagados num prazo máximo de 90 dias.</p>
  <div class="contact">
    <h3>Contacto — Mayangue Service</h3>
    <p> <a href="mailto:privacidademayangueservicecta@gmail.com">privacidademayangueservicecta@gmail.com</a></p>
    <p>📍 Luanda, República de Angola</p>
  </div>
</div>

<!-- COOKIES -->
<div class="section" id="cookies">
  <div class="badge">Documento Legal</div>
  <div class="doc-title">Política de Cookies</div>
  <div class="doc-meta">Última atualização: 22 de Maio de 2026 | Versão 1.0</div>
  <div class="highlight"><p>Esta política explica como a <strong>Mayangue Service</strong> utiliza cookies e tecnologias similares na ConnectAll Angola.</p></div>
  <h2>1. O que são Cookies?</h2>
  <p>Cookies são pequenos ficheiros armazenados no seu dispositivo. Na ConnectAll Angola utilizamos <strong>tokens de sessão</strong>, <strong>armazenamento local</strong> e <strong>identificadores de dispositivo</strong>.</p>
  <h2>2. Tipos de Cookies</h2>
  <table>
    <thead><tr><th>Tipo</th><th>Tecnologia</th><th>Finalidade</th><th>Duração</th></tr></thead>
    <tbody>
      <tr><td><strong>Essenciais</strong></td><td>Firebase Auth Token</td><td>Manter sessão ativa</td><td>30 dias</td></tr>
      <tr><td><strong>Essenciais</strong></td><td>AsyncStorage</td><td>Preferências offline</td><td>Persistente</td></tr>
      <tr><td><strong>Analíticos</strong></td><td>Firebase Analytics</td><td>Estatísticas anónimas</td><td>24 meses</td></tr>
      <tr><td><strong>Desempenho</strong></td><td>Firebase Performance</td><td>Monitorizar erros</td><td>30 dias</td></tr>
    </tbody>
  </table>
  <h2>3. Cookies Essenciais</h2>
  <div class="warning"><p>⚠️ Não é possível desativar os cookies essenciais sem comprometer o funcionamento da aplicação.</p></div>
  <h2>4. Gerir Preferências</h2>
  <ul>
    <li>Aceda a <strong>Perfil → Definições → Privacidade</strong></li>
    <li>Ative ou desative a recolha de dados analíticos</li>
    <li>Solicite a eliminação dos seus dados</li>
  </ul>
  <div class="contact">
    <h3>Contacto — Mayangue Service</h3>
    <p>📧 <a href="mailto:privacidademayangueservicecta@gmail.com">privacidademayangueservicecta@gmail.com</a></p>
    <p>📍 Luanda, República de Angola</p>
  </div>
</div>

<script>
  function showTab(id, btn) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

</body>
</html>
`;

export default function PoliticasScreen() {
  const router = useRouter();
  const { tipo } = useLocalSearchParams();

  const scrollToSection = () => {
    if (tipo === 'privacidade') return `<script>showTab('privacidade', document.querySelectorAll('.tab')[1]);</script>`;
    if (tipo === 'cookies') return `<script>showTab('cookies', document.querySelectorAll('.tab')[2]);</script>`;
    return '';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F1F1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{TITULOS[tipo] || 'Políticas Legais'}</Text>
        <View style={{ width: 32 }} />
      </View>
      <WebView
        source={{ html: HTML_CONTENT }}
        style={{ flex: 1 }}
        startInLoadingState
        onLoadEnd={(e) => {
          if (tipo === 'privacidade') {
            e.target.injectJavaScript("showTab('privacidade', document.querySelectorAll('.tab')[1]); true;");
          } else if (tipo === 'cookies') {
            e.target.injectJavaScript("showTab('cookies', document.querySelectorAll('.tab')[2]); true;");
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },
});