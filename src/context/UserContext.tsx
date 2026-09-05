import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, getDocs,
  onSnapshot, query, setDoc, where, writeBatch,
} from 'firebase/firestore';
import {
  ReactNode, createContext, useCallback,
  useContext, useEffect, useRef, useState,
} from 'react';
import { auth, db } from '../config/firebase';
import { traduzir } from '../i18n/translations';

export interface Perfil {
  nome: string;
  cargo: string;
  bio: string;
  empresa: string;
  cidade: string;
  area: string;
  fotoURL: string | null;
  capaURL?: string | null;
  telefone?: string;
  emailContacto?: string;
  emailCorporativo?: string;
  universidade?: string;
  escolaSecundaria?: string;
  curso?: string;
  cvUrl?: string | null;
  certUrls?: string[];
  perfilCompleto?: boolean;
  isEstudante?: boolean;
  detalhesAcademicos?: any;
  // ── Campos novos do profile.jsx ──
  dataNasc?: string;
  genero?: string;
  nacionalidade?: string;
  estadoCivil?: string;
  telPrincipal?: string;
  telAlternativo?: string;
  email?: string;
  provincia?: string;
  municipio?: string;
  endereco?: string;
  tituloProfissional?: string;
  resumo?: string;
  situacaoProf?: string;
  pretensaoSalarial?: string;
  disponibilidade?: string;
  formacoes?: any[];
  experiencias?: any[];
  certificacoes?: any[];
  competenciasTecnicas?: string[];
  competenciasPessoais?: string[];
  idiomas?: any[];
  uriBilhete?: string | null;
  uriCV?: string | null;
  uriCertificados?: string | null;
  uriCartaConducao?: string | null;
  uriPortefolio?: string | null;
  uriDiploma?: string | null;
  linkedin?: string;
  github?: string;
  behance?: string;
  website?: string;
  emailVerificado?: boolean;
  telVerificado?: boolean;
  tipoPerfil?: string;
  // Usados em sincronizarDadosGlobais() para marcar autorVerificado nos
  // posts/histórias — nomes legados, mantidos tal como já eram gravados.
  verificado?: boolean;
  isVerified?: boolean;
  // ── Idioma da app (código: 'pt' | 'en' | 'fr' | 'es') ──
  // Ver i18n/translations.js — usado para calcular `idioma` e `t()`
  // expostos por este contexto.
  idiomaPerfil?: string;
}

// ── Dados da Página da Empresa (users/{uid}/perfis/empresa) ──
// Espelha o que pagina-empresa.jsx grava. Campos opcionais para que o
// formulário completo (setor, NIF, sobre, contactos, redes, capa, logo,
// etc.) possa ser guardado progressivamente sem partir o tipo. Quem
// consumir perfilExibido/perfilEmpresa deve tratar fotoURL/logoURL nulo
// com um avatar de fallback (ex: iniciais do nome da empresa).
export interface PerfilEmpresa {
  nomeEmpresa: string;
  setor?: string;
  nif?: string;
  telefone?: string;
  email?: string;
  sobre?: string;
  logoURL?: string | null;
  capaURL?: string | null;
  endereco?: string;
  cidade?: string;
  website?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  horario?: string;
}

// ── Identidade activa, ao estilo "Páginas" do Facebook ──
// 'pessoal' = a conta do próprio utilizador/recrutador (o que já existia).
// 'empresa' = a Página da Empresa, quando o Recrutador troca para ela.
// A conta (uid/login) NUNCA muda — só muda que dados/identidade são usados
// para exibir o perfil e para assinar novas publicações.
export type ContextoAtivo = 'pessoal' | 'empresa';

export interface PerfilExibido {
  tipo: ContextoAtivo;
  nome: string;
  fotoURL: string | null;
  bio: string;
}

export interface DadosConta {
  estado: 'banida' | 'suspensa' | 'aviso' | 'verificacao' | 'revisao' | 'eliminada';
  motivo?: string;
  dataInicio?: string;
  dataFim?: string;
  referencia?: string;
  politicaUrl?: string;
  descricaoAdmin?: string;
}

