"use client"
import React, { useState } from 'react'

const ChatForm = ({onSendMessage}: {onSendMessage: (message: string) => void}) => {
    const [message, setMessage] = useState("");
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
 if(message.trim()!=="") {
    console.log(message);
    onSendMessage(message);
    setMessage("");
 }
    }
  return (
   <form onSubmit={handleSubmit} className="flex gap-2 mt-4 w-full">
    <input
      type="text"
      value={message}
      className='flex-1 px-4 py-2 rounded-lg border focus:outline-none'
      onChange={(e) => setMessage(e.target.value)}
      placeholder="Type your message here..."
    />
    <button type='submit' className=' text-white px-4 py-2 rounded-lg bg-blue-500'>Send</button>
   </form>
  )
}

export default ChatForm