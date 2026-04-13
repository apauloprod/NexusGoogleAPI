import React, { useState, useEffect } from "react";
import { 
  Plus, 
  MessageSquare,
  Search,
  Send,
  User as UserIcon,
  MoreVertical,
  Phone,
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const Messages = () => {
  const [activeChat, setActiveChat] = useState<any>(null);

  const chats = [
    { id: 1, name: "John Doe", lastMessage: "When can you start the project?", time: "2m ago", unread: 2 },
    { id: 2, name: "Sarah Smith", lastMessage: "The quote looks good, let's proceed.", time: "1h ago", unread: 0 },
    { id: 3, name: "Mike Johnson", lastMessage: "Can we reschedule the visit?", time: "3h ago", unread: 0 },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Chat List */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-black/20">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-2xl font-bold tracking-tighter mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search chats..." className="pl-10 bg-white/5 border-white/10 rounded-xl h-10" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                  activeChat?.id === chat.id ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <UserIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{chat.name}</span>
                    <span className="text-[10px] text-muted-foreground">{chat.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>
                </div>
                {chat.unread > 0 && (
                  <div className="h-5 w-5 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center shrink-0">
                    {chat.unread}
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#050505]">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/50 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold">{activeChat.name}</p>
                  <p className="text-[10px] text-emerald-500 font-medium">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                <div className="flex justify-center">
                  <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase tracking-widest">
                    Today
                  </Badge>
                </div>
                <div className="flex gap-3 max-w-[80%]">
                  <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/10">
                    <p className="text-sm">Hello! I'm interested in the AI implementation service. When can you start the project?</p>
                    <p className="text-[10px] text-muted-foreground mt-2">09:41 AM</p>
                  </div>
                </div>
                <div className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
                  <div className="h-8 w-8 rounded-full bg-white border border-white flex items-center justify-center shrink-0">
                    <UserIcon className="h-4 w-4 text-black" />
                  </div>
                  <div className="p-4 rounded-2xl rounded-tr-none bg-white text-black">
                    <p className="text-sm font-medium">Hi John! We can start as early as next week. Would you like to schedule a consultation?</p>
                    <p className="text-[10px] text-black/60 mt-2">09:45 AM</p>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-6 border-t border-white/5 bg-black/50 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <Input 
                  placeholder="Type a message..." 
                  className="flex-1 bg-white/5 border-white/10 rounded-xl h-12 focus:ring-white/20"
                />
                <Button className="h-12 w-12 rounded-xl bg-white text-black hover:bg-white/90 shrink-0">
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10" />
            </div>
            <p className="text-lg font-bold text-white">Select a chat to start messaging</p>
            <p className="text-sm">Communicate with your clients in real-time.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
