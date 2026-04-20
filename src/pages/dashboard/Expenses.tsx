import React, { useState, useEffect, useMemo, useContext } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Plus, 
  Calendar as CalendarIcon,
  Search,
  Filter,
  ArrowUpRight,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Calculator,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval, isSameMonth } from "date-fns";
import { AuthContext } from "../../App";
import { useNavigate } from "react-router-dom";

const Expenses = () => {
  const { currentUserData, impersonatedUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const role = impersonatedUser?.role || currentUserData?.role || 'team';
  const isManagerOrAdmin = role === 'admin' || role === 'manager';

  useEffect(() => {
    if (!isManagerOrAdmin) {
      navigate("/dashboard");
    }
  }, [isManagerOrAdmin, navigate]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [includeLabor, setIncludeLabor] = useState(true);
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    category: "other",
    type: "one-time",
    date: format(new Date(), "yyyy-MM-dd")
  });

  useEffect(() => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const unsubExpenses = onSnapshot(query(
      collection(db, "expenses"), 
      where("businessId", "==", businessId),
      orderBy("date", "desc")
    ), (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubTimesheets = onSnapshot(query(
      collection(db, "timesheets"), 
      where("businessId", "==", businessId),
      where("submissionStatus", "==", "approved")
    ), (snap) => {
      setTimesheets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubQuotes = onSnapshot(query(
      collection(db, "quotes"),
      where("businessId", "==", businessId)
    ), (snap) => {
      setQuotes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRequests = onSnapshot(query(
      collection(db, "requests"),
      where("businessId", "==", businessId)
    ), (snap) => {
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubJobs = onSnapshot(query(
      collection(db, "jobs"),
      where("businessId", "==", businessId)
    ), (snap) => {
      setJobs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubExpenses();
      unsubTimesheets();
      unsubQuotes();
      unsubRequests();
      unsubJobs();
    };
  }, [currentUserData?.businessId, impersonatedUser?.businessId]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;
    try {
      await addDoc(collection(db, "expenses"), {
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        businessId,
        date: Timestamp.fromDate(new Date(newExpense.date + "T12:00:00")),
        createdAt: serverTimestamp()
      });
      setIsAddDialogOpen(false);
      setNewExpense({
        description: "",
        amount: "",
        category: "other",
        type: "one-time",
        date: format(new Date(), "yyyy-MM-dd")
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "expenses");
    }
  };

  const totalLaborCost = useMemo(() => {
    return timesheets.reduce((sum, ts) => sum + (ts.totalCost || 0), 0);
  }, [timesheets]);

  const totalOtherExpenses = useMemo(() => {
    return expenses.reduce((sum, ex) => {
      // If monthly, we might want to multiply by months in period, 
      // but for "Total Spending" we'll just sum current entries.
      return sum + (ex.amount || 0);
    }, 0);
  }, [expenses]);

  const totalSpending = (includeLabor ? totalLaborCost : 0) + totalOtherExpenses;

  // Projection Data
  const projectionData = useMemo(() => {
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    return last6Months.map(month => {
      const monthQuotes = quotes.filter(q => {
        const date = q.createdAt?.toDate();
        return date && isSameMonth(date, month);
      });
      const monthJobs = jobs.filter(j => {
        const date = j.createdAt?.toDate();
        return date && isSameMonth(date, month);
      });
      const monthRequests = requests.filter(r => {
        const date = r.createdAt?.toDate();
        return date && isSameMonth(date, month);
      });

      const revenue = monthQuotes.reduce((sum, q) => sum + (q.total || q.totalAmount || 0), 0);
      
      return {
        name: format(month, "MMM"),
        revenue,
        jobs: monthJobs.length,
        requests: monthRequests.length,
        projection: revenue * 1.2 + (monthRequests.length * 200)
      };
    });
  }, [quotes, jobs, requests]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    if (includeLabor) categories.labor = totalLaborCost;
    
    expenses.forEach(ex => {
      categories[ex.category] = (categories[ex.category] || 0) + ex.amount;
    });

    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [expenses, totalLaborCost, includeLabor]);

  const COLORS = ['#FFFFFF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Expenses & Projections</h1>
          <p className="text-muted-foreground">Monitor spending, analyze labor costs, and project future growth.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 glass px-4 py-2 rounded-xl border-white/5">
            <Switch 
              id="include-labor" 
              checked={includeLabor} 
              onCheckedChange={setIncludeLabor}
            />
            <Label htmlFor="include-labor" className="text-xs font-medium text-muted-foreground">Include Labor</Label>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-white/90 rounded-xl gap-2 font-bold">
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white sm:max-w-[425px] rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tighter">Add New Expense</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddExpense} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <Input 
                    required
                    value={newExpense.description}
                    onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                    className="bg-white/5 border-white/10"
                    placeholder="e.g. Office Supplies"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Amount ($)</label>
                    <Input 
                      required
                      type="number"
                      step="0.01"
                      value={newExpense.amount}
                      onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                      className="bg-white/5 border-white/10"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <Select 
                      value={newExpense.category} 
                      onValueChange={val => setNewExpense({...newExpense, category: val})}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10">
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="software">Software</SelectItem>
                        <SelectItem value="rent">Rent/Utilities</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <Select 
                      value={newExpense.type} 
                      onValueChange={val => setNewExpense({...newExpense, type: val})}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black border-white/10">
                        <SelectItem value="one-time">One-time</SelectItem>
                        <SelectItem value="monthly">Monthly (Recurring)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Date</label>
                    <Input 
                      required
                      type="date"
                      value={newExpense.date}
                      onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-white text-black hover:bg-white/90 rounded-xl font-bold h-12">
                  Save Expense
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass p-6 rounded-3xl border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Spending</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold">${totalSpending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              MTD
            </Badge>
          </div>
        </div>

        <div className="glass p-6 rounded-3xl border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Labor Costs</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold">${totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            <Badge variant="outline" className="text-[10px] border-white/10">Approved Only</Badge>
          </div>
        </div>

        <div className="glass p-6 rounded-3xl border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Projected Revenue</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-emerald-400">
              ${(projectionData[projectionData.length - 1]?.projection || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </h2>
            <span className="text-xs text-muted-foreground">Next Month</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="glass p-8 rounded-[2.5rem] border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold tracking-tighter">Growth Projection</h3>
              <p className="text-sm text-muted-foreground">Revenue vs. Predicted Growth</p>
            </div>
            <BarChartIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectionData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#FFFFFF" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="projection" stroke="#10B981" fillOpacity={1} fill="url(#colorProj)" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-8 rounded-[2.5rem] border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold tracking-tighter">Expense Breakdown</h3>
              <p className="text-sm text-muted-foreground">Spending by category</p>
            </div>
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="h-[300px] w-full flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 pr-8">
              {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs text-muted-foreground capitalize">{entry.name}</span>
                  <span className="text-xs font-bold ml-auto">${entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass p-8 rounded-[2.5rem] border-white/5">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold tracking-tighter">Recent Expenses</h3>
            <p className="text-sm text-muted-foreground">Manual entries and recurring costs</p>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">View All</Button>
        </div>
        <div className="space-y-4">
          {expenses.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">No expenses recorded yet.</div>
          ) : (
            expenses.slice(0, 5).map((expense) => (
              <div key={expense.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
                    {expense.type === 'monthly' ? (
                      <RefreshCw className="h-5 w-5 text-blue-400" />
                    ) : (
                      <Calculator className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold">{expense.description}</h4>
                      {expense.type === 'monthly' && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 text-blue-400 border-blue-400/20">Monthly</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{expense.category} • {format(expense.date.toDate(), "MMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">-${expense.amount.toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Expenses;
