import { useAtom } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BotIcon, UserIcon, MessageCircleIcon } from 'lucide-react';
import { chatMessagesAtom } from '@/lib/atoms';

export function ChatMessages() {
  const [messages] = useAtom(chatMessagesAtom);

  if (messages.length === 0) {
    return (
      <div className="relative flex h-full flex-col rounded-xl border bg-background/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircleIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Chat Messages</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground text-center">
            No messages yet.
            <br />
            Start a conversation to see messages here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col rounded-xl border bg-background/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircleIcon className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Chat Messages</h3>
        <Badge variant="secondary" className="text-xs">
          {messages.filter((m) => m.role !== 'system').length}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3 pr-2">
          {messages
            .filter((message) => message.role !== 'system')
            .map((message, index) => (
              <div
                key={index}
                className={cn(
                  'flex gap-3 p-3 rounded-lg text-sm',
                  message.role === 'user'
                    ? 'bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/30'
                    : 'bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/30',
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 rounded-full p-1.5',
                    message.role === 'user' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white',
                  )}
                >
                  {message.role === 'user' ? (
                    <UserIcon className="h-3 w-3" />
                  ) : (
                    <BotIcon className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'font-medium text-xs mb-1',
                      message.role === 'user'
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-blue-700 dark:text-blue-300',
                    )}
                  >
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </div>
                  <div
                    className={cn(
                      'text-sm leading-relaxed break-words',
                      message.role === 'user'
                        ? 'text-red-900 dark:text-red-100'
                        : 'text-blue-900 dark:text-blue-100',
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
