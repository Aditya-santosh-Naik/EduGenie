// Typed context variables set by requireAuth, so routes can read them safely.
import 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    uid: string;
    email: string | null;
    name: string | null;
    isGuest: boolean;
  }
}
