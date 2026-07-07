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

async function seedReferrers(clinicId) {
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000);
  const referrers = [
    { id: uuidv4(), clinic_id: clinicId, name: 'Apollo Pharmacy - Curzon Gate', type: 'pharmacy', contact: '919830100001', notes: 'Near main square', created_at: daysAgo(180) },
    { id: uuidv4(), clinic_id: clinicId, name: 'Dr. Suresh Verma (GP)', type: 'doctor', contact: '919830100002', notes: 'General physician, refers dental cases', created_at: daysAgo(300) },
    { id: uuidv4(), clinic_id: clinicId, name: 'Bardhaman Diagnostic Lab', type: 'lab', contact: '919830100003', notes: 'X-ray tie-up', created_at: daysAgo(220) },
    { id: uuidv4(), clinic_id: clinicId, name: 'Fit-Zone Gym', type: 'gym', contact: '919830100004', notes: 'Sports mouthguard leads', created_at: daysAgo(120) },
    { id: uuidv4(), clinic_id: clinicId, name: 'Sunrise Public School', type: 'school', contact: '919830100005', notes: 'Annual dental camp', created_at: daysAgo(400) },
    { id: uuidv4(), clinic_id: clinicId, name: 'Ananya Roy (patient)', type: 'patient', contact: '919830112233', notes: 'Loyal patient, brings family', created_at: daysAgo(200) },
    { id: uuidv4(), clinic_id: clinicId, name: 'Meera Iyer (patient)', type: 'patient', contact: '919830556677', notes: 'Refers colleagues', created_at: daysAgo(90) },
  ];
  return referrers;
}

