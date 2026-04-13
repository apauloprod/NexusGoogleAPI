import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Users,
  ArrowUpRight,
  Mail,
  Phone,
  MapPin,
  Search,
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "clients");
    });
    return () => unsubscribe();
  }, []);

  const filteredClients = clients.filter(client => 
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Clients</h1>
          <p className="text-muted-foreground">Manage your customer database and communication history.</p>
        </div>
        <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Search by name or email..." 
          className="pl-12 bg-white/5 border-white/10 rounded-2xl h-14 text-lg focus:ring-white/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full h-32 flex items-center justify-center text-muted-foreground">Loading clients...</div>
        ) : filteredClients.length === 0 ? (
          <div className="col-span-full h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No clients found.</div>
        ) : (
          filteredClients.map((client) => (
            <div key={client.id} className="p-6 rounded-3xl glass border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                  <Users className="h-7 w-7 text-muted-foreground group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">{client.name}</h3>
                  <p className="text-sm text-muted-foreground">{client.company || 'Individual Client'}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{client.address}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-white/5">
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase">
                    {client.jobsCount || 0} Jobs
                  </Badge>
                  <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase">
                    Active
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1 hover:text-white">
                  View Details
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Clients;
