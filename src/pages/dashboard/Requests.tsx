import React, { useState, useEffect, useContext } from "react";
import { 
  Plus, 
  ArrowUpRight,
  User as UserIcon,
  Mail,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
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

const Requests = () => {
  const { currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isManagerOrAdmin = role === 'admin' || role === 'manager';

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

  useEffect(() => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const q = query(
      collection(db, "requests"), 
      where("businessId", "==", businessId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "requests");
    });
    return () => unsubscribe();
  }, [currentUserData?.businessId, impersonatedUser?.businessId]);

  const handleConvertToQuote = async (request: any) => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

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
      items: (request.services || []).map((s: string) => ({ description: s, price: 0 })),
      notes: request.notes || "",
      requestId: request.id,
    };

    setConvertingRequest(quoteData);
  };

  const onQuoteCreated = async () => {
    if (convertingRequest?.requestId) {
      const requestRef = doc(db, "requests", convertingRequest.requestId);
      await updateDoc(requestRef, { status: "quoted" });
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
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {req.email}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {req.address}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-white">
                    {req.services?.join(", ") || "No services specified"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {req.createdAt?.toDate().toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {req.status === 'pending' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-white/10 hover:bg-white/5 text-xs h-8"
                      onClick={() => handleConvertToQuote(req)}
                    >
                      Convert to Quote
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