interface UserContextType {
  user: User | null;
  perfil: Perfil;
  carregando: boolean;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  guardarPerfil: (dados: Partial<Perfil>) => Promise<void>;
  atualizarFoto: (fotoURL: string) => Promise<void>;
  estadoConta: DadosConta | null;
  setEstadoContaConfirmado: (dados: DadosConta | null) => void;
  iniciarListenerPerfil: (uid: string) => void;
  pararListenerPerfil: () => void;
  // ── Contexto activo (Pessoal / Página da Empresa) ──
  perfilEmpresa: PerfilEmpresa | null;
  contextoAtivo: ContextoAtivo;
  perfilExibido: PerfilExibido;
  trocarContexto: (contexto: ContextoAtivo) => Promise<boolean>;
  guardarPerfilEmpresa: (dados: Partial<PerfilEmpresa>) => Promise<void>;
  // ── Idioma / traduções ──
  // idioma: código actual ('pt'|'en'|'fr'|'es'), derivado de
  // perfil.idiomaPerfil (por omissão 'pt').
  // t: função de tradução já associada a esse idioma — usar como
  // t('alguma_chave') em qualquer ecrã que consuma useUser().
  idioma: string;
  t: (chave: string, ...args: any[]) => string;
}

const perfilInicial: Perfil = {
  nome: '', cargo: '', bio: '', empresa: '', cidade: '', area: '',
  fotoURL: null, capaURL: null, telefone: '', emailContacto: '',
  emailCorporativo: '', universidade: '', escolaSecundaria: '',
  curso: '', cvUrl: null, certUrls: [], perfilCompleto: false,
  isEstudante: false, detalhesAcademicos: null,
  dataNasc: '', genero: '', nacionalidade: '', estadoCivil: '',
  telPrincipal: '', telAlternativo: '', email: '', provincia: '',
  municipio: '', endereco: '', tituloProfissional: '', resumo: '',
  situacaoProf: '', pretensaoSalarial: '', disponibilidade: '',
  formacoes: [], experiencias: [], certificacoes: [],
  competenciasTecnicas: [], competenciasPessoais: [], idiomas: [],
  uriBilhete: null, uriCV: null, uriCertificados: null,
  uriCartaConducao: null, uriPortefolio: null, uriDiploma: null,
  linkedin: '', github: '', behance: '', website: '',
  emailVerificado: false, telVerificado: false, tipoPerfil: '',
  idiomaPerfil: 'pt',
};

const perfilExibidoInicial: PerfilExibido = {
  tipo: 'pessoal', nome: '', fotoURL: null, bio: '',
};

const UserContext = createContext<UserContextType>({
  user: null, perfil: perfilInicial, carregando: true,
  isEditing: false,
  setIsEditing: () => {},
  guardarPerfil: async () => {},
  atualizarFoto: async () => {},
  estadoConta: null,
  setEstadoContaConfirmado: () => {},
  iniciarListenerPerfil: () => {},
  pararListenerPerfil: () => {},
  perfilEmpresa: null,
  contextoAtivo: 'pessoal',
  perfilExibido: perfilExibidoInicial,
  trocarContexto: async () => false,
  guardarPerfilEmpresa: async () => {},
  idioma: 'pt',
  t: (chave: string) => chave,
});

