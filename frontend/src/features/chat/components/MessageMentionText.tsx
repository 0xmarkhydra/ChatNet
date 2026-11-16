import { Fragment } from 'react'
import type { GroupMember } from '../types'
import { messageLinkHref, messageTextParts } from '../lib/messageClipboard'
import { splitMessageMentions } from '../utils/mentions'

type Props = { text: string; members: GroupMember[]; onProfile: (username: string) => void }

export default function MessageMentionText({ text, members, onProfile }: Props) {
  return <>{messageTextParts(text).flatMap((part, partIndex) => {
    if (part.kind === 'link') return [<a key={partIndex} className="message-inline-link" href={messageLinkHref(part.text)} target="_blank" rel="noopener noreferrer">{part.text}</a>]
    return splitMessageMentions(part.text, members).map((token, tokenIndex) =>
      token.username
        ? <button key={`${partIndex}:${tokenIndex}`} type="button" className="chat-message-inline-mention" onClick={event => { event.stopPropagation(); onProfile(token.username!) }}>{token.text}</button>
        : token.all
          ? <strong key={`${partIndex}:${tokenIndex}`} className="chat-message-inline-mention">{token.text}</strong>
          : <Fragment key={`${partIndex}:${tokenIndex}`}>{token.text}</Fragment>)
  })}</>
}
