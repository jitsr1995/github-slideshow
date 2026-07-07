import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'clinicos_ai';
const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;

let cachedClient = null;
async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL);
    await cachedClient.connect();
  }
  return cachedClient.db(DB_NAME);
}

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function segmentOf(patient) {
  const now = new Date();
  const last = new Date(patient.last_visit_date);
  const daysSince = daysBetween(last, now);
  const nextFollowup = patient.next_followup_date ? new Date(patient.next_followup_date) : null;
  if (nextFollowup && daysBetween(nextFollowup, now) >= 0 && daysBetween(nextFollowup, now) <= 30) {
    return 'overdue_followup';
  }
  if (daysSince >= 330 && daysSince <= 400) return 'annual_checkup';
  if (daysSince >= 180) return 'inactive_6mo';
  return 'active';
}

async function callLLM(systemPrompt, userPrompt) {
  const url = 'https://integrations.emergentagent.com/llm/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EMERGENT_LLM_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

function waLink(phone, text) {
  const p = String(phone).replace(/[^0-9]/g, '');
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

async function ensureClinic(db) {
  let clinic = await db.collection('clinics').findOne({ _default: true });
  if (!clinic) {
    clinic = {
      id: uuidv4(),
      _default: true,
      name: 'Bright Smile Dental Clinic',
      doctor_name: 'Dr. Priya Sharma',
      specialty: 'Dentistry',
      city: 'Bardhaman',
      avg_visit_value: 1200,
      google_review_link: 'https://g.page/r/brightsmiledental/review',
      created_at: new Date(),
    };
    await db.collection('clinics').insertOne(clinic);
  }
  return clinic;
}

function seedPatients(clinicId) {
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000);
  const daysAhead = (d) => new Date(now.getTime() + d * 86400000);
  const list = [
    // Overdue followup (next_followup_date is today or past, within 30 days)
    ['Ananya Roy', '919830112233', daysAgo(30), daysAgo(2), 'Root canal', 'Followup for RCT stage 2'],
    ['Rohit Das', '919830223344', daysAgo(45), daysAgo(5), 'Cavity filling', 'Second sitting due'],
    ['Priya Menon', '919830334455', daysAgo(25), daysAhead(3), 'Braces adjustment', 'Monthly adjustment'],
    ['Aarav Kapoor', '919830445566', daysAgo(60), daysAgo(15), 'Wisdom tooth extraction', 'Post-op review'],
    ['Meera Iyer', '919830556677', daysAgo(21), daysAhead(7), 'Teeth cleaning', 'Followup polish'],
    // Inactive 6mo+
    ['Sanjay Gupta', '919830667788', daysAgo(210), null, 'Cleaning', 'Regular cleaning patient'],
    ['Neha Verma', '919830778899', daysAgo(240), null, 'Cavity check', 'Recommended 6-month visit'],
    ['Vikram Singh', '919830889900', daysAgo(280), null, 'Cleaning', 'Overdue for cleaning'],
    ['Kavita Bose', '919830990011', daysAgo(320), null, 'Whitening', 'Annual whitening'],
    ['Arjun Nair', '919831001122', daysAgo(200), null, 'Filling', 'Old filling review'],
    ['Ishita Sen', '919831112233', daysAgo(260), null, 'Cleaning', 'Long gap'],
    ['Rahul Jha', '919831223344', daysAgo(195), null, 'Braces followup', 'Retainer check'],
    ['Divya Pillai', '919831334455', daysAgo(230), null, 'Cleaning', 'Missed last appointment'],
    ['Karan Malhotra', '919831445566', daysAgo(300), null, 'Extraction site check', 'Post-extraction long term'],
    // Annual checkup (330-400 days)
    ['Sneha Ghosh', '919831556677', daysAgo(340), null, 'Annual checkup', 'Due for annual'],
    ['Manish Rao', '919831667788', daysAgo(360), null, 'Annual cleaning', 'Annual cleaning due'],
    ['Pooja Mehta', '919831778899', daysAgo(375), null, 'Full mouth checkup', 'Annual visit'],
    ['Ravi Chatterjee', '919831889900', daysAgo(350), null, 'Cleaning', 'Annual due'],
    // Active recent
    ['Tanvi Shah', '919831990011', daysAgo(10), daysAhead(60), 'Filling', 'Recently done'],
    ['Nikhil Reddy', '919832001122', daysAgo(15), daysAhead(45), 'Cleaning', 'Recent'],
    ['Sara Khan', '919832112233', daysAgo(5), daysAhead(90), 'Consultation', 'Recent consult'],
    ['Aditya Banerjee', '919832223344', daysAgo(8), daysAhead(30), 'RCT stage 1', 'Recent, next stage due'],
  ];
  return list.map(([name, phone, last, next, reason, notes]) => ({
    id: uuidv4(),
    clinic_id: clinicId,
    name,
    phone,
    last_visit_date: last,
    next_followup_date: next,
    visit_reason: reason,
    notes,
    tags: [],
    created_at: new Date(),
  }));
}

async function handle(request, method, pathParts) {
  const db = await getDb();
  const clinic = await ensureClinic(db);
  const path = pathParts.join('/');

  // GET /api/health
  if (method === 'GET' && path === 'health') {
    return NextResponse.json({ ok: true });
  }

  // POST /api/init - seed patients if none
  if (method === 'POST' && path === 'init') {
    const count = await db.collection('patients').countDocuments({ clinic_id: clinic.id });
    if (count === 0) {
      const patients = seedPatients(clinic.id);
      await db.collection('patients').insertMany(patients);
      return NextResponse.json({ seeded: patients.length, clinic });
    }
    return NextResponse.json({ seeded: 0, existing: count, clinic });
  }

  // GET /api/clinic
  if (method === 'GET' && path === 'clinic') {
    return NextResponse.json(clinic);
  }

  // PATCH /api/clinic
  if (method === 'PATCH' && path === 'clinic') {
    const body = await request.json();
    const allowed = ['name', 'doctor_name', 'specialty', 'city', 'avg_visit_value', 'google_review_link'];
    const update = {};
    for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];
    await db.collection('clinics').updateOne({ id: clinic.id }, { $set: update });
    const updated = await db.collection('clinics').findOne({ id: clinic.id });
    return NextResponse.json(updated);
  }

  // GET /api/patients?segment=xxx
  if (method === 'GET' && path === 'patients') {
    const url = new URL(request.url);
    const segment = url.searchParams.get('segment');
    const patients = await db.collection('patients').find({ clinic_id: clinic.id }).sort({ last_visit_date: -1 }).toArray();
    const enriched = patients.map((p) => ({ ...p, _id: undefined, segment: segmentOf(p) }));
    const filtered = segment && segment !== 'all' ? enriched.filter((p) => p.segment === segment) : enriched;
    return NextResponse.json(filtered);
  }

  // POST /api/patients
  if (method === 'POST' && path === 'patients') {
    const body = await request.json();
    const patient = {
      id: uuidv4(),
      clinic_id: clinic.id,
      name: body.name,
      phone: body.phone,
      last_visit_date: body.last_visit_date ? new Date(body.last_visit_date) : new Date(),
      next_followup_date: body.next_followup_date ? new Date(body.next_followup_date) : null,
      visit_reason: body.visit_reason || '',
      notes: body.notes || '',
      tags: body.tags || [],
      created_at: new Date(),
    };
    await db.collection('patients').insertOne(patient);
    return NextResponse.json({ ...patient, _id: undefined });
  }

  // POST /api/ai/message - generate personalized WhatsApp copy
  if (method === 'POST' && path === 'ai/message') {
    const body = await request.json();
    const { type, patient_name, visit_reason, days_since_visit, language = 'English', clinic_name, doctor_name, review_link } = body;
    const system = 'You are a warm, respectful copywriter for an Indian medical clinic. Write short WhatsApp messages under 240 characters, single paragraph, no emojis unless requested, no medical claims, no diagnosis. Never ask for a "5-star review" — ask for honest feedback. Use polite Indian English tone.';
    let user;
    if (type === 'recall_followup') {
      user = `Write a WhatsApp recall message in ${language} from ${doctor_name} at ${clinic_name} to ${patient_name}. Their last visit was ${days_since_visit} days ago for ${visit_reason}. Gently invite them to book a follow-up. Keep it warm and under 240 chars. Return only the message text, no quotes.`;
    } else if (type === 'recall_inactive') {
      user = `Write a WhatsApp reactivation message in ${language} from ${doctor_name} at ${clinic_name} to ${patient_name}. It has been ${days_since_visit} days since their last visit (${visit_reason}). Warmly invite them to book a routine check. Under 240 chars. Return only the message text.`;
    } else if (type === 'recall_annual') {
      user = `Write a WhatsApp annual checkup reminder in ${language} from ${doctor_name} at ${clinic_name} to ${patient_name}. Their annual visit is due. Under 240 chars. Return only the message text.`;
    } else if (type === 'review_prompt') {
      user = `Write a WhatsApp message in ${language} from ${clinic_name} to ${patient_name} asking for HONEST feedback about their recent visit for ${visit_reason}. Ask them to reply with a rating from 1 to 5. Do NOT ask for 5-star rating. Under 240 chars. Return only the message text.`;
    } else if (type === 'review_google') {
      user = `Write a WhatsApp message in ${language} thanking ${patient_name} for positive feedback and politely asking them to share their honest review on Google using this link: ${review_link}. Under 240 chars. Return only the message text.`;
    } else {
      user = `Write a friendly WhatsApp message to ${patient_name} from ${clinic_name}.`;
    }
    try {
      const text = await callLLM(system, user);
      return NextResponse.json({ text });
    } catch (e) {
      return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
    }
  }

  // POST /api/campaigns - create a campaign for a segment with a message template, generate sends
  if (method === 'POST' && path === 'campaigns') {
    const body = await request.json();
    const { segment, message_template, type } = body;
    const patients = await db.collection('patients').find({ clinic_id: clinic.id }).toArray();
    const targets = patients.filter((p) => segmentOf(p) === segment);
    const campaign = {
      id: uuidv4(),
      clinic_id: clinic.id,
      type: type || 'recall',
      segment,
      message_template,
      created_at: new Date(),
      total_targets: targets.length,
    };
    await db.collection('campaigns').insertOne(campaign);
    const sends = targets.map((p) => {
      const personalized = String(message_template).replace(/\{name\}/g, p.name.split(' ')[0]);
      return {
        id: uuidv4(),
        campaign_id: campaign.id,
        clinic_id: clinic.id,
        patient_id: p.id,
        patient_name: p.name,
        phone: p.phone,
        message: personalized,
        wa_link: waLink(p.phone, personalized),
        status: 'pending',
        created_at: new Date(),
      };
    });
    if (sends.length) await db.collection('sends').insertMany(sends);
    return NextResponse.json({ campaign: { ...campaign, _id: undefined }, sends: sends.map((s) => ({ ...s, _id: undefined })) });
  }

  // GET /api/campaigns
  if (method === 'GET' && path === 'campaigns') {
    const campaigns = await db.collection('campaigns').find({ clinic_id: clinic.id }).sort({ created_at: -1 }).toArray();
    const withStats = await Promise.all(campaigns.map(async (c) => {
      const sends = await db.collection('sends').find({ campaign_id: c.id }).toArray();
      const sent = sends.filter((s) => s.status !== 'pending').length;
      const replied = sends.filter((s) => ['replied', 'booked'].includes(s.status)).length;
      const booked = sends.filter((s) => s.status === 'booked').length;
      return { ...c, _id: undefined, sent, replied, booked };
    }));
    return NextResponse.json(withStats);
  }

  // GET /api/campaigns/:id/sends
  if (method === 'GET' && pathParts[0] === 'campaigns' && pathParts[2] === 'sends') {
    const cid = pathParts[1];
    const sends = await db.collection('sends').find({ campaign_id: cid }).sort({ created_at: -1 }).toArray();
    return NextResponse.json(sends.map((s) => ({ ...s, _id: undefined })));
  }

  // PATCH /api/sends/:id - update status
  if (method === 'PATCH' && pathParts[0] === 'sends' && pathParts[1]) {
    const sid = pathParts[1];
    const body = await request.json();
    const update = { status: body.status };
    if (body.status === 'sent') update.sent_at = new Date();
    if (body.status === 'replied') update.responded_at = new Date();
    if (body.status === 'booked') update.booked_at = new Date();
    await db.collection('sends').updateOne({ id: sid }, { $set: update });
    const send = await db.collection('sends').findOne({ id: sid });
    return NextResponse.json({ ...send, _id: undefined });
  }

  // POST /api/reviews - patient submits rating via internal form
  if (method === 'POST' && path === 'reviews') {
    const body = await request.json();
    const patient = await db.collection('patients').findOne({ id: body.patient_id });
    const rating = Number(body.rating);
    const sentiment = rating >= 4 ? 'positive' : 'negative';
    const review = {
      id: uuidv4(),
      clinic_id: clinic.id,
      patient_id: body.patient_id,
      patient_name: patient?.name || 'Unknown',
      rating,
      sentiment,
      routed_to: sentiment === 'positive' ? 'google' : 'private_feedback',
      feedback_text: body.feedback_text || '',
      created_at: new Date(),
    };
    await db.collection('reviews').insertOne(review);
    return NextResponse.json({ ...review, _id: undefined });
  }

  // GET /api/reviews
  if (method === 'GET' && path === 'reviews') {
    const reviews = await db.collection('reviews').find({ clinic_id: clinic.id }).sort({ created_at: -1 }).toArray();
    return NextResponse.json(reviews.map((r) => ({ ...r, _id: undefined })));
  }

  // GET /api/dashboard
  if (method === 'GET' && path === 'dashboard') {
    const patients = await db.collection('patients').find({ clinic_id: clinic.id }).toArray();
    const segCounts = { overdue_followup: 0, inactive_6mo: 0, annual_checkup: 0, active: 0 };
    for (const p of patients) segCounts[segmentOf(p)]++;
    const sends = await db.collection('sends').find({ clinic_id: clinic.id }).toArray();
    const totalSent = sends.filter((s) => s.status !== 'pending').length;
    const totalReplied = sends.filter((s) => ['replied', 'booked'].includes(s.status)).length;
    const totalBooked = sends.filter((s) => s.status === 'booked').length;
    const recoveredRevenue = totalBooked * (clinic.avg_visit_value || 0);
    const reviews = await db.collection('reviews').find({ clinic_id: clinic.id }).toArray();
    const positive = reviews.filter((r) => r.sentiment === 'positive').length;
    const negative = reviews.filter((r) => r.sentiment === 'negative').length;
    const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;
    const todayFollowups = patients.filter((p) => segmentOf(p) === 'overdue_followup').length;
    return NextResponse.json({
      clinic,
      total_patients: patients.length,
      segments: segCounts,
      today_followups: todayFollowups,
      campaign_stats: { sent: totalSent, replied: totalReplied, booked: totalBooked },
      recovered_revenue: recoveredRevenue,
      reviews: { total: reviews.length, positive, negative, average: avgRating },
    });
  }

  return NextResponse.json({ error: 'Not found', path, method }, { status: 404 });
}

export async function GET(request, context) {
  const { path = [] } = await context.params;
  try { return await handle(request, 'GET', path); } catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
export async function POST(request, context) {
  const { path = [] } = await context.params;
  try { return await handle(request, 'POST', path); } catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
export async function PATCH(request, context) {
  const { path = [] } = await context.params;
  try { return await handle(request, 'PATCH', path); } catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
export async function DELETE(request, context) {
  const { path = [] } = await context.params;
  try { return await handle(request, 'DELETE', path); } catch (e) { return NextResponse.json({ error: String(e.message || e) }, { status: 500 }); }
}
