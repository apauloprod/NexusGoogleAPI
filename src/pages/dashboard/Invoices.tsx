import React, { useState, useEffect } from "react";
import { 
  Plus, 
  FileText,
  ArrowUpRight,
  User as UserIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Edit2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

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

const Invoices = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "invoices");
    });
    return () => unsubscribe();
  }, []);

  const downloadInvoice = (inv: any) => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text("INVOICE", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Invoice Number: ${inv.invoiceNumber}`, 20, 40);
    doc.text(`Date: ${inv.createdAt?.toDate().toLocaleDateString() || new Date().toLocaleDateString()}`, 20, 48);
    doc.text(`Due Date: ${inv.dueDate?.toDate().toLocaleDateString() || "N/A"}`, 20, 56);
    doc.text(`Client: ${inv.clientName}`, 20, 64);
    
    const tableData = inv.items.map((item: any) => [
      item.description,
      `$${item.price.toLocaleString()}`
    ]);
    
    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Price']],
      body: tableData,
      foot: [['Total', `$${inv.total.toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0] },
    });
    
    if (inv.notes) {
      const finalY = (doc as any).lastAutoTable?.finalY || 80;
      doc.text("Notes:", 20, finalY + 20);
      doc.setFontSize(10);
      doc.text(inv.notes, 20, finalY + 28, { maxWidth: 170 });
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Invoices</h1>
          <p className="text-muted-foreground">Manage billing, track payments, and send professional invoices.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
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
      </div>

      <Dialog open={!!editingInvoice} onOpenChange={(open) => !open && setEditingInvoice(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Edit Invoice</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editingInvoice && (
              <InvoiceForm 
                initialData={{
                  ...editingInvoice,
                  dueDate: editingInvoice.dueDate?.toDate().toISOString().split('T')[0] || ""
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
        ) : invoices.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No invoices found.</div>
        ) : (
          invoices.map((inv) => (
            <div key={inv.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors group">
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
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Due {inv.dueDate?.toDate().toLocaleDateString()}</span>
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
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-white"
                    onClick={() => setEditingInvoice(inv)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-white"
                    onClick={() => downloadInvoice(inv)}
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

export default Invoices;
