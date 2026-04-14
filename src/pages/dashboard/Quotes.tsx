import React, { useState, useEffect } from "react";
import { 
  Plus, 
  FileText,
  ArrowUpRight,
  User as UserIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, getDocs, where } from "firebase/firestore";

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
import { Download, Edit2 } from "lucide-react";

const Quotes = () => {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "quotes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuotes(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "quotes");
    });
    return () => unsubscribe();
  }, []);

  const downloadQuote = (quote: any) => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text("SERVICE QUOTE", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Quote Number: ${quote.quoteNumber}`, 20, 40);
    doc.text(`Date: ${quote.createdAt?.toDate().toLocaleDateString() || new Date().toLocaleDateString()}`, 20, 48);
    doc.text(`Client: ${quote.clientName}`, 20, 56);
    
    const tableData = quote.items.map((item: any) => [
      item.description,
      `$${item.price.toLocaleString()}`
    ]);
    
    autoTable(doc, {
      startY: 70,
      head: [['Description', 'Price']],
      body: tableData,
      foot: [['Total', `$${quote.total.toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0] },
    });
    
    if (quote.notes) {
      const finalY = (doc as any).lastAutoTable?.finalY || 70;
      doc.text("Notes:", 20, finalY + 20);
      doc.setFontSize(10);
      doc.text(quote.notes, 20, finalY + 28, { maxWidth: 170 });
    }

    doc.save(`Quote_${quote.quoteNumber}.pdf`);
  };

  const convertToJob = async (quote: any) => {
    try {
      await addDoc(collection(db, "jobs"), {
        title: `Job from Quote #${quote.quoteNumber}`,
        clientId: quote.clientId,
        clientName: quote.clientName,
        status: "active",
        notes: quote.notes || "",
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        items: quote.items || [],
        total: quote.total,
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
          <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
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

      <Dialog open={!!editingQuote} onOpenChange={(open) => !open && setEditingQuote(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
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
        ) : quotes.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No quotes found.</div>
        ) : (
          quotes.map((quote) => (
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
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {quote.createdAt?.toDate().toLocaleDateString()}</span>
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