function seedReferrals(clinicId, referrers) {
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000);
  const rBy = (name) => referrers.find((r) => r.name.startsWith(name))?.id;
  const list = [
    ['Apollo Pharmacy', 'Sunita Kar', '919835001001', 'cleaning', 'converted', 60],
    ['Apollo Pharmacy', 'Manoj Ghosh', '919835001002', 'filling', 'converted', 45],
    ['Apollo Pharmacy', 'Rita Basak', '919835001003', 'consultation', 'booked', 12],
    ['Apollo Pharmacy', 'Amit Saha', '919835001004', 'consultation', 'lost', 100],
    ['Apollo Pharmacy', 'Deepa Nag', '919835001005', 'cleaning', 'converted', 25],
    ['Dr. Suresh', 'Rajiv Chowdhury', '919835002001', 'RCT', 'converted', 80],
    ['Dr. Suresh', 'Kalpana Devi', '919835002002', 'extraction', 'converted', 30],
    ['Dr. Suresh', 'Sourav Dutta', '919835002003', 'consultation', 'contacted', 5],
    ['Dr. Suresh', 'Preeti Roy', '919835002004', 'RCT', 'converted', 150],
    ['Bardhaman Diagnostic', 'Anil Kumar', '919835003001', 'consultation', 'converted', 40],
    ['Bardhaman Diagnostic', 'Sonia Paul', '919835003002', 'cleaning', 'lost', 90],
    ['Fit-Zone Gym', 'Karan Roy', '919835004001', 'mouthguard', 'converted', 20],
    ['Fit-Zone Gym', 'Priyanka Sen', '919835004002', 'whitening', 'booked', 3],
    ['Sunrise Public', 'Rohan Das (student parent)', '919835005001', 'cleaning', 'converted', 35],
    ['Sunrise Public', 'Priya Sengupta', '919835005002', 'braces', 'converted', 40],
    ['Sunrise Public', 'Amit Bose', '919835005003', 'cleaning', 'contacted', 8],
    ['Ananya Roy', 'Aditi Roy (sister)', '919835006001', 'consultation', 'converted', 50],
    ['Ananya Roy', 'Rakesh Roy (husband)', '919835006002', 'cleaning', 'converted', 70],
    ['Meera Iyer', 'Kavya S (colleague)', '919835007001', 'consultation', 'converted', 30],
    ['Meera Iyer', 'Ravi K (colleague)', '919835007002', 'filling', 'booked', 6],
  ];
  return list.map(([rName, pName, phone, service, status, dAgo]) => ({
    id: uuidv4(),
    clinic_id: clinicId,
    referrer_id: rBy(rName),
    referrer_name: referrers.find((r) => r.name.startsWith(rName))?.name || rName,
    patient_name: pName,
    patient_phone: phone,
    service,
    status,
    notes: '',
    created_at: daysAgo(dAgo),
    converted_at: status === 'converted' ? daysAgo(Math.max(0, dAgo - 3)) : null,
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
    }
    const refCount = await db.collection('referrers').countDocuments({ clinic_id: clinic.id });
    if (refCount === 0) {
      const referrers = await seedReferrers(clinic.id);
      await db.collection('referrers').insertMany(referrers);
      const referrals = seedReferrals(clinic.id, referrers);
      await db.collection('referrals').insertMany(referrals);
    }
    return NextResponse.json({ ok: true, clinic });
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

  // GET /api/referrers
  if (method === 'GET' && path === 'referrers') {
    const items = await db.collection('referrers').find({ clinic_id: clinic.id }).sort({ created_at: -1 }).toArray();
    return NextResponse.json(items.map((x) => ({ ...x, _id: undefined })));
  }

  // POST /api/referrers
  if (method === 'POST' && path === 'referrers') {
    const body = await request.json();
    const doc = {
      id: uuidv4(), clinic_id: clinic.id,
      name: body.name, type: body.type || 'other', contact: body.contact || '', notes: body.notes || '',
      created_at: new Date(),
    };
    await db.collection('referrers').insertOne(doc);
    return NextResponse.json({ ...doc, _id: undefined });
  }

  // GET /api/referrals
  if (method === 'GET' && path === 'referrals') {
    const items = await db.collection('referrals').find({ clinic_id: clinic.id }).sort({ created_at: -1 }).toArray();
    return NextResponse.json(items.map((x) => ({ ...x, _id: undefined })));
  }

  // POST /api/referrals
  if (method === 'POST' && path === 'referrals') {
    const body = await request.json();
    const referrer = body.referrer_id ? await db.collection('referrers').findOne({ id: body.referrer_id }) : null;
    const doc = {
      id: uuidv4(), clinic_id: clinic.id,
      referrer_id: body.referrer_id,
      referrer_name: referrer?.name || body.referrer_name || 'Unknown',
      patient_name: body.patient_name,
      patient_phone: body.patient_phone || '',
      service: body.service || 'consultation',
      status: body.status || 'contacted',
      notes: body.notes || '',
      created_at: new Date(),
      converted_at: null,
    };
    await db.collection('referrals').insertOne(doc);
    return NextResponse.json({ ...doc, _id: undefined });
  }

  // PATCH /api/referrals/:id - update status
  if (method === 'PATCH' && pathParts[0] === 'referrals' && pathParts[1]) {
    const body = await request.json();
    const upd = { status: body.status };
    if (body.status === 'converted') upd.converted_at = new Date();
    await db.collection('referrals').updateOne({ id: pathParts[1] }, { $set: upd });
    const item = await db.collection('referrals').findOne({ id: pathParts[1] });
    return NextResponse.json({ ...item, _id: undefined });
  }

  // GET /api/referrals/leaderboard - aggregated stats per referrer
  if (method === 'GET' && path === 'referrals/leaderboard') {
    const [referrers, referrals] = await Promise.all([
      db.collection('referrers').find({ clinic_id: clinic.id }).toArray(),
      db.collection('referrals').find({ clinic_id: clinic.id }).toArray(),
    ]);
    const avg = clinic.avg_visit_value || 0;
    const board = referrers.map((r) => {
      const rs = referrals.filter((x) => x.referrer_id === r.id);
      const converted = rs.filter((x) => x.status === 'converted').length;
      const booked = rs.filter((x) => x.status === 'booked').length;
      const contacted = rs.filter((x) => x.status === 'contacted').length;
      const lost = rs.filter((x) => x.status === 'lost').length;
      const revenue = converted * avg;
      const conversion = rs.length ? Math.round((converted / rs.length) * 100) : 0;
      return {
        ...r, _id: undefined,
        total: rs.length, converted, booked, contacted, lost, revenue, conversion,
      };
    }).sort((a, b) => b.revenue - a.revenue);
    const totals = {
      referrers: referrers.length,
      referrals: referrals.length,
      converted: referrals.filter((x) => x.status === 'converted').length,
      revenue: referrals.filter((x) => x.status === 'converted').length * avg,
      pipeline_value: (referrals.filter((x) => x.status === 'booked').length + referrals.filter((x) => x.status === 'contacted').length) * avg,
    };
    // Top type contribution
    const byType = {};
    for (const r of board) {
      byType[r.type] = (byType[r.type] || 0) + r.revenue;
    }
    return NextResponse.json({ board, totals, by_type: byType });
  }

  // POST /api/ai/receptionist - conversational AI receptionist
  if (method === 'POST' && path === 'ai/receptionist') {
    const body = await request.json();
    const { session_id, message, patient_name } = body;
    if (!session_id || !message) return NextResponse.json({ error: 'session_id and message required' }, { status: 400 });

    // fetch or create session
    let session = await db.collection('receptionist_sessions').findOne({ id: session_id });
    if (!session) {
      session = { id: session_id, clinic_id: clinic.id, patient_name: patient_name || 'Patient', messages: [], created_at: new Date() };
      await db.collection('receptionist_sessions').insertOne(session);
    }

    // append user message
    session.messages.push({ role: 'user', content: message, at: new Date() });

    const clinicCtx = `AI Receptionist for ${clinic.name} (${clinic.specialty}, ${clinic.city}). Doctor: ${clinic.doctor_name}. Fee \u20b9${clinic.avg_visit_value}. Hours: Mon-Sat 10-1 & 5-8, closed Sun. Services: consultation, cleaning, filling, RCT, extraction, whitening, braces.`;
    const system = `${clinicCtx}\nHandle booking, reschedule, cancel, price, hours, FAQs. Warm, WhatsApp-style, max 3 short sentences. NEVER give medical/clinical advice \u2014 say doctor will address on visit. For booking/reschedule intent, suggest 2 specific slots this week.\nReturn STRICT JSON: {"reply": string, "intent": "booking"|"reschedule"|"cancel"|"price_inquiry"|"services"|"hours"|"faq"|"other", "suggested_slots": [{"day","time"}], "requires_human": bool}. JSON only.`;

    // last 6 turns
    const history = session.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    const userInstr = `Conversation so far is in messages. Current user message: "${message}". Respond as the receptionist. Return only strict JSON, no markdown.`;

    // call LLM directly with full history
    const url = 'https://integrations.emergentagent.com/llm/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EMERGENT_LLM_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: userInstr }],
        temperature: 0.5,
        max_tokens: 250,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Receptionist LLM error', res.status, errText);
      return NextResponse.json({ error: `LLM ${res.status}: ${errText}` }, { status: 500 });
    }
    const data = await res.json();
    let raw = data.choices?.[0]?.message?.content?.trim() || '{}';
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { reply: raw, intent: 'other', suggested_slots: [], requires_human: false }; }

    session.messages.push({ role: 'assistant', content: parsed.reply, intent: parsed.intent, suggested_slots: parsed.suggested_slots || [], at: new Date() });
    await db.collection('receptionist_sessions').updateOne({ id: session_id }, { $set: { messages: session.messages, last_intent: parsed.intent, updated_at: new Date() } });

    return NextResponse.json(parsed);
  }

  // GET /api/receptionist/:sessionId
  if (method === 'GET' && pathParts[0] === 'receptionist' && pathParts[1]) {
    const session = await db.collection('receptionist_sessions').findOne({ id: pathParts[1] });
    if (!session) return NextResponse.json({ messages: [] });
    return NextResponse.json({ ...session, _id: undefined });
  }

  // POST /api/ai/marketing - generate marketing content (reel/festival/gbp/whatsapp)
  if (method === 'POST' && path === 'ai/marketing') {
    const body = await request.json();
    const { content_type, topic, language = 'English', tone = 'warm and professional' } = body;
    const clinicCtx = `Clinic: ${clinic.name} (${clinic.specialty}) in ${clinic.city}. Doctor: ${clinic.doctor_name}.`;
    const system = 'You are a top-tier social media copywriter for Indian medical clinics. You write scroll-stopping, culturally relevant, and compliant content. NEVER promise cures, medical outcomes, or make diagnostic claims. Focus on education, awareness, trust-building, and inviting patients to visit. Return ONLY strict JSON, no markdown fences.';

    let user;
    if (content_type === 'reel_script') {
      user = `${clinicCtx}\nCreate a 20-second Instagram Reel / YouTube Short script in ${language} on topic: "${topic}". Tone: ${tone}.\nReturn strict JSON with keys: "hook" (first 3 seconds, punchy, curiosity), "body" (7-10 seconds, educational value, 2-3 short lines), "cta" (call to action, 3-5 seconds), "on_screen_text" (array of 4-6 short text overlays), "caption" (Instagram caption under 280 chars, warm), "hashtags" (array of 8 relevant tags including local city + specialty).`;
    } else if (content_type === 'festival_post') {
      user = `${clinicCtx}\nCreate a festival/occasion social media post in ${language} for: "${topic}". Warm, non-promotional-feeling but subtly reminds patients about the clinic.\nReturn strict JSON with keys: "headline" (max 8 words), "body" (2-3 short lines, greeting + subtle health tip + warm sign-off), "hashtags" (array of 8), "whatsapp_status_version" (60 chars max).`;
    } else if (content_type === 'gbp_post') {
      user = `${clinicCtx}\nCreate a Google Business Profile post in ${language} on topic: "${topic}". Educational, builds trust, ends with a soft CTA.\nReturn strict JSON with keys: "title" (max 60 chars), "body" (150-250 chars, 1-2 short paragraphs), "cta_button" (one of: "Book", "Learn more", "Call", "Visit"), "hashtags" (array of 5).`;
    } else if (content_type === 'whatsapp_promo') {
      user = `${clinicCtx}\nCreate a WhatsApp broadcast message in ${language} promoting a soft offer/awareness about: "${topic}". Non-spammy, warm, respectful. Under 280 chars.\nReturn strict JSON with keys: "message" (the full WhatsApp text), "followup_line" (a friendly sign-off if patient replies).`;
    } else {
      return NextResponse.json({ error: 'Unknown content_type' }, { status: 400 });
    }

    try {
      const raw = await callLLM(system, user);
      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      const content = JSON.parse(cleaned);
      // persist
      await db.collection('marketing_content').insertOne({
        id: uuidv4(), clinic_id: clinic.id, content_type, topic, language, tone, content, created_at: new Date(),
      });
      return NextResponse.json({ content_type, topic, language, content });
    } catch (e) {
      return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
    }
  }

  // GET /api/marketing/history
  if (method === 'GET' && path === 'marketing/history') {
    const items = await db.collection('marketing_content').find({ clinic_id: clinic.id }).sort({ created_at: -1 }).limit(20).toArray();
    return NextResponse.json(items.map((x) => ({ ...x, _id: undefined })));
  }

  // POST /api/ai/coach - AI Business Coach insights based on current clinic data
  if (method === 'POST' && path === 'ai/coach') {
    const patients = await db.collection('patients').find({ clinic_id: clinic.id }).toArray();
    const segCounts = { overdue_followup: 0, inactive_6mo: 0, annual_checkup: 0, active: 0 };
    for (const p of patients) segCounts[segmentOf(p)]++;
    const sends = await db.collection('sends').find({ clinic_id: clinic.id }).toArray();
    const campaigns = await db.collection('campaigns').find({ clinic_id: clinic.id }).toArray();
    const reviews = await db.collection('reviews').find({ clinic_id: clinic.id }).toArray();
    const sent = sends.filter((s) => s.status !== 'pending').length;
    const replied = sends.filter((s) => ['replied', 'booked'].includes(s.status)).length;
    const booked = sends.filter((s) => s.status === 'booked').length;
    const positive = reviews.filter((r) => r.sentiment === 'positive').length;
    const negative = reviews.filter((r) => r.sentiment === 'negative').length;
    const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : null;
    const recallable = segCounts.overdue_followup + segCounts.inactive_6mo + segCounts.annual_checkup;
    const untapped = Math.round(recallable * 0.12 * (clinic.avg_visit_value || 0));

    const context = {
      clinic_name: clinic.name,
      specialty: clinic.specialty,
      city: clinic.city,
      avg_visit_value: clinic.avg_visit_value,
      total_patients: patients.length,
      segments: segCounts,
      campaigns_launched: campaigns.length,
      messages_sent: sent,
      replied,
      booked,
      recovered_revenue: booked * (clinic.avg_visit_value || 0),
      untapped_potential_this_month: untapped,
      reply_rate: sent ? Math.round((replied / sent) * 100) : null,
      conversion_rate: replied ? Math.round((booked / replied) * 100) : null,
      reviews_total: reviews.length,
      reviews_positive: positive,
      reviews_negative: negative,
      average_rating: avgRating,
    };

    const system = 'You are the AI Business Coach for an Indian medical clinic. You give sharp, plain-language OPERATIONAL and GROWTH insights only \u2014 never clinical advice, never treatment recommendations. Every insight ties to money, patient retention, or reputation. Use INR (\u20b9) and Indian number formatting. Be direct, specific, actionable. Never generic. Focus on the biggest levers first.';
    const user = `Here is today\u2019s clinic snapshot as JSON:\n${JSON.stringify(context, null, 2)}\n\nProduce EXACTLY 4 insights as a strict JSON array. Each object must have keys: "title" (max 8 words, punchy), "insight" (2 sentences plain-language observation), "action" (1 sentence specific next step the doctor should take today), "impact" (short phrase estimating rupee upside or reputation gain, e.g. "\u20b918,000 recoverable" or "+0.3 rating in 2 weeks"), "severity" (one of: "critical", "opportunity", "wins", "reputation"). Return ONLY the JSON array, no markdown, no commentary.`;

    try {
      const raw = await callLLM(system, user);
      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      const insights = JSON.parse(cleaned);
      return NextResponse.json({ insights, context });
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
