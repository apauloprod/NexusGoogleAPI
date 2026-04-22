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

  useEffect(() => {
    if (!isManagerOrAdmin) {
      navigate("/dashboard");
    }
  }, [isManagerOrAdmin, navigate]);

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [convertingRequest, setConvertingRequest] = useState<any>(null);
  const [requestToDelete, setRequestToDelete] = useState<any>(null);
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
          requests.map((req) => (
            <div key={req.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors group">
              <div className="flex items-center gap-6 cursor-pointer" onClick={() => setEditingRequest(req)}>
                <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">{req.name}</h3>
                    <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] uppercase tracking-wider">
                      {req.status}
                    </Badge>
                    {req.quoteId && (
                      <Badge 
                        variant="outline" 
                        className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] uppercase tracking-wider cursor-pointer hover:bg-emerald-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/quotes?search=${req.quoteId}`);
                        }}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        View Quote
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {req.email}</span>
                    {req.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhoneNumber(req.phone)}</span>}
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([req.address, req.city, req.state, req.zip].filter(Boolean).join(", "))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-3 w-3 text-cyan-400" /> 
                      {[req.address, req.city, req.state, req.zip].filter(Boolean).join(", ")}
                    </a>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-white max-w-[200px] truncate">
                    {req.items?.map((i: any) => i.description).join(", ") || "No services specified"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ensureDate(req.createdAt)?.toLocaleDateString()}
                  </p>
                </div>
                  <div className="flex items-center gap-2">
                    {req.status === 'pending' && impersonatedUser?.role !== 'team' && currentUserData?.role !== 'team' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-white/10 hover:bg-white/5 text-xs h-8"
                        onClick={() => handleConvertToQuote(req)}
                        disabled={isConverting === req.id}
                      >
                        {isConverting === req.id ? "Converting..." : "Convert to Quote"}
                      </Button>
                    )}
                    {isManagerOrAdmin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive" 
                        onClick={() => handleDelete(req.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white" onClick={() => setEditingRequest(req)}>
                      <ArrowUpRight className="h-5 w-5" />
                    </Button>
                  </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Requests;
