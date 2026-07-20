import { ChatIntro } from "@/components/chat/chat-intro";
import { ChatPanel } from "@/components/chat/chat-panel";

/**
 * /chat — "Pregúntale a la dieta".
 * Dos caminos en el mismo input: lookups locales al instante (Camino A) y
 * preguntas abiertas a la IA grounded (Camino B). Ver `use-chat-thread.ts`.
 */
export default function ChatPage() {
  return (
    <>
      <ChatPanel />
      <ChatIntro />
    </>
  );
}
