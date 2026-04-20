import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../App";
import { 
  Plus, 
  CreditCard,
  ArrowUpRight,
  User as UserIcon,
  Clock,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Edit2,
  Search,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PaymentForm } from "../../components/forms/PaymentForm";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useSearchParams, Link, useNavigate } from "react-router-dom";

const Payments = () => {
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
  const success = searchParams.get("success");
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");

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
      collection(db, "payments"), 
      where("businessId", "==", businessId),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "payments");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentUserData?.businessId, impersonatedUser?.businessId]);

  const filteredPayments = payments.filter(payment => {
    return payment.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
           payment.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-8">
      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-bold">Payment processed successfully!</p>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Payments</h1>
          <p className="text-muted-foreground">Track revenue, process transactions, and view payment history.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass px-6 py-2 rounded-xl border-white/5 flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Revenue</p>
              <p className="text-lg font-bold">
                ${payments.reduce((acc, p) => acc + (p.amount || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                <Plus className="h-4 w-4" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tighter">Record Payment</DialogTitle>
              </DialogHeader>
              <div className="pt-4">
                <PaymentForm 
                  onSuccess={() => setIsAddDialogOpen(false)} 
                  onCancel={() => setIsAddDialogOpen(false)} 
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
      </div>

      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="bg-black border-white/10 text-white sm:max-w-[600px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tighter">Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="pt-4">
            {editingPayment && (
              <PaymentForm 
                initialData={editingPayment}
                onSuccess={() => setEditingPayment(null)} 
                onCancel={() => setEditingPayment(null)} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {loading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">Loading payments...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No payments recorded yet.</div>
        ) : (
          filteredPayments.map((payment) => (
            <div key={payment.id} className="p-6 rounded-2xl glass border-white/5 flex items-center justify-between hover:border-white/10 transition-colors group">
              <div className="flex items-center gap-6">
                <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">{payment.clientName}</h3>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Success</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      Invoice 
                      <Link to={`/dashboard/invoices?search=${payment.invoiceNumber}`} className="text-blue-400 hover:underline">
                        #{payment.invoiceNumber}
                      </Link>
                    </span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {payment.createdAt?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-lg font-bold text-white">
                    +${payment.amount?.toLocaleString() || "0.00"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    via {payment.method || 'Credit Card'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-white"
                    onClick={() => setEditingPayment(payment)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
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

export default Payments;
