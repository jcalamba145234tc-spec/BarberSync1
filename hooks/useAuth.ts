/**
 * Thin hook wrapper around AuthContext so screens don't import the context
 * directly. Throws early if used outside AuthProvider, which catches a
 * missing provider during development instead of a confusing runtime crash.
 */
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
