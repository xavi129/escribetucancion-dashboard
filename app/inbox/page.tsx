import type { Metadata } from 'next'
import InboxView from '@/components/inbox/inbox-view'

export const metadata: Metadata = {
  title: 'WhatsApp Inbox',
  description: 'Gestión de conversaciones de WhatsApp',
}

export default function InboxPage() {
  return (
    <div className="min-h-screen w-full bg-black/95 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-green-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="h-[calc(100vh-4rem)] relative z-10">
        <InboxView />
      </div>
    </div>
  )
}
