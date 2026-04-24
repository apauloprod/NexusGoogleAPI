import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { 
  Plus, 
  FileText,
  ArrowUpRight,
  User as UserIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Edit2,
  Send,
  Search,
  Filter,
  Trash2,
  ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, getDoc, doc, where, limit, getDocs, deleteDoc } from "firebase/firestore";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InvoiceForm } from "../../components/forms/InvoiceForm";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { AuthContext } from "../../App";
import { useContext } from "react";



const ensureDate = (val: any) => {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  return new Date(val);
};

const Invoices = () => {
  const { user, currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isAdmin = role === 'admin' || role === 'super-admin';
  const isManager = role === 'manager';
  const isManagerOrAdmin = isAdmin || isManager;
  
  const permissions = impersonatedUser?.permissions || currentUserData?.permissions || {};
  const hasAccess = isAdmin || isManager || permissions.page_invoices;
  
  const canViewInvoice = hasAccess;
  const canCreateInvoice = hasAccess;
  const canEditInvoice = hasAccess;
  const canSendInvoice = hasAccess;

  useEffect(() => {
    if (!isAdmin && !isManager && !hasAccess) {
      navigate("/dashboard");
    }
  }, [isAdmin, isManager, hasAccess, navigate]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("invoiceNumber");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(currentUserData?.preferredViewMode === 'list' ? 'list' : 'grid');

  const handleDelete = async (id: string) => {
    if (!isManagerOrAdmin) {
      alert("You do not have permission to delete invoices.");
      return;
    }
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await deleteDoc(doc(db, "invoices", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "invoices");
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
      collection(db, "invoices"), 
      where("businessId", "==", businessId),
      orderBy(sortBy, sortOrder)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "invoices");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentUserData?.businessId, impersonatedUser?.businessId, sortBy, sortOrder]);

  const sendInvoiceEmail = async (inv: any) => {
    setIsSending(inv.id);
    try {
      const clientDoc = await getDoc(doc(db, "clients", inv.clientId));
      const clientData = clientDoc.exists() ? clientDoc.data() : null;

      if (!clientData?.email) {
        alert("Client has no email address.");
        return;
      }

      const response = await fetch(`/api/send-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice: { 
            ...inv, 
            dueDate: inv.dueDate?.toDate().toISOString() || new Date().toISOString() 
          },
          clientEmail: clientData.email,
          layout: businessSettings?.customInvoiceLayout || 'classic',
          appUrl: window.location.origin,
        }),
      });

      if (response.ok) {
        alert("Invoice sent successfully!");
      } else {
        alert("Failed to send invoice.");
      }
    } catch (error) {
      console.error("Error sending invoice:", error);
      alert("Error sending invoice.");
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

  const downloadInvoice = (inv: any) => {
    const doc = new jsPDF();
    const layout = businessSettings?.customInvoiceLayout || 'classic';
    
    // Use invoice's stored business info or fall back to current settings
    const bName = inv.businessName || businessSettings?.businessName || "Your Company";
    const bLogo = inv.businessLogo || businessSettings?.businessLogo;
    const bDetails = inv.businessDetails || (businessSettings?.address 
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
      doc.text("INVOICE", 190, 25, { align: "right" });
      
      doc.setFontSize(10);
      doc.text(`#${inv.invoiceNumber}`, 190, 32, { align: "right" });
      doc.text(`Due: ${ensureDate(inv.dueDate)?.toLocaleDateString()}`, 190, 38, { align: "right" });

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
      doc.text("BILL TO", 120, 75);
      doc.setFont("helvetica", "normal");
      doc.text(inv.clientName, 120, 82);

      autoTable(doc, {
        startY: 105,
        head: [['Description', 'Amount']],
        body: inv.items.map((it: any) => [it.description, `$${(it.price || it.unitPrice || 0).toLocaleString()}`]),
        foot: [['Total', `$${(inv.total || 0).toLocaleString()}`]],
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
      doc.text(`$${(inv.total || 0).toLocaleString()}`, 20, 40);
      doc.setFontSize(10);
      doc.text(`INVOICE #${inv.invoiceNumber}`, 20, 48);

      doc.setDrawColor(240);
      doc.line(20, 60, 190, 60);

      doc.text("CLIENT", 20, 75);
      doc.setFont("helvetica", "bold");
      doc.text(inv.clientName, 20, 82);
      
      doc.setFont("helvetica", "normal");
      doc.text("DUE DATE", 120, 75);
      doc.setFont("helvetica", "bold");
      doc.text(ensureDate(inv.dueDate)?.toLocaleDateString() || "N/A", 120, 82);

      autoTable(doc, {
        startY: 100,
        head: [['ITEM', 'PRICE']],
        body: inv.items.map((it: any) => [it.description.toUpperCase(), `$${(it.price || it.unitPrice || 0).toLocaleString()}`]),
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
      doc.text("INVOICE", 200, 20, { align: "right" });
      
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
      doc.text(`Invoice Number: ${inv.invoiceNumber}`, 200, 45, { align: "right" });
      doc.text(`Date: ${inv.createdAt?.toDate().toLocaleDateString() || new Date().toLocaleDateString()}`, 200, 52, { align: "right" });
      
      const dueDateStr = inv.dueDate ? (inv.dueDate.toDate ? inv.dueDate.toDate().toLocaleDateString() : new Date(inv.dueDate).toLocaleDateString()) : "N/A";
      doc.text(`Due Date: ${dueDateStr}`, 200, 59, { align: "right" });
      
      doc.setDrawColor(200);
      doc.line(20, 80, 200, 80);

      doc.setFont("helvetica", "bold");
      doc.text("Bill To:", 20, 90);
      doc.setFont("helvetica", "normal");
      doc.text(inv.clientName, 20, 97);
      
      autoTable(doc, {
        startY: 110,
        head: [['Description', 'Price']],
        body: inv.items.map((item: any) => [item.description, `$${(item.price || item.unitPrice || 0).toLocaleString()}`]),
        foot: [['Total', `$${(inv.total || inv.totalHT || 0).toLocaleString()}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] },
      });
    }
    
    if (inv.notes) {
      const finalY = (doc as any).lastAutoTable?.finalY || 110;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 20, finalY + 15);
      doc.setFont("helvetica", "normal");
      doc.text(inv.notes, 20, finalY + 22, { maxWidth: 170 });
    }

    doc.save(`Invoice_${inv.invoiceNumber}.pdf`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Paid</Badge>;
      case 'sent':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Sent</Badge>;
      case 'overdue':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
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

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.id === searchTerm ||
                          inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inv.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.jobId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Invoices</h1>
          <p className="text-muted-foreground">Manage billing, track payments, and send professional invoices.</p>
        </div>
        {canCreateInvoice && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                <Plus className="h-4 w-4" />
                New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tighter">Create New Invoice</DialogTitle>
              </DialogHeader>
              <div className="pt-4">
                <InvoiceForm 
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
            placeholder="Search by client name or invoice number..." 
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
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 h-9 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-transparent border-none text-[10px] font-bold uppercase tracking-wider focus:ring-0 cursor-pointer text-white h-7"
          >
            <option value="invoiceNumber" className="bg-black">Invoice #</option>
            <option value="clientName" className="bg-black">Client Name</option>
            <option value="createdAt" className="bg-black">Created Date</option>
            <option value="total" className="bg-black">Total Amount</option>
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
      </div>

      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Edit Invoice</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editingInvoice && (
              <InvoiceForm 
                initialData={{
                  ...editingInvoice,
                  dueDate: ensureDate(editingInvoice.dueDate)?.toISOString().split('T')[0] || ""
                }}
                onSuccess={() => setEditingInvoice(null)} 
                onCancel={() => setEditingInvoice(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {loading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No invoices found matching your criteria.</div>
        ) : (
          viewMode === 'grid' ? (
            filteredInvoices.map((inv) => (
              <div key={inv.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors group cursor-pointer" onClick={() => setEditingInvoice(inv)}>
                <div className="flex items-center gap-6">
                  <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg">{inv.clientName}</h3>
                      {getStatusBadge(inv.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">#{inv.invoiceNumber || inv.id.slice(0, 6)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Due {ensureDate(inv.dueDate)?.toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      {inv.quoteNumber && (
                        <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                          Quote: 
                          <Link to={`/dashboard/quotes?search=${inv.quoteNumber}`} className="text-cyan-400 hover:underline">
                            {inv.quoteNumber}
                          </Link>
                        </div>
                      )}
                      {inv.jobId && (
                        <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                          Job: 
                          <Link to={`/dashboard/jobs?search=${inv.jobId}`} className="text-amber-400 hover:underline">
                            {inv.jobTitle || inv.jobId.slice(0, 8)}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">
                      ${inv.total?.toLocaleString() || "0.00"}
                    </p>
                    <div className="flex flex-col items-end gap-0.5 mt-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        {inv.items?.length || 0} items
                      </p>
                      <p className="text-xs text-muted-foreground text-emerald-500">
                        {inv.status === 'paid' ? 'Fully Paid' : `$${(inv.total - (inv.paidAmount || 0)).toLocaleString()} balance`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canSendInvoice && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-white"
                        onClick={(e) => { e.stopPropagation(); sendInvoiceEmail(inv); }}
                        disabled={isSending === inv.id}
                      >
                        <Send className={`h-4 w-4 ${isSending === inv.id ? 'animate-pulse' : ''}`} />
                      </Button>
                    )}
                    {canEditInvoice && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-white"
                        onClick={(e) => { e.stopPropagation(); setEditingInvoice(inv); }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-white"
                      onClick={(e) => { e.stopPropagation(); downloadInvoice(inv); }}
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                    {isManagerOrAdmin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Invoice</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Client</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Dates / Ref</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                       <th className="p-4 text-xs font-bold uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {filteredInvoices.map((inv) => (
                       <tr key={inv.id} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => setEditingInvoice(inv)}>
                         <td className="p-4">
                           <div className="font-bold">#{inv.invoiceNumber || inv.id.slice(0, 6)}</div>
                         </td>
                         <td className="p-4">
                           <div className="font-bold text-sm">{inv.clientName}</div>
                         </td>
                         <td className="p-4 hidden md:table-cell">
                           <div className="flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap">
                             <Clock className="h-3 w-3" /> Due {ensureDate(inv.dueDate)?.toLocaleDateString()}
                           </div>
                           <div className="flex items-center gap-2 mt-1">
                            {inv.quoteNumber && (
                              <div className="text-[10px] uppercase font-bold text-muted-foreground">
                                Quote: <Link to={`/dashboard/quotes?search=${inv.quoteNumber}`} className="text-cyan-400 hover:underline">{inv.quoteNumber}</Link>
                              </div>
                            )}
                            {inv.jobId && (
                              <div className="text-[10px] uppercase font-bold text-muted-foreground">
                                Job: <Link to={`/dashboard/jobs?search=${inv.jobId}`} className="text-amber-400 hover:underline">{inv.jobTitle || inv.jobId.slice(0, 8)}</Link>
                              </div>
                            )}
                           </div>
                         </td>
                         <td className="p-4">
                           <div className="font-bold">${inv.total?.toLocaleString() || "0.00"}</div>
                           <div className="text-[10px] text-muted-foreground">
                             {inv.status === 'paid' ? 'Fully Paid' : `$${(inv.total - (inv.paidAmount || 0)).toLocaleString()} bal`}
                           </div>
                         </td>
                         <td className="p-4">
                           {getStatusBadge(inv.status)}
                         </td>
                         <td className="p-4 text-right">
                           <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canSendInvoice && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-white h-8 w-8"
                                  onClick={() => sendInvoiceEmail(inv)}
                                  disabled={isSending === inv.id}
                                >
                                  <Send className={`h-4 w-4 ${isSending === inv.id ? 'animate-pulse' : ''}`} />
                                </Button>
                              )}
                              {canEditInvoice && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-white h-8 w-8"
                                  onClick={() => setEditingInvoice(inv)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:text-white h-8 w-8"
                                onClick={() => downloadInvoice(inv)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {isManagerOrAdmin && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                                  onClick={() => handleDelete(inv.id)}
                                >
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

export default Invoices;
