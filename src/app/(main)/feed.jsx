import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const STORIES = [
  { id: '1', nome: 'A tua história', criar: true },
  { id: '2', nome: 'Ana F.', cor: '#1677F2', inicial: 'A' },
  { id: '3', nome: 'Carlos M.', cor: '#0D9488', inicial: 'C' },
  { id: '4', nome: 'Sofia L.', cor: '#7C3AED', inicial: 'S' },
  { id: '5', nome: 'Pedro N.', cor: '#EA580C', inicial: 'P' },
];

const OPORTUNIDADES = [
  { id: '1', titulo: 'Desenvolvedor React Native', empresa: 'TechAngola Lda', local: 'Luanda · Remoto', tipo: 'Tempo inteiro', cor: '#1677F2' },
  { id: '2', titulo: 'Gestora de Marketing Digital', empresa: 'ConnectBrands', local: 'Benguela', tipo: 'Contrato', cor: '#0D9488' },
];

const TIPO_CORES = { conquista: '#FBBC05', ideia: '#1677F2', oportunidade: '#0D9488', artigo: '#7C3AED' };

function tempoRelativo(timestamp) {
  if (!timestamp) return '';
  const agora = new Date();
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Math.floor((agora - data) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function FeedScreen() {
  const router = useRouter();
  const { user, perfil } = useUser();
  const [posts, setPosts] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(dados);
      setCarregando(false);
    }, (err) => {
      console.log('Erro posts:', err);
      setCarregando(false);
    });
    return unsub;
  }, []);

  const handleLike = async (post) => {
    if (!user) return;
    const ref = doc(db, 'posts', post.id);
    const jaDeuLike = post.likedBy?.includes(user.uid);
    try {
      await updateDoc(ref, {
        likes: jaDeuLike ? post.likes - 1 : post.likes + 1,
        likedBy: jaDeuLike ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (err) {
      console.log('Erro like:', err);
    }
  };

  const abrirComentarios = (post) => {
    router.push({
      pathname: '/(main)/post-comentarios',
      params: {
        postId: post.id,
        autorNome: post.autorNome || '',
        autorFoto: post.autorFoto || '',
        autorCargo: post.autorCargo || '',
        autorCidade: post.autorCidade || '',
        texto: post.texto || '',
        tipo: post.tipo || '',
        timestamp: post.timestamp?.toDate ? post.timestamp.toDate().getTime().toString() : '',
        likes: post.likes?.toString() || '0',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image source={require('../../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(main)/explore')}>
            <Ionicons name="search-outline" size={20} color="#1F1F1F" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(main)/chat')}>
            <Ionicons name="chatbubble-outline" size={20} color="#1F1F1F" />
            <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(main)/notifications')}>
            <Ionicons name="notifications-outline" size={20} color="#1F1F1F" />
            <View style={styles.badge}><Text style={styles.badgeText}>5</Text></View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

        <View style={styles.publishCard}>
          <View style={styles.publishTop}>
            <View style={styles.publishAvatar}>
              {perfil.fotoURL ? (
                <Image source={{ uri: perfil.fotoURL }} style={styles.publishAvatarImage} />
              ) : (
                <Ionicons name="person" size={18} color="#fff" />
              )}
            </View>
            <TouchableOpacity style={styles.publishInput} activeOpacity={0.7}
              onPress={() => router.push('/(main)/create-post')}>
              <Text style={styles.publishPlaceholder}>Partilha uma conquista, ideia ou oportunidade...</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.publishDivider} />
          <View style={styles.publishActions}>
            <TouchableOpacity style={styles.publishAction} onPress={() => router.push('/(main)/create-post')}>
              <Ionicons name="image-outline" size={18} color="#1677F2" />
              <Text style={styles.publishActionText}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.publishAction} onPress={() => router.push('/(main)/create-post')}>
              <Ionicons name="briefcase-outline" size={18} color="#0D9488" />
              <Text style={styles.publishActionText}>Oportunidade</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.publishAction} onPress={() => router.push('/(main)/create-post')}>
              <Ionicons name="newspaper-outline" size={18} color="#7C3AED" />
              <Text style={styles.publishActionText}>Artigo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Actualizações</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 4 }}>
            {STORIES.map(story => (
              <TouchableOpacity key={story.id} style={styles.storyItem} activeOpacity={0.8}>
                {story.criar ? (
                  <View style={styles.storyCreateRing}>
                    {perfil.fotoURL ? (
                      <Image source={{ uri: perfil.fotoURL }} style={styles.storyCreateImage} />
                    ) : (
                      <Ionicons name="person" size={22} color="#ABABAB" />
                    )}
                    <View style={styles.storyPlus}>
                      <Ionicons name="add" size={11} color="#fff" />
                    </View>
                  </View>
                ) : (
                  <View style={styles.storyRing}>
                    <View style={[styles.storyInner, { backgroundColor: story.cor }]}>
                      <Text style={styles.storyInitial}>{story.inicial}</Text>
                    </View>
                  </View>
                )}
                <Text style={styles.storyName} numberOfLines={1}>{story.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Oportunidades para ti</Text>
            <TouchableOpacity><Text style={styles.sectionLink}>Ver todas</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {OPORTUNIDADES.map(op => (
              <TouchableOpacity key={op.id} style={styles.opCard} activeOpacity={0.85}>
                <View style={[styles.opIcon, { backgroundColor: op.cor + '18' }]}>
                  <Ionicons name="briefcase" size={20} color={op.cor} />
                </View>
                <Text style={styles.opTitulo} numberOfLines={2}>{op.titulo}</Text>
                <Text style={styles.opEmpresa}>{op.empresa}</Text>
                <View style={styles.opMeta}>
                  <Ionicons name="location-outline" size={11} color="#6B6B6B" />
                  <Text style={styles.opMetaText}>{op.local}</Text>
                </View>
                <View style={[styles.opTipo, { backgroundColor: op.cor + '18' }]}>
                  <Text style={[styles.opTipoText, { color: op.cor }]}>{op.tipo}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Publicações recentes</Text>
          </View>

          {carregando ? (
            <ActivityIndicator color="#1677F2" style={{ marginTop: 20 }} />
          ) : posts.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="newspaper-outline" size={40} color="#ABABAB" />
              <Text style={styles.emptyText}>Ainda não há publicações.</Text>
              <Text style={styles.emptySubText}>Sê o primeiro a partilhar algo!</Text>
            </View>
          ) : (
            posts.map(post => {
              const jaDeuLike = post.likedBy?.includes(user?.uid);
              const cor = TIPO_CORES[post.tipo] || '#1677F2';
              return (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={[styles.postAvatar, { backgroundColor: cor }]}>
                      {post.autorFoto ? (
                        <Image source={{ uri: post.autorFoto }} style={styles.postAvatarImage} />
                      ) : (
                        <Text style={styles.postAvatarText}>{(post.autorNome || 'U')[0]}</Text>
                      )}
                    </View>
                    <View style={styles.postMeta}>
                      <Text style={styles.postAutor}>{post.autorNome}</Text>
                      <Text style={styles.postCargo} numberOfLines={1}>{post.autorCargo}</Text>
                      <View style={styles.postMetaRow}>
                        {post.autorCidade ? (
                          <>
                            <Ionicons name="location-outline" size={11} color="#ABABAB" />
                            <Text style={styles.postMetaText}>{post.autorCidade}</Text>
                            <Text style={styles.postMetaDot}>·</Text>
                          </>
                        ) : null}
                        <Text style={styles.postMetaText}>{tempoRelativo(post.timestamp)}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.postMore}>
                      <Ionicons name="ellipsis-horizontal" size={18} color="#ABABAB" />
                    </TouchableOpacity>
                  </View>

                  {/* Clica no texto para ver comentários */}
                  <TouchableOpacity onPress={() => abrirComentarios(post)} activeOpacity={0.9}>
                    <Text style={styles.postTexto}>{post.texto}</Text>
                  </TouchableOpacity>

                  <View style={styles.postStatsRow}>
                    <View style={styles.postStatsLeft}>
                      <View style={[styles.postLikeCircle, { backgroundColor: cor }]}>
                        <Ionicons name="heart" size={9} color="#fff" />
                      </View>
                      <Text style={styles.postStatText}>{post.likes || 0} gostos</Text>
                    </View>
                    {/* Clica nos comentários para abrir */}
                    <TouchableOpacity onPress={() => abrirComentarios(post)}>
                      <Text style={styles.postStatText}>{post.comentarios || 0} comentários</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.postDivider} />

                  <View style={styles.postActions}>
                    <TouchableOpacity style={styles.postAction} onPress={() => handleLike(post)}>
                      <Ionicons name={jaDeuLike ? 'heart' : 'heart-outline'} size={17}
                        color={jaDeuLike ? '#EF4444' : '#6B6B6B'} />
                      <Text style={[styles.postActionText, jaDeuLike && { color: '#EF4444' }]}>Gosto</Text>
                    </TouchableOpacity>
                    {/* Botão comentar → abre ecrã de comentários */}
                    <TouchableOpacity style={styles.postAction} onPress={() => abrirComentarios(post)}>
                      <Ionicons name="chatbubble-outline" size={17} color="#6B6B6B" />
                      <Text style={styles.postActionText}>Comentar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postAction}>
                      <Ionicons name="share-social-outline" size={17} color="#6B6B6B" />
                      <Text style={styles.postActionText}>Partilhar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postAction}>
                      <Ionicons name="bookmark-outline" size={17} color="#6B6B6B" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  logo: { width: 170, height: 44 },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F7FA', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { fontSize: 8, color: '#fff', fontWeight: '800' },
  publishCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14,
    borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  publishTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  publishAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  publishAvatarImage: { width: 38, height: 38, borderRadius: 19 },
  publishInput: {
    flex: 1, backgroundColor: '#F5F7FA', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#EAEAEA',
  },
  publishPlaceholder: { fontSize: 13, color: '#ABABAB' },
  publishDivider: { height: 1, backgroundColor: '#F5F7FA' },
  publishActions: { flexDirection: 'row', paddingVertical: 4 },
  publishAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, gap: 6,
  },
  publishActionText: { fontSize: 12, fontWeight: '600', color: '#6B6B6B' },
  section: { marginTop: 16 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F1F1F' },
  sectionLink: { fontSize: 13, fontWeight: '600', color: '#1677F2' },
  storyItem: { alignItems: 'center', gap: 6, width: 60 },
  storyRing: { padding: 2.5, borderRadius: 30, borderWidth: 2, borderColor: '#1677F2' },
  storyInner: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  storyInitial: { color: '#fff', fontSize: 18, fontWeight: '800' },
  storyCreateRing: {
    width: 55, height: 55, borderRadius: 27.5,
    backgroundColor: '#F5F7FA', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#EAEAEA', borderStyle: 'dashed', overflow: 'hidden',
  },
  storyCreateImage: { width: 55, height: 55, borderRadius: 27.5 },
  storyPlus: {
    position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#1677F2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  storyName: { fontSize: 11, color: '#444', fontWeight: '500', textAlign: 'center' },
  opCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, width: 180, gap: 6,
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  opIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  opTitulo: { fontSize: 13, fontWeight: '700', color: '#1F1F1F', lineHeight: 18 },
  opEmpresa: { fontSize: 12, color: '#6B6B6B' },
  opMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  opMetaText: { fontSize: 11, color: '#6B6B6B' },
  opTipo: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  opTipoText: { fontSize: 11, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#6B6B6B' },
  emptySubText: { fontSize: 13, color: '#ABABAB' },
  postCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    overflow: 'hidden',
  },
  postHeader: { flexDirection: 'row', padding: 14, gap: 10 },
  postAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  postAvatarImage: { width: 44, height: 44, borderRadius: 22 },
  postAvatarText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  postMeta: { flex: 1, gap: 1 },
  postAutor: { fontSize: 14, fontWeight: '700', color: '#1F1F1F' },
  postCargo: { fontSize: 12, color: '#6B6B6B' },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  postMetaText: { fontSize: 11, color: '#ABABAB' },
  postMetaDot: { fontSize: 11, color: '#ABABAB' },
  postMore: { padding: 4 },
  postTexto: { fontSize: 14, color: '#1F1F1F', lineHeight: 21, paddingHorizontal: 14, paddingBottom: 12 },
  postStatsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10,
  },
  postStatsLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postLikeCircle: { width: 17, height: 17, borderRadius: 8.5, alignItems: 'center', justifyContent: 'center' },
  postStatText: { fontSize: 12, color: '#ABABAB' },
  postDivider: { height: 1, backgroundColor: '#F5F7FA', marginHorizontal: 14 },
  postActions: { flexDirection: 'row', paddingVertical: 2 },
  postAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, gap: 5,
  },
  postActionText: { fontSize: 12, fontWeight: '600', color: '#6B6B6B' },
});