import React, { useState, useEffect, useContext } from "react";
import { 
  Users, 
  Shield, 
  UserCircle, 
  Search, 
  Briefcase,
  ChevronRight,
  MoreVertical,
  Activity,
  UserPlus
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, where, doc, updateDoc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebase";
import { cn } from "@/lib/utils";
import { AuthContext } from "../../App";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AdminControl = () => {
  const { setImpersonatedUser } = useContext(AuthContext);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.currentUser) {
        navigate("/dashboard");
        return;
      }
      
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const role = userDoc.data()?.role;
      const isSuper = auth.currentUser.email === "apauloprod@gmail.com";
      
      if (role !== "admin" || !isSuper) {
        navigate("/dashboard");
      }
    };
    
    checkAdmin();
  }, [navigate]);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });
    return () => unsubscribe();
  }, []);

  const businessOwners = users.filter(u => u.role === 'admin');
  
  const getTeamMembers = (ownerId: string) => {
    // Team members have their owner's ID or businessId
    return users.filter(u => u.businessId === ownerId && u.id !== ownerId);
  };

  const handleImpersonate = (userItem: any) => {
    setImpersonatedUser({
      uid: userItem.id,
      role: userItem.role,
      businessId: userItem.businessId || userItem.id
    });
    navigate("/dashboard");
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        role: currentRole === 'admin' ? 'team' : 'admin',
        updatedAt: new Date()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
    }
  };

  const usersToShow = users.filter(u => 
    u.email !== "apauloprod@gmail.com" && (
      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tighter text-white flex items-center gap-3">
          <Shield className="h-8 w-8 text-cyan-500" />
          Super Admin Control
        </h1>
        <p className="text-muted-foreground mt-2">Platform-wide management of all users. Promote users to Business Owner (Admin) or demote to Team Role.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search all users..." 
          className="pl-10 bg-white/5 border-white/10 rounded-xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : usersToShow.length === 0 ? (
          <div className="glass p-12 rounded-[2rem] text-center border-white/5">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">No users found.</p>
          </div>
        ) : (
          usersToShow.map((userItem) => (
            <Card key={userItem.id} className="bg-black border-white/5 rounded-[2rem] overflow-hidden glass transition-all hover:border-white/10">
              <CardHeader className="border-b border-white/5 p-6 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-12 w-12 rounded-2xl border border-white/10 flex items-center justify-center transition-colors",
                      userItem.role === 'admin' 
                        ? "bg-gradient-to-br from-cyan-500/20 to-blue-500/10" 
                        : "bg-white/5"
                    )}>
                      {userItem.role === 'admin' ? (
                        <Briefcase className="h-6 w-6 text-cyan-400" />
                      ) : (
                        <UserCircle className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-bold tracking-tight text-white">
                          {userItem.displayName || userItem.email}
                        </CardTitle>
                        <Badge variant="outline" className={cn(
                          "text-[10px] h-4",
                          userItem.role === 'admin' ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-white/5 text-muted-foreground border-white/10"
                        )}>
                          {userItem.role === 'admin' ? 'Business Owner' : 'Team Member'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {userItem.email}
                        </span>
                        {userItem.businessName && (
                          <span className="text-xs text-cyan-400 flex items-center gap-1 font-medium">
                            <Activity className="h-3 w-3" />
                            {userItem.businessName}
                          </span>
                        )}
                        <Badge variant="outline" className="bg-white/5 text-[10px] h-4 opacity-50">UID: {userItem.id.slice(0, 8)}</Badge>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="hover:bg-white/5">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-black border-white/10">
                      <DropdownMenuItem onClick={() => handleImpersonate(userItem)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Impersonate User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleRole(userItem.id, userItem.role)}>
                        {userItem.role === 'admin' ? "Demote to Team Member" : "Promote to Business Owner"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              {userItem.role === 'admin' && (
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[300px]">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Managed Team</h4>
                        <Badge className="bg-white/10 text-white border-transparent">
                          {getTeamMembers(userItem.id).length} Linked
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {getTeamMembers(userItem.id).length === 0 ? (
                          <p className="col-span-full text-xs text-muted-foreground italic py-4">No team members linked to this business owner.</p>
                        ) : (
                          getTeamMembers(userItem.id).map(member => (
                            <div key={member.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-colors">
                              <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                <UserCircle className="h-4 w-4 text-white/50" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate text-white">{member.displayName || member.email}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminControl;
