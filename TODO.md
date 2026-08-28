# TODO.md

- [x] profile.jsx: adicionar import `createUserWithEmailAndPassword`
- [x] profile.jsx: substituir função `submeter` conforme especificação (criar Firebase user via `_registoPendente`, setDoc em `users`, upload foto, guardarPerfil, cleanup AsyncStorage, setPasso(11), tratamento de erros)
- [ ] profile-empresa.jsx: adicionar imports `AsyncStorage` e `createUserWithEmailAndPassword`
- [ ] profile-empresa.jsx: ajustar início de `submeter` para criar Firebase user se não existir (`auth.currentUser?.uid`); setDoc em `users/{uid}`
- [ ] profile-empresa.jsx: antes de `setPasso(99)` remover `_registoPendente`

- [ ] profile-recrutador.jsx: adicionar imports `AsyncStorage` e `createUserWithEmailAndPassword`
- [ ] profile-recrutador.jsx: ajustar início de `submeter` para criar Firebase user se não existir; setDoc em `users/{uid}`
- [ ] profile-recrutador.jsx: antes de `setPasso(5)` remover `_registoPendente`
- [ ] Executar build/lint/test (cmd relevante do projeto)
