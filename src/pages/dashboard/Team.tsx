import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../App";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Shield, 
  MoreVertical, 
  Edit2, 
  Trash2,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  Check,
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { db, handleFirestoreError, OperationType, auth } from "../../firebase";
import { collection, onSnapshot, query, where, doc, updateDoc, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

const Team = () => {
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

  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = teamMembers.find(m => m.id === selectedMemberId);
  const [memberJobs, setMemberJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  useEffect(() => {
    if (!currentUserData?.businessId && !impersonatedUser?.businessId) return;
    const businessId = impersonatedUser?.businessId || currentUserData.businessId;

    const q = query(
      collection(db, "users"), 
      where("businessId", "==", businessId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeamMembers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserData?.businessId, impersonatedUser?.businessId]);

  const fetchMemberJobs = async (memberId: string) => {
    setLoadingJobs(true);
    try {
      const q = query(
        collection(db, "jobs"),
        where("assignedTeam", "array-contains", memberId),
        orderBy("scheduledAt", "desc")
      );
      const snap = await getDocs(q);
      setMemberJobs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching member jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (selectedMemberId) {
      fetchMemberJobs(selectedMemberId);
    } else {
      setMemberJobs([]);
    }
  }, [selectedMemberId]);

  const filteredTeam = teamMembers.filter(m => 
    (m.displayName || m.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const permissionsList = [
    { id: 'viewClients', label: 'View Clients' },
    { id: 'canCreateClient', label: 'Create Client' },
    { id: 'canEditClient', label: 'Edit Client' },
    { id: 'viewQuotes', label: 'View Quotes' },
    { id: 'canCreateQuote', label: 'Create Quote' },
    { id: 'canEditQuote', label: 'Edit Quote' },
    { id: 'canSendQuote', label: 'Send Quote' },
    { id: 'viewInvoices', label: 'View Invoices' },
    { id: 'canCreateInvoice', label: 'Create Invoice' },
    { id: 'canEditInvoice', label: 'Edit Invoice' },
    { id: 'canSendInvoice', label: 'Send Invoice' },
    { id: 'viewJobs', label: 'View Jobs' },
    { id: 'canCreateJob', label: 'Create Job' },
    { id: 'canEditJob', label: 'Edit Job' },
    { id: 'viewRequests', label: 'View Requests' },
  ];

  const togglePermission = async (memberId: string, permissionId: string, current: boolean) => {
    try {
      const memberRef = doc(db, "users", memberId);
      const currentPermissions = teamMembers.find(m => m.id === memberId)?.permissions || {};
      await updateDoc(memberRef, {
        [`permissions.${permissionId}`]: !current
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
    }
  };

  const updateRole = async (memberId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", memberId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
    }
  };

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">Team Management</h1>
          <p className="text-muted-foreground">Manage roles, permissions, and track team assignments.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search team members..." 
              className="pl-9 bg-white/5 border-white/10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 space-y-6">
          <Card className="bg-black border-white/10 text-white rounded-[2rem] overflow-hidden">
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>All users associated with your business.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <p className="text-center text-muted-foreground py-8">Loading team...</p>
                ) : filteredTeam.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No members found.</p>
                ) : (
                  filteredTeam.map((member) => (
                    <div 
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.id)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                        selectedMemberId === member.id 
                          ? "bg-white/10 border-white/20" 
                          : "bg-white/5 border-transparent hover:border-white/10"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10 group-hover:border-white/20">
                          {member.photoURL ? (
                            <img src={member.photoURL} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                          ) : (
                            <UserIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-none mb-1">{member.displayName || member.email?.split('@')[0]}</p>
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase font-bold py-0 h-4",
                            member.role === 'admin' ? "text-red-400 border-red-400/20" : 
                            member.role === 'manager' ? "text-blue-400 border-blue-400/20" : 
                            "text-muted-foreground border-white/10"
                          )}>
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                      <ArrowUpRight className={cn(
                        "h-4 w-4 transition-all opacity-0 group-hover:opacity-100",
                        selectedMember?.id === member.id && "opacity-100 text-white"
                      )} />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-2">
          {selectedMember ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="bg-black border-white/10 text-white rounded-[2rem] overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="h-16 w-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center border border-white/10 shadow-xl overflow-hidden">
                       {selectedMember.photoURL ? (
                          <img src={selectedMember.photoURL} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        ) : (
                          <UserIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                    </div>
                    <div>
                      <CardTitle className="text-2xl tracking-tighter">{selectedMember.displayName || "Team Member"}</CardTitle>
                      <CardDescription>{selectedMember.email}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 block">Account Role</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {['admin', 'manager', 'team'].map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant="outline"
                          disabled={role !== 'admin' && r === 'admin'}
                          className={cn(
                            "rounded-xl border-white/10 h-10 capitalize font-bold",
                            selectedMember.role === r ? "bg-white text-black hover:bg-white/90" : "bg-white/5 hover:bg-white/10"
                          )}
                          onClick={() => updateRole(selectedMember.id, r)}
                        >
                          {r}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-white/5" />

                  <div className="flex flex-wrap items-center gap-2">
                    {permissionsList.map((perm) => (
                      <div key={perm.id} className="flex items-center space-x-2 px-3 h-8 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                        <Checkbox 
                          id={`${selectedMember.id}-${perm.id}`}
                          checked={selectedMember.role === 'admin' || selectedMember.role === 'manager' || selectedMember.permissions?.[perm.id]}
                          disabled={selectedMember.role === 'admin' || selectedMember.role === 'manager'}
                          onCheckedChange={() => togglePermission(selectedMember.id, perm.id, !!selectedMember.permissions?.[perm.id])}
                          className="h-3.5 w-3.5 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black"
                        />
                        <label 
                          htmlFor={`${selectedMember.id}-${perm.id}`}
                          className="text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none"
                        >
                          {perm.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-black border-white/10 text-white rounded-[2rem] overflow-hidden border-blue-500/10">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                       <Clock className="h-5 w-5 text-blue-400" />
                       Assigned Jobs
                    </CardTitle>
                    <CardDescription>Recent and upcoming assignments.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {loadingJobs ? (
                        <p className="text-center text-muted-foreground py-4 text-xs">Loading jobs...</p>
                      ) : memberJobs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4 text-xs italic">No jobs assigned yet.</p>
                      ) : (
                        memberJobs.map(job => (
                          <div key={job.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between group cursor-pointer hover:border-white/10" onClick={() => navigate(`/dashboard/jobs?search=${job.id}`)}>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate pr-2">{job.title}</p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                <Calendar className="h-3 w-3" />
                                {ensureDate(job.scheduledAt)?.toLocaleDateString()}
                              </div>
                            </div>
                            <Badge className={cn(
                              "text-[10px] py-0 px-2 h-5",
                              job.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                            )}>
                              {job.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  variant="outline" 
                  className="w-full h-14 rounded-2xl border-white/10 hover:bg-white/5 font-bold gap-2"
                  onClick={() => navigate(`/dashboard/schedule?member=${selectedMember.id}`)}
                >
                  <Calendar className="h-5 w-5" />
                  View Member Schedule
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center p-8">
              <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <Users className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold mb-2">Select a member to manage</h2>
              <p className="text-muted-foreground max-w-xs mx-auto">
                Choose a team member from the list to view their assigned jobs, manage roles, and customize permissions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");

export default Team;
