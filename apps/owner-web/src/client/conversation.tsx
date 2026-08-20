import { displayBody } from './copy';
import { formatTime } from './format';
import type { ChatMessage } from './types';

type Props = {
  messages: ChatMessage[];
  mine: 'INBOUND' | 'OUTBOUND';
};

export function Conversation({ messages, mine }: Props) {
  return (
    <ol className="thread">
      {messages.map((message) => {
        const own = message.direction === mine;
        return (
          <li key={message.id} className={own ? 'bubble mine' : 'bubble theirs'}>
            <p>{displayBody(message.body)}</p>
            <time>{formatTime(message.createdAt)}</time>
          </li>
        );
      })}
    </ol>
  );
}
