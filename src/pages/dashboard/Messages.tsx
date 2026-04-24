import React, { useState, useEffect, useContext } from "react";
import { 
  Plus, 
  MessageSquare,
  Search,
  Send,
  User as UserIcon,
  MoreVertical,
  Phone,
  Video,
  Mail,
  MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, Timestamp } from "firebase/firestore";
import { AuthContext } from "../../App";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const Messages = () => {
  const { user, currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isManagerOrAdmin = role === 'admin' || role === 'manager' || role === 'super-admin';
  const permissions = impersonatedUser?.permissions || currentUserData?.permissions || {};
  const hasAccess = isManagerOrAdmin || permissions.page_messages;

  useEffect(() => {
    if (!hasAccess && currentUserData) {
      navigate("/dashboard");
    }
  }, [hasAccess, navigate, currentUserData]);

  useEffect(() => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    // Fetch team members and clients as contacts within the same business
    const unsubUsers = onSnapshot(query(
      collection(db, "users"),
      where("businessId", "==", businessId)
    ), (snap) => {
      const users = snap.docs.map(d => ({ id: d.id, type: 'team', ...d.data() }));
      setContacts(prev => {
        const clients = prev.filter(c => c.type === 'client');
        // Filter out self
        const effectiveUid = impersonatedUser?.uid || user.uid;
        const team = users.filter(u => u.id !== effectiveUid);
        return [...team, ...clients];
      });
    });

    const unsubClients = onSnapshot(query(
      collection(db, "clients"),
      where("businessId", "==", businessId)
    ), (snap) => {
      const clients = snap.docs.map(d => ({ id: d.id, type: 'client', ...d.data() }));
      setContacts(prev => {
        const users = prev.filter(c => c.type === 'team');
        return [...users, ...clients];
      });
    });

    return () => {
      unsubUsers();
      unsubClients();
    };
  }, [user, currentUserData?.businessId, impersonatedUser?.businessId, impersonatedUser?.uid]);

  useEffect(() => {
    if (!activeChat || !user) return;

    const effectiveUid = impersonatedUser?.uid || user.uid;
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", [effectiveUid, activeChat.id].sort().join("_")),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [activeChat, user, impersonatedUser?.uid]);

  const handleSendMessage = async (type: 'chat' | 'email' | 'sms' = 'chat') => {
    if (!newMessage.trim() || !activeChat || !user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) {
      console.warn("Cannot send message: check context", { newMessage, activeChat, userId: user?.uid });
      return;
    }

    const businessId = impersonatedUser?.businessId || currentUserData.businessId;
    const effectiveUid = impersonatedUser?.uid || user.uid;
    const effectiveName = impersonatedUser?.displayName || user.displayName || user.email;

    try {
      console.log(`Attempting to send ${type} to ${activeChat.id}`);
      const conversationId = [effectiveUid, activeChat.id].sort().join("_");
      const docRef = await addDoc(collection(db, "messages"), {
        conversationId,
        businessId,
        senderId: effectiveUid,
        senderName: effectiveName,
        receiverId: activeChat.id,
        receiverName: activeChat.displayName || activeChat.name || activeChat.email,
        content: newMessage,
        type,
        createdAt: serverTimestamp()
      });
      console.log("Message sent successfully, ID:", docRef.id);

      // Mock API call feedback
      if (type === 'email') {
        console.log(`Sending email to ${activeChat.email}: ${newMessage}`);
      } else if (type === 'sms') {
        console.log(`Sending SMS to ${activeChat.phone}: ${newMessage}`);
      }

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      handleFirestoreError(error, OperationType.CREATE, "messages");
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.displayName || c.name || c.email)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const effectiveUid = impersonatedUser?.uid || user?.uid;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Contact List */}
      <div className="w-80 border-r border-white/5 flex flex-col bg-black/20">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-2xl font-bold tracking-tighter mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search contacts..." 
              className="pl-10 bg-white/5 border-white/10 rounded-xl h-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setActiveChat(contact)}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                  activeChat?.id === contact.id ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  {contact.photoURL ? (
                    <img src={contact.photoURL} className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm truncate">{contact.displayName || contact.name || contact.email}</span>
                    <Badge variant="outline" className="text-[8px] uppercase px-1">
                      {contact.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                </div>
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
                  {activeChat.photoURL ? (
                    <img src={activeChat.photoURL} className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold">{activeChat.displayName || activeChat.name || activeChat.email}</p>
                  <p className="text-[10px] text-emerald-500 font-medium">
                    {activeChat.phone || "No phone"} • {activeChat.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-white" 
                  title="Send Email"
                  onClick={() => handleSendMessage('email')}
                >
                  <Mail className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-white" 
                  title="Send SMS"
                  onClick={() => handleSendMessage('sms')}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col gap-1 ${msg.senderId === effectiveUid ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className="flex items-center gap-2 px-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${msg.senderId === effectiveUid ? 'text-white/60' : 'text-muted-foreground'}`}>
                        {msg.senderId === effectiveUid ? 'You' : msg.senderName}
                      </span>
                      <span className="text-[9px] text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        {msg.createdAt?.toDate() ? format(msg.createdAt.toDate(), "MMM d, HH:mm") : "..."}
                      </span>
                    </div>
                    <div className={`flex gap-3 max-w-[85%] ${msg.senderId === effectiveUid ? 'flex-row-reverse' : ''}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        msg.senderId === effectiveUid 
                          ? 'bg-white border-white' 
                          : 'bg-white/5 border-white/10'
                      }`}>
                        <UserIcon className={`h-4 w-4 ${msg.senderId === effectiveUid ? 'text-black' : 'text-muted-foreground'}`} />
                      </div>
                      <div className={`p-4 rounded-2xl shadow-xl ${
                        msg.senderId === effectiveUid 
                          ? 'bg-white text-black rounded-tr-none' 
                          : 'bg-white/5 border border-white/10 rounded-tl-none backdrop-blur-sm'
                      }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                            msg.senderId === effectiveUid 
                              ? 'bg-black/5 text-black/40' 
                              : 'bg-white/10 text-white/40'
                          }`}>
                            {msg.type}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                        <p className={`text-[9px] mt-2 font-bold ${
                          msg.senderId === effectiveUid ? 'text-black/40' : 'text-muted-foreground'
                        }`}>
                          {msg.createdAt?.toDate() ? format(msg.createdAt.toDate(), "HH:mm") : "..."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-6 border-t border-white/5 bg-black/50 backdrop-blur-xl">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <Input 
                    placeholder="Type a message..." 
                    className="flex-1 bg-white/5 border-white/10 rounded-xl h-12 focus:ring-white/20"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage('chat')}
                  />
                  <Button 
                    onClick={() => handleSendMessage('chat')}
                    className="h-12 w-12 rounded-xl bg-white text-black hover:bg-white/90 shrink-0"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-[10px] h-7 bg-blue-500/10 text-blue-400 border-blue-500/20"
                    onClick={() => handleSendMessage('email')}
                  >
                    <Mail className="h-3 w-3 mr-1" /> Send as Email
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-[10px] h-7 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    onClick={() => handleSendMessage('sms')}
                  >
                    <MessageCircle className="h-3 w-3 mr-1" /> Send as SMS
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10" />
            </div>
            <p className="text-lg font-bold text-white">Select a contact to start messaging</p>
            <p className="text-sm">Communicate with your team and clients.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
