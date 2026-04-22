import React, { useState, useEffect, useContext } from "react";
import { 
  Plus, 
  ArrowUpRight,
  User as UserIcon,
  Mail,
  MapPin,
  Phone,
  Trash2,
  Share2,
  Check,
  Filter,
  ArrowUpDown,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, where, deleteDoc } from "firebase/firestore";
import { AuthContext } from "../../App";
import { useNavigate } from "react-router-dom";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RequestFormInternal } from "../../components/forms/RequestFormInternal";
import { QuoteForm } from "../../components/forms/QuoteForm";
import { updateDoc, doc, getDocs, query as firestoreQuery, addDoc, serverTimestamp } from "firebase/firestore";

import { formatPhoneNumber } from "../../lib/phone";

const Requests = () => {
  const { currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isManagerOrAdmin = role === 'admin' || role === 'manager';

  const ensureDate = (val: any) => {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const permissions = impersonatedUser?.permissions || currentUserData?.permissions || {};
  const hasAccess = isManagerOrAdmin || permissions.page_requests;

  useEffect(() => {
    if (!hasAccess) {
      navigate("/dashboard");
    }
  }, [hasAccess, navigate]);

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [convertingRequest, setConvertingRequest] = useState<any>(null);
  const [requestToDelete, setRequestToDelete] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [copied, setCopied] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const copyPublicLink = () => {
    const bizId = impersonatedUser?.businessId || currentUserData?.businessId;
    if (!bizId) return;
    const url = `${window.location.origin}/#/request?biz=${bizId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!isManagerOrAdmin) {
      alert("You do not have permission to delete requests.");
      return;
    }
    if (!confirm("Are you sure you want to delete this request?")) return;
    try {
      await deleteDoc(doc(db, "requests", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "requests");
    }
  };

  useEffect(() => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const q = query(
      collection(db, "requests"), 
      where("businessId", "==", businessId),
      orderBy(sortBy, sortOrder)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "requests");
    });
    return () => unsubscribe();
  }, [currentUserData?.businessId, impersonatedUser?.businessId, sortBy, sortOrder]);

  const [isConverting, setIsConverting] = useState<string | null>(null);

  const handleConvertToQuote = async (request: any) => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    setIsConverting(request.id);
    try {
      // 1. Try to find existing client by email
      const clientsRef = collection(db, "clients");
      const q = firestoreQuery(
        clientsRef, 
        where("email", "==", request.email),
        where("businessId", "==", businessId)
      );
      const snapshot = await getDocs(q);
      
      let clientId = "";
      if (!snapshot.empty) {
        clientId = snapshot.docs[0].id;
      } else {
        // 2. Create new client if not found
        const newClientRef = await addDoc(collection(db, "clients"), {
          businessId,
          name: request.name,
          email: request.email,
          phone: request.phone,
          address: request.address,
          status: "potential", // New clients from requests are potential
          createdAt: serverTimestamp(),
        });
        clientId = newClientRef.id;
      }

      // 3. Prepare quote data
      const quoteData = {
        clientId,
        name: request.name,
        email: request.email,
        phone: request.phone,
        address: request.address,
        city: request.city || "",
        state: request.state || "",
        zip: request.zip || "",
        items: (request.items || []).map((item: any) => ({ 
          description: item.description, 
          price: item.price || 0,
        })),
        notes: request.notes || "",
        requestId: request.id,
      };

      // Add a small delay to allow the edit dialog to close if it was open
      setTimeout(() => {
        setConvertingRequest(quoteData);
      }, 100);
    } catch (error) {
      console.error("Conversion error:", error);
      handleFirestoreError(error, OperationType.CREATE, "quotes");
    } finally {
      setIsConverting(null);
    }
  };

  const onQuoteCreated = async (quoteId: string) => {
    if (convertingRequest?.requestId) {
      const requestRef = doc(db, "requests", convertingRequest.requestId);
      await updateDoc(requestRef, { 
        status: "quoted",
        quoteId: quoteId
      });
    }
    setConvertingRequest(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Requests</h1>
          <p className="text-muted-foreground">Manage incoming quote requests from potential clients.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/5 p-1 border border-white/10 rounded-xl">
            <Button 
              className={`h-8 px-3 rounded-lg text-xs ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'bg-transparent text-muted-foreground hover:text-white'}`}
              onClick={() => setViewMode('grid')}
              variant="ghost"
            >
              Grid
            </Button>
            <Button 
              className={`h-8 px-3 rounded-lg text-xs ${viewMode === 'list' ? 'bg-white/10 text-white' : 'bg-transparent text-muted-foreground hover:text-white'}`}
              onClick={() => setViewMode('list')}
              variant="ghost"
            >
              List
            </Button>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 h-9">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent border-none text-[10px] font-bold uppercase tracking-wider focus:ring-0 cursor-pointer h-7"
            >
              <option value="createdAt" className="bg-black">Date</option>
              <option value="name" className="bg-black">Client Name</option>
              <option value="status" className="bg-black">Status</option>
            </select>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 ml-1" 
              onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
            >
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </div>
            <Button 
            variant="outline" 
            className="border-white/10 hover:bg-white/5 rounded-xl gap-2 font-bold h-9 text-xs"
            onClick={copyPublicLink}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
            {copied ? "Link" : "Copy Form Link"}
          </Button>
          {isManagerOrAdmin && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                  <Plus className="h-4 w-4" />
                  Add Request
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold tracking-tighter">Create New Request</DialogTitle>
                </DialogHeader>
                <div className="pt-4">
                  <RequestFormInternal 
                    onSuccess={() => setIsAddDialogOpen(false)} 
                    onCancel={() => setIsAddDialogOpen(false)} 
                  />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Edit Request</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editingRequest && (
              <RequestFormInternal 
                initialData={editingRequest}
                onSuccess={() => setEditingRequest(null)} 
                onCancel={() => setEditingRequest(null)} 
                onConvertToQuote={(req) => {
                  setEditingRequest(null);
                  handleConvertToQuote(req);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!convertingRequest} onOpenChange={(open) => !open && setConvertingRequest(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Convert Request to Quote</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {convertingRequest && (
              <QuoteForm 
                initialData={convertingRequest}
                onSuccess={onQuoteCreated} 
                onCancel={() => setConvertingRequest(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {loading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No requests found.</div>
        ) : (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {requests.map((req) => (
                 <div key={req.id} className="p-6 rounded-3xl glass border-white/5 hover:border-white/10 transition-all group relative overflow-hidden cursor-pointer" onClick={() => setEditingRequest(req)}>
                   <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                     {isManagerOrAdmin && (
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}>
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     )}
                   </div>
                   <div className="flex items-center gap-4 mb-6">
                     <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                       <UserIcon className="h-7 w-7 text-muted-foreground group-hover:text-white transition-colors" />
                     </div>
                     <div>
                       <h3 className="font-bold text-xl">{req.name}</h3>
                       <p className="text-sm text-muted-foreground">{ensureDate(req.createdAt)?.toLocaleDateString()}</p>
                     </div>
                   </div>
                   <div className="space-y-3 mb-6">
                     <div className="flex items-center gap-3 text-sm text-muted-foreground">
                       <Mail className="h-4 w-4 shrink-0" />
                       <span className="truncate">{req.email}</span>
                     </div>
                     {req.phone && (
                       <div className="flex items-center gap-3 text-sm text-muted-foreground">
                         <Phone className="h-4 w-4 shrink-0" />
                         <span>{formatPhoneNumber(req.phone)}</span>
                       </div>
                     )}
                     <div className="flex items-center gap-3 text-sm text-muted-foreground">
                       <MapPin className="h-4 w-4 shrink-0 text-cyan-400" />
                       <span className="truncate">{[req.address, req.city, req.state, req.zip].filter(Boolean).join(", ")}</span>
                     </div>
                   </div>
                   <div className="flex items-center justify-between pt-6 border-t border-white/5">
                     <div className="flex gap-2">
                       <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase tracking-wider">{req.status}</Badge>
                     </div>
                     <div className="flex gap-2">
                        {req.status === 'pending' && (!isManagerOrAdmin ? null : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-white/10 hover:bg-white/5 text-xs h-8"
                            onClick={(e) => { e.stopPropagation(); handleConvertToQuote(req); }}
                            disabled={isConverting === req.id}
                          >
                            {isConverting === req.id ? "Converting..." : "Convert"}
                          </Button>
                        ))}
                     </div>
                   </div>
                 </div>
               ))}
            </div>
          ) : (
            <div className="glass rounded-3xl border-white/5 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-white/5 bg-white/5">
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Contact</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Location / Details</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {requests.map((req) => (
                       <tr key={req.id} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => setEditingRequest(req)}>
                         <td className="p-4">
                           <div className="font-bold">{req.name}</div>
                           <div className="text-xs text-muted-foreground">{ensureDate(req.createdAt)?.toLocaleDateString()}</div>
                         </td>
                         <td className="p-4">
                           <div className="text-sm">{req.email}</div>
                           {req.phone && <div className="text-xs text-muted-foreground">{formatPhoneNumber(req.phone)}</div>}
                         </td>
                         <td className="p-4 hidden md:table-cell">
                           <div className="text-sm truncate max-w-[200px]">{[req.address, req.city, req.state, req.zip].filter(Boolean).join(", ")}</div>
                           <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                             {req.items?.map((i: any) => i.description).join(", ") || "No services specified"}
                           </div>
                         </td>
                         <td className="p-4">
                           <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase tracking-wider">{req.status}</Badge>
                         </td>
                         <td className="p-4 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {req.status === 'pending' && impersonatedUser?.role !== 'team' && currentUserData?.role !== 'team' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="border-white/10 hover:bg-white/5 text-xs h-8"
                                  onClick={(e) => { e.stopPropagation(); handleConvertToQuote(req); }}
                                  disabled={isConverting === req.id}
                                >
                                  {isConverting === req.id ? "Converting..." : "Convert Quote"}
                                </Button>
                              )}
                              {isManagerOrAdmin && (
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDelete(req.id); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Requests;
