import { ChatIntro } from "@/components/chat/chat-intro";
import { ChatPanel } from "@/components/chat/chat-panel";

/**
 * /chat — "Pregúntale a la dieta".
 * Un solo input, todo con código sobre el plan cargado y sin red (ADR-008):
 * «¿se puede?», «no tengo X», «no quiso X», «¿qué le doy ahora?», «¿cuánta agua?».
 * Ver `use-chat-thread.ts`.
 */
export default function ChatPage() {
  return (
    <>
      <ChatPanel />
      <ChatIntro />
    </>
  );
}
