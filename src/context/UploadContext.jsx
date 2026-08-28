import { createContext, useContext, useRef, useState } from 'react';

const UploadContext = createContext(null);

export function UploadProvider({ children }) {
  const [estado, setEstado] = useState(null);
  const cancelarRef = useRef(false);

  // Com media (imagem ou vídeo) — mostra banner com progresso
  const iniciar    = (tipo) => {
    cancelarRef.current = false;
    setEstado({ fase: 'upload', progresso: 0, tipo });
  };

  // Sem media (só texto) — não mostra banner, apenas publica silenciosamente
  const iniciarTexto = () => {
    cancelarRef.current = false;
    setEstado(null); // garante que não há estado residual
  };

  const atualizar  = (progresso) =>
    setEstado(prev => prev ? { ...prev, progresso } : prev);

  const publicando = () =>
    setEstado(prev => prev ? { ...prev, fase: 'publicando' } : prev);

  const concluir   = () => {
    setEstado(prev =>
      prev ? { fase: 'concluido', progresso: 100, tipo: prev.tipo } : null
    );
    setTimeout(() => setEstado(null), 4000);
  };

  const erro = () =>
    setEstado(prev => prev ? { ...prev, fase: 'erro' } : prev);

  const limpar = () => setEstado(null);

  return (
    <UploadContext.Provider value={{
      estado,
      iniciar,
      iniciarTexto,
      atualizar,
      publicando,
      concluir,
      erro,
      limpar,
      cancelarRef,
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export const useUpload = () => useContext(UploadContext);