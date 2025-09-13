'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function page() {
const[roomId,setRoomId]=useState<string>()
const router = useRouter()

const handleJoinRoom = () => {
  if (roomId && roomId.trim()) {
    router.push(`/room/${roomId}`)
  }
}

  return (
    <div className='flex w-full max-w-3xl mx-auto flex-col items-center'>
        <h1 className='mb-4 text-2xl font-bold'>Join a Room</h1>
        <input type='text' placeholder='Enter Room ID ' onChange ={(e)=>setRoomId(e.target.value)}  value={roomId} 
        className='w-64 px-4 py-2 mb-4 border-2 rounded-lg'/>
        <button onClick ={handleJoinRoom} className="px py-2 text-white bg-blue-500 rounded-lg">
          Join Room
        </button>
    </div>
  )
}
