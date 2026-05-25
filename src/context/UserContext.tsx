import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';

interface Perfil {
  nome: string;
  cargo: string;
  bio: string;
  empresa: string;
  cidade: string;
  area: string;
  fotoURL: string | null;
}

interface UserContextType {
  user: User | null;
  perfil: Perfil;
  carregando: boolean;
  guardarPerfil: (dados: Partial<Perfil>) => Promise<void>;
  atualizarFoto: (fotoURL: string) => Promise<void>;
}

const perfilInicial: Perfil = {
  nome: '',
  cargo: '',
  bio: '',
  empresa: '',
  cidade: '',
  area: '',
  fotoURL: null,
};

const UserContext = createContext<UserContextType>({
  user: null,
  perfil: perfilInicial,
  carregando: true,
  guardarPerfil: async () => {},
  atualizarFoto: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial);
  const [carregando, setCarregando] = useState(true);

  const carregarPerfil = async (uid: string) => {
    try {
      const cacheLocal = await AsyncStorage.getItem(`perfil_${uid}`);
      if (cacheLocal) {
        setPerfil(JSON.parse(cacheLocal));
      }
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const dados = snap.data();
        const perfilAtualizado: Perfil = {
          nome: dados.nome || '',
          cargo: dados.area || dados.cargo || '',
          bio: dados.bio || '',
          empresa: dados.empresa || '',
          cidade: dados.cidade || '',
          area: dados.area || '',
          fotoURL: dados.fotoURL || null,
        };
        setPerfil(perfilAtualizado);
        await AsyncStorage.setItem(`perfil_${uid}`, JSON.stringify(perfilAtualizado));
      }
    } catch (err) {
      console.log('Erro ao carregar perfil:', err);
    }
  };

  const guardarPerfil = async (dados: Partial<Perfil>) => {
    if (!user) return;
    try {
      // 1. Atualiza estado local IMEDIATAMENTE
      setPerfil(prev => {
        const novo = { ...prev, ...dados };
        // Guarda cache em background
        AsyncStorage.setItem(`perfil_${user.uid}`, JSON.stringify(novo)).catch(console.log);
        return novo;
      });
      // 2. Persiste no Firestore em background
      await setDoc(doc(db, 'users', user.uid), dados, { merge: true });
    } catch (err) {
      console.log('Erro ao guardar perfil:', err);
      throw err;
    }
  };

  // Atualiza foto — primeiro local, depois Firestore
  const atualizarFoto = async (fotoURL: string) => {
    if (!user) return;

    // 1. Atualiza estado local IMEDIATAMENTE (a UI atualiza já)
    setPerfil(prev => {
      const novo = { ...prev, fotoURL };
      AsyncStorage.setItem(`perfil_${user.uid}`, JSON.stringify(novo)).catch(console.log);
      return novo;
    });

    // 2. Persiste no Firestore (em background, não bloqueia a UI)
    try {
      await setDoc(doc(db, 'users', user.uid), { fotoURL }, { merge: true });
    } catch (err) {
      console.log('Erro ao guardar foto no Firestore:', err);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await carregarPerfil(firebaseUser.uid);
      } else {
        setPerfil(perfilInicial);
      }
      setCarregando(false);
    });
    return unsub;
  }, []);

  return (
    <UserContext.Provider value={{ user, perfil, carregando, guardarPerfil, atualizarFoto }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  return useContext(UserContext);
}