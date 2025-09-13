import React from 'react'

interface ChatMessageProps {
  
    isOwnMessage: boolean;
    sender: string;
    message: string;
}

export default function ChatMessage({isOwnMessage,sender,message}:ChatMessageProps) {
  return (
    <div className={`flex ${ isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`} >
        <div className={`max-w-xs rounded-lg px-4 py-2 shadow 
        ${ isOwnMessage ? 'bg-blue-500 text-white' : 'bg-white text-gray-900'}`} >
            <p className='text-sm font-bold'>{sender}</p>
            <p>{message}</p>
        </div>
    </div>
  )
}
