"use client"
import ChatForm from "@/components/Chat/ChatForm";
import ChatMessage from "@/components/Chat/ChatMessage";
import { useEffect, useState } from "react";
import {socket} from "@/lib/socketClient"
import { useParams } from "next/navigation";

export default function RoomPage() {
  const params = useParams<{ roomid: string }>();
  const roomId = params.roomid;

  const [messages,setMessage]=useState<{sender:string;message:string}[]>([])
  const [userName,setUserName]=useState("")
  const [isJoined, setIsJoined] = useState(false)

  useEffect(()=>{
    // Prompt for username if not set
    if (!userName) {
      const name = prompt("Enter your username:");
      if (name) {
        setUserName(name);
        setIsJoined(true);
        // Join the room
        socket.emit("join-room", { room: roomId, userName: name });
      }
    }

    socket.on("message",(data)=>{
      console.log(data);
      setMessage((prev)=>[...prev,data])
    })

    socket.on("user_joined",(message)=>{
      setMessage((prev)=>[...prev, {sender:"system",message}])
    })
    
    return()=>{
      socket.off("user_joined")
      socket.off("message")
    }
  },[roomId, userName])

    const handleSendMessage = (message: string) => {
        if (!userName) return;
        console.log(message);
        const data={roomId,message,sender:userName}
        socket.emit("message",data)
    }
  if (!isJoined) {
    return (
      <div className="flex mt-24 justify-center w-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Joining room {roomId}...</h2>
          <p>Please enter your username to join the chat.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col mt-24 justify-center w-full max-w-4xl mx-auto p-4">
      <div className="h-[500px] overflow-y-auto p-4 mb-4 border-2 rounded-lg bg-gray-200">
        {messages.map((msg,index)=>(
          <ChatMessage key={index} sender={msg.sender} message={msg.message} isOwnMessage ={msg.sender===userName}/>
        ))}
      </div>
      <ChatForm onSendMessage={handleSendMessage}/>
    </div>
  )
}