'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Activity, Users, MessageSquare, Star, TrendingUp, Send, Sparkles, PhoneCall,
  Clock, AlertCircle, CalendarCheck, IndianRupee, ThumbsUp, ThumbsDown, ArrowRight, CheckCircle2, Loader2,
  Brain, Zap, Flame, Trophy, RefreshCw,
} from 'lucide-react';

const SEG_META = {
  overdue_followup: { label: 'Overdue Follow-up', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  inactive_6mo: { label: 'Inactive 6+ months', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: AlertCircle },
  annual_checkup: { label: 'Annual Checkup Due', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CalendarCheck },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
};

const SEG_ORDER = ['overdue_followup', 'inactive_6mo', 'annual_checkup', 'active'];

function StatCard({ icon: Icon, label, value, sub, accent = 'emerald' }) {
  const colors = {
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    rose: 'from-rose-500 to-pink-600',
    blue: 'from-blue-500 to-indigo-600',
    violet: 'from-violet-500 to-purple-600',
  };
  return (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            <p className="text-3xl font-bold mt-1 text-slate-900">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colors[accent]} text-white shadow-sm`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [patients, setPatients] = useState([]);
  const [segment, setSegment] = useState('overdue_followup');
  const [campaigns, setCampaigns] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // AI Coach
  const [coachInsights, setCoachInsights] = useState([]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachLoaded, setCoachLoaded] = useState(false);

  const runCoach = async () => {
    setCoachLoading(true);
    try {
      const res = await fetch('/api/ai/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      if (data.insights) {
        setCoachInsights(data.insights);
        setCoachLoaded(true);
        toast.success('AI Coach analyzed your clinic');
      } else {
        toast.error('Coach failed: ' + (data.error || 'unknown'));
      }
    } catch (e) {
      toast.error(e.message);
    }
    setCoachLoading(false);
  };

  // campaign dialog
  const [openCampaign, setOpenCampaign] = useState(false);
  const [campaignSegment, setCampaignSegment] = useState('overdue_followup');
  const [campaignLang, setCampaignLang] = useState('English');
  const [campaignMsg, setCampaignMsg] = useState('');
  const [generating, setGenerating] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState(null);
  const [currentSends, setCurrentSends] = useState([]);

  // review dialog
  const [openReview, setOpenReview] = useState(false);
  const [reviewPatient, setReviewPatient] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewFeedback, setReviewFeedback] = useState('');

  const loadAll = async () => {
    const [d, p, c, r] = await Promise.all([
      fetch('/api/dashboard').then((x) => x.json()),
      fetch('/api/patients').then((x) => x.json()),
      fetch('/api/campaigns').then((x) => x.json()),
      fetch('/api/reviews').then((x) => x.json()),
    ]);
    setDashboard(d);
    setPatients(p);
    setCampaigns(c);
    setReviews(r);
  };

  useEffect(() => {
    (async () => {
      await fetch('/api/init', { method: 'POST' });
      await loadAll();
      setLoading(false);
    })();
  }, []);

  const filteredPatients = useMemo(() => {
    return segment === 'all' ? patients : patients.filter((p) => p.segment === segment);
  }, [patients, segment]);

  const generateMessage = async () => {
    setGenerating(true);
    setCampaignMsg('');
    try {
      const type = campaignSegment === 'overdue_followup' ? 'recall_followup' : campaignSegment === 'annual_checkup' ? 'recall_annual' : 'recall_inactive';
      const res = await fetch('/api/ai/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          patient_name: '{name}',
          visit_reason: 'their treatment',
          days_since_visit: campaignSegment === 'inactive_6mo' ? 200 : campaignSegment === 'annual_checkup' ? 360 : 30,
          language: campaignLang,
          clinic_name: dashboard?.clinic?.name,
          doctor_name: dashboard?.clinic?.doctor_name,
        }),
      });
      const data = await res.json();
      if (data.text) {
        setCampaignMsg(data.text);
        toast.success('AI drafted your message');
      } else {
        toast.error('AI failed: ' + (data.error || 'unknown'));
      }
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
    setGenerating(false);
  };

  const launchCampaign = async () => {
    if (!campaignMsg.trim()) {
      toast.error('Draft a message first');
      return;
    }
    setCreatingCampaign(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: campaignSegment, message_template: campaignMsg, type: 'recall' }),
      });
      const data = await res.json();
      setCurrentCampaign(data.campaign);
      setCurrentSends(data.sends);
      toast.success(`Campaign ready — ${data.sends.length} messages queued`);
      await loadAll();
    } catch (e) {
      toast.error('Failed: ' + e.message);
    }
    setCreatingCampaign(false);
  };

  const markSend = async (sendId, status) => {
    const res = await fetch(`/api/sends/${sendId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const updated = await res.json();
    setCurrentSends((prev) => prev.map((s) => (s.id === sendId ? updated : s)));
    if (status === 'booked') toast.success(`Booked! +\u20B9${dashboard?.clinic?.avg_visit_value || 0} recovered`);
    await loadAll();
  };

  const submitReview = async () => {
    if (!reviewPatient) return;
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: reviewPatient.id, rating: reviewRating, feedback_text: reviewFeedback }),
    });
    const data = await res.json();
    if (data.sentiment === 'positive') {
      toast.success('Positive! Routed to Google review link.');
    } else {
      toast.warning('Negative feedback captured privately — resolve before it goes public.');
    }
    setOpenReview(false);
    setReviewFeedback('');
    setReviewRating(5);
    setReviewPatient(null);
    await loadAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading ClinicOS AI…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 leading-none">ClinicOS AI</p>
              <p className="text-xs text-slate-500 mt-0.5">We don’t manage clinics. We grow them.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </Badge>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900">{dashboard?.clinic?.doctor_name}</p>
              <p className="text-xs text-slate-500">{dashboard?.clinic?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Good morning, {dashboard?.clinic?.doctor_name?.split(' ').slice(-1)[0] || 'Doctor'} 👋</h1>
          <p className="text-slate-600 mt-1">Here’s what your clinic looks like today. Let’s bring some patients back.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={IndianRupee} label="Recovered Revenue" value={`₹${(dashboard?.recovered_revenue || 0).toLocaleString('en-IN')}`} sub={`from ${dashboard?.campaign_stats?.booked || 0} bookings`} accent="emerald" />
          <StatCard icon={Clock} label="Follow-ups Today" value={dashboard?.today_followups || 0} sub="overdue this week" accent="amber" />
          <StatCard icon={Users} label="Total Patients" value={dashboard?.total_patients || 0} sub={`${dashboard?.segments?.inactive_6mo || 0} inactive`} accent="blue" />
          <StatCard icon={Star} label="Avg Rating" value={dashboard?.reviews?.average || '—'} sub={`${dashboard?.reviews?.total || 0} reviews collected`} accent="violet" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="coach" className="gap-1"><Brain className="h-3.5 w-3.5" /> AI Coach</TabsTrigger>
            <TabsTrigger value="patients">Patients</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="reputation">Reputation</TabsTrigger>
          </TabsList>

          {/* Dashboard tab */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-600" /> Patient Growth Segments</CardTitle>
                  <CardDescription>Automatic segmentation based on last visit + follow-up rules.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {SEG_ORDER.map((s) => {
                    const meta = SEG_META[s];
                    const count = dashboard?.segments?.[s] || 0;
                    const total = dashboard?.total_patients || 1;
                    const pct = Math.round((count / total) * 100);
                    const Icon = meta.icon;
                    return (
                      <div key={s} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-600" />
                            <span className="font-medium text-slate-800">{meta.label}</span>
                            <Badge variant="outline" className={meta.color}>{count} patients</Badge>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => { setCampaignSegment(s); setOpenCampaign(true); setCampaignMsg(''); }}>
                            Launch Campaign <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Revenue Recovery Math</CardTitle>
                  <CardDescription className="text-emerald-50">Based on your average visit value.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-4xl font-bold">₹{(dashboard?.recovered_revenue || 0).toLocaleString('en-IN')}</p>
                    <p className="text-sm text-emerald-50">recovered so far</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-t border-white/20 pt-2"><span>Messages sent</span><b>{dashboard?.campaign_stats?.sent || 0}</b></div>
                    <div className="flex justify-between"><span>Replied</span><b>{dashboard?.campaign_stats?.replied || 0}</b></div>
                    <div className="flex justify-between"><span>Booked</span><b>{dashboard?.campaign_stats?.booked || 0}</b></div>
                    <div className="flex justify-between border-t border-white/20 pt-2"><span>Avg visit value</span><b>₹{dashboard?.clinic?.avg_visit_value || 0}</b></div>
                  </div>
                  <p className="text-xs text-emerald-50 pt-2 leading-relaxed">Potential: {(dashboard?.segments?.inactive_6mo || 0) + (dashboard?.segments?.overdue_followup || 0) + (dashboard?.segments?.annual_checkup || 0)} recallable patients × typical 12% conversion ≈ <b>₹{Math.round(((dashboard?.segments?.inactive_6mo || 0) + (dashboard?.segments?.overdue_followup || 0) + (dashboard?.segments?.annual_checkup || 0)) * 0.12 * (dashboard?.clinic?.avg_visit_value || 0)).toLocaleString('en-IN')}</b> untapped this month.</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Coach tab */}
          <TabsContent value="coach" className="mt-6 space-y-6">
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 p-6 text-white">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur grid place-items-center">
                      <Brain className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">AI Business Coach</h2>
                      <p className="text-violet-100 text-sm mt-0.5 max-w-xl">Plain-language operational insights tied to money. No clinical advice — only growth, retention, and reputation levers.</p>
                    </div>
                  </div>
                  <Button onClick={runCoach} disabled={coachLoading} className="bg-white text-violet-700 hover:bg-violet-50">
                    {coachLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    {coachLoaded ? 'Re-analyze' : 'Analyze My Clinic'}
                  </Button>
                </div>
              </div>
            </Card>

            {!coachLoaded && !coachLoading && (
              <div className="text-center py-16 text-slate-500">
                <Brain className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p>Tap "Analyze My Clinic" to get today's insights.</p>
              </div>
            )}

            {coachLoading && (
              <div className="text-center py-16 text-slate-500">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-violet-500 mb-3" />
                <p>Reading your clinic's numbers…</p>
              </div>
            )}

            {coachInsights.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {coachInsights.map((ins, i) => {
                  const sevMap = {
                    critical: { icon: Flame, bg: 'from-rose-500 to-red-600', badge: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Critical' },
                    opportunity: { icon: Zap, bg: 'from-amber-500 to-orange-600', badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Opportunity' },
                    wins: { icon: Trophy, bg: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Win' },
                    reputation: { icon: Star, bg: 'from-violet-500 to-fuchsia-600', badge: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Reputation' },
                  };
                  const s = sevMap[ins.severity] || sevMap.opportunity;
                  const Icon = s.icon;
                  return (
                    <Card key={i} className="border-0 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${s.bg} text-white shrink-0`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-slate-900">{ins.title}</h3>
                              <Badge variant="outline" className={s.badge}>{s.label}</Badge>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">{ins.insight}</p>
                            <div className="mt-3 space-y-1.5 text-sm">
                              <div className="flex gap-2"><span className="text-slate-400 shrink-0">→ Action:</span><span className="text-slate-800 font-medium">{ins.action}</span></div>
                              <div className="flex gap-2"><span className="text-slate-400 shrink-0">💰 Impact:</span><span className="text-emerald-700 font-semibold">{ins.impact}</span></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-slate-400 text-center italic">AI Coach never provides clinical or treatment advice — only operational, growth, and reputation guidance.</p>
          </TabsContent>
          <TabsContent value="patients" className="mt-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Patients</CardTitle>
                    <CardDescription>Auto-segmented by last visit · tap a patient to request a review.</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['all', ...SEG_ORDER].map((s) => (
                      <Button key={s} size="sm" variant={segment === s ? 'default' : 'outline'} onClick={() => setSegment(s)}>
                        {s === 'all' ? 'All' : SEG_META[s].label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-slate-100">
                  {filteredPatients.map((p) => {
                    const meta = SEG_META[p.segment];
                    return (
                      <div key={p.id} className="py-3 flex items-center justify-between hover:bg-slate-50 -mx-2 px-2 rounded-lg transition">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 grid place-items-center font-semibold text-slate-700">{p.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div>
                          <div>
                            <p className="font-medium text-slate-900">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.visit_reason} · last visit {new Date(p.last_visit_date).toLocaleDateString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                          <Button size="sm" variant="outline" onClick={() => { setReviewPatient(p); setOpenReview(true); }}>
                            <Star className="h-3.5 w-3.5 mr-1" /> Request Review
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {!filteredPatients.length && (
                    <div className="py-10 text-center text-slate-500">No patients in this segment.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns tab */}
          <TabsContent value="campaigns" className="mt-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Recall Campaigns</h2>
                <p className="text-slate-500 text-sm">AI-drafted WhatsApp messages, one-click send.</p>
              </div>
              <Button onClick={() => { setOpenCampaign(true); setCampaignMsg(''); }} className="bg-gradient-to-r from-emerald-500 to-teal-600">
                <Sparkles className="h-4 w-4 mr-2" /> New Campaign
              </Button>
            </div>

            {currentCampaign && currentSends.length > 0 && (
              <Card className="border-0 shadow-md ring-1 ring-emerald-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-emerald-600" /> Active Campaign · {SEG_META[currentCampaign.segment].label}</CardTitle>
                  <CardDescription>Click “Send on WhatsApp” to open WhatsApp with the personalized message ready to send. Then mark the result.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {currentSends.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{s.patient_name}</p>
                          <p className="text-xs text-slate-500 truncate">{s.message}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={
                            s.status === 'booked' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            s.status === 'replied' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            s.status === 'sent' ? 'bg-slate-100 text-slate-700' : 'bg-white'
                          }>{s.status}</Badge>
                          <a href={s.wa_link} target="_blank" rel="noreferrer" onClick={() => markSend(s.id, 'sent')}>
                            <Button size="sm" variant="outline"><PhoneCall className="h-3.5 w-3.5 mr-1" /> Send</Button>
                          </a>
                          {s.status === 'sent' && (
                            <Button size="sm" variant="outline" onClick={() => markSend(s.id, 'replied')}>Replied</Button>
                          )}
                          {(s.status === 'sent' || s.status === 'replied') && (
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => markSend(s.id, 'booked')}>Booked</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle>Campaign History</CardTitle></CardHeader>
              <CardContent>
                {!campaigns.length ? (
                  <p className="text-slate-500 text-sm py-6 text-center">No campaigns yet. Launch your first one.</p>
                ) : (
                  <div className="space-y-2">
                    {campaigns.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium">{SEG_META[c.segment]?.label || c.segment}</p>
                          <p className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString('en-IN')} · {c.total_targets} targets</p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline">{c.sent} sent</Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{c.replied} replied</Badge>
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{c.booked} booked</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reputation tab */}
          <TabsContent value="reputation" className="mt-6 space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <StatCard icon={Star} label="Total Reviews" value={dashboard?.reviews?.total || 0} accent="violet" />
              <StatCard icon={ThumbsUp} label="Positive → Google" value={dashboard?.reviews?.positive || 0} sub="routed to public review" accent="emerald" />
              <StatCard icon={ThumbsDown} label="Negative → Private" value={dashboard?.reviews?.negative || 0} sub="handled before public" accent="rose" />
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Review Funnel</CardTitle>
                <CardDescription>Positive feedback goes public. Negative feedback stays private so you can fix it before it hurts you.</CardDescription>
              </CardHeader>
              <CardContent>
                {!reviews.length ? (
                  <p className="text-slate-500 py-6 text-center text-sm">No reviews yet — collect one from the Patients tab.</p>
                ) : (
                  <div className="space-y-2">
                    {reviews.map((r) => (
                      <div key={r.id} className="p-3 bg-slate-50 rounded-lg flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{r.patient_name}</span>
                            <span className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          </div>
                          {r.feedback_text && <p className="text-sm text-slate-600 mt-1">“{r.feedback_text}”</p>}
                          <p className="text-xs text-slate-400 mt-1">{new Date(r.created_at).toLocaleString('en-IN')}</p>
                        </div>
                        <Badge variant="outline" className={r.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}>
                          {r.routed_to === 'google' ? 'Google' : 'Private'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Campaign Dialog */}
      <Dialog open={openCampaign} onOpenChange={(o) => { setOpenCampaign(o); if (!o) { setCurrentCampaign(null); setCurrentSends([]); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-600" /> New Recall Campaign</DialogTitle>
            <DialogDescription>Pick a segment, let AI draft the WhatsApp message, review it, then launch.</DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Segment</Label>
              <Select value={campaignSegment} onValueChange={setCampaignSegment}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEG_ORDER.filter((s) => s !== 'active').map((s) => (
                    <SelectItem key={s} value={s}>{SEG_META[s].label} ({dashboard?.segments?.[s] || 0})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Language</Label>
              <Select value={campaignLang} onValueChange={setCampaignLang}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="English">English</SelectItem>
                  <SelectItem value="Hindi">Hindi</SelectItem>
                  <SelectItem value="Bengali">Bengali</SelectItem>
                  <SelectItem value="Hinglish">Hinglish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm">Message template</Label>
              <Button size="sm" variant="outline" onClick={generateMessage} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                {generating ? 'Drafting…' : 'Draft with AI'}
              </Button>
            </div>
            <Textarea value={campaignMsg} onChange={(e) => setCampaignMsg(e.target.value)} rows={5} placeholder="Hi {name}, this is a friendly reminder… (use {name} for personalization)" />
            <p className="text-xs text-slate-500 mt-1">Use <code className="bg-slate-100 px-1 rounded">{'{name}'}</code> to auto-personalize.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCampaign(false)}>Cancel</Button>
            <Button onClick={launchCampaign} disabled={creatingCampaign || !campaignMsg.trim()} className="bg-gradient-to-r from-emerald-500 to-teal-600">
              {creatingCampaign ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Launch to {dashboard?.segments?.[campaignSegment] || 0} patients
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={openReview} onOpenChange={setOpenReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulate patient feedback</DialogTitle>
            <DialogDescription>{reviewPatient?.name} — in production this comes via WhatsApp 24h after visit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rating</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setReviewRating(n)} className={`text-3xl transition ${n <= reviewRating ? 'text-amber-400' : 'text-slate-300'}`}>★</button>
                ))}
              </div>
            </div>
            <div>
              <Label>Feedback (optional)</Label>
              <Textarea value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)} rows={3} placeholder="Anything the patient shared…" />
            </div>
            <div className="text-xs bg-slate-50 p-3 rounded-lg text-slate-600">
              <b>Branching logic:</b> Rating 4–5 → routed to Google review link. Rating 1–3 → kept private for you to resolve first.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReview(false)}>Cancel</Button>
            <Button onClick={submitReview} className="bg-gradient-to-r from-emerald-500 to-teal-600">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
