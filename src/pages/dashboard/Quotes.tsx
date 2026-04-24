import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
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
  Edit2,
  Trash2,
  ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, getDocs, where, getDoc, limit, Timestamp, deleteDoc } from "firebase/firestore";

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



const ensureDate = (val: any) => {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
};

const Quotes = () => {
  const { user, currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isAdmin = role === 'admin' || role === 'super-admin';
  const isManager = role === 'manager';
  const isManagerOrAdmin = isAdmin || isManager;
  
  const permissions = impersonatedUser?.permissions || currentUserData?.permissions || {};
  const hasAccess = isAdmin || isManager || permissions.page_quotes;
  
  const canViewQuote = hasAccess;
  const canCreateQuote = hasAccess;
  const canEditQuote = hasAccess;
  const canSendQuote = hasAccess;

  useEffect(() => {
    if (!isAdmin && !isManager && !hasAccess) {
      navigate("/dashboard");
    }
  }, [isAdmin, isManager, hasAccess, navigate]);

  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("quoteNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(currentUserData?.preferredViewMode === 'list' ? 'list' : 'grid');

  const handleDelete = async (id: string) => {
    if (!isManagerOrAdmin) {
      alert("You do not have permission to delete quotes. Only Admins and Managers can delete.");
      return;
    }
    if (!confirm("Are you sure you want to delete this quote?")) return;
    try {
      await deleteDoc(doc(db, "quotes", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "quotes");
    }
  };

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
      orderBy(sortBy, sortOrder)
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
  }, [user, currentUserData?.businessId, impersonatedUser?.businessId, sortBy, sortOrder]);

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
          layout: businessSettings?.customQuoteLayout || 'classic',
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
    const layout = businessSettings?.customQuoteLayout || 'classic';
    
    // Use quote's stored business info or fall back to current settings
    const bName = quote.businessName || businessSettings?.businessName || "Your Company";
    const bLogo = quote.businessLogo || businessSettings?.businessLogo;
    const bDetails = quote.businessDetails || (businessSettings?.address 
      ? `${businessSettings.address.street}\n${businessSettings.address.city}, ${businessSettings.address.postcode}`
      : businessSettings?.businessDetails);

    if (layout === 'modern') {
      // Modern Layout
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, 210, 60, 'F');
      
      if (bLogo) {
        try { doc.addImage(bLogo, 'PNG', 20, 10, 25, 25); } catch(e) {}
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("QUOTE", 190, 25, { align: "right" });
      
      doc.setFontSize(10);
      doc.text(`#${quote.quoteNumber}`, 190, 32, { align: "right" });
      doc.text(`Date: ${ensureDate(quote.createdAt)?.toLocaleDateString()}`, 190, 38, { align: "right" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.text(bName, 20, 75);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      if (bDetails) {
        const detailsLines = doc.splitTextToSize(bDetails, 80);
        doc.text(detailsLines, 20, 82);
      }

      doc.setFont("helvetica", "bold");
      doc.text("FOR CLIENT", 120, 75);
      doc.setFont("helvetica", "normal");
      doc.text(quote.clientName, 120, 82);

      autoTable(doc, {
        startY: 105,
        head: [['Service Description', 'Estimate']],
        body: (quote.items || []).map((it: any) => [it.description, `$${(it.price || it.unitPrice || 0).toLocaleString()}`]),
        foot: [['Total Estimate', `$${(quote.total || 0).toLocaleString()}`]],
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
    } else if (layout === 'minimal') {
      // Minimal Layout
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(bName.toUpperCase(), 20, 20);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(32);
      doc.text(`$${(quote.total || 0).toLocaleString()}`, 20, 40);
      doc.setFontSize(10);
      doc.text(`SERVICE QUOTE #${quote.quoteNumber}`, 20, 48);

      doc.setDrawColor(240);
      doc.line(20, 60, 190, 60);

      doc.text("CLIENT", 20, 75);
      doc.setFont("helvetica", "bold");
      doc.text(quote.clientName, 20, 82);
      
      doc.setFont("helvetica", "normal");
      doc.text("ISSUE DATE", 120, 75);
      doc.setFont("helvetica", "bold");
      doc.text(ensureDate(quote.createdAt)?.toLocaleDateString() || "N/A", 120, 82);

      autoTable(doc, {
        startY: 100,
        head: [['TASK', 'PRICE']],
        body: (quote.items || []).map((it: any) => [it.description.toUpperCase(), `$${(it.price || it.unitPrice || 0).toLocaleString()}`]),
        theme: 'plain',
        headStyles: { textColor: [150, 150, 150], fontStyle: 'normal' },
        styles: { fontSize: 9 }
      });
    } else {
      // Classic Layout (Original)
      if (bLogo) {
        try { doc.addImage(bLogo, 'PNG', 20, 10, 30, 30); } catch (e) {}
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
      
      autoTable(doc, {
        startY: 110,
        head: [['Description', 'Price']],
        body: (quote.items || []).map((item: any) => [item.description, `$${(item.price || item.unitPrice || 0).toLocaleString()}`]),
        foot: [['Total', `$${(quote.total || quote.totalTTC || 0).toLocaleString()}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });
    }
    
    if (quote.notes) {
      const finalY = (doc as any).lastAutoTable?.finalY || 110;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 20, finalY + 15);
      doc.setFont("helvetica", "normal");
      doc.text(quote.notes, 20, finalY + 22, { maxWidth: 170 });
    }

    doc.save(`Quote_${quote.quoteNumber}.pdf`);
  };

  const convertToJob = async (quote: any) => {
    try {
      const businessId = impersonatedUser?.businessId || currentUserData.businessId;
      
      const clientDoc = await getDoc(doc(db, "clients", quote.clientId));
      const clientData = clientDoc.exists() ? clientDoc.data() : null;
      const clientPhone = clientData?.phone || "";
      
      let clientAddress = "";
      if (clientData?.address) {
        if (typeof clientData.address === 'string') {
          clientAddress = clientData.address;
        } else {
          const { street = "", city = "", state = "", zip = "" } = clientData.address;
          clientAddress = [street, city, state, zip].filter(Boolean).join(", ");
        }
      }

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

      // Cleanup visits
      const visitsRef = collection(db, "visits");
      const vq = query(visitsRef, where("quoteId", "==", quote.id));
      const vSnap = await getDocs(vq);
      for (const d of vSnap.docs) {
        await deleteDoc(doc(db, "visits", d.id));
      }
      if (quote.visitId && !vSnap.docs.some(d => d.id === quote.visitId)) {
        await deleteDoc(doc(db, "visits", quote.visitId)).catch(() => {});
      }
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
    if (val.toDate && typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = quote.id === searchTerm ||
                          quote.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          quote.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Quotes</h1>
          <p className="text-muted-foreground">Create and manage professional quotes for your clients.</p>
        </div>
        {canCreateQuote && (
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
        )}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px] bg-white/5 border-white/10 h-9 text-[10px] font-bold uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
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

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 h-9 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent border-none text-[10px] font-bold uppercase tracking-wider focus:ring-0 cursor-pointer text-white h-7"
          >
            <option value="quoteNumber" className="bg-black text-xs font-sans">Quote #</option>
            <option value="clientName" className="bg-black text-xs font-sans">Client Name</option>
            <option value="createdAt" className="bg-black text-xs font-sans">Created Date</option>
            <option value="total" className="bg-black text-xs font-sans">Total Amount</option>
            <option value="status" className="bg-black text-xs font-sans">Status</option>
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
          viewMode === 'grid' ? (
            filteredQuotes.map((quote) => (
              <div key={quote.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors group cursor-pointer" onClick={() => setEditingQuote(quote)}>
                <div className="flex items-center gap-6">
                  <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <Link 
                        to={`/dashboard/clients?search=${encodeURIComponent(quote.clientName)}`}
                        className="font-bold text-lg hover:text-cyan-400 transition-colors"
                      >
                        {quote.clientName}
                      </Link>
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
                    {quote.status !== 'approved' && canEditQuote && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs gap-1 hover:text-emerald-500"
                        onClick={(e) => { e.stopPropagation(); convertToJob(quote); }}
                      >
                        <Briefcase className="h-3 w-3" />
                        Approve & Job
                      </Button>
                    )}
                    {canSendQuote && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-white"
                        onClick={(e) => { e.stopPropagation(); sendQuoteEmail(quote); }}
                        disabled={isSending === quote.id}
                      >
                        <Send className={`h-4 w-4 ${isSending === quote.id ? 'animate-pulse' : ''}`} />
                      </Button>
                    )}
                    {canEditQuote && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-white"
                        onClick={(e) => { e.stopPropagation(); setEditingQuote(quote); }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    {isManagerOrAdmin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(quote.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-white"
                      onClick={(e) => { e.stopPropagation(); downloadQuote(quote); }}
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="glass rounded-3xl border-white/5 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-white/5 bg-white/5">
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Quote</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Client</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Date</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {filteredQuotes.map((quote) => (
                       <tr key={quote.id} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => setEditingQuote(quote)}>
                         <td className="p-4">
                           <div className="font-bold">#{quote.quoteNumber || quote.id.slice(0, 6)}</div>
                         </td>
                         <td className="p-4">
                           <Link 
                            to={`/dashboard/clients?search=${encodeURIComponent(quote.clientName)}`}
                            className="font-bold text-sm hover:text-cyan-400 transition-colors"
                          >
                            {quote.clientName}
                          </Link>
                         </td>
                         <td className="p-4 hidden md:table-cell">
                           <div className="text-sm text-muted-foreground">
                             {quote.scheduledAt ? ensureDate(quote.scheduledAt)?.toLocaleString() : ensureDate(quote.createdAt)?.toLocaleDateString()}
                           </div>
                         </td>
                         <td className="p-4">
                           <div className="font-bold">${quote.total?.toLocaleString() || "0.00"}</div>
                           <div className="text-xs text-muted-foreground">{quote.items?.length || 0} items</div>
                         </td>
                         <td className="p-4">
                           {getStatusBadge(quote.status)}
                         </td>
                         <td className="p-4 text-right">
                           <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {quote.status !== 'approved' && canEditQuote && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-xs gap-1 hover:text-emerald-500 h-8"
                                  onClick={(e) => { e.stopPropagation(); convertToJob(quote); }}
                                >
                                  <Briefcase className="h-3 w-3" />
                                </Button>
                              )}
                              {canSendQuote && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-white h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); sendQuoteEmail(quote); }}
                                  disabled={isSending === quote.id}
                                >
                                  <Send className={`h-4 w-4 ${isSending === quote.id ? 'animate-pulse' : ''}`} />
                                </Button>
                              )}
                              {canEditQuote && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-white h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); setEditingQuote(quote); }}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                              {isManagerOrAdmin && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(quote.id); }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:text-white h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); downloadQuote(quote); }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
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

export default Quotes;
