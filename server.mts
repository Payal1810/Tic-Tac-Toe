import {createServer} from "node:http"
import next from "next"
import {Server} from "socket.io";

const dev= process.env.NODE_ENV !== "production"
const hostname=process.env.HOSTNAME || "localhost";
const port=parseInt(process.env.PORT || "3000",10)
const app=next({dev,hostname,port});
const handle=app.getRequestHandler();
app.prepare().then(()=>{
    const httpServer=createServer(handle);
    const io=new Server(httpServer)
    io.on("connection",(socket)=>{
        console.log(`User connected :${socket.id} `)
        socket.on("join-room",({room,userName})=>{
            socket.join(room)
            console.log(`User ${userName} joined room ${room}`)
            socket.to(room).emit('user_joined',
                `${userName} joined room`
            )
        })
        socket.on("message",({roomId,message,sender})=>{
            // relay to everyone in the room including the sender
            io.to(roomId).emit("message", { sender, message })
        })
        socket.on("disconnect",()=>{
            console.log(`User disconnected : ${socket.id}`)
        })  
    })
 
    httpServer.listen(port,()=>{
        console.log(`Server running on http://${hostname}:${port}`)
    })
})