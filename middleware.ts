import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Rutas públicas que no requieren autenticación
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)', 
  '/api/webhook(.*)', // Webhooks de servicios externos (Suno, SendPulse, etc.)
  '/api/video/webhook(.*)', // Webhook de video de KIE.ai
  '/api(.*)' // Todas las rutas de API (puede requerir autenticación interna)
])

export default clerkMiddleware(async (auth, req) => {
  // Las rutas de webhook están excluidas del matcher, por lo que este middleware
  // nunca se ejecuta para ellas. Esto permite que los webhooks externos (Suno, SendPulse)
  // accedan sin autenticación.
  
  // Para otras rutas, aplicar protección según isPublicRoute
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and webhook routes
    '/((?!_next/static|_next/image|favicon.ico|api/webhook|api/video/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
};