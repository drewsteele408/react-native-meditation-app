import { useAuthStore } from '../stores/authStore';

export const useUser = () => useAuthStore((state) => state.user);
export const useSession = () => useAuthStore((state) => state.session);
export const useAuthStatus = () => useAuthStore((state) => state.status);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useSignIn = () => useAuthStore((state) => state.signIn);
export const useSignUp = () => useAuthStore((state) => state.signUp);
export const useSignOut = () => useAuthStore((state) => state.signOut);
export const useSetSession = () => useAuthStore((state) => state.setSession);