export function interpretarEstadoConta(dados: any): DadosConta | null {
  const ce = dados?.contaEstado;
  if (ce?.estado && ce.estado !== 'ativa') {
    if (ce.estado === 'suspensa' && ce.dataFim) {
      if (new Date(ce.dataFim) <= new Date()) return null;
    }
    return {
      estado:         ce.estado,
      motivo:         ce.motivo         || undefined,
      dataInicio:     ce.dataInicio     || undefined,
      dataFim:        ce.dataFim        || undefined,
      referencia:     ce.referencia     || undefined,
      politicaUrl:    ce.politicaUrl    || undefined,
      descricaoAdmin: ce.descricaoAdmin || undefined,
    };
  }

  const statusStr = (
    dados?.accountStatus || dados?.status || dados?.userStatus || 'activo'
  ).toLowerCase();

  const activosStr = ['activo', 'ativo', 'active', 'normal', ''];
  if (activosStr.includes(statusStr)) return null;

  const isBanido   = ['banned', 'banido', 'blocked'].includes(statusStr) || dados?.banido === true;
  const isSuspenso = ['suspended', 'suspenso'].includes(statusStr) || dados?.bloqueado === true;

  if (isBanido) {
    return {
      estado: 'banida',
      motivo: dados?.statusMotivo || dados?.banReason || 'Conta banida por violação dos termos.',
      referencia: dados?.referencia || undefined,
    };
  }

  if (isSuspenso) {
    const expira = dados?.suspensaoExpira;
    if (expira) {
      const dataExpira = expira?.toDate ? expira.toDate() : new Date(expira);
      if (!isNaN(dataExpira.getTime()) && dataExpira <= new Date()) return null;
    }
    return {
      estado: 'suspensa',
      motivo: dados?.statusMotivo || dados?.suspensionReason || 'Conta suspensa temporariamente.',
      dataFim: expira
        ? (expira?.toDate ? expira.toDate().toISOString() : String(expira))
        : undefined,
    };
  }

  return null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [perfil, setPerfil]           = useState<Perfil>(perfilInicial);
  const [carregando, setCarregando]   = useState(true);
  const [isEditing, setIsEditing]     = useState(false);
  const [estadoConta, setEstadoConta] = useState<DadosConta | null>(null);

  // ── Contexto activo (Pessoal / Página da Empresa) ──
  const [perfilEmpresa, setPerfilEmpresa]   = useState<PerfilEmpresa | null>(null);
  const [contextoAtivo, setContextoAtivo]   = useState<ContextoAtivo>('pessoal');

  const unsubPerfilRef  = useRef<(() => void) | null>(null);
  const listenerUidRef  = useRef<string | null>(null);
  const unsubEmpresaRef = useRef<(() => void) | null>(null);
  const empresaUidRef   = useRef<string | null>(null);

  const pararListenerPerfil = useCallback(() => {
    if (unsubPerfilRef.current) {
      unsubPerfilRef.current();
      unsubPerfilRef.current = null;
    }
    listenerUidRef.current = null;
  }, []);

  const pararListenerEmpresa = useCallback(() => {
    if (unsubEmpresaRef.current) {
      unsubEmpresaRef.current();
      unsubEmpresaRef.current = null;
    }
    empresaUidRef.current = null;
  }, []);

  const setEstadoContaConfirmado = useCallback((dados: DadosConta | null) => {
    setEstadoConta(dados);
    if (dados !== null) {
      setCarregando(false);
    }
  }, []);

  const iniciarListenerPerfil = useCallback((uid: string) => {
    if (listenerUidRef.current === uid && unsubPerfilRef.current) return;
    pararListenerPerfil();
    listenerUidRef.current = uid;

    AsyncStorage.getItem(`perfil_${uid}`).then(cache => {
      if (cache && listenerUidRef.current === uid) {
        try { setPerfil(JSON.parse(cache)); } catch (_) {}
      }
    }).catch(() => {});

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (listenerUidRef.current !== uid) return;

        if (!snap.exists()) {
          setCarregando(false);
          return;
        }

        const dados = snap.data();
        if (!dados) { setCarregando(false); return; }

        const novoEstado = interpretarEstadoConta(dados);
        setEstadoConta(novoEstado);

        // ── Perfil completo com TODOS os campos ──
        const p: Perfil = {
          // Campos originais
          nome:             dados.nome             || '',
          cargo:            dados.cargo            || dados.tituloProfissional || dados.area || '',
          bio:              dados.bio              || dados.resumo || '',
          empresa:          dados.empresa          || '',
          cidade:           dados.cidade           || dados.municipio || dados.provincia || '',
          area:             dados.area             || '',
          fotoURL:          dados.fotoURL          ?? null,
          capaURL:          dados.capaURL          ?? null,
          telefone:         dados.telefone         || dados.telPrincipal || '',
          emailContacto:    dados.emailContacto    || dados.emailCorporativo || dados.email || '',
          emailCorporativo: dados.emailCorporativo || dados.emailContacto || '',
          universidade:     dados.universidade     || '',
          escolaSecundaria: dados.escolaSecundaria || '',
          curso:            dados.curso            || '',
          cvUrl:            dados.cvUrl            || dados.uriCV || null,
          certUrls:         dados.certUrls         || [],
          perfilCompleto:   dados.perfilCompleto   || false,
          isEstudante:      dados.isEstudante      || false,
          detalhesAcademicos: dados.detalhesAcademicos || null,
          // ── Campos novos ──
          dataNasc:          dados.dataNasc          || '',
          genero:            dados.genero            || '',
          nacionalidade:     dados.nacionalidade     || '',
          estadoCivil:       dados.estadoCivil       || '',
          telPrincipal:      dados.telPrincipal      || dados.telefone || '',
          telAlternativo:    dados.telAlternativo    || '',
          email:             dados.email             || dados.emailContacto || '',
          provincia:         dados.provincia         || '',
          municipio:         dados.municipio         || '',
          endereco:          dados.endereco          || '',
          tituloProfissional: dados.tituloProfissional || dados.cargo || '',
          resumo:            dados.resumo            || dados.bio || '',
          situacaoProf:      dados.situacaoProf      || '',
          pretensaoSalarial: dados.pretensaoSalarial || '',
          disponibilidade:   dados.disponibilidade   || '',
          formacoes:         Array.isArray(dados.formacoes)            ? dados.formacoes            : [],
          experiencias:      Array.isArray(dados.experiencias)         ? dados.experiencias         : [],
          certificacoes:     Array.isArray(dados.certificacoes)        ? dados.certificacoes        : [],
          competenciasTecnicas: Array.isArray(dados.competenciasTecnicas) ? dados.competenciasTecnicas : [],
          competenciasPessoais: Array.isArray(dados.competenciasPessoais) ? dados.competenciasPessoais : [],
          idiomas:           Array.isArray(dados.idiomas)              ? dados.idiomas              : [],
          uriBilhete:        dados.uriBilhete        || null,
          uriCV:             dados.uriCV             || dados.cvUrl || null,
          uriCertificados:   dados.uriCertificados   || null,
          uriCartaConducao:  dados.uriCartaConducao  || null,
          uriPortefolio:     dados.uriPortefolio     || null,
          uriDiploma:        dados.uriDiploma        || null,
          linkedin:          dados.linkedin          || '',
          github:            dados.github            || '',
          behance:           dados.behance           || '',
          website:           dados.website           || '',
          emailVerificado:   dados.emailVerificado   || false,
          telVerificado:     dados.telVerificado     || false,
          tipoPerfil:        dados.tipoPerfil        || '',
          idiomaPerfil:      dados.idiomaPerfil      || 'pt',
        };

        setPerfil(p);
        AsyncStorage.setItem(`perfil_${uid}`, JSON.stringify(p)).catch(() => {});
        setCarregando(false);
      },
      (erro) => {
        console.log('Erro listener perfil:', erro.code || erro.message);
        setCarregando(false);
      }
    );

    unsubPerfilRef.current = unsub;
  }, [pararListenerPerfil]);

  // ── Ouve users/{uid}/perfis/empresa em tempo real. Se a Página da
  // Empresa for apagada/deixar de existir, força o contexto de volta a
  // 'pessoal' — nunca se fica "preso" a mostrar uma página que já não há.
  const iniciarListenerEmpresa = useCallback((uid: string) => {
    if (empresaUidRef.current === uid && unsubEmpresaRef.current) return;
    pararListenerEmpresa();
    empresaUidRef.current = uid;

    const unsub = onSnapshot(
      doc(db, 'users', uid, 'perfis', 'empresa'),
      (snap) => {
        if (empresaUidRef.current !== uid) return;
        if (snap.exists()) {
          setPerfilEmpresa(snap.data() as PerfilEmpresa);
        } else {
          setPerfilEmpresa(null);
          setContextoAtivo(prev => {
            if (prev === 'empresa') {
              AsyncStorage.setItem(`contexto_${uid}`, 'pessoal').catch(() => {});
              return 'pessoal';
            }
            return prev;
          });
        }
      },
      (erro) => console.log('Erro listener empresa:', erro.code || erro.message)
    );

    unsubEmpresaRef.current = unsub;
  }, [pararListenerEmpresa]);

  // ── Troca a identidade activa (Pessoal ⇄ Página da Empresa). A conta
  // (login/uid) mantém-se sempre a mesma — só muda que dados são usados
  // para mostrar o perfil e para assinar novas publicações, tal como nas
  // Páginas do Facebook. Não deixa trocar para 'empresa' se a página ainda
  // não existir. Devolve true/false para o ecrã que chamou poder avisar o
  // utilizador se a troca não foi possível.
  const trocarContexto = useCallback(async (contexto: ContextoAtivo): Promise<boolean> => {
    if (!user) return false;
    if (contexto === 'empresa' && !perfilEmpresa) return false;
    setContextoAtivo(contexto);
    try { await AsyncStorage.setItem(`contexto_${user.uid}`, contexto); } catch (_) {}
    return true;
  }, [user, perfilEmpresa]);

  // ── Dados prontos a exibir em qualquer ecrã (avatar, nome, bio),
  // conforme o contexto activo — sem cada ecrã ter de saber a diferença
  // entre "perfil" e "perfilEmpresa".
  const perfilExibido: PerfilExibido = contextoAtivo === 'empresa' && perfilEmpresa
    ? {
        tipo: 'empresa',
        nome: perfilEmpresa.nomeEmpresa || 'Página da Empresa',
        fotoURL: perfilEmpresa.logoURL ?? null,
        bio: perfilEmpresa.sobre || '',
      }
    : {
        tipo: 'pessoal',
        nome: perfil.nome || 'Utilizador',
        fotoURL: perfil.fotoURL ?? null,
        bio: perfil.bio || perfil.resumo || '',
      };

  // ── Idioma / traduções ──
  // Código actual, derivado de perfil.idiomaPerfil (guardado em
  // configuracoes.jsx). t() está pré-associado a este idioma, para que
  // qualquer ecrã só precise de chamar t('chave') sem se preocupar com
  // qual dicionário usar.
  const idioma = perfil?.idiomaPerfil || 'pt';
  const t = useCallback(
    (chave: string, ...args: any[]) => traduzir(idioma, chave, ...args),
    [idioma]
  );

  const sincronizarDadosGlobais = async (uid: string, dados: Partial<Perfil>) => {
    const camposPost: any = {};
    const camposChat: any = {};

    if (dados.nome)                  { camposPost.autorNome = dados.nome;    camposChat[`nomes.${uid}`] = dados.nome; }
    if (dados.fotoURL !== undefined) { camposPost.autorFoto = dados.fotoURL; camposChat[`fotos.${uid}`] = dados.fotoURL; }
    if (dados.cargo || dados.area)   camposPost.autorCargo  = dados.cargo || dados.area;
    if (dados.cidade)                camposPost.autorCidade = dados.cidade;
    if (dados.verificado !== undefined || dados.isVerified !== undefined) {
      camposPost.autorVerificado =
        dados.verificado === true || dados.isVerified === true;
    }

    if (!Object.keys(camposPost).length && !Object.keys(camposChat).length) return;

    try {
      const batch = writeBatch(db);
      const [snapPosts, snapStories, snapChats, snapNotifs] = await Promise.all([
        getDocs(query(collection(db, 'posts'),        where('uid', '==', uid))),
        getDocs(query(collection(db, 'stories'),      where('uid', '==', uid))),
        getDocs(query(collection(db, 'chats'),        where('users', 'array-contains', uid))),
        getDocs(query(collection(db, 'notificacoes'), where('senderId', '==', uid))),
      ]);

      const camposStory = { ...camposPost };
      delete camposStory.autorCidade;

      // ── Só sincroniza retroactivamente os posts/histórias assinados
      // como 'pessoal'; publicações já assinadas como 'empresa' mantêm os
      // dados da Página mesmo que o perfil pessoal mude depois.
      snapPosts.forEach(d   => { if ((d.data() as any).autorTipo !== 'empresa') batch.update(d.ref, camposPost); });
      snapStories.forEach(d => { if ((d.data() as any).autorTipo !== 'empresa') batch.update(d.ref, camposStory); });
      snapChats.forEach(d   => batch.update(d.ref, camposChat));

      const camposNotif: any = {};
      if (dados.fotoURL !== undefined) camposNotif.remetenteFoto = dados.fotoURL;
      if (Object.keys(camposNotif).length) snapNotifs.forEach(d => batch.update(d.ref, camposNotif));

      await batch.commit();
    } catch (err) {
      console.error('Erro sincronizar dados globais:', err);
    }
  };

  // ── Sincroniza retroactivamente as publicações já assinadas como
  // 'empresa' quando o nome/logotipo da Página muda — o mesmo princípio
  // do sincronizarDadosGlobais, mas para o lado da Página da Empresa.
  const sincronizarDadosEmpresa = async (uid: string, dados: Partial<PerfilEmpresa>) => {
    const camposPost: any = {};

    if (dados.nomeEmpresa !== undefined) camposPost.autorNome = dados.nomeEmpresa;
    if (dados.logoURL !== undefined)     camposPost.autorFoto = dados.logoURL;
    if (dados.capaURL !== undefined)     camposPost.autorCapa = dados.capaURL;
    if (dados.setor !== undefined)       camposPost.autorCargo = dados.setor;

    if (!Object.keys(camposPost).length) return;

    try {
      const batch = writeBatch(db);
      const snapPosts = await getDocs(
        query(
          collection(db, 'posts'),
          where('uid', '==', uid),
          where('autorTipo', '==', 'empresa'),
        )
      );
      snapPosts.forEach(d => batch.update(d.ref, camposPost));
      await batch.commit();
    } catch (err) {
      console.error('Erro sincronizar dados da empresa:', err);
    }
  };

  const guardarPerfil = async (dados: Partial<Perfil>) => {
    if (!user) return;
    const perfilActual = await new Promise<Perfil>(resolve => {
      setPerfil(prev => { const novo = { ...prev, ...dados }; resolve(novo); return novo; });
    });
    await AsyncStorage.setItem(`perfil_${user.uid}`, JSON.stringify(perfilActual));
    const dadosCloud: Record<string, any> = {};
    Object.entries(dados).forEach(([k, v]) => { if (typeof v !== 'function') dadosCloud[k] = v; });
    await setDoc(doc(db, 'users', user.uid), dadosCloud, { merge: true });
    await sincronizarDadosGlobais(user.uid, dados);
  };

  const atualizarFoto = async (fotoURL: string) => {
    if (!user) return;
    setPerfil(prev => {
      const novo = { ...prev, fotoURL };
      AsyncStorage.setItem(`perfil_${user.uid}`, JSON.stringify(novo)).catch(() => {});
      return novo;
    });
    await setDoc(doc(db, 'users', user.uid), { fotoURL }, { merge: true });
    await sincronizarDadosGlobais(user.uid, { fotoURL });
  };

  // ── Guarda/actualiza a Página da Empresa (users/{uid}/perfis/empresa).
  // Usa merge:true para nunca apagar campos que não estão a ser editados
  // naquele momento (ex.: guardar só o logotipo não apaga o "sobre").
  // O mesmo documento já é ouvido por iniciarListenerEmpresa, por isso o
  // onSnapshot confirma o estado a seguir — mas actualizamos o estado
  // local de imediato para feedback instantâneo no ecrã.
  const guardarPerfilEmpresa = async (dados: Partial<PerfilEmpresa>) => {
    if (!user) return;

    const dadosCloud: Record<string, any> = {};
    Object.entries(dados).forEach(([k, v]) => {
      if (typeof v !== 'function') dadosCloud[k] = v;
    });

    await setDoc(
      doc(db, 'users', user.uid, 'perfis', 'empresa'),
      dadosCloud,
      { merge: true }
    );

    setPerfilEmpresa(prev => ({
      ...(prev || { nomeEmpresa: dados.nomeEmpresa || '' }),
      ...dados,
    } as PerfilEmpresa));

    await sincronizarDadosEmpresa(user.uid, dados);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, firebaseUser => {
      pararListenerPerfil();
      pararListenerEmpresa();
      setEstadoConta(null);
      setPerfil(perfilInicial);
      setPerfilEmpresa(null);
      setContextoAtivo('pessoal');
      setUser(firebaseUser);

      if (!firebaseUser || firebaseUser.isAnonymous) {
        setCarregando(false);
      } else {
        setCarregando(true);
        iniciarListenerPerfil(firebaseUser.uid);
        iniciarListenerEmpresa(firebaseUser.uid);
        // Restaura a última identidade activa desta conta (Pessoal ou
        // Página da Empresa) guardada localmente. Se a página entretanto
        // deixou de existir, o listener de empresa acima corrige sozinho.
        AsyncStorage.getItem(`contexto_${firebaseUser.uid}`).then(valor => {
          if (valor === 'empresa') setContextoAtivo('empresa');
        }).catch(() => {});
      }
    });

    return () => {
      unsub();
      pararListenerPerfil();
      pararListenerEmpresa();
    };
  }, [pararListenerPerfil, pararListenerEmpresa, iniciarListenerPerfil, iniciarListenerEmpresa]);

  return (
    <UserContext.Provider value={{
      user, perfil, carregando, isEditing, setIsEditing,
      guardarPerfil, atualizarFoto,
      estadoConta,
      setEstadoContaConfirmado,
      iniciarListenerPerfil,
      pararListenerPerfil,
      perfilEmpresa,
      contextoAtivo,
      perfilExibido,
      trocarContexto,
      guardarPerfilEmpresa,
      idioma,
      t,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  return useContext(UserContext);
}