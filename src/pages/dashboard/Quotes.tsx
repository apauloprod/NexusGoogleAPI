import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Plus, 
  FileText,
  ArrowUpRight,
  User as UserIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Briefcase,
  Search,
  Filter,
  Download, 
  Edit2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, getDocs, where, getDoc, limit, Timestamp } from "firebase/firestore";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QuoteForm } from "../../components/forms/QuoteForm";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";



import { AuthContext } from "../../App";
import { useContext } from "react";



const Quotes = () => {
  const { user, currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isManagerOrAdmin = role === 'admin' || role === 'manager';

  useEffect(() => {
    if (!isManagerOrAdmin) {
      navigate("/dashboard");
    }
  }, [isManagerOrAdmin, navigate]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const search = searchParams.get("search");
    if (search) {
      setSearchTerm(search);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user || (!currentUserData?.businessId && !impersonatedUser?.businessId)) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const q = query(
      collection(db, "quotes"), 
      where("businessId", "==", businessId),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuotes(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "quotes");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentUserData?.businessId, impersonatedUser?.businessId]);

  const sendQuoteEmail = async (quote: any) => {
    setIsSending(quote.id);
    try {
      const clientDoc = await getDoc(doc(db, "clients", quote.clientId));
      const clientData = clientDoc.exists() ? clientDoc.data() : null;

      if (!clientData?.email) {
        alert("Client has no email address.");
        return;
      }

      const response = await fetch(`/api/send-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote: { id: quote.id, ...quote },
          clientEmail: clientData.email,
          appUrl: window.location.origin,
        }),
      });

      if (response.ok) {
        alert("Quote sent successfully!");
      } else {
        alert("Failed to send quote.");
      }
    } catch (error) {
      console.error("Error sending quote:", error);
      alert("Error sending quote.");
    } finally {
      setIsSending(null);
    }
  };

  const [businessSettings, setBusinessSettings] = useState<any>(null);

  useEffect(() => {
    const fetchBusinessSettings = async () => {
      if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
      const businessId = impersonatedUser?.businessId || currentUserData.businessId;
      const snap = await getDoc(doc(db, "users", businessId));
      if (snap.exists()) {
        setBusinessSettings(snap.data());
      }
    };
    fetchBusinessSettings();
  }, [currentUserData?.businessId, impersonatedUser?.businessId]);

  const downloadQuote = (quote: any) => {
    const doc = new jsPDF();
    
    // Use quote's stored business info or fall back to current settings
    const bName = quote.businessName || businessSettings?.businessName || "Your Company";
    const bLogo = quote.businessLogo || businessSettings?.businessLogo;
    const bDetails = quote.businessDetails || (businessSettings?.address 
      ? `${businessSettings.address.street}\n${businessSettings.address.city}, ${businessSettings.address.postcode}`
      : businessSettings?.businessDetails);

    // Add Logo if exists
    if (bLogo) {
      try {
        doc.addImage(bLogo, 'PNG', 20, 10, 30, 30);
      } catch (e) {
        console.error("Error adding logo to PDF:", e);
      }
    }

    doc.setFontSize(22);
    doc.text("SERVICE QUOTE", 200, 20, { align: "right" });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(bName, 20, 45);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (bDetails) {
      const detailsLines = doc.splitTextToSize(bDetails, 80);
      doc.text(detailsLines, 20, 52);
    }

    doc.setFontSize(12);
    doc.text(`Quote Number: ${quote.quoteNumber}`, 200, 45, { align: "right" });
    doc.text(`Date: ${quote.createdAt?.toDate().toLocaleDateString() || new Date().toLocaleDateString()}`, 200, 52, { align: "right" });
    
    doc.setDrawColor(200);
    doc.line(20, 80, 200, 80);

    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, 90);
    doc.setFont("helvetica", "normal");
    doc.text(quote.clientName, 20, 97);
    
    const tableData = (quote.items || []).map((item: any) => [
      item.description,
      `$${(item.price || item.unitPrice || 0).toLocaleString()}`
    ]);
    
    autoTable(doc, {
      startY: 110,
      head: [['Description', 'Price']],
      body: tableData,
      foot: [['Total', `$${(quote.total || quote.totalTTC || 0).toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0] },
    });
    
    if (quote.notes) {
      const finalY = (doc as any).lastAutoTable?.finalY || 110;
      doc.text("Notes:", 20, finalY + 20);
      doc.setFontSize(10);
      doc.text(quote.notes, 20, finalY + 28, { maxWidth: 170 });
    }

    doc.save(`Quote_${quote.quoteNumber}.pdf`);
  };

  const convertToJob = async (quote: any) => {
    try {
      const businessId = impersonatedUser?.businessId || currentUserData.businessId;
      
      const clientDoc = await getDoc(doc(db, "clients", quote.clientId));
      const clientData = clientDoc.exists() ? clientDoc.data() : null;
      const clientPhone = clientData?.phone || "";
      const clientAddress = clientData?.address ? 
        `${clientData.address.street}, ${clientData.address.city}, ${clientData.address.postcode}` 
        : "";

      await addDoc(collection(db, "jobs"), {
        title: `Job from Quote #${quote.quoteNumber}`,
        clientId: quote.clientId,
        clientName: quote.clientName,
        clientPhone,
        clientAddress,
        businessId,
        status: "active",
        notes: quote.notes || "",
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        scheduledAt: quote.scheduledAt ? Timestamp.fromDate(new Date(quote.scheduledAt)) : null,
        items: (quote.items || []).map((i: any) => ({
          description: i.description || "",
          price: i.price || i.unitPrice || 0
        })),
        total: quote.total || quote.totalTTC || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Update quote status
      const quoteRef = doc(db, "quotes", quote.id);
      await updateDoc(quoteRef, {
        status: "approved",
        updatedAt: serverTimestamp(),
      });

      // Update client status to active
      const clientRef = doc(db, "clients", quote.clientId);
      await updateDoc(clientRef, {
        status: "active",
        updatedAt: serverTimestamp(),
      });

      // Confirm associated visits
      const visitsRef = collection(db, "visits");
      const q = query(visitsRef, where("quoteId", "==", quote.id));
      const snapshot = await getDocs(q);
      
      const updatePromises = snapshot.docs.map(visitDoc => 
        updateDoc(doc(db, "visits", visitDoc.id), {
          status: "confirmed",
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(updatePromises);

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "jobs");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Approved</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Sent</Badge>;
      case 'declined':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Declined</Badge>;
      default:
        return <Badge variant="outline" className="bg-white/5 border-white/10">Draft</Badge>;
    }
  };

  const ensureDate = (val: any) => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          quote.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const dateA = ensureDate(a.scheduledAt)?.getTime() || Number.MAX_SAFE_INTEGER;
    const dateB = ensureDate(b.scheduledAt)?.getTime() || Number.MAX_SAFE_INTEGER;
    if (dateA !== dateB) return dateA - dateB;
    return (a.clientName || "").localeCompare(b.clientName || "");
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Quotes</h1>
          <p className="text-muted-foreground">Create and manage professional quotes for your clients.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
              <Plus className="h-4 w-4" />
              New Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tighter">Create New Quote</DialogTitle>
            </DialogHeader>
            <div className="pt-4">
              <QuoteForm 
                onSuccess={() => setIsAddDialogOpen(false)} 
                onCancel={() => setIsAddDialogOpen(false)} 
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by client name or quote number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white/5 border-white/10">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-black border-white/10">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={!!editingQuote} onOpenChange={(open) => !open && setEditingQuote(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Edit Quote</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editingQuote && (
              <QuoteForm 
                initialData={editingQuote}
                onSuccess={() => setEditingQuote(null)} 
                onCancel={() => setEditingQuote(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {loading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">Loading quotes...</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No quotes found matching your criteria.</div>
        ) : (
          filteredQuotes.map((quote) => (
            <div key={quote.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors group">
              <div className="flex items-center gap-6">
                <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">{quote.clientName}</h3>
                    {getStatusBadge(quote.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">#{quote.quoteNumber || quote.id.slice(0, 6)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> 
                      {quote.scheduledAt ? ensureDate(quote.scheduledAt)?.toLocaleString() : ensureDate(quote.createdAt)?.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-lg font-bold text-white">
                    ${quote.total?.toLocaleString() || "0.00"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {quote.items?.length || 0} items
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {quote.status !== 'approved' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs gap-1 hover:text-emerald-500"
                      onClick={() => convertToJob(quote)}
                    >
                      <Briefcase className="h-3 w-3" />
                      Approve & Job
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-white"
                    onClick={() => sendQuoteEmail(quote)}
                    disabled={isSending === quote.id}
                  >
                    <Send className={`h-4 w-4 ${isSending === quote.id ? 'animate-pulse' : ''}`} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-white"
                    onClick={() => setEditingQuote(quote)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-white"
                    onClick={() => downloadQuote(quote)}
                  >
                    <Download className="h-5 w-5" />
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

export default Quotes;
