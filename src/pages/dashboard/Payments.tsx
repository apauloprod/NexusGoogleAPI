import React, { useState, useEffect } from "react";
import { 
  Plus, 
  CreditCard,
  ArrowUpRight,
  User as UserIcon,
  Clock,
  CheckCircle2,
  TrendingUp,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

const Payments = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "payments"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "payments");
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="p-8">
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
              <p className="text-lg font-bold">$42,850.00</p>
            </div>
          </div>
          <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground glass rounded-2xl border-white/5">No payments recorded yet.</div>
        ) : (
          payments.map((payment) => (
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
                    <span className="flex items-center gap-1">Invoice #{payment.invoiceNumber}</span>
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
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                  <ArrowUpRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Payments;
