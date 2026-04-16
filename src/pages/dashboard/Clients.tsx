import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Users,
  ArrowUpRight,
  Mail,
  Phone,
  MapPin,
  Search,
  MoreVertical,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClientForm } from "../../components/forms/ClientForm";

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clientToDelete, setClientToDelete] = useState<any>(null);

  const handleDelete = async () => {
    if (!clientToDelete) return;
    try {
      await deleteDoc(doc(db, "clients", clientToDelete.id));
      setClientToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "clients");
    }
  };

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] uppercase">Active</Badge>;
      case 'returning':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] uppercase">Returning</Badge>;
      case 'potential':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] uppercase">Potential</Badge>;
      default:
        return <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase">New</Badge>;
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Clients</h1>
          <p className="text-muted-foreground">Manage your customer database and communication history.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tighter">Add New Client</DialogTitle>
            </DialogHeader>
            <div className="pt-4">
              <ClientForm 
                onSuccess={() => setIsAddDialogOpen(false)} 
                onCancel={() => setIsAddDialogOpen(false)} 
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Edit Client</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editingClient && (
              <ClientForm 
                initialData={editingClient}
                onSuccess={() => setEditingClient(null)} 
                onCancel={() => setEditingClient(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

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
            <div 
              key={client.id} 
              className="p-6 rounded-3xl glass border-white/5 hover:border-white/10 transition-all group relative overflow-hidden cursor-pointer"
              onClick={() => setEditingClient(client)}
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClientToDelete(client);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
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
                  {getStatusBadge(client.status)}
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1 hover:text-white">
                  Edit Details
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[400px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter text-center">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            Are you sure you want to delete <strong>{clientToDelete?.name}</strong>? This will not delete their associated jobs or invoices.
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setClientToDelete(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1 rounded-xl font-bold" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
