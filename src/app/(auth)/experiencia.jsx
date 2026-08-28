import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Image, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';

export default function ExperienceScreen() {
  const router = useRouter();
  const { user, perfil, guardarPerfil } = useUser();
  const storage = getStorage();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Estados inicializados com o que já existe no perfil para sincronização completa
  const [cargo, setCargo] = useState(perfil?.cargo || '');
  const [empresa, setEmpresa] = useState(perfil?.empresa && perfil.empresa !== 'Desempregado' ? perfil.empresa : '');
  const [semExperiencia, setSemExperiencia] = useState(perfil?.empresa === 'Desempregado' || !perfil?.empresa);
  const [bio, setBio] = useState(perfil?.bio || ''); 
  
  // Estados para novos uploads locais (Uri temporária)
  const [novoCv, setNovoCv] = useState(null);
  const [novosCertificados, setNovosCertificados] = useState([]);
  const [aguardando, setAguardando] = useState(false);

  const nomeUtilizador = perfil?.nome ? perfil.nome.split(' ')[0] : 'Utilizador';
  const userId = user?.uid || perfil?.uid;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const uploadFile = async (file, path) => {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  const handlePickDocument = async (type) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ 
        type: 'application/pdf', 
        multiple: type === 'cert' 
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (type === 'cv') {
          setNovoCv(result.assets[0]);
        } else if (type === 'cert') {
          const novos = [...novosCertificados, ...result.assets];
          setNovosCertificados(novos.slice(0, 10));
        }
      }
    } catch (err) { 
      alert('Erro ao selecionar o ficheiro PDF.'); 
    }
  };

  const handleContinuar = async () => {
    // Validação obrigatória do Título Profissional (Cargo) em qualquer um dos estados
    if (!cargo.trim()) {
      alert('Por favor, introduza o seu Título Profissional ou Cargo.');
      return;
    }

    if (!semExperiencia && !empresa.trim()) {
      alert('Por favor, introduza a Empresa onde trabalhou.');
      return;
    }

    setAguardando(true);
    try {
      let cvUrlFinal = perfil?.cvUrl || null;
      let certUrlsFinais = perfil?.certUrls ? [...perfil.certUrls] : [];

      // 1. Upload do novo CV
      if (novoCv && novoCv.uri && userId) {
        cvUrlFinal = await uploadFile(novoCv, `cvs/${userId}/cv.pdf`);
      }
      
      // 2. Upload dos novos certificados
      if (novosCertificados.length > 0 && userId) {
        for (let i = 0; i < novosCertificados.length; i++) {
          if (novosCertificados[i].uri) {
            const idUnico = Date.now() + i;
            const url = await uploadFile(novosCertificados[i], `certificados/${userId}/cert_${idUnico}.pdf`);
            certUrlsFinais.push(url);
          }
        }
      }

      // 3. Salvamento unificado na Base de Dados global (Sincronização Imediata com o Perfil)
      await guardarPerfil({ 
        ...perfil, 
        cargo: cargo, // Agora salva SEMPRE o que ele digitar (Ex: Técnico de Instrumentação)
        empresa: semExperiencia ? 'Desempregado' : empresa, // Se não tem exp, fica como Desempregado para ativar o selo automático
        bio: bio, // Salva o resumo/biografia profissional digitado
        cvUrl: cvUrlFinal, 
        certUrls: certUrlsFinais, 
        perfilCompleto: true 
      });

      router.replace('/(main)/my-profile');
    } catch (err) { 
      console.error(err);
      alert('Erro ao salvar os dados. Tente novamente.'); 
    } finally { 
      setAguardando(false); 
    }
  };

  const removerNovoCertificado = (index) => {
    const filtrados = novosCertificados.filter((_, i) => i !== index);
    setNovosCertificados(filtrados);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.progressBarContainer}><View style={styles.progressBarActive} /></View>

      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.logoSection}>
              <Image source={require('../../../assets/logo2.png')} style={styles.brandLogo} resizeMode="contain" />
            </View>

            <Text style={styles.mainTitle}>
              {semExperiencia ? `${nomeUtilizador}, configure o seu perfil profissional` : `${nomeUtilizador}, qual é a sua experiência?`}
            </Text>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Não tenho experiência de trabalho</Text>
              <Switch value={semExperiencia} onValueChange={setSemExperiencia} />
            </View>

            {/* SE ESTIVER ATIVADO "SEM EXPERIÊNCIA" */}
            {semExperiencia ? (
              <View>
                <Text style={styles.fieldLabel}>Título Profissional *</Text>
                <TextInput 
                  style={styles.underlineInput} 
                  value={cargo} 
                  onChangeText={setCargo} 
                  placeholder="Ex: Técnico de Instrumentação" 
                  placeholderTextColor="#A0AEC0" 
                />
                
                <Text style={styles.fieldLabel}>Resumo Profissional (Biografia)</Text>
                <TextInput 
                  style={[styles.underlineInput, { height: 80, textAlignVertical: 'top' }]} 
                  multiline 
                  value={bio} 
                  onChangeText={setBio} 
                  placeholder="Ex: Técnico de Instrumentação recém-formado à procura de uma primeira oportunidade no mercado de trabalho..."
                  placeholderTextColor="#A0AEC0"
                />
              </View>
            ) : (
              /* SE TIVER EXPERIÊNCIA (EXIBE TODOS OS CAMPOS NORMAIS) */
              <View>
                <Text style={styles.fieldLabel}>Cargo Atual ou Último *</Text>
                <TextInput 
                  style={styles.underlineInput} 
                  value={cargo} 
                  onChangeText={setCargo} 
                  placeholder="Ex: Técnico de Instrumentação Sénior" 
                  placeholderTextColor="#A0AEC0" 
                />
                
                <Text style={styles.fieldLabel}>Empresa *</Text>
                <TextInput 
                  style={styles.underlineInput} 
                  value={empresa} 
                  onChangeText={setEmpresa} 
                  placeholder="Ex: Sonangol" 
                  placeholderTextColor="#A0AEC0" 
                />
                
                <Text style={styles.fieldLabel}>Resumo Profissional (Biografia)</Text>
                <TextInput 
                  style={[styles.underlineInput, { height: 80, textAlignVertical: 'top' }]} 
                  multiline 
                  value={bio} 
                  onChangeText={setBio} 
                  placeholder="Conte um pouco sobre as suas principais competências e histórico profissional..."
                  placeholderTextColor="#A0AEC0"
                />
              </View>
            )}

            {/* SECÇÃO DO CURRICULUM VITAE */}
            <Text style={styles.fieldLabel}>Curriculum Vitae (PDF)</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => handlePickDocument('cv')}>
              <Feather name="file-text" size={16} color="#1677F2" style={{ marginRight: 6 }} />
              <Text style={styles.uploadText}>
                {novoCv ? novoCv.name : (perfil?.cvUrl ? '✓ CV já associado (Toque para substituir)' : 'Selecionar arquivo PDF')}
              </Text>
            </TouchableOpacity>

            {/* SECÇÃO DOS CERTIFICADOS */}
            <Text style={styles.fieldLabel}>
              Certificados ({((perfil?.certUrls?.length || 0) + novosCertificados.length)}/10)
            </Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => handlePickDocument('cert')}>
              <Feather name="plus-circle" size={16} color="#1677F2" style={{ marginRight: 6 }} />
              <Text style={styles.uploadText}>Adicionar PDF Académico</Text>
            </TouchableOpacity>

            {perfil?.certUrls && perfil.certUrls.map((url, i) => (
              <Text key={`salvo-${i}`} style={[styles.fileName, { color: '#059669' }]}>
                ✓ Certificado {i + 1} salvo no seu perfil
              </Text>
            ))}

            {novosCertificados.map((c, i) => (
              <View key={`novo-${i}`} style={styles.fileRowSelected}>
                <Text style={styles.fileName}>• Ficheiro pendente: {c.name}</Text>
                <TouchableOpacity onPress={() => removerNovoCertificado(i)}>
                  <Feather name="trash-2" size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            
            <View style={{height: 50}} />
          </ScrollView>

          <View style={styles.footerNavigation}>
            <TouchableOpacity style={styles.circleBackButton} onPress={() => router.replace('/(auth)/profile')}>
              <Feather name="arrow-left" size={22} color="#1677F2" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.btnContinue} onPress={handleContinuar} disabled={aguardando}>
              {aguardando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnContinueText}>Guardar Perfil</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  progressBarContainer: { width: '100%', height: 4, backgroundColor: '#E2E8F0' },
  progressBarActive: { width: '85%', height: '100%', backgroundColor: '#1677F2' },
  scrollContainer: { padding: 28, paddingBottom: 100 },
  logoSection: { marginBottom: 28 },
  brandLogo: { width: 44, height: 44 },
  mainTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#1A202C' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#2D3748' },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase', color: '#1A202C', letterSpacing: 0.5 },
  underlineInput: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 20, paddingVertical: 10, fontSize: 15, color: '#2D3748' },
  footerNavigation: { flexDirection: 'row', justifyContent: 'space-between', padding: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFF' },
  btnContinue: { backgroundColor: '#1677F2', padding: 15, borderRadius: 25, width: 150, alignItems: 'center', justifyContent: 'center' },
  btnContinueText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  circleBackButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#1677F2', justifyContent: 'center', alignItems: 'center' },
  uploadBtn: { borderStyle: 'dashed', borderWidth: 1, borderColor: '#1677F2', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginVertical: 6, backgroundColor: '#F4F9FF' },
  uploadText: { color: '#1677F2', fontWeight: '600', fontSize: 14 },
  fileName: { fontSize: 13, color: '#4A5568', marginVertical: 2, flex: 1 },
  fileRowSelected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 4 }
});