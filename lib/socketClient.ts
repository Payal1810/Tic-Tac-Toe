"use client"
import {io} from "socket.io-client" 
export const socket = io(process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3000');