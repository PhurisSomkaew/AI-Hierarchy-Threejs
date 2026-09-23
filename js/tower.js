import * as THREE from 'three';
import { EffectComposer } from 'https://unpkg.com/three@0.184.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.184.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.184.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'https://unpkg.com/three@0.184.0/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three@0.184.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.184.0/examples/jsm/loaders/GLTFLoader.js';

/* ============================================================
   หอคอยจดหมายเหตุ AI — โถงชั้นล่าง + ชั้น 1 (Rule-Based)
   ยุคของแต่ละชั้น: 1 อนาล็อกล้วน → 4 โฮโลแกรม
   ชั้น 1 เปิดแล้ว, ชั้น 2-4 ยังล็อก
============================================================ */

const TH = '"IBM Plex Sans Thai","IBM Plex Sans",sans-serif';
const P = {
  sky: [0x2A1E18, 0x6B4A32, 0xC9915A],
  fog: 0x3A2A20,
  ground: 0x4A3526,
  ink: 0x201711,
  wood: 0x6B4A2E, woodDark: 0x4A3324, woodLight: 0x8A6A42,
  brass: 0xC8912E, brassDark: 0x8A6420,
  skin: 0xEBD0B4, hair: 0x2A211C,
  keeperShirt: 0x8A6A3E, keeperPant: 0x5A4228,
  mechShirt: 0x4A6B62, mechPant: 0x3A4A44,
  plShirt: 0x6B5A4A, plSkirt: 0x4A3A2E, plPack: 0x8A6A3E
};
const FLOORS = [
  /* `era` names the room you are about to walk into, as a place — not a
     label pair. The old values were all built to one template ("ยุคX ·
     Y"), six times over, and that mechanical sameness is what read as
     machine-written far more than the separator itself did. */
  { t: 'AI', th: 'ทำตามกฎที่คนเขียน', col: 0xD98B3A, tx: '#8A5410', era: 'โรงเครื่องไขลาน', open: true },
  { t: 'Machine Learning', th: 'ปรับกฎเองจากข้อมูล', col: 0x6FB3A8, tx: '#186158', era: 'ห้องหน้าปัดเข็ม', open: true },
  { t: 'Deep Learning', th: 'หาจุดสังเกตเอง', col: 0x8FBF63, tx: '#456B22', era: 'โรงแขนกล', open: true },
  { t: 'Generative AI', th: 'สร้างของใหม่ได้', col: 0xE0685A, tx: '#A83326', era: 'ห้องโฮโลแกรม', open: true },
  { t: 'LLM', th: 'ทายคำถัดไปทีละคำ', col: 0x8E7BD6, tx: '#5A46A8', era: 'ห้องตัวอักษรลอย', open: true },
  { t: 'Agentic AI', th: 'สั่งทีเดียว จบงานเอง', col: 0x4E8FD6, tx: '#1F5C99', era: 'ห้องบัญชาการ', open: true }
];
const FLOOR_TINT = FLOORS.map(f => new THREE.Color(f.col));
/* camera personality per era: floor 1 (mechanical) tight and snappy,
   floor 4 (hologram) wide and floaty — the follow-cam tunes itself like
   everything else already does per floor, instead of one fixed rig for all */
const CAM_TUNE = [
  { fov: 52, damp: 3.4 },
  { fov: 46, damp: 4.6 },
  { fov: 50, damp: 3.7 },
  { fov: 53, damp: 3.0 },
  { fov: 58, damp: 2.3 },
  { fov: 56, damp: 2.6 },
  { fov: 60, damp: 2.2 }
];
const FW = 19, FD = 10, FZ = -7;
/* the one gap ever cut into a floor's back wall — floor 5's doorway to
   the Jev bridge (see JEV_ROOM further down). Declared up here, next to
   FW/FD/FZ, because the per-floor construction loop below needs it and
   that loop runs before the Jev-specific geometry does. */
const JEV_GATE = { w: 2.6, h: 3.3 };
const floorY = i => 5.6 + i * 7.6;
/* everything structural above the top floor (columns, roof, lift rail) is
   derived from the floor count, so adding a floor doesn't leave the roof
   sitting halfway down the building. With the original 4 floors this
   worked out to 36 — one floor-height above the top deck — so the same
   formula (floorY at the "next" floor index) reproduces that exactly and
   scales automatically when a floor is added. */
const TOP_Y = floorY(FLOORS.length);
/* the lobby establishing shot was framed when the tower topped out at 36;
   scaling it by the current height keeps the same composition instead of
   cropping the roof off every time a floor is added */
const LOBBY_K = TOP_Y / 36;

/* เนื้อหากระดานเรียนรู้ — เรียบเรียงจาก docs ของผู้สอน (agentic.txt) */
const DOCS = [
  {
    q: 'AI คืออะไร?', short: 'AI คืออะไร?',
    en: 'Artificial Intelligence',
    lead: 'ชั้นที่ 1 ชั้นตั้งต้นของทุกอย่าง',
    blocks: [
      { h: 'นิยามสั้น ๆ', p: 'ระบบอัตโนมัติ (Automatic System) ที่จัดการงานแทนมนุษย์ได้' },
      { h: 'มันทำงานยังไง', p: 'ทำงานภายใต้ตรรกะแบบ <b>Rule-Based</b> คือ “ถ้า AI ทำงานภายใต้เงื่อนไขนี้ ก็จะได้ผลลัพธ์แบบนี้”' },
      { h: 'ตัวอย่างในชั้นนี้', p: 'ตู้กดน้ำหยอดเหรียญ ช่างเขียนเงื่อนไขไว้ 2 ข้อ ตรงเงื่อนไขก็ทำได้แม่นมาก' },
      { h: 'ข้อจำกัดที่ต้องจำ', p: 'เจอของที่<b>ไม่มีในเงื่อนไข</b> แล้วไปต่อไม่ได้ ต้องรอคนมาเขียนเงื่อนไขเพิ่มทุกครั้ง' }
    ],
    next: 'ชั้นถัดไปแก้ข้อจำกัดนี้ ด้วยการทำให้เงื่อนไขอัปเดตตัวเองได้'
  },
  {
    q: 'Machine Learning คืออะไร?', short: 'ML คืออะไร?',
    en: 'Machine Learning (ML)',
    lead: 'ชั้นที่ 2 เงื่อนไขที่อัปเดตตัวเองได้',
    blocks: [
      { h: 'นิยามสั้น ๆ', p: 'ระบบ Rule-Based ที่<b>อัปเดตตัวเองได้</b>' },
      { h: 'ที่มา', p: 'ข้อมูลของแต่ละเงื่อนไขถูกแบ่งเป็นชุด ๆ ด้วยสมการหรือวิธีการต่าง ๆ เช่น <b>Classification</b>, <b>Clustering</b>, <b>Outlier Detection</b>' },
      { h: 'ทำไมต้องมี Policy Fix', p: 'แต่ละเงื่อนไขมีกติกาคุมไว้ เพื่อให้ข้อมูลใหม่ที่เข้ามา<b>ไม่ทำให้สิ่งที่ทำไปแล้วเปลี่ยน</b> เช่น Clustering มี 2 วง ข้อมูลใหม่ก็ไม่ทำให้จำนวนวงเพิ่มขึ้น' },
      { h: 'จุดประสงค์', p: 'เวลามีข้อมูลใหม่เข้ามา เงื่อนไขที่มีอยู่<b>เรียนรู้ใหม่แล้วพัฒนาเป็นสมการรูปแบบใหม่ได้ตลอดเวลา</b>' }
    ],
    next: 'แต่ ML ยังต้องพึ่ง “การสอนของมนุษย์” อยู่ ชั้นถัดไปคือทางออก'
  },
  {
    q: 'Deep Learning คืออะไร?', short: 'DL คืออะไร?',
    en: 'Deep Learning (DL)',
    lead: 'ชั้นที่ 3 เมื่อมนุษย์บอกไม่ได้ว่าดูจากอะไร',
    blocks: [
      { h: 'Component สำคัญของ ML', p: 'คือ <b>การสอนของมนุษย์</b> แบ่งเป็น Supervised (คน Label ไว้ชัดเจนว่าแต่ละกลุ่มคืออะไร) และ Unsupervised (จัดกลุ่มไว้เฉย ๆ ยังไม่ Label)' },
      { h: 'ปัญหาของ Unsupervised', p: 'เกิดจากมนุษย์<b>ระบุไม่ได้</b>ว่าข้อมูลกลุ่มนั้นมี Feature อะไร มี Pattern อะไร' },
      { h: 'ทางออก', p: 'ทำสิ่งที่เรียกว่า <b>Neural Network</b> เพื่อกำหนด Feature และ Pattern ออกมาเอง' },
      { h: 'ข้างใน Neural Network มีอะไร', p: 'หน่วยตั้งต้นเรียกว่า <b>Perceptron</b> ทำงานแบบ Feed Forward: เอา Input แต่ละตัวคูณ Weight ของตัวเองแล้วบวกรวมกัน (x₁w₁ + x₂w₂ + x₃w₃) จากนั้นส่งผ่าน <b>Activation Function</b> เพื่อพิจารณาว่าข้อมูลชุดนี้ควร/ไม่ควรใช้' },
      { h: 'Input แต่ละตัวคือ Feature', p: 'แต่ละ Input ที่ป้อนเข้าไปเรียกว่า <b>Feature</b> และ <b>Feature = Event</b> เหตุการณ์หนึ่งที่มีค่าความน่าจะเป็นของตัวเอง เช่น "อยู่นนทบุรี" มีค่า 0.5 และ "ใส่เสื้อสีส้ม" มีค่า 0.6 พอคูณ Feature เหล่านี้เข้าด้วยกัน (0.5 × 0.6) ก็ได้คำตอบว่าน่าจะ<b>ชอบกินกะเพราหมูสับ</b> ตัวเลขแบบเดียวกับ Weight ที่คุณเพิ่งปรับ' },
      { h: 'ชั้นเดียวไม่พอ', p: 'Perceptron ชั้นเดียวแก้ <b>XOR problem</b> ไม่ได้ คือมีข้อมูลบางชุดที่ใช้วิธีการทางสถิติแยกออกจากกันไม่ได้เลย จึงต้องซ้อนหลายชั้นเป็น <b>MLP (Multi Layer Perceptron)</b>' },
      { h: 'แล้วเก่งขึ้นได้ยังไง', p: 'เอาผลลัพธ์สุดท้ายมาทำ <b>Backpropagation</b> เทียบกับผลของกลุ่มเดิม แล้วอัปเดตผ่านตัวแปร <b>Weight</b> เพื่อเพิ่มความแม่น (Accuracy)' },
      { h: 'Backpropagation ทำงานยังไง', p: 'หาส่วนต่างของ Prediction กับ Actual ออกมาเป็น <b>Loss</b> แล้วเอา Loss ไปปรับตัว Weight ผ่าน <b>Optimizer</b> ด้วยวิธีทาง Calculus' },
      { h: 'ML ต่างกับ Neural Network ตรงไหน', p: '<b>ML</b> ใช้กับชุดข้อมูลที่เรา<b>รู้ Pattern</b> อยู่แล้ว จึงแบ่งกลุ่มได้เลย ส่วน <b>Neural Network</b> ใช้กับชุดข้อมูลที่เรา<b>ไม่รู้ Pattern</b> มันจะพยายามหาจุดร่วมแล้วแปลงเป็นชุดข้อมูลใหม่ จนแบ่งกลุ่มได้' },
      { h: 'ประเภทที่ใช้งานจริง', p: '<b>CNN</b> ใช้กับภาพเป็นหลัก ซอยภาพเป็นส่วนย่อยแล้ววิเคราะห์ ได้ผลออกมาเป็น Matrix<br><b>RNN</b> ใช้กับ Time-Series แปลภาษา และเสียง<br><b>Reinforcement Learning</b> เอา State ที่รับเข้ามาพิจารณาว่าควร Action ไปทางไหน แล้วประเมิน Value เลือกอันที่ดีที่สุด' }
    ],
    next: 'ถึงตรงนี้เครื่องตัดสินของที่มีอยู่ได้เก่งแล้ว แต่ยังสร้างของใหม่ไม่ได้'
  },
  {
    q: 'Generative AI คืออะไร?', short: 'GenAI คืออะไร?',
    en: 'Generative AI (GA)',
    lead: 'ชั้นที่ 4 ชั้นที่สร้างของใหม่ได้',
    blocks: [
      { h: 'ตัวที่ใช้งานจริง', p: 'Model ที่พัฒนามาจาก DL เรียกว่า <b>Discriminator Model</b> ตัวนี้คือ Model on production จริง' },
      { h: 'GA เพิ่มอะไรมา', p: 'เพิ่มอีก 1 Model เพื่อลับคม Discriminator ให้เฉียบคมขึ้น เรียกว่า <b>Generator Model</b>' },
      { h: 'Flow การทำงาน', p: 'Random Input Vector → Generator Model → ได้ผลลัพธ์เป็น <b>Generated Fake Example</b>' },
      { h: 'แล้วเอาไปทำอะไร', p: 'เอา Fake Example ยัดเข้า Discriminator ให้บอกว่าจริงหรือเท็จ ถ้ามีความแตกต่างก็ทำเป็น <b>Binary Classification</b> แยกไว้ ช่วยเกลา Discriminator ให้คมขึ้นอีกที' }
    ],
    next: 'LLM ที่เราคุยด้วยทุกวัน คือ Generative AI ที่สร้าง “คำ” ออกมาทีละคำ'
  },
  {
    q: 'LLM คืออะไร?', short: 'LLM คืออะไร?',
    en: 'Large Language Model (LLM)',
    lead: 'ชั้นที่ 5 ทายคำถัดไปทีละคำ',
    blocks: [
      { h: 'นิยามสั้น ๆ', p: 'Model ที่นำข้อมูลมาคำนวณเป็น <b>ความน่าจะเป็น</b> แล้วเทียบกับ<b>ความสัมพันธ์</b>ที่มี จน Outcome ออกมาเป็นคำตอบแบบ <b>Prediction</b>' },
      { h: 'มันสร้างคำยังไง', p: 'ซอยข้อความเป็นชิ้นเล็ก ๆ ด้วยวิธี <b>Tokenized</b> แปลงแต่ละชิ้นเป็นตัวเลขด้วย <b>Embeddings</b> แล้วให้ <b>Attention</b> คำนวณว่าคำไหนเกี่ยวกับคำไหน ก่อนทายคำถัดไปออกมาทีละคำ' },
      { h: 'Neural Network ที่ใช้ใน LLM', p: 'เรียกว่า <b>Transformer</b> มี <b>Encoder</b> แปลงข้อความเป็นเวกเตอร์ และ <b>Decoder</b> แปลงเวกเตอร์กลับมาเป็นคำตอบ' },
      { h: 'พร้อมใช้งานได้เลยไหม', p: 'ยังไม่พร้อม ต้องผ่าน <b>Pretrain</b> (เรียนจากความสัมพันธ์ในข้อมูลล้วน ๆ รู้เยอะแต่ไม่ specialist) → <b>Instruct</b> (Fine-Tuning ให้ทำงานเฉพาะทางได้) → <b>Reinforcement Learning</b> (มนุษย์ให้ Feedback ว่าคำตอบไหนดี เป็น Reward ให้โมเดลปรับตัว)' },
      { h: 'ศัพท์เพิ่มเติม', p: '<b>In-Context Learning</b> คือการเตรียมข้อมูล (Data Preparation) ให้ LLM ดีที่สุดตอนใช้งาน เพื่อให้ได้คำตอบที่ดีที่สุด' },
      { h: 'Transformer ไม่ได้มีไว้ทายคำอย่างเดียว', p: 'Transformer ที่เพิ่งเห็นด้านบนเป็น<b>สถาปัตยกรรม</b> ไม่ใช่ตัว LLM เอง เอาไปทำอย่างอื่นได้ด้วย เดือนกันยายน 2026 มีโมเดลตัวแรกชื่อ <b>Jev</b> ที่ใช้ Transformer ตัวเดียวกันเป๊ะ แต่<b>ไม่พ่นคำออกมาเลย</b> มีห้องแยกอยู่หลังกำแพงท้ายชั้นนี้ เดินทะลุประตูไปดูรายละเอียดได้เลยครับ' }
    ],
    next: 'ต่อให้ตอบเก่งแค่ไหน มันก็แค่ "ตอบ" ชั้นสุดท้ายจะพาไปดูว่า AI เริ่มทำงานแทนคนได้เองยังไง'
  },
  {
    q: 'Agentic AI คืออะไร?', short: 'Agentic คืออะไร?',
    en: 'Agentic AI',
    lead: 'ชั้นที่ 6 สั่งทีเดียว จบงานเอง',
    blocks: [
      { h: 'นิยามสั้น ๆ', p: 'Agentic คือ <b>Workflow</b> การทำงานของ <b>Multi-Agent</b> ชุดนึง (Agent = AI 1 ตัว) เทียบได้ว่า <b>Agentic = Manager</b> และ <b>Agent = Engineer</b>' },
      { h: 'มนุษย์ทำอะไร', p: 'Human จะเป็นคน Input <b>"Goal"</b> เข้าไป แล้วตัว Agentic จะให้ Agents ที่อยู่ใน Workflow ดำเนินการจนเสร็จสิ้นภารกิจ แล้วได้ Outcome ที่ตรงตาม Goal ออกมา' },
      { h: 'มันทำงานยังไง', p: 'User Input Goal เข้ามา → Agentic วิเคราะห์ผ่าน <b>LLM ของ Agentic</b> ว่าควรไปหาข้อมูลที่เกี่ยวข้องจากไหน → ไปหาข้อมูลมา ไม่ว่าจะจาก VectorDB + DB ที่มีอยู่ หรือ Ref จากแหล่งต่าง ๆ → LLM วิเคราะห์ว่าควร Action อะไรบ้าง ไปทางไหน → ส่งให้ Agent ทำการ Action ต่อ' },
      { h: 'Design Patterns 4 แบบ', list: [
        ['1 Reflection', 'ตอน Generate จนได้ Outcome ออกมา จะตรวจสอบ Outcome นั้น (Reflect) จนมั่นใจว่าชัวร์แล้วจึงค่อย Response กลับไป'],
        ['2 Planning', 'ตอน Generate จนได้ Task ออกมาชุดนึงแล้ว จะ Replan ชุด Task นั้นจน Optimized แล้วจึงค่อย Response กลับไป'],
        ['3 Tool Use', 'Agentic เลือก "Tool ที่เหมาะสม" ให้กับ Goal ที่ Input เข้ามา ไปดำเนินการต่อจนสำเร็จแล้ว Response Outcome กลับไป'],
        ['4 MultiAgent', 'Agentic รับ Goal เข้ามาแล้วให้ Agents ที่อยู่ภายในทีมจัดการดำเนินการเองจนได้ Outcome ออกมา']
      ] },
      { h: 'Agent ต่างกับ Agentic ยังไง', p: '<b>Agent</b> จะรับงาน → ทำงาน → ส่งงาน เปรียบเหมือนเป็น Engineer<br><b>Agentic</b> คือคนที่ทำตั้งแต่รับ Task → วิเคราะห์ + ใส่ความเป็นเหตุผล (Reasoning) → หาวิธีการที่ Optimized สุด → Implement → ตรวจสอบ + Final Decision → ชัวร์แล้วว่าสิ่งที่จะส่งมันดีที่สุดแล้วจึงค่อยส่งงาน → รับ Feedback จาก Human + เรียนรู้จากรูปแบบการทำงานเดิมแล้วพัฒนาให้ดีขึ้นก่อนจะเริ่มงานถัด ๆ ไป' },
      { h: 'Reasoning คืออะไร', p: 'ให้ Agentic สามารถคิดเป็น Logical พร้อมกับใส่สภาพแวดล้อมการคิดแบบมนุษย์ที่ไม่ได้ใช้แค่ Logical อย่างเดียว แต่ต้องใช้สิ่งจำพวก <b>คุณธรรม จริยธรรม Empathization</b> ด้วย เพื่อให้การตัดสินใจของ Agentic มีความใกล้เคียงกับมนุษย์มากที่สุด' },
      { h: 'Jev เข้ามาช่วย Agentic ตรงไหน', p: 'ทุกลูกศรใน "มันทำงานยังไง" ด้านบนคือ Agentic เรียก <b>LLM</b> ช้า แพง และคำตอบเป็นข้อความที่เอาไปเขียน if ต่อไม่ได้ <b>Jev</b> (ที่เจอตอนชั้น 5) เสียบเข้าไปแทนได้ครบทั้ง 4 Design Patterns: Reflection → ผ่านไหม, Planning → ดีพอหรือยัง, Tool Use → ใช้ tool ไหน, MultiAgent → ส่งให้ agent ตัวไหน <b>ไม่ได้มาแทน 4 อย่างนี้ แต่เป็นเครื่องยนต์ที่ทำให้ตัดสินใจแต่ละจุดเร็วขึ้น 40-200 เท่า</b>' },
      { h: 'แบ่งหน้าที่กัน 3 ตัว', p: '<b>Jev</b> ตัดสินใจว่าจะไปทางไหน (เหมือนไฟจราจร)<br><b>LLM</b> คิด เขียน วิเคราะห์ (สมอง)<br><b>Agent</b> ลงมือทำงานจริง (มือ) ถามว่า "2+2 เท่ากับเท่าไหร่" Jev บอกว่างานง่าย ส่งโมเดลเล็กพอ แต่ถาม "วิเคราะห์ธุรกิจนี้แบบละเอียด" Jev บอกว่าต้องส่งโมเดลที่เก่งกว่า ใช้ได้ทั้งก่อน LLM เริ่มงาน (Routing) และหลัง Agent จะลงมือ (Guardrail เช็คว่าเสี่ยงไหมก่อนรันจริง) แนวคิดคือ <b>อย่าใช้สมองใหญ่คิดทุกเรื่อง ใช้เฉพาะตอนที่จำเป็น</b>' }
    ],
    next: 'นี่คือชั้นบนสุดของหอคอย ทุกชั้นที่เดินผ่านมาถูกรวมมาอยู่ในตัวนี้หมดแล้ว'
  }
];

/* not a floor — a standalone entry read via the Jev standee on floor 5
   (openDocs(6)), reusing the same full-screen board UI. The board-building
   loop above is bounded by FLOORS.length (6), so this extra entry never
   grows a 7th physical board; it only exists when something calls
   openDocs(JEV_DOC) directly. Kept as bonus content rather than a 7th
   floor per the session's explicit call — see memory-bank/progress.md. */
const JEV_DOC = 6;
DOCS.push({
  q: 'Jev คืออะไรกันแน่?', en: 'Jev / System One Model',
  lead: 'แถมความรู้ · TypeSafe AI · เปิดตัว ก.ย. 2026',
  blocks: [
    { h: 'Jev คืออะไร', p: 'นิยามของบริษัทเอง: <b>"a frontier-intelligence function call — unstructured state in, typed probabilistic decisions out"</b> — ยัด "สภาพงานตอนนี้" เข้าไป แล้วได้ "การตัดสินใจที่มี Type กำกับ + ความน่าจะเป็น" ออกมา จาก <b>TypeSafe AI</b> (ซานฟรานซิสโก, เงินทุน 40 ล้านดอลลาร์, CEO เคยร่วมคิด RLHF ที่ OpenAI มาก่อน)' },
    { h: 'เครื่องยนต์เดียวกัน คนละหัวจ่าย', p: '<b>Transformer</b> (แกนกลาง) เหมือนกันทั้งคู่ LLM ต่อ <b>Decoder</b> ที่ทายทีละ token จนได้ประโยค ส่วน Jev ต่อ <b>Parallel Sampler</b> ที่ตอบทุกคำถามพร้อมกันจบใน pass เดียว ถ้าเปลี่ยนหัวจ่ายเป็นอย่างอื่นได้อีก ก็จะมี Model ประเภทใหม่เกิดขึ้นได้อีกในอนาคต' },
    { h: 'Jev ต่างจาก LLM ยังไง', list: [
      ['โครงสร้างสมอง', 'Transformer เหมือนกันทั้งคู่ ต่างกันที่ "วิธีเทรน" ไม่ใช่ "สมองคนละแบบ"'],
      ['วิธีเทรน', 'LLM ใช้ RLHF ปรับให้ตอบถูกใจคน<br>Jev ใช้ RLCD (Reinforcement Learning for Calibrated Decisions) ปรับให้มั่นใจเท่าที่ถูกจริง'],
      ['วิธีปล่อยคำตอบ', 'LLM ทายทีละคำต่อกันเป็นสาย (Autoregressive)<br>Jev ตอบทุกคำถามพร้อมกันใน pass เดียว (Parallel)'],
      ['พื้นที่คำตอบ', 'LLM เลือกคำไหนก็ได้ในภาษา (เปิดโล่ง)<br>Jev เลือกได้แค่ตัวเลือกที่ตั้งไว้ล่วงหน้า (ปิด)'],
      ['ความเร็ว/ราคา', 'Jev เร็วกว่า 40-200 เท่า (70-500ms ต่อครั้ง) input $0.042/ล้าน token, output ฟรี เพราะไม่ต้องพ่น token ทีละตัว']
    ] },
    { h: 'ทำไม Jev Hallucinate ไม่ได้', p: 'ไม่ใช่เพราะฉลาดกว่าหรือซื่อสัตย์กว่า แต่เพราะ<b>ไม่ได้ให้ปากมันไว้</b> มันเลือกได้แค่จากลิสต์ที่เราเขียนไว้ล่วงหน้าเท่านั้น จะแต่งเรื่องก็ไม่มีที่ให้แต่ง แลกมาด้วย<b>ตอบได้เฉพาะคำถามที่เราเตรียมตัวเลือกไว้แล้ว</b> เจอเรื่องนอกลิสต์ = ตอบไม่ได้ ไม่ใช่ตอบมั่ว' },
    { h: 'Calibration ของที่ Jev มี แล้ว LLM ไม่มี', p: 'LLM ก็มีความน่าจะเป็น แต่เป็น prob ของ "คำถัดไป" ไม่ใช่ prob ว่า "คำตอบนี้ถูก" เลยพูดมั่นใจเต็มปากทั้งที่ผิดได้ ส่วน Jev ถูกเทรนด้วย RLCD ให้<b>ความมั่นใจตรงกับความถูกจริง</b> บอก 90% แปลว่าถูกจริงราว 90 ใน 100 ครั้ง นี่คือเหตุผลที่ซอฟต์แวร์เอาคำตอบของมันไปเขียน <b>if</b> ต่อได้ทันที ซึ่ง output ของ LLM ทำแบบนี้ไม่ได้' },
    { h: 'Jev ตอบได้แค่ 3 แบบ', list: [
      ['Bool', 'ใช่ / ไม่ใช่ พร้อม % ความมั่นใจ เช่น "ตั๋วใบนี้ด่วนไหม" → ด่วน 99.9%'],
      ['Choice', 'เลือก 1 จากลิสต์ พร้อม prob ทุกตัวเลือก เช่น "ส่งให้ทีมไหน" → Support 0.7 / Billing 0.2 / Dev 0.1'],
      ['Score', 'ให้คะแนนบนสเกลที่เรานิยาม เช่น "งานนี้ยากแค่ไหน" → low / medium / high']
    ] },
    { h: 'Jev ทำอะไรไม่ได้', p: 'แชท เขียนโค้ด เขียนงานสร้างสรรค์ อธิบายเหตุผลเป็นตัวหนังสือ และตอบคำถามที่เราไม่ได้เตรียมตัวเลือกไว้ล่วงหน้าไม่ได้เลย <b>มันไม่ได้มาแทน LLM และไม่ได้เก่งกว่า Agentic AI เป็นคนละแกนกัน</b> เพิ่งเปิดตัวได้ไม่กี่วัน บริษัทยังไม่ปล่อย architecture paper ด้วย ข้อมูลนี้อาจยังไม่นิ่ง' }
  ],
  next: 'อยากรู้ว่าเอาไปใช้คู่กับ Agentic ยังไง ไปคุยกับยูนิตชั้น 6 หรืออ่านกระดานชั้น 6 ต่อได้เลยครับ'
});

const ITEMS = [
  { id: 'c10', label: 'เหรียญ 10 บาท', kind: 'ok' },
  { id: 'c5', label: 'เหรียญ 5 บาท', kind: 'half' },
  { id: 'b20', label: 'ธนบัตร 20 บาท', kind: 'bad', why: 'เป็นธนบัตร ไม่ใช่เหรียญ' },
  { id: 'fx', label: 'เหรียญต่างประเทศ', kind: 'bad', why: 'ขนาดกับลายไม่ตรงกับที่เขียนไว้' },
  { id: 'bt', label: 'กระดุมเสื้อ', kind: 'bad', why: 'ไม่มีเงื่อนไขข้อไหนพูดถึงมันเลย' }
];

const TALK_LOBBY = [
  ['ยูนิต 00', 'ยินดีต้อนรับครับ หอคอยนี้มี <b>6 ชั้น</b> แต่ละชั้นคือ<b>วิวัฒนาการของ AI</b>'],
  ['ยูนิต 00', 'ยิ่งชั้นสูงขึ้น <b>ความสามารถของ AI ยิ่งเพิ่มขึ้น</b> ชั้นล่างสุดเป็นแค่กลไก ชั้นบนสุดเริ่มสั่งงานทีมแทนคนได้เอง'],
  ['ยูนิต 00', 'เปิดครบ <b>ทั้ง 6 ชั้น</b> แล้วครับ ขึ้นกระเช้าทางขวามือ แล้วเลือกชั้นได้เลย ยูนิตประจำชั้นรออยู่']
];
const TALK_F1_A = [
  ['ยูนิต 01', 'ชั้นนี้เป็นยุคกลไกครับ ไม่มีจอ ไม่มีหุ่นยนต์ มีแต่<b>เฟืองกับคานโยก</b>'],
  ['ยูนิต 01', 'ตู้กดน้ำตัวนี้ผมตั้งเงื่อนไขไว้เองด้วยมือ มันทำงานแบบ <b>Rule-Based</b> คือทำตามเงื่อนไขที่เขียนไว้ล่วงหน้า'],
  ['ยูนิต 01', 'ผมเขียนไว้แค่ <b>2 ข้อ</b> ลองไปหย่อนของดูครับ เอาทั้งของที่<b>ตรงเงื่อนไข</b>และของที่<b>ไม่ตรง</b>']
];
const TALK_F1_B = [
  ['ยูนิต 01', 'เห็นแล้วใช่ไหมครับ ของที่ตรงเงื่อนไขมันทำได้<b>แม่นมาก</b> ส่วนของที่ไม่ตรง มันค้างไปเลย'],
  ['ยูนิต 01', 'จุดสำคัญคือตู้ไม่ได้ <b>เข้าใจ</b> ว่าของที่ใส่เข้าไปคืออะไร มันแค่เทียบกับเงื่อนไขที่มีอยู่'],
  ['ยูนิต 01', 'เจอของใหม่ที่ไม่มีในเงื่อนไข ก็ต้อง<b>รอผมมาเขียนเพิ่ม</b>ทุกครั้ง ชั้นบนเขาแก้เรื่องนี้กันแล้วครับ']
];

const TALK_F2_A = [
  ['ยูนิต 02', 'ชั้นนี้เป็นยุคไฟฟ้าครับ ไม่มีกระดาษโพยแบบชั้นล่างแล้ว เรามี<b>หน้าปัดเข็ม</b>กับสายพานคัดของ'],
  ['ยูนิต 02', 'เครื่องนี้ต้องคัดผลไม้ว่าลูกไหน<b>สุกพอขาย</b> ลูกไหนยังดิบ แต่มันยังไม่รู้ว่าต้องดูจากอะไร'],
  ['ยูนิต 02', 'ช่วยลาก<b>เส้นแบ่ง</b>ให้มันก่อนครับ ไปที่เครื่องแล้วกด E เลย']
];
const TALK_F2_B = [
  ['ยูนิต 02', 'เห็นไหมคะ พอผลไม้ล็อตใหม่เข้ามา เส้นที่คุณลากไว้ก็<b>เริ่มตัดผิด</b>'],
  ['ยูนิต 02', 'แต่เครื่องนี้ไม่ต้องรอใครมาแก้ มัน<b>ขยับเส้นของตัวเองได้</b> จากการดูข้อมูลใหม่'],
  ['ยูนิต 02', 'นี่แหละครับ <b>Machine Learning</b> กฎที่อัปเดตตัวเองได้ ต่างจากชั้นล่างที่ต้องรอช่างมาเขียนเพิ่ม']
];

const TALK_F3_A = [
  ['ยูนิต 03', 'ชั้นนี้เข้ายุคคอมพิวเตอร์แล้วครับ ตู้เซิร์ฟเวอร์ กับ<b>แขนหุ่นยนต์</b>ตัวแรกของหอคอย'],
  ['ยูนิต 03', 'ชั้นล่างยังต้องมีคนบอกว่า “ดูจากอะไร” แต่บางงานคน<b>ระบุไม่ได้</b>ว่าจุดสังเกตคืออะไร'],
  ['ยูนิต 03', 'เราจึงทำ <b>Neural Network</b> ให้มันหาเอง ข้างในไม่มีความคิด มีแต่ตัวเลขชื่อ <b>Weight</b>'],
  ['ยูนิต 03', 'ไปที่แผงควบคุมแล้วลองหมุน Weight ด้วยมือดูครับ จะได้เห็นว่ามันคิดด้วยอะไร']
];
const TALK_F3_B = [
  ['ยูนิต 03', 'คุณหมุน Weight เองใช้เวลาเป็นนาที ส่วนเครื่องทำแบบนี้ได้<b>ล้านครั้งต่อวินาที</b>'],
  ['ยูนิต 03', 'คลื่นสีแดงที่ไหลย้อนกลับเมื่อกี้คือ <b>Backpropagation</b> มันเทียบคำตอบกับของจริงว่าผิดไปเท่าไร'],
  ['ยูนิต 03', 'แล้วไล่บอก Weight ทุกตัวว่าต้องหมุนทางไหน นี่คือวิธีที่ <b>Deep Learning</b> เก่งขึ้นเองครับ']
];

const TALK_F4_A = [
  ['ยูนิต 04', 'ชั้นนี้ยุคโฮโลแกรมครับ ผมเป็นหุ่นฮิวแมนนอยด์ตัวเดียวในหอคอยนี้'],
  ['ยูนิต 04', 'สามชั้นล่างเก่งเรื่อง<b>ตัดสินของที่มีอยู่</b> ชั้นนี้เพิ่มตัวที่<b>สร้างของขึ้นมาใหม่</b>'],
  ['ยูนิต 04', 'ตัวที่ใช้งานจริงคือ <b>Discriminator</b> ส่วนตัวสร้างของใหม่คือ <b>Generator</b>'],
  ['ยูนิต 04', 'รอบนี้คุณจะได้เป็น Generator ครับ ไปที่แท่นสร้าง แล้วปั้นของไปหลอก Discriminator ให้ได้']
];
const TALK_F4_B = [
  ['ยูนิต 04', 'ทุกครั้งที่คุณหลอกผ่าน Discriminator จะ<b>จำจุดนั้นไว้</b> แล้วรอบหน้าตรวจละเอียดขึ้น'],
  ['ยูนิต 04', 'สองตัวไล่กวดกันไปเรื่อย ๆ Generator เนียนขึ้น Discriminator ก็คมขึ้น'],
  ['ยูนิต 04', 'สุดท้ายตัวที่เราเอาไปใช้งานคือ <b>Discriminator</b> ที่ถูกลับคมมาแล้วครับ นี่คือ <b>Generative AI</b> ชั้นบนถัดไปเอา GenAI ตัวนี้ไปสร้าง "คำ" ต่อครับ']
];

const TALK_F5_A = [
  ['ยูนิต 05', 'ขึ้นมาถึงชั้นภาษาแล้วครับ ผมคือส่วนที่ทำให้ AI คุยกับคนได้แบบที่คุณคุยกับผมอยู่นี้'],
  ['ยูนิต 05', 'ผมไม่ได้ "รู้" คำตอบนะครับ ผมแค่ทาย<b>คำถัดไป</b>ทีละคำ จากความน่าจะเป็นที่เห็นจากข้อมูล'],
  ['ยูนิต 05', 'ลองไปที่เครื่องผลิตคำ แล้วเป็นคนทายคำถัดไปเองดูครับ จะได้เห็นว่าผมคิดยังไงตอนตอบคุณ']
];
const TALK_F5_B = [
  ['ยูนิต 05', 'เห็นไหมครับ ต่อคำไปเรื่อย ๆ จนได้ประโยค นี่แหละคือสิ่งที่ผมทำทุกครั้งที่ตอบคุณ'],
  ['ยูนิต 05', 'แต่แค่ทายคำไม่พอ ต้องรู้ด้วยว่าคำไหนเกี่ยวกับคำไหน กลไกนั้นชื่อ <b>Attention</b>'],
  ['ยูนิต 05', 'แล้วก่อนจะเอามาใช้งานจริง ต้องผ่านการสอนสามขั้น <b>Pretrain → Instruct → Reinforcement Learning</b> ก่อนด้วยครับ'],
  ['ยูนิต 05', 'แต่ Transformer ที่ผมใช้ ไม่ได้มีไว้ทายคำอย่างเดียวนะครับ เดือนก่อนมีโมเดลที่ใช้ Transformer ตัวเดียวกัน แต่<b>ไม่พ่นคำออกมาเลย</b> เห็นประตูท้ายห้องที่เพิ่งเปิดใหม่ไหมครับ ลองเดินทะลุไปดูสิ น่าสนใจมาก'],
  ['ยูนิต 05', 'ครบหมดแล้วครับ ชั้นสุดท้ายจะพาไปดูว่า พอ AI ตอบเก่งขนาดนี้ มันเริ่มทำงานแทนคนได้เองยังไง']
];

const TALK_F6_A = [
  ['ยูนิต 06', 'ชั้นนี้ผมไม่ได้ตอบคำถามแล้วครับ ผมรับ<b>เป้าหมาย</b> แล้วไปทำให้เสร็จ'],
  ['ยูนิต 06', 'ชั้น 5 เก่งเรื่องตอบ แต่ตอบเสร็จก็จบ ผมเอาความเก่งนั้นมาเป็นแค่<b>สมองของผมตัวหนึ่ง</b>'],
  ['ยูนิต 06', 'ผมคือ <b>Manager</b> ครับ ลูกทีมผมคือ <b>Agent</b> แต่ละตัวคือ AI หนึ่งตัวที่ถนัดคนละอย่าง'],
  ['ยูนิต 06', 'ไปที่ Mission Control แล้วส่งโจทย์ให้ผมสักใบสิครับ แล้วดูว่าผมจัดการยังไงตั้งแต่ต้นจนส่งงาน']
];
const TALK_F6_B = [
  ['ยูนิต 06', 'เห็นตอนทีมทดสอบตีงานกลับไหมครับ นั่นคือ <b>Reflection</b> ถ้าไม่มีขั้นนั้น ผมก็เป็นแค่ Agent ที่รับงานแล้วส่งงาน'],
  ['ยูนิต 06', '<b>Agent</b> คือรับงาน → ทำ → ส่ง แค่นั้น ส่วน <b>Agentic</b> คิดตั้งแต่ควรทำยังไง ไปจนถึงมั่นใจแล้วหรือยัง'],
  ['ยูนิต 06', 'สิ่งที่ทำให้ผมตัดสินใจแบบนั้นได้เรียกว่า <b>Reasoning</b> ไม่ใช่แค่ตรรกะ แต่มีคุณธรรม จริยธรรม และความเข้าใจคนอยู่ด้วย'],
  ['ยูนิต 06', 'อ้อ อย่างที่ชั้น 5 ทิ้งท้ายไว้ โมเดลตัวนั้นชื่อ <b>Jev</b> ผมก็ใช้มันช่วยตัดสินใจใน 4 ขั้นตอนที่เพิ่งเห็นนี่แหละครับ เร็วกว่า LLM หลายสิบเท่า ถ้ายังไม่เคยแวะ ลองย้อนไปชั้น 5 แล้วเดินทะลุประตูท้ายชั้นดูครับ'],
  ['ยูนิต 06', 'คุณเดินครบทั้งหกชั้นแล้วครับ ชั้นบนสุดไม่ได้มาแทนชั้นล่าง ผมยืนอยู่บนทุกชั้นที่คุณผ่านมา']
];

let RAMP = null;
const ramp = () => {
  if (!RAMP) {
    const d = new Uint8Array([96, 172, 236, 255]);
    RAMP = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
    RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
    RAMP.needsUpdate = true;
  }
  return RAMP;
};
const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: ramp() });
/* less specular pop than before — the graphic-novel reference has no glossy
   highlight sweeping across brass as the sun moves, everything reads matte */
const metal = c => new THREE.MeshStandardMaterial({ color: c, roughness: .58, metalness: .55 });
/* comic-panel outline weight: was a barely-there 1-3% sliver, now a real
   graphic-novel line — one multiplier so every part's existing relative
   tuning (thin on small greebles, thick on big blocky forms) stays intact */
const OUTLINE_BOLD = 1.7;
function ink(mesh, w = .028) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: P.ink, side: THREE.BackSide }));
  o.position.copy(mesh.position); o.rotation.copy(mesh.rotation);
  o.scale.copy(mesh.scale).multiplyScalar(1 + w * OUTLINE_BOLD);
  const g = new THREE.Group(); g.add(o, mesh); return g;
}
function surface(w, h, dpr = 2) {
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { c, ctx, tex, w, h };
}
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/* shoji screen: washi paper + a kumiko lattice grid, painted once and shared
   by every paper surface in the tower (backdrop rooms, windows, the lift) so
   the whole building reads as one consistent world instead of two styles
   bolted together */
let SHOJI_TEX = null;
const shojiTex = () => {
  if (!SHOJI_TEX) {
    const S = surface(128, 128, 1);
    const ctx = S.ctx;
    ctx.fillStyle = '#F2DFAE'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(58,42,26,.75)'; ctx.lineWidth = 5;
    ctx.strokeRect(2, 2, 124, 124);
    ctx.lineWidth = 3.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(i * 42.6, 0); ctx.lineTo(i * 42.6, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 42.6); ctx.lineTo(128, i * 42.6); ctx.stroke();
    }
    S.tex.needsUpdate = true;
    SHOJI_TEX = S.tex;
  }
  return SHOJI_TEX;
};
const shojiMat = () => new THREE.MeshBasicMaterial({
  map: shojiTex(), transparent: true, opacity: .85, side: THREE.DoubleSide, fog: true
});
function glowSprite(size, color, opacity) {
  const S = surface(128, 128, 1);
  const g = S.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.3, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  S.ctx.fillStyle = g; S.ctx.fillRect(0, 0, 128, 128); S.tex.needsUpdate = true;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: S.tex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  sp.scale.set(size, size, 1);
  return sp;
}
function signSprite(title, sub, color, scale = 1, locked = false) {
  const S = surface(520, 140);
  const ctx = S.ctx;
  ctx.textAlign = 'center';
  ctx.font = `700 46px ${TH}`;
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12;
  ctx.fillText(title, 260, 54);
  ctx.shadowBlur = 0;
  ctx.font = `400 27px ${TH}`;
  ctx.fillStyle = locked ? 'rgba(230,214,190,.45)' : 'rgba(246,232,210,.85)';
  /* a locked floor's sign says the one thing that matters from across
     the room — that you can't go in yet. Appending it to the subtitle
     behind a separator buried the state in a line nobody finishes. */
  ctx.fillText(locked ? 'ยังไม่เปิด' : sub, 260, 100);
  S.tex.needsUpdate = true;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: S.tex, transparent: true, depthWrite: false, fog: false, opacity: locked ? .6 : 1
  }));
  sp.scale.set(10.4 * scale, 2.8 * scale, 1);
  return sp;
}

export async function boot() {
  try {
    await Promise.all(['400 40px ' + TH, '600 40px ' + TH, '700 40px ' + TH]
      .map(f => document.fonts.load(f, 'กขคABC')));
    await document.fonts.ready;
  } catch (e) { }

  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(P.sky[1], 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(P.fog, 52, 340);
  const camera = new THREE.PerspectiveCamera(52, 1, .1, 900);

  /* ---- sky + light ---- */
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 40, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(P.sky[0]) },
      mid: { value: new THREE.Color(P.sky[1]) },
      low: { value: new THREE.Color(P.sky[2]) }
    },
    vertexShader: `varying float h; void main(){ vec4 w = modelMatrix*vec4(position,1.);
      h = normalize(w.xyz).y; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying float h; uniform vec3 top, mid, low;
      void main(){ float t = clamp(h,-1.,1.);
        vec3 c = t > .04 ? mix(mid, top, smoothstep(.04,.7,t)) : mix(low, mid, smoothstep(-.34,.04,t));
        gl_FragColor = vec4(c,1.); }`
  })));
  const hemi = new THREE.HemisphereLight(0xE8C79A, 0x483826, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFE3B0, 1.5);
  sun.position.set(50, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 48; sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 170;
  sun.shadow.bias = -.0025;
  sun.shadow.normalBias = .02;
  sun.target.position.set(0, 15, FZ);
  scene.add(sun, sun.target);
  const HEMI_BASE = hemi.color.clone(), SUN_BASE = sun.color.clone();
  const _hemiGoal = new THREE.Color(), _sunGoal = new THREE.Color();

  const floorPlane = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshStandardMaterial({ color: P.ground, roughness: .92, metalness: .04 }));
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.receiveShadow = true;
  scene.add(floorPlane);

  /* ------------------------------------------------------ the tower ---- */
  const signs = [];
  for (let i = 0; i < FLOORS.length; i++) {
    const y = floorY(i), c = FLOORS[i].col, open = FLOORS[i].open;
    const deck = new THREE.Mesh(new RoundedBoxGeometry(FW, .7, FD, 2, .07), toon(P.wood));
    deck.position.set(0, y, FZ);
    scene.add(ink(deck, .012));
    const trim = new THREE.Mesh(new THREE.BoxGeometry(FW, .3, .4), toon(c));
    trim.position.set(0, y + .5, FZ + FD / 2);
    scene.add(trim);
    for (let k = 0; k < 13; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 1.6, 6), toon(P.woodLight));
      b.position.set(-FW / 2 + .8 + k * (FW - 1.6) / 12, y + 1.2, FZ + FD / 2);
      scene.add(b);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(FW, .18, .3), toon(c));
    rail.position.set(0, y + 2, FZ + FD / 2);
    scene.add(rail);
    /* floor 5 only: a real doorway cut into the back wall for the Jev
       bridge (see JEV_GATE below) — two wall segments flanking a gap
       instead of one solid slab, with a header piece left above the gap
       so the opening reads as an actual door instead of a hole, using
       the same wall material rather than new geometry to fake a frame.
       Centred at x=0, comfortably inside the gap between the two shoji
       windows at x=±3 built just below. */
    if (i === 4) {
      const gw = JEV_GATE.w, doorH = JEV_GATE.h, segW = (FW - gw) / 2;
      for (const sx of [-(gw / 2 + segW / 2), gw / 2 + segW / 2]) {
        const seg = new THREE.Mesh(new RoundedBoxGeometry(segW, 6.2, .5, 2, .05), toon(P.woodDark));
        seg.position.set(sx, y + 3.4, FZ - FD / 2);
        scene.add(ink(seg, .01));
      }
      const headerH = 6.2 - doorH;
      const header = new THREE.Mesh(new RoundedBoxGeometry(gw, headerH, .5, 2, .05), toon(P.woodDark));
      header.position.set(0, y + 6.5 - headerH / 2, FZ - FD / 2);
      scene.add(ink(header, .01));
    } else {
      const wall = new THREE.Mesh(new RoundedBoxGeometry(FW, 6.2, .5, 2, .05), toon(P.woodDark));
      wall.position.set(0, y + 3.4, FZ - FD / 2);
      scene.add(ink(wall, .01));
    }
    /* a belt-course cornice at the top of every floor's wall — a plain
       stacked box read as unfinished scaffolding with nothing marking
       where one floor ends and the next begins from outside */
    const cornice = new THREE.Mesh(new RoundedBoxGeometry(FW + 1, .35, 1.1, 2, .06), metal(P.brassDark));
    cornice.position.set(0, y + 6.65, FZ - FD / 2);
    scene.add(ink(cornice, .012));
    /* shoji windows on the wall's outward-facing side — the interior face
       is already busy with shelves/boards/machines, but the exterior face
       (what you actually see looking at the tower from outside) had
       nothing on it at all until now. Same washi-paper + kumiko-lattice
       material as the floating backdrop rooms, so the tower and the
       backdrop finally read as the same building instead of two styles */
    for (const wx of [-3, 3]) {
      const wz = FZ - FD / 2 - .35;
      const frame = new THREE.Mesh(new RoundedBoxGeometry(2, 2.6, .18, 2, .04), toon(P.woodDark));
      frame.position.set(wx, y + 3.4, wz);
      scene.add(ink(frame, .02));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), shojiMat());
      pane.position.set(wx, y + 3.4, wz - .1);
      scene.add(pane);
      const glow = glowSprite(2.6, 0xFFD9A0, .16);
      glow.position.set(wx, y + 3.4, wz - .05);
      scene.add(glow);
      const sill = new THREE.Mesh(new RoundedBoxGeometry(2.3, .16, .34, 2, .03), toon(P.woodLight));
      sill.position.set(wx, y + 3.4 - 1.42, wz + .1);
      scene.add(ink(sill, .02));
    }
    /* shelves: only on the locked floors, so floor 1 has room for the game */
    const shelfCount = open ? 2 : 5;
    for (let k = 0; k < shelfCount; k++) {
      const sx = open ? -7.4 + k * 14.8 : -7.4 + k * 3.7;
      const sh = new THREE.Mesh(new RoundedBoxGeometry(3.2, 5.4, 1.1, 2, .09), toon(0x5A3E26));
      sh.position.set(sx, y + 3.05, FZ - FD / 2 + 1);
      scene.add(ink(sh, .012));
      for (let row = 0; row < 3; row++) {
        const bk = new THREE.Mesh(new THREE.BoxGeometry(2.8, .95, .34),
          toon([0xB8543A, 0x9A7A3A, 0x4A6B62, 0x7A4A62][(k + row) % 4]));
        bk.position.set(sx, y + 1.4 + row * 1.7, FZ - FD / 2 + 1.6);
        scene.add(bk);
      }
    }
    const g2 = glowSprite(15, c, open ? .22 : .1);
    g2.position.set(0, y + 3, FZ + 1);
    scene.add(g2);
    const sign = signSprite(FLOORS[i].t, FLOORS[i].era, c, .9, !open);
    sign.position.set(-4.2, y + 4.4, FZ + FD / 2 + .8);
    scene.add(sign);
    signs.push(sign);
  }
  /* corner column with a base + capital, at one (x, z) spot — called once
     per front corner and once per back corner so all 4 corners of the
     tower match instead of just the two facing the camera by default */
  function corner(cx, cz) {
    /* unlit, same reasoning as matWood/beamMat: a column this tall is
       exactly the shape that catches the sun edge-on somewhere along its
       height and blows out to a bright streak running the full height
       of the tower — a flat color keeps it stable at every angle.
       Height (and the cap positions below) track TOP_Y, so this keeps
       reaching the roofline no matter how many floors the tower has. */
    const col = new THREE.Mesh(new RoundedBoxGeometry(1.3, TOP_Y, 1.3, 2, .12), new THREE.MeshBasicMaterial({ color: 0x5A3E26 }));
    col.position.set(cx, TOP_Y / 2, cz);
    scene.add(ink(col, .01));
    /* a base and capital so the column reads as built architecture, not
       just an extruded rod — brass to match the trim used everywhere else */
    for (const cy of [.5, TOP_Y - .5]) {
      const cap = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1, 1.7, 2, .1), metal(P.brassDark));
      cap.position.set(cx, cy, cz);
      scene.add(ink(cap, .014));
    }
  }
  for (const cx of [-FW / 2 - .7, FW / 2 + .7]) {
    corner(cx, FZ + FD / 2 - .8); // front corners
    corner(cx, FZ - FD / 2 + .8); // back corners
  }
  /* pagoda roof — the flat overhanging slab this used to be got rebuilt as a
     real tiered pagoda roof to go with the shoji/tatami/lantern theme
     already established in the floating backdrop. A ConeGeometry with only
     4 radial segments is a square-based pyramid — the actual plan shape a
     real multi-story pagoda roof has, not a stylization of one. Each tier
     gets its own short, wide "eave" tier underneath in vermillion (torii
     red) — the one color this whole tower hasn't used yet. */
  {
    function pagodaTier(y, radius, height) {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), toon(0x3A281C));
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, y + height / 2, FZ);
      scene.add(ink(roof, .012));
      const eave = new THREE.Mesh(new THREE.ConeGeometry(radius + .5, .35, 4),
        new THREE.MeshBasicMaterial({ color: 0xA8321E }));
      eave.rotation.y = Math.PI / 4;
      eave.position.set(0, y + .18, FZ);
      scene.add(ink(eave, .01));
      return y + height;
    }
    let ry = pagodaTier(TOP_Y + .6, 15, 4.6);
    ry = pagodaTier(ry, 9, 3.6);
    const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(.32, .5, 2, 10), metal(P.brass));
    spireBase.position.set(0, ry + 1, FZ);
    scene.add(ink(spireBase, .02));
    const spireBall = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 10), metal(P.brass));
    spireBall.position.set(0, ry + 2.3, FZ);
    scene.add(spireBall);
  }
  /* the back-wall "window" glow planes and the volumetric light-shaft planes
     that used to live here are gone — at 30-34 units tall, spanning nearly
     the whole tower height right behind the action, they were the last of
     the long bright streaks (this is the exact spot circled in feedback):
     tall translucent/additive planes are exactly what bloom turns into a
     stark vertical line the moment the viewing angle lines them up edge-on. */

  /* -------------------------------------------- impossible backdrop --- */
  /* rooms and staircases tumbling at their own angles around the tower:
     scenery only, well outside the decks, so nothing is mistaken for a path */
  const drift = [];
  {
    const paperMat = shojiMat();
    /* unlit on purpose, same reasoning as beamMat below: these are thin,
       long, randomly-angled background pieces (room slabs, stair steps,
       gate posts) that can catch direct sun edge-on and blow out to a
       bright gray-white streak once real shadows/bloom are in the scene.
       A flat unlit brown keeps them a stable dark silhouette regardless
       of angle, as a distant background element should read. */
    const matWood = new THREE.MeshBasicMaterial({ color: 0x4A3324 });

    /* one floating room: a tatami slab, a wooden underside, glowing paper walls */
    function room(w, d) {
      const g = new THREE.Group();
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, .5, d), matWood);
      g.add(slab);
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(w * .92, d * .92),
        toon(0x7A6A44));
      mat.rotation.x = -Math.PI / 2; mat.position.y = .27;
      g.add(mat);
      /* two paper walls, lit from inside */
      for (const [px, pz, ry, pw] of [[-w / 2, 0, Math.PI / 2, d], [0, -d / 2, 0, w]]) {
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(pw * .9, 3.2), paperMat);
        wall.position.set(px, 1.85, pz);
        wall.rotation.y = ry;
        g.add(wall);
      }
      const lamp = glowSprite(w * 1.6, 0xFFCE86, .3);
      lamp.position.y = 1.4;
      g.add(lamp);
      return g;
    }
    /* one floating staircase */
    function stair(steps, sw) {
      const g = new THREE.Group();
      for (let i = 0; i < steps; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(sw, .32, 1.1), matWood);
        st.position.set(0, i * .52, -i * 1.05);
        g.add(st);
      }
      return g;
    }

    /* ring them around the tower at varied radius, height and attitude */
    const RNG = (() => { let sd = 20260913; return () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + RNG() * .3;
      const rad = 46 + RNG() * 42;
      const y = -14 + RNG() * 62;
      const isRoom = i % 3 !== 0;
      const o = isRoom
        ? room(5 + RNG() * 5, 4 + RNG() * 4)
        : stair(6 + Math.floor(RNG() * 7), 2.6 + RNG() * 1.4);
      o.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
      /* each piece keeps its own idea of "down" */
      o.rotation.set(
        (RNG() - .5) * 2.3,
        RNG() * Math.PI * 2,
        (RNG() - .5) * 2.3
      );
      o.traverse(m => { m.userData.noFit = true; });
      o.userData.noFit = true;
      scene.add(o);
      drift.push({ o, phase: RNG() * 6.283, amp: .5 + RNG() * 1.3, spin: (RNG() - .5) * .02 });
    }

    /* a second, much farther ring — small and dim, to build depth */
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + RNG() * .4;
      const rad = 96 + RNG() * 76;
      const y = -30 + RNG() * 96;
      const o = i % 4 === 0
        ? stair(5 + Math.floor(RNG() * 6), 2.4 + RNG())
        : room(4 + RNG() * 5, 3.4 + RNG() * 3);
      o.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
      o.rotation.set((RNG() - .5) * 2.6, RNG() * 6.283, (RNG() - .5) * 2.6);
      o.traverse(m => { m.userData.noFit = true; });
      o.userData.noFit = true;
      scene.add(o);
      drift.push({ o, phase: RNG() * 6.283, amp: .8 + RNG() * 1.6, spin: (RNG() - .5) * .014 });
    }

    /* empty gate frames, tumbling — reads as doorways to nowhere */
    for (let i = 0; i < 14; i++) {
      const a = RNG() * 6.283, rad = 52 + RNG() * 60;
      const y = -18 + RNG() * 74;
      const gw = 4.2 + RNG() * 3.4, gh = 5.4 + RNG() * 3;
      const g = new THREE.Group();
      for (const px of [-gw / 2, gw / 2]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(.32, gh, .32), matWood);
        post.position.set(px, 0, 0);
        g.add(post);
      }
      for (const py of [-gh / 2, gh / 2]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(gw + .8, .34, .34), matWood);
        beam.position.set(0, py, 0);
        g.add(beam);
      }
      /* a pane of glowing paper in some of them */
      if (i % 3 !== 0) {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(gw * .84, gh * .78), paperMat);
        g.add(pane);
        const hz = glowSprite(gw * 2.1, 0xFFC98A, .16);
        g.add(hz);
      }
      g.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
      g.rotation.set((RNG() - .5) * 2.4, RNG() * 6.283, (RNG() - .5) * 2.4);
      g.traverse(m => { m.userData.noFit = true; });
      g.userData.noFit = true;
      scene.add(g);
      drift.push({ o: g, phase: RNG() * 6.283, amp: .6 + RNG() * 1.2, spin: (RNG() - .5) * .022 });
    }

    /* long timber beams crossing the void at odd angles — unlit on purpose:
       thin, long, and randomly angled, they were catching direct sun at
       just the wrong angle and blowing out to a bright gray-white streak
       once real shadows/bloom went in. A flat unlit material keeps them a
       stable dark silhouette regardless of lighting angle, the way a
       distant background element should read. */
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x4A3324 });
    for (let i = 0; i < 18; i++) {
      const a = RNG() * 6.283, rad = 50 + RNG() * 70;
      const len = 18 + RNG() * 34;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(.55, len, .55), beamMat);
      beam.position.set(Math.cos(a) * rad, -24 + RNG() * 86, Math.sin(a) * rad);
      beam.rotation.set((RNG() - .5) * 2.8, RNG() * 6.283, (RNG() - .5) * 2.8);
      beam.userData.noFit = true;
      scene.add(beam);
      drift.push({ o: beam, phase: RNG() * 6.283, amp: .4 + RNG() * .9, spin: (RNG() - .5) * .01 });
    }

    /* paper scraps adrift, catching the lantern light */
    {
      const N = 260, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const a = RNG() * 6.283, rad = 26 + RNG() * 120;
        pos[i * 3] = Math.cos(a) * rad;
        pos[i * 3 + 1] = -20 + RNG() * 100;
        pos[i * 3 + 2] = Math.sin(a) * rad;
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const scraps = new THREE.Points(pg, new THREE.PointsMaterial({
        color: 0xFFE2B0, size: .7, transparent: true, opacity: .5, depthWrite: false
      }));
      scraps.userData.noFit = true;
      scene.add(scraps);
      drift.push({ o: scraps, phase: 0, amp: 1.6, spin: .006 });
    }

    /* faint pools of light far below, so looking down reads as depth */
    for (let i = 0; i < 9; i++) {
      const a = RNG() * 6.283, rad = 40 + RNG() * 80;
      const pool = glowSprite(26 + RNG() * 24, 0xE8A860, .1);
      pool.position.set(Math.cos(a) * rad, -34 - RNG() * 26, Math.sin(a) * rad);
      pool.userData.noFit = true;
      scene.add(pool);
    }

    /* hanging lanterns coming down from somewhere above the ceiling — a
       simple glowing cylinder placeholder goes up immediately; a real
       Kenney (CC0) lantern model swaps in per-instance once it loads,
       without disturbing the float animation already tracking each one */
    const lanternSlots = [];
    for (let i = 0; i < 28; i++) {
      const a = RNG() * Math.PI * 2, rad = 30 + RNG() * 62;
      const y = 4 + RNG() * 58;
      /* no hanging cord — a thin thing that long, at a random angle, was
         one of the streaks that read as a bright white line once real
         lighting went in; the lantern reads fine floating on its own */
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 1.15, 12),
        new THREE.MeshBasicMaterial({ color: 0xFFD9A0 }));
      body.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
      body.userData.noFit = true;
      const halo = glowSprite(5.5, 0xFFBE72, .32);
      halo.position.copy(body.position);
      halo.userData.noFit = true;
      scene.add(body, halo);
      const slot = { o: body, halo, phase: RNG() * 6.283, amp: .35 + RNG() * .5, spin: 0 };
      drift.push(slot);
      lanternSlots.push(slot);
    }
    new GLTFLoader().loadAsync('./assets/lantern.glb').then(gltf => {
      const src = gltf.scene;
      const box = new THREE.Box3().setFromObject(src);
      const modelH = box.max.y - box.min.y || 1;
      const scl = 1.3 / modelH; // match the placeholder cylinder's rough size
      src.traverse(o => {
        if (!o.isMesh) return;
        const old = o.material;
        o.material = new THREE.MeshToonMaterial({
          map: old && old.map ? old.map : null,
          color: old && old.map ? 0xffffff : 0xFFD9A0,
          gradientMap: ramp()
        });
      });
      for (const slot of lanternSlots) {
        const inst = src.clone();
        inst.scale.setScalar(scl);
        /* model origin sits at its own base (min.y ≈ 0) — if it reads
           upside-down or the wrong way up once visible, flip this sign */
        inst.position.copy(slot.o.position);
        inst.position.y -= (box.max.y - box.min.y) / 2 * scl;
        inst.userData.noFit = true;
        scene.add(inst);
        scene.remove(slot.o);
        slot.o = inst;
      }
    }).catch(e => console.error('lantern model failed to load:', e));
  }

  /* ---- learning board: read the docs before playing the floor ---- */
  const boards = [];
  for (let i = 0; i < FLOORS.length; i++) {
    const y = floorY(i), c = FLOORS[i].col;
    const g = new THREE.Group();
    g.position.set(-8.4, y + .35, FZ + 1.4);
    g.rotation.y = .5;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.3, .22), toon(0x5A3E26));
    frame.position.y = 2.6;
    g.add(ink(frame, .016));
    /* legs */
    for (const lx of [-1.7, 1.7]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, 1.1, 8), toon(P.woodDark));
      leg.position.set(lx, .55, 0);
      g.add(ink(leg, .03));
    }
    /* the written page */
    const S = surface(420, 300);
    const ctx = S.ctx;
    /* slate board surface */
    ctx.fillStyle = '#2E3A33'; ctx.fillRect(0, 0, 420, 300);
    const wash = ctx.createRadialGradient(210, 130, 20, 210, 150, 260);
    wash.addColorStop(0, 'rgba(255,255,255,.07)');
    wash.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, 420, 300);
    /* chalk dust smudges */
    ctx.fillStyle = 'rgba(240,236,224,.05)';
    for (let d = 0; d < 14; d++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * 420, Math.random() * 300, 20 + Math.random() * 60, 8 + Math.random() * 24, Math.random(), 0, 7);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.font = `700 46px ${TH}`;
    ctx.fillStyle = '#F2EDDF';
    ctx.fillText(DOCS[i].short || DOCS[i].q, 210, 140);
    /* hand-drawn chalk underline */
    ctx.strokeStyle = 'rgba(242,237,223,.55)'; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 120; x <= 300; x += 10) ctx.lineTo(x, 168 + Math.sin(x * .14) * 2.4);
    ctx.stroke();
    ctx.font = `400 22px ${TH}`;
    ctx.fillStyle = 'rgba(242,237,223,.6)';
    ctx.fillText(DOCS[i].en, 210, 204);
    S.tex.needsUpdate = true;
    const page = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.93),
      new THREE.MeshBasicMaterial({ map: S.tex }));
    page.position.set(0, 2.6, .13);
    g.add(page);
    g.add((() => { const gl2 = glowSprite(9, c, .16); gl2.position.set(0, 2.6, .5); return gl2; })());
    scene.add(g);
    boards.push(g);
  }

  /* ------------------------------------------------------ the lift ----- */
  const LIFT_X = 13.4, LIFT_Z = -3;
  /* the lift pad's own walkable radius (visual cylinder is 2.5/2.7 top/
     bottom — 2.3 stays inside it) and a rectangle bridging the ~2.6-unit
     gap between the deck's clamp edge and the pad, since there is no
     walkway mesh there — this rectangle IS the floor as far as movement
     is concerned. Used by the movement clamp in step(); see that call
     site for why a simple "detect a zone, clamp within it" check (the
     pattern every other zone in this game uses) doesn't work here: the
     deck and the pad are genuinely disjoint shapes with a real gap
     between their edges, and detecting a zone with a radius wide enough
     to reach across that gap smoothly is what the original code did —
     and is exactly the bug report (round 33): that same wide radius
     also disabled clamping far past the pad, over open exterior air,
     which is where the screenshots show the player ending up. */
  const LIFT_PAD_R = 2.3;
  const LIFT_CORRIDOR = { x0: FW / 2 - 1, x1: 11.3, z0: -6.5, z1: .5 };
  const nearestInRect = (x, z, x0, x1, z0, z1) => [Math.max(x0, Math.min(x1, x)), Math.max(z0, Math.min(z1, z))];
  const nearestOnLiftPad = (x, z) => {
    const dx = x - LIFT_X, dz = z - LIFT_Z, d = Math.hypot(dx, dz);
    return d <= LIFT_PAD_R ? [x, z] : [LIFT_X + dx / d * LIFT_PAD_R, LIFT_Z + dz / d * LIFT_PAD_R];
  };
  const lift = new THREE.Group();
  lift.position.set(LIFT_X, 0, LIFT_Z);
  {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, .3, 20), metal(P.brass));
    pad.position.y = .15;
    lift.add(ink(pad, .014));
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + .4;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, 5.4, 8), metal(P.brassDark));
      bar.position.set(Math.cos(a) * 2.2, 2.7, Math.sin(a) * 2.2);
      lift.add(bar);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.2, .35, 20), metal(P.brass));
    top.position.y = 5.5;
    lift.add(ink(top, .016));
    /* a thin vermillion eave ring under the cap — the same torii-red trim
       now used on the tower's roof, so the lift reads as part of the same
       building instead of a separate brass fixture */
    const capEave = new THREE.Mesh(new THREE.TorusGeometry(2.65, .06, 6, 28), new THREE.MeshBasicMaterial({ color: 0xA8321E }));
    capEave.rotation.x = Math.PI / 2;
    capEave.position.y = 5.28;
    lift.add(capEave);
    lift.add(glowSprite(9, 0xFFD9A0, .28));
    /* solid cabin wall — a real elevator cab, not an open rig or a birdcage.
       CylinderGeometry's own theta convention is x=sin(theta), z=cos(theta),
       so the doorway (which must face -x, where the player actually boards/
       exits — LIFT_X - 3.x) sits at theta = 3π/2; the wall is one partial
       cylinder sweeping all the way around EXCEPT that gap. openEnded so it
       doesn't cap itself with a floating disc at the cut edges. */
    const CABIN_R = 2.35, DOOR_HALF = .62, DOOR_THETA = Math.PI * 1.5;
    /* paper-and-lattice cabin wall instead of plain brass, to match the
       shoji theme now on the tower itself — a cream unlit panel plus
       real kumiko lattice bars (geometry, not a stretched texture, so it
       can't distort wrapping around a curved wall) */
    const cabinMat = new THREE.MeshBasicMaterial({ color: 0xF2DFAE, side: THREE.DoubleSide });
    const cabin = new THREE.Mesh(
      new THREE.CylinderGeometry(CABIN_R, CABIN_R, 2.3, 24, 1, true,
        DOOR_THETA + DOOR_HALF, Math.PI * 2 - DOOR_HALF * 2),
      cabinMat);
    cabin.position.y = 1.45;
    lift.add(ink(cabin, .012));
    for (let k = 0; k < 16; k++) {
      const th = DOOR_THETA + DOOR_HALF + (k / 16) * (Math.PI * 2 - DOOR_HALF * 2);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 2.3, 6), toon(P.woodDark));
      bar.position.set(Math.sin(th) * CABIN_R, 1.45, Math.cos(th) * CABIN_R);
      lift.add(bar);
    }
    for (const ringY of [.42, 2.48]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(CABIN_R, .045, 6, 32), toon(P.woodDark));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ringY;
      lift.add(ring);
    }
    /* door-frame trim: a post at each open edge so the entrance reads as a
       doorway, not just an unfinished seam in the wall */
    for (const s of [-1, 1]) {
      const th = DOOR_THETA + s * DOOR_HALF;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 2.3, 8), metal(P.brass));
      post.position.set(Math.sin(th) * CABIN_R, 1.45, Math.cos(th) * CABIN_R);
      lift.add(post);
    }
    /* a small paper lantern by the doorway — reuses the same model as the
       floating backdrop lanterns; the file is tiny and already cached by
       the browser from that first load, so this second fetch is instant */
    new GLTFLoader().loadAsync('./assets/lantern.glb').then(gltf => {
      const inst = gltf.scene;
      const box = new THREE.Box3().setFromObject(inst);
      const h = box.max.y - box.min.y || 1;
      const scl = 1.1 / h;
      inst.scale.setScalar(scl);
      inst.position.y -= box.min.y * scl;
      inst.traverse(o => {
        if (!o.isMesh) return;
        const old = o.material;
        o.material = new THREE.MeshToonMaterial({
          map: old && old.map ? old.map : null,
          color: old && old.map ? 0xffffff : 0xFFD9A0,
          gradientMap: ramp()
        });
      });
      const lanternTh = DOOR_THETA + DOOR_HALF + .15;
      const holder = new THREE.Group();
      holder.position.set(Math.sin(lanternTh) * CABIN_R, 4.1, Math.cos(lanternTh) * CABIN_R);
      holder.add(inst);
      lift.add(holder);
      lift.add((() => { const g2 = glowSprite(2.4, 0xFFC98A, .22); g2.position.copy(holder.position); return g2; })());
    }).catch(e => console.error('lift lantern failed to load:', e));
  }
  scene.add(lift);
  /* cable + guide rail up the shaft */
  {
    /* unlit — same streak problem as the columns above; a thin metal rail
       this long caught a specular highlight running its whole length
       instead of just one grazing spot. Height tracks TOP_Y so the rail
       always reaches a bit past the roofline regardless of floor count. */
    const railH = TOP_Y + 2;
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, railH, 10), new THREE.MeshBasicMaterial({ color: P.brassDark }));
    rail.position.set(LIFT_X, railH / 2, LIFT_Z);
    scene.add(rail);
  }

  /* ------------------------------------------------- vending machine --- */
  const machine = new THREE.Group();
  machine.position.set(5.4, floorY(0) + .35, FZ - 1.5);
  machine.rotation.y = -.34;
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(4.2, 6.4, 2, 2, .18), toon(0x7A5230));
    body.position.y = 3.2;
    machine.add(ink(body, .012));
    const bandTop = new THREE.Mesh(new THREE.BoxGeometry(4.3, .34, 2.1), metal(P.brass));
    bandTop.position.y = 6.2;
    const bandBot = new THREE.Mesh(new THREE.BoxGeometry(4.3, .34, 2.1), metal(P.brass));
    bandBot.position.y = .5;
    machine.add(bandTop, bandBot);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(2, .2, 1.1), metal(P.brassDark));
    tray.position.set(0, 1.1, 1.05);
    machine.add(ink(tray, .02));
    /* exposed gears — the analog era, no screens */
    for (const [gx, gy, gr] of [[-1.3, 2.2, .5], [-.2, 2.7, .34], [1.2, 2.1, .42]]) {
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(gr, gr, .18, 12), metal(P.brass));
      gear.rotation.x = Math.PI / 2;
      gear.position.set(gx, gy, 1.02);
      gear.userData.spin = (gr < .4 ? 1.8 : -1.1) / gr;
      machine.add(gear);
      machine.userData.gears = machine.userData.gears || [];
      machine.userData.gears.push(gear);
    }
    const lever = new THREE.Mesh(new THREE.BoxGeometry(.16, 1.5, .16), metal(P.brassDark));
    lever.position.set(1.75, 3.4, 1.02);
    machine.userData.lever = lever;
    machine.add(lever);
  }
  /* the rules, on a mechanical flip board */
  const RS = surface(380, 200);
  const paintRules = err => {
    const ctx = RS.ctx, W = RS.w, H = RS.h;
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 4, 4, W - 8, H - 8, 8);
    ctx.fillStyle = '#2A211A'; ctx.fill();
    ctx.strokeStyle = '#C8912E'; ctx.lineWidth = 3; ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = `600 19px ${TH}`; ctx.fillStyle = '#E8B45A';
    ctx.fillText('เงื่อนไขที่ช่างเขียนไว้ 2 ข้อ', 20, 34);
    ctx.font = `400 21px ${TH}`; ctx.fillStyle = '#F2E4CC';
    ctx.fillText('1) เหรียญ 10 บาท → จ่ายน้ำ', 20, 78);
    ctx.fillText('2) เหรียญ 5 บาท → รออีก 5 บาท', 20, 112);
    ctx.font = `600 19px ${TH}`;
    ctx.fillStyle = err ? '#FF9E7A' : '#A89880';
    ctx.fillText(err ? 'ไม่มีข้อไหนตรงกับของชิ้นนี้' : 'นอกเหนือจากนี้ ทำไม่ได้', 20, 160);
    RS.tex.needsUpdate = true;
  };
  paintRules(false);
  {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.79),
      new THREE.MeshBasicMaterial({ map: RS.tex, transparent: true }));
    board.position.set(0, 4.7, 1.03);
    machine.add(board);
  }
  const DS = surface(380, 80);
  const paintReadout = (text, color) => {
    const ctx = DS.ctx;
    ctx.clearRect(0, 0, DS.w, DS.h);
    roundRect(ctx, 4, 4, DS.w - 8, DS.h - 8, 8);
    ctx.fillStyle = '#1A1410'; ctx.fill();
    ctx.strokeStyle = '#8A6420'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.font = `600 23px ${TH}`; ctx.textAlign = 'center';
    ctx.fillStyle = color || '#E8D8B8';
    ctx.fillText(text, DS.w / 2, 50);
    DS.tex.needsUpdate = true;
  };
  paintReadout('พร้อมทำงาน');
  {
    const ro = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .72),
      new THREE.MeshBasicMaterial({ map: DS.tex, transparent: true }));
    ro.position.set(0, 3.5, 1.03);
    machine.add(ro);
  }
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.4, .22, .26), metal(P.brass));
  slot.position.set(0, 2.6, 1.05);
  machine.add(slot);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .85, 16), toon(0x5E8C6A));
  can.visible = false;
  machine.add(can);
  scene.add(machine);

  /* ------------------------------------------- floor 2: sorting plant --- */
  const F2Y = floorY(1) + .35;
  const plant = new THREE.Group();
  plant.position.set(5.2, F2Y, FZ - 1.4);
  plant.rotation.y = -.3;
  const gauges = [];
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(5.4, 4.2, 2, 2, .18), toon(0x3E5A54));
    body.position.y = 2.6;
    plant.add(ink(body, .012));
    /* conveyor belt across the front */
    const belt = new THREE.Mesh(new THREE.BoxGeometry(6.4, .3, 1.3), toon(0x2A3A36));
    belt.position.set(0, 1.1, 1.3);
    plant.add(ink(belt, .016));
    for (let k = 0; k < 7; k++) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, 1.25, 10), metal(0x8A9A94));
      roll.rotation.x = Math.PI / 2;
      roll.position.set(-2.7 + k * .9, 1.32, 1.3);
      roll.userData.spin = 1;
      plant.add(roll);
      plant.userData.rolls = plant.userData.rolls || [];
      plant.userData.rolls.push(roll);
    }
    /* two needle gauges — the era's read-out */
    for (let gi = 0; gi < 2; gi++) {
      const GS = surface(200, 200);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7),
        new THREE.MeshBasicMaterial({ map: GS.tex, transparent: true }));
      face.position.set(gi ? 1.35 : -1.35, 3.1, 1.02);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.88, .08, 8, 32), metal(P.brass));
      rim.position.copy(face.position);
      rim.position.z -= .02;
      plant.add(rim, face);
      const needle = new THREE.Mesh(new THREE.BoxGeometry(.055, .72, .04),
        new THREE.MeshBasicMaterial({ color: 0xD9503A }));
      needle.geometry.translate(0, .36, 0);
      needle.position.copy(face.position);
      needle.position.z += .03;
      plant.add(needle);
      gauges.push({ GS, needle, label: gi ? 'ความแม่น' : 'ข้อมูลเข้า' });
      /* paint the dial face once */
      const ctx = GS.ctx;
      ctx.clearRect(0, 0, 200, 200);
      ctx.beginPath(); ctx.arc(100, 100, 96, 0, 7);
      ctx.fillStyle = '#F2EADA'; ctx.fill();
      ctx.strokeStyle = '#7A8A84'; ctx.lineWidth = 3; ctx.stroke();
      for (let m = 0; m <= 10; m++) {
        const a = -Math.PI * 1.25 + (m / 10) * Math.PI * 1.5;
        const r1 = 96, r2 = m % 5 === 0 ? 74 : 84;
        ctx.strokeStyle = '#3E5A54'; ctx.lineWidth = m % 5 === 0 ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(100 + Math.cos(a) * r1, 100 + Math.sin(a) * r1);
        ctx.lineTo(100 + Math.cos(a) * r2, 100 + Math.sin(a) * r2);
        ctx.stroke();
      }
      ctx.font = `600 20px ${TH}`; ctx.textAlign = 'center'; ctx.fillStyle = '#3E5A54';
      ctx.fillText(gi ? 'ความแม่น' : 'ข้อมูลเข้า', 100, 148);
      GS.tex.needsUpdate = true;
    }
    /* a crate of fruit waiting on the belt */
    for (let k = 0; k < 5; k++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(.24, 12, 9),
        toon(k % 2 ? 0xE8A33D : 0x63C48C));
      fruit.position.set(-2.2 + k * 1.05, 1.5, 1.3);
      plant.add(fruit);
    }
    plant.add((() => { const g2 = glowSprite(11, FLOORS[1].col, .18); g2.position.set(0, 2.6, 1.4); return g2; })());
  }
  scene.add(plant);

  /* ------------------------------------------- floor 3: the DL lab ----- */
  const F3Y = floorY(2) + .35;
  const lab = new THREE.Group();
  lab.position.set(5, F3Y, FZ - 1.4);
  lab.rotation.y = -.28;
  const rackLights = [];
  const armJoints = [];
  {
    /* two server racks with blinking LEDs */
    for (const rx of [-2.5, 2.5]) {
      const rack = new THREE.Mesh(new RoundedBoxGeometry(2.2, 5.2, 1.5, 2, .14), toon(0x2E3A34));
      rack.position.set(rx, 2.6, -.3);
      lab.add(ink(rack, .014));
      for (let r = 0; r < 7; r++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(1.5, .12, .06),
          new THREE.MeshBasicMaterial({ color: 0x8FBF63 }));
        led.position.set(rx, .9 + r * .62, .48);
        lab.add(led);
        rackLights.push({ led, ph: Math.random() * 6.283, sp: 1.4 + Math.random() * 2.6 });
      }
    }
    /* the robot arm — first machine in the tower that moves on its own */
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.72, .86, .5, 16), metal(0x8A9A94));
    base.position.set(0, .25, .6);
    lab.add(ink(base, .02));
    const seg1 = new THREE.Group(); seg1.position.set(0, .5, .6);
    const upper = new THREE.Mesh(new RoundedBoxGeometry(.42, 2.4, .42, 2, .05), toon(0xC8912E));
    upper.position.y = 1.2;
    seg1.add(ink(upper, .024));
    const seg2 = new THREE.Group(); seg2.position.y = 2.4;
    const lower = new THREE.Mesh(new RoundedBoxGeometry(.34, 2, .34, 2, .04), toon(0xC8912E));
    lower.position.y = 1;
    seg2.add(ink(lower, .026));
    const seg3 = new THREE.Group(); seg3.position.y = 2;
    const grip = new THREE.Mesh(new RoundedBoxGeometry(.5, .34, .5, 2, .04), metal(0x8A9A94));
    seg3.add(ink(grip, .03));
    for (const fx of [-.22, .22]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(.1, .5, .1), metal(0xB8C4BE));
      f.position.set(fx, -.4, 0);
      seg3.add(f);
    }
    seg2.add(seg3); seg1.add(seg2); lab.add(seg1);
    armJoints.push(seg1, seg2, seg3);
    lab.add((() => { const g2 = glowSprite(11, FLOORS[2].col, .18); g2.position.set(0, 2.6, 1); return g2; })());
  }
  scene.add(lab);

  /* --------------------------------------- floor 4: the holo forge ----- */
  const F4Y = floorY(3) + .35;
  const forge = new THREE.Group();
  forge.position.set(5, F4Y, FZ - 1.4);
  forge.rotation.y = -.26;
  const holoRings = [];
  let holoCore = null, scanEye = null, scanIris = null;
  {
    /* the generator pedestal */
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 1, 20), toon(0x3A3244));
    ped.position.y = .5;
    forge.add(ink(ped, .018));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28),
      new THREE.MeshBasicMaterial({ color: 0xE0685A, transparent: true, opacity: .5 }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 1.02;
    forge.add(disc);
    /* the thing being generated, floating and rotating */
    holoCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.9, 1),
      new THREE.MeshBasicMaterial({ color: 0xFFAE9E, transparent: true, opacity: .55, wireframe: true }));
    holoCore.position.y = 2.7;
    forge.add(holoCore);
    forge.add((() => { const g2 = glowSprite(8, 0xE0685A, .3); g2.position.y = 2.7; return g2; })());
    /* holographic rings around it */
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.3 + i * .45, .035, 6, 48),
        new THREE.MeshBasicMaterial({ color: 0xE0685A, transparent: true, opacity: .45 }));
      r.position.y = 2.7;
      r.rotation.set(1.1 + i * .5, i * .8, 0);
      forge.add(r);
      holoRings.push(r);
    }
    /* the discriminator: a scanning eye on a post */
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.18, .22, 4.4, 10), metal(0x8A8496));
    post.position.set(3.6, 2.2, 0);
    forge.add(ink(post, .026));
    scanEye = new THREE.Group();
    scanEye.position.set(3.6, 4.6, 0);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(.75, 20, 14), toon(0x2E2A38));
    scanIris = new THREE.Mesh(new THREE.CircleGeometry(.42, 24),
      new THREE.MeshBasicMaterial({ color: 0xE0685A }));
    scanIris.position.z = .74;
    scanEye.add(ink(shell, .022), scanIris);
    scanEye.add(glowSprite(4.4, 0xE0685A, .3));
    forge.add(scanEye);
  }
  scene.add(forge);

  /* --------------------------------------------- floor 5: the word press --- */
  const F5Y = floorY(4) + .35;
  const press = new THREE.Group();
  press.position.set(5, F5Y, FZ - 1.4);
  press.rotation.y = -.3;
  const letterRing = new THREE.Group();
  let paintPressOutput = null;
  {
    const base = new THREE.Mesh(new RoundedBoxGeometry(3.6, 3.2, 1.6, 2, .12), toon(0x3A3050));
    base.position.y = 1.6;
    press.add(ink(base, .012));
    const bandTop = new THREE.Mesh(new RoundedBoxGeometry(3.7, .3, 1.7, 2, .05), metal(P.brass));
    bandTop.position.y = 3.25;
    press.add(bandTop);
    const bandBot = new THREE.Mesh(new RoundedBoxGeometry(3.7, .3, 1.7, 2, .05), metal(P.brass));
    bandBot.position.y = .35;
    press.add(bandBot);
    /* output screen — shows the sentence being built, one token at a time */
    const OS = surface(360, 130);
    paintPressOutput = text => {
      const ctx = OS.ctx, W = OS.w, H = OS.h;
      ctx.clearRect(0, 0, W, H);
      roundRect(ctx, 4, 4, W - 8, H - 8, 10);
      ctx.fillStyle = '#F2EEFF'; ctx.fill();
      ctx.strokeStyle = '#8E7BD6'; ctx.lineWidth = 3; ctx.stroke();
      ctx.font = `600 21px ${TH}`; ctx.fillStyle = '#3A3050'; ctx.textAlign = 'center';
      const words = (text || '').split(' ');
      const lines = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > W - 36 && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      const startY = H / 2 - (lines.length - 1) * 14;
      lines.forEach((ln, i) => ctx.fillText(ln, W / 2, startY + i * 28));
      OS.tex.needsUpdate = true;
    };
    paintPressOutput('…');
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.15),
      new THREE.MeshBasicMaterial({ map: OS.tex }));
    screen.position.set(0, 2.05, .81);
    press.add(screen);
    /* floating letters drifting slowly above — "ตัวอักษรลอยได้" */
    /* Latin + Thai only — see the same note on the era-5 unit's head glyphs */
    const glyphs = ['A', 'B', 'ก', 'ข', 'C', 'ค'];
    glyphs.forEach((ch, i) => {
      const S = surface(48, 48, 1);
      S.ctx.font = `700 32px ${TH}`; S.ctx.textAlign = 'center';
      S.ctx.fillStyle = '#EDE7FF';
      S.ctx.fillText(ch, 24, 32);
      S.tex.needsUpdate = true;
      const a = (i / glyphs.length) * Math.PI * 2;
      const glyph = new THREE.Mesh(new THREE.PlaneGeometry(.4, .4),
        new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
      glyph.position.set(Math.cos(a) * 1.9, 4.1 + Math.sin(a * 2) * .18, Math.sin(a) * 1.9);
      letterRing.add(glyph);
    });
    press.add(letterRing);
    press.add((() => { const g2 = glowSprite(11, FLOORS[4].col, .18); g2.position.set(0, 2.6, 1); return g2; })());
  }
  scene.add(press);

  /* a genuinely separate room for the Jev bonus content, reached by a
     bridge through floor 5's own back wall — not off the side (round 15):
     "สร้างทางเดินเชื่อมไปด้านหลังดีกว่า" (better to route it out through the
     back), and with a real rail instead of scattered posts so it visibly
     can't be walked off ("กันไม่ให้เดินตกแมพ"). The doorway itself
     (`JEV_GATE`) is cut into the shared per-floor wall loop above, so
     from outside the tower it reads as an actual door with a header, not
     a hole — the crossing sits exactly between the wall's two shoji
     windows at x=±3.
     The room is a deep hall, not a chamber, and that depth is load-
     bearing rather than decorative (round 27). Every screenshot from
     round 24 on reported the same thing — the view in here feels
     cramped next to the rest of floor 5 — and measuring the two
     side by side explains why: floor 5's own camera sits ~16 units from
     the player, 7.4 above them, looking ~15° down. A room can only
     reproduce that if it has ~15 units of clear depth *behind* where the
     player stands, because the camera can never retreat past the
     doorway (out there is the unlit bridge, then the tower itself).
     Hence 30 deep: the camera parks just inside the near edge, the
     player lands 16 units in, and the geometry works out to within half
     a unit and 1.5° of floor 5's own. Verified that the corridor
     straight behind the tower is clear for this — the backdrop ring
     (radius 46+) has nothing within ~10 units of this footprint at
     floor 5's height, which is why the old ~46 clearance rule that
     capped earlier rounds turned out not to bind here. */
  const JEV_BRIDGE = { z0: FZ - FD / 2 - .3, z1: -14.5, hw: .8 };
  const JEV_ROOM = { x0: -12, x1: 12, zNear: -14.6, zFar: -44.6 };
  /* how close to the doorway the player may walk back — *not* zNear.
     The camera parks at zNear-1.2 and cannot follow any closer to the
     door than that, so letting the player walk the last stretch would
     have them close the whole 14.8-unit gap and finally step through
     the lens. Stopping them 6 units short keeps the camera behind them
     at every reachable position, and the exit marker/trigger move here
     with them (the doorway itself stays behind the camera, unseen from
     inside — it is the *hall* side that needs it to read as a door). */
  const JEV_WALK_NEAR = JEV_ROOM.zNear - 7.2;
  /* lets the player walk the last ~1.3 units up to the doorway itself —
     the hall's normal clamp stops at z=-11, short of the wall (z=-12).
     Also doubles as nearJevDoor's own trigger bounds (see that const):
     round 20 shrank the trigger to a sliver with zero overlap against
     ยูนิต 05's/the word press's talk circles, which round 21's
     follow-up ("กดปุ่มอื่นเถอะ") showed was correct but unusably precise.
     Round 22 moved the crossing off E entirely (a dedicated key, per
     explicit instruction) — with no more E-press to disambiguate, the
     trigger box could go back to being this whole comfortable approach
     zone instead of staying squeezed to zero overlap. */
  /* z1=-10.8, not -11 exactly: the hall's own clamp minimum *is* -11
     (FZ-FD/2+1), so matching it exactly would leave the same one-frame
     seam gap the lift's radius and every earlier Jev zone had to be
     deliberately widened to avoid — see those comments for the pattern. */
  const JEV_DOOR_WALK = { x0: -1.3, x1: 1.3, z0: -12.3, z1: -10.8 };
  {
    /* the bridge: a solid continuous parapet on both sides (not posts —
       explicit ask, so falling off reads as impossible, not just unlikely) */
    const { z0: bz0, z1: bz1, hw } = JEV_BRIDGE;
    const blen = bz0 - bz1; // z1 is further (more negative); length is positive
    const plank = new THREE.Mesh(new RoundedBoxGeometry(hw * 2, .4, blen, 2, .04), toon(P.wood));
    plank.position.set(0, F5Y - .2, (bz0 + bz1) / 2);
    scene.add(ink(plank, .012));
    for (const x of [-hw, hw]) {
      const parapet = new THREE.Mesh(new RoundedBoxGeometry(.16, 1.0, blen, 2, .03), toon(FLOORS[4].col));
      parapet.position.set(x, F5Y + .5, (bz0 + bz1) / 2);
      scene.add(ink(parapet, .012));
      const cap = new THREE.Mesh(new RoundedBoxGeometry(.24, .08, blen, 2, .02), metal(P.brassDark));
      cap.position.set(x, F5Y + 1.02, (bz0 + bz1) / 2);
      scene.add(cap);
    }
    /* lanterns spaced every ~4.5 units along the way, alternating sides —
       genuinely dark exterior space, unlit by anything inside the tower,
       and now a long enough crossing (round 17: "ทำสะพานให้ไปด้านหลังยาวๆ")
       that two fixed points would leave most of it dark */
    const lampGap = 4.5, lampN = Math.max(2, Math.round(blen / lampGap));
    for (let li = 1; li < lampN; li++) {
      const bz = bz0 - (blen * li) / lampN;
      const lamp = glowSprite(3.4, 0xFFCE86, .22);
      lamp.position.set(li % 2 ? -hw - .3 : hw + .3, F5Y + 1.7, bz);
      scene.add(lamp);
    }

    /* the platform + room, mirroring the main deck's own build (a
       RoundedBoxGeometry slab, ink-outlined, top surface at F5Y) so it
       reads as "more tower," not a different kind of object */
    const { x0: rx0, x1: rx1, zNear, zFar } = JEV_ROOM;
    const platX0 = rx0 - .4, platX1 = rx1 + .4, platZFar = zFar - .4, platZNear = bz1 + .3;
    const platform = new THREE.Mesh(new RoundedBoxGeometry(platX1 - platX0, .7, platZNear - platZFar, 2, .07), toon(P.wood));
    platform.position.set(0, F5Y - .35, (platZFar + platZNear) / 2);
    scene.add(ink(platform, .012));

    const wallH = 12, wallY = F5Y + wallH / 2 + .05, wallMat = toon(P.woodDark);
    /* back wall (far, zFar) carries the sign, facing the doorway (+z) */
    const back = new THREE.Mesh(new RoundedBoxGeometry(rx1 - rx0 + .3, wallH, .22, 2, .03), wallMat);
    back.position.set(0, wallY, zFar);
    scene.add(ink(back, .012));
    /* side walls at rx0/rx1 — closing both x-sides leaves zNear (facing
       the bridge — the only direction in from here) open */
    for (const x of [rx0, rx1]) {
      const side = new THREE.Mesh(new RoundedBoxGeometry(.22, wallH, zNear - zFar + .3, 2, .03), wallMat);
      side.position.set(x, wallY, (zFar + zNear) / 2);
      scene.add(ink(side, .012));
    }
    const roof = new THREE.Mesh(new RoundedBoxGeometry(rx1 - rx0 + .6, .22, zNear - zFar + .6, 2, .05), metal(P.brassDark));
    roof.position.set(0, F5Y + wallH + .17, (zFar + zNear) / 2);
    scene.add(ink(roof, .015));
    const trim = new THREE.Mesh(new THREE.BoxGeometry(rx1 - rx0 + .4, .12, .14), toon(FLOORS[4].col));
    trim.position.set(0, F5Y + wallH + .03, zNear + .05);
    scene.add(trim);
    /* the sign, mounted on the back wall, facing the doorway. It carries
       the F prompt itself (round 28) — there used to be a second,
       floating marker pill hovering over the player saying the same
       thing, which is the pattern every other interactable on every
       floor uses. It earns its place there because those are people and
       machines standing in open space with nothing to write on; here
       there is a lit sign on the wall already saying "Jev", so the
       prompt belongs on it rather than duplicated in the air two metres
       away. The pill below is drawn in the same shape and colours as
       marker() so it still reads as "this is the thing you press",
       just mounted instead of hovering. */
    const S = surface(420, 308);
    const c = S.ctx;
    roundRect(c, 4, 4, S.w - 8, S.h - 8, 22);
    c.fillStyle = '#1A1410'; c.fill();
    c.strokeStyle = '#D8CFFF'; c.lineWidth = 4; c.stroke();
    c.textAlign = 'center';
    c.font = `700 62px ${TH}`; c.fillStyle = '#F2EEE4';
    c.fillText('Jev', S.w / 2, 100);
    c.font = `600 32px ${TH}`; c.fillStyle = '#D8CFFF';
    c.fillText('System One Model', S.w / 2, 152);
    c.font = `400 26px ${TH}`; c.fillStyle = 'rgba(216,207,255,.8)';
    c.fillText('โมเดลที่ไม่พ่นคำออกมา', S.w / 2, 196);
    roundRect(c, 80, 226, 260, 54, 27);
    c.fillStyle = '#D8CFFF'; c.fill();
    c.font = `700 29px ${TH}`; c.fillStyle = '#2A1E14';
    c.fillText('กด F เพื่ออ่าน', S.w / 2, 264);
    S.tex.needsUpdate = true;
    /* sized and hung for the distance it is actually read from: the
       camera parks 28.8 units from this wall, where the frame is ~30
       units wide, and the visible band of the wall runs floor to about
       F5Y+7.4 (below that the view axis has already dropped past the
       floor). 6×4.4 at F5Y+3.6 puts it a fifth of the frame wide,
       centred in that band. */
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.4),
      new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
    sign.position.set(0, F5Y + 3.6, zFar + .13);
    scene.add(sign);
    /* these are additive billboards, not lights — the hall is lit by the
       same tower-wide hemisphere/directional pair as every floor, so
       this is about the space reading as inhabited rather than about
       visibility. One wide wash on the back wall, then a two-column
       grid down the length so a 24×30 floor doesn't go flat between the
       entrance and the sign. */
    scene.add((() => { const g2 = glowSprite(13, 0x8E7BD6, .2); g2.position.set(0, F5Y + 3.4, zFar + 2); return g2; })());
    for (const gx of [-6.5, 6.5]) {
      for (const f of [.25, .5, .75]) {
        const gl = glowSprite(7, 0x8E7BD6, .11);
        gl.position.set(gx, F5Y + 2.6, zFar + (zNear - zFar) * f);
        scene.add(gl);
      }
    }
    /* a torii-style gate at the doorway (zNear) — a lesson kept from
       round 14: the doorway faces the exact direction a player standing
       on the bridge looks in from, which puts flat walls edge-on to that
       view; two posts + a crossbeam read as "an entrance" from precisely
       that angle instead. Posts spread in x this time (the corridor runs
       along z), mirroring round 14's z-spread posts on the x-axis corridor. */
    const postH = wallH + .5;
    for (const x of [rx0, rx1]) {
      const post = new THREE.Mesh(new RoundedBoxGeometry(.55, postH, .55, 2, .04), metal(P.brass));
      post.position.set(x, F5Y + postH / 2, zNear - .12);
      scene.add(ink(post, .015));
    }
    const beam = new THREE.Mesh(new RoundedBoxGeometry(rx1 - rx0 + .8, .7, .8, 2, .05), toon(FLOORS[4].col));
    beam.position.set(0, F5Y + postH + .06, zNear - .12);
    scene.add(ink(beam, .012));

    /* a nameplate hanging on the wall's own new header, facing into the
       hall — no rotation needed (a PlaneGeometry's default normal is
       already +z, and the hall is the +z side of this doorway) — this
       replaces round 15's separate free-standing wayfinding standee,
       since the doorway itself is now unmistakable on its own. */
    const WS = surface(260, 130);
    const wc = WS.ctx;
    roundRect(wc, 3, 3, WS.w - 6, WS.h - 6, 12);
    wc.fillStyle = '#1A1410'; wc.fill();
    wc.strokeStyle = '#D8CFFF'; wc.lineWidth = 3; wc.stroke();
    wc.textAlign = 'center';
    wc.font = `700 32px ${TH}`; wc.fillStyle = '#F2EEE4';
    wc.fillText('Jev', WS.w / 2, 56);
    wc.font = `600 18px ${TH}`; wc.fillStyle = '#D8CFFF';
    wc.fillText('กด F เพื่อเข้าห้อง', WS.w / 2, 90);
    WS.tex.needsUpdate = true;
    const waySign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .8),
      new THREE.MeshBasicMaterial({ map: WS.tex, transparent: true }));
    waySign.position.set(0, F5Y + 4.9, FZ - FD / 2 + .4);
    scene.add(waySign);
  }

  /* ------------------------------------------- floor 6: Mission Control --- */
  /* The only floor whose set IS the lesson: a line painted across the deck
     with the human on one side and the whole AI team on the other. */
  const F6Y = floorY(5) + .35;
  const CREW = [
    { k: 'ux', name: 'นักออกแบบ', en: 'UX/UI', col: 0xE07A9A },
    { k: 'fe', name: 'ทีมหน้าบ้าน', en: 'Frontend', col: 0x4E8FD6 },
    { k: 'be', name: 'ทีมหลังบ้าน', en: 'Backend', col: 0x6FB3A8 },
    { k: 'ops', name: 'ทีมระบบ', en: 'Infra / DevOps', col: 0xE0A85A },
    { k: 'qa', name: 'ทีมทดสอบ', en: 'QA', col: 0x8FBF63 },
    /* lightened from 0x7C7A8C (scale ×1.1) — the original gray was the one
       crew color where neither white nor dark text cleared 4.5:1 against
       it (4.18:1 white, 3.77:1 dark); this shift is small enough to read
       as the same neutral/bench identity color everywhere else it's used
       (desks, figures, glow sprites) while giving dark text 5.1:1 */
    { k: 'data', name: 'ทีมข้อมูล', en: 'Data', col: 0x88869A, bench: true },
    { k: 'sec', name: 'ทีมความปลอดภัย', en: 'Security', col: 0x88869A, bench: true }
  ];
  const f6 = new THREE.Group();
  const desks = {};
  let paintMC = null, mcScreenGlow = null;
  {
    /* the dividing line — unlit, like every other long thin element in this
       scene, so it can't catch the sun edge-on and blow out to a streak */
    const DZ = -6.6;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(FW - 1.6, .22),
      new THREE.MeshBasicMaterial({ color: 0xCFE6FF }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, F6Y + .37, DZ);
    f6.add(strip);
    for (let i = 0; i < 14; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(.1, .7),
        new THREE.MeshBasicMaterial({ color: 0x1F5C99, transparent: true, opacity: .45 }));
      tick.rotation.x = -Math.PI / 2;
      tick.position.set(-8.4 + i * 1.3, F6Y + .371, DZ);
      f6.add(tick);
    }
    const plaque = (label, z, col) => {
      const S = surface(300, 80);
      const c = S.ctx;
      roundRect(c, 3, 3, S.w - 6, S.h - 6, 10);
      c.fillStyle = '#1A1410'; c.fill();
      c.strokeStyle = col; c.lineWidth = 3; c.stroke();
      c.font = `700 30px ${TH}`; c.fillStyle = col; c.textAlign = 'center';
      c.fillText(label, S.w / 2, S.h / 2 + 11);
      S.tex.needsUpdate = true;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .9, 6),
        new THREE.MeshBasicMaterial({ color: 0x4A3324 }));
      post.position.set(-7.9, F6Y + .8, z);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .4),
        new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
      p.position.set(-7.9, F6Y + 1.4, z);
      p.rotation.y = .18;
      f6.add(post, p);
    };
    plaque('ฝั่งมนุษย์', DZ + 1.3, '#E8C98A');
    plaque('ฝั่ง Agentic AI', DZ - 1.3, '#9FD0FF');

    /* a compact standing figure — seven of these would be too heavy as full
       makeBot units, and they read better small next to the lead anyway */
    const crewFigure = col => {
      const g = new THREE.Group();
      for (const lx of [-.17, .17]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .72, 8), toon(0x3A3A44));
        leg.position.set(lx, .36, 0);
        g.add(ink(leg, .04));
      }
      const torso = new THREE.Mesh(new RoundedBoxGeometry(.66, .78, .42, 2, .07), toon(col));
      torso.position.y = 1.1;
      g.add(ink(torso, .04));
      const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 14, 11), toon(col));
      head.position.y = 1.72;
      g.add(ink(head, .045));
      const visor = new THREE.Mesh(new THREE.BoxGeometry(.4, .11, .06),
        new THREE.MeshBasicMaterial({ color: 0xF2EEE4 }));
      visor.position.set(0, 1.74, .26);
      g.add(visor);
      return { g, visor };
    };

    CREW.forEach((cw, i) => {
      const x = -4.8 + i * 1.6, z = -10.2;
      const grp = new THREE.Group();
      grp.position.set(x, F6Y, z);
      /* desk */
      const top = new THREE.Mesh(new RoundedBoxGeometry(1.34, .12, .82, 2, .04), toon(0x5A3E26));
      top.position.y = .74;
      grp.add(ink(top, .02));
      for (const lx of [-.54, .54]) {
        const lg = new THREE.Mesh(new THREE.BoxGeometry(.1, .72, .1),
          new THREE.MeshBasicMaterial({ color: 0x3A2A1C }));
        lg.position.set(lx, .37, .28);
        grp.add(lg);
      }
      /* desk monitor: off until this member is pulled into the job */
      const mon = new THREE.Mesh(new THREE.PlaneGeometry(.78, .48),
        new THREE.MeshBasicMaterial({ color: cw.col, transparent: true, opacity: .25 }));
      mon.position.set(0, 1.12, .3);
      mon.rotation.x = -.16;
      grp.add(mon);
      const monFrame = new THREE.Mesh(new RoundedBoxGeometry(.88, .58, .07, 2, .03), toon(0x3A3A44));
      monFrame.position.set(0, 1.12, .26);
      monFrame.rotation.x = -.16;
      grp.add(ink(monFrame, .03));
      /* the member, standing behind their own desk */
      const fig = crewFigure(cw.col);
      fig.g.position.set(0, 0, -.72);
      grp.add(fig.g);
      /* name tag */
      const S = surface(320, 110);
      const c = S.ctx;
      c.font = `700 34px ${TH}`; c.fillStyle = '#F2EEE4'; c.textAlign = 'center';
      c.fillText(cw.name, S.w / 2, 44);
      c.font = `600 24px ${TH}`;
      c.fillStyle = '#' + cw.col.toString(16).padStart(6, '0');
      c.fillText(cw.en, S.w / 2, 82);
      S.tex.needsUpdate = true;
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .52),
        new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
      tag.position.set(0, 2.42, -.72);
      grp.add(tag);
      const glow = glowSprite(2.4, cw.col, .3);
      glow.position.set(0, 1.3, -.4);
      glow.visible = false;
      grp.add(glow);
      f6.add(grp);
      desks[cw.k] = { grp, mon, glow, visor: fig.visor, fig: fig.g, bench: !!cw.bench, col: cw.col };
    });

    /* a standee at the near end of the desk row: press E for who's who and
       who sits where, without touching the desks/figures already built —
       the actual 3D scale there stays exactly as it is */
    /* placed in front of the desk row's midpoint rather than at either end:
       the near end sits inside ยูนิต 06's talk radius and the far end sits
       inside Mission Control's radius, so standing close enough to trigger
       this marker also triggered whichever of those is checked first in
       onKeyDown — making it permanently unreachable. This spot clears both
       (checked against nearLead's 5.2 and nearMC's 6 radii) with margin.
       x=1.6 also happened to be exactly desk index 4's own x (-4.8+4*1.6),
       so the standee visually sat right in front of that crew figure —
       nudged to x=1.2 (off the desk-column grid) and z=-8.9 (0.3 further
       forward, away from the desk row at z=-10.2) to clear the figure
       without re-tightening either radius margin. */
    f6.userData.roster = new THREE.Vector3(1.2, F6Y, -8.9);
    {
      const rp = f6.userData.roster;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1.7, 6),
        new THREE.MeshBasicMaterial({ color: 0x4A3324 }));
      post.position.set(rp.x, F6Y + .85, rp.z);
      f6.add(post);
      const S = surface(260, 100);
      const c = S.ctx;
      roundRect(c, 3, 3, S.w - 6, S.h - 6, 12);
      c.fillStyle = '#1A1410'; c.fill();
      c.strokeStyle = '#9FD0FF'; c.lineWidth = 3; c.stroke();
      c.font = `700 30px ${TH}`; c.fillStyle = '#F2EEE4'; c.textAlign = 'center';
      c.fillText('ทีมของเรา', S.w / 2, 48);
      c.font = `600 20px ${TH}`; c.fillStyle = '#9FD0FF';
      c.fillText('7 ตำแหน่ง · กด E', S.w / 2, 78);
      S.tex.needsUpdate = true;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .82),
        new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
      board.position.set(rp.x, F6Y + 1.55, rp.z);
      board.rotation.y = .5;
      f6.add(board);
      f6.add((() => { const g2 = glowSprite(2.4, 0x9FD0FF, .18); g2.position.set(rp.x, F6Y + 1, rp.z); return g2; })());
    }

    /* the PM: the one figure on the human side of the line */
    const pmFig = crewFigure(0xE8C98A);
    pmFig.g.position.set(1.2, F6Y, -3.9);
    pmFig.g.rotation.y = Math.PI + .25;
    f6.add(pmFig.g);
    {
      const S = surface(300, 110);
      const c = S.ctx;
      c.font = `700 34px ${TH}`; c.fillStyle = '#F2EEE4'; c.textAlign = 'center';
      c.fillText('PM', S.w / 2, 44);
      c.font = `600 22px ${TH}`; c.fillStyle = '#E8C98A';
      c.fillText('คนส่งโจทย์ ไม่ใช่ AI', S.w / 2, 80);
      S.tex.needsUpdate = true;
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.45, .53),
        new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
      tag.position.set(1.2, F6Y + 2.42, -3.9);
      f6.add(tag);
    }

    /* the console the player actually walks up to */
    const mc = new THREE.Group();
    mc.position.set(6.8, F6Y, -5.2);
    mc.rotation.y = .42;
    const body = new THREE.Mesh(new RoundedBoxGeometry(4.2, 1.1, 1.5, 2, .12), toon(0x2A3448));
    body.position.y = .95;
    mc.add(ink(body, .012));
    for (const lx of [-1.7, 1.7]) {
      const pylon = new THREE.Mesh(new RoundedBoxGeometry(.34, 2.5, .34, 2, .06), metal(P.brassDark));
      pylon.position.set(lx, 2.5, -.2);
      mc.add(ink(pylon, .02));
    }
    const MS = surface(560, 300);
    paintMC = (title, body2) => {
      const c = MS.ctx, W = MS.w, H = MS.h;
      c.clearRect(0, 0, W, H);
      roundRect(c, 5, 5, W - 10, H - 10, 14);
      c.fillStyle = '#101A26'; c.fill();
      c.strokeStyle = '#4E8FD6'; c.lineWidth = 4; c.stroke();
      c.textAlign = 'center';
      c.font = `700 40px ${TH}`; c.fillStyle = '#CFE6FF';
      c.fillText(title, W / 2, 96);
      c.font = `600 30px ${TH}`; c.fillStyle = '#8FB4D8';
      const words = (body2 || '').split(' ');
      const lines = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (c.measureText(test).width > W - 70 && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      lines.slice(0, 4).forEach((ln, i) => c.fillText(ln, W / 2, 170 + i * 42));
      MS.tex.needsUpdate = true;
    };
    paintMC('Mission Control', 'กด E เพื่อส่งโจทย์ให้ทีม');
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2),
      new THREE.MeshBasicMaterial({ map: MS.tex }));
    screen.position.set(0, 2.7, -.1);
    mc.add(screen);
    const screenFrame = new THREE.Mesh(new RoundedBoxGeometry(4, 2.3, .16, 2, .05), toon(0x1B2433));
    screenFrame.position.set(0, 2.7, -.2);
    mc.add(ink(screenFrame, .014));
    mcScreenGlow = glowSprite(9, 0x4E8FD6, .2);
    mcScreenGlow.position.set(0, 2.7, .4);
    mc.add(mcScreenGlow);
    f6.add(mc);
    f6.userData.mc = mc;
  }
  scene.add(f6);
  const mcPos = f6.userData.mc.position.clone();
  const rosterPos = f6.userData.roster.clone();

  /* ------------------------------------------------------ characters --- */
  function makeBot(era, opt = {}) {
    const g = new THREE.Group();
    const C = {
      0: { body: 0xC8912E, trim: 0x8A6420, eye: 0xFFD9A0 },   // brass greeter
      1: { body: 0xB98A3C, trim: 0x7A5628, eye: 0xFFC98A },   // clockwork
      2: { body: 0x7FA8B4, trim: 0x3E5A64, eye: 0x9FE4D8 },   // electric
      3: { body: 0xA8B6A0, trim: 0x4E6B52, eye: 0xBDE88F },   // servo / computer
      4: { body: 0xBFC4D6, trim: 0x6A6480, eye: 0xFF9E88 },   // holographic
      5: { body: 0x8E7BD6, trim: 0x5A46A8, eye: 0xE0D8FF },   // language / LLM
      6: { body: 0x4E8FD6, trim: 0x1F5C99, eye: 0xCFE6FF }    // agentic / team lead
    }[era];

    /* base: wheeled plinth for the older units, legs for the newer ones */
    if (era <= 1) {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.62, .82, 1.3, 14), toon(C.trim));
      skirt.position.y = .65;
      g.add(ink(skirt, .026));
      const band = new THREE.Mesh(new THREE.TorusGeometry(.66, .07, 6, 20), metal(C.body));
      band.rotation.x = Math.PI / 2; band.position.y = 1.24;
      g.add(band);
    } else {
      for (const lx of [-.28, .28]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(.19, .22, 1.5, 10), toon(C.trim));
        leg.position.set(lx, .75, 0);
        g.add(ink(leg, .034));
      }
    }

    /* torso — era 4 (hologram) and era 5 (LLM) share the smoother humanoid
       silhouette; everything mechanical/electric/computer stays boxy */
    const torso = era >= 4
      ? new THREE.Mesh(new THREE.CapsuleGeometry(.58, 1.05, 6, 14), toon(C.body))
      : new THREE.Mesh(new RoundedBoxGeometry(1.16, 1.5, .82, 2, .08), toon(C.body));
    torso.position.y = 2.1;
    g.add(ink(torso, .028));
    /* chest detail per era */
    if (era === 2) {
      const dial = new THREE.Mesh(new THREE.CircleGeometry(.26, 20),
        new THREE.MeshBasicMaterial({ color: 0xF2EADA }));
      dial.position.set(0, 2.15, .43);
      const ndl = new THREE.Mesh(new THREE.BoxGeometry(.03, .2, .02),
        new THREE.MeshBasicMaterial({ color: 0xD9503A }));
      ndl.geometry.translate(0, .1, 0);
      ndl.position.set(0, 2.15, .45);
      g.add(dial, ndl);
      g.userData.needle = ndl;
    } else if (era === 5) {
      /* a quote-mark glyph instead of a vent — this is the unit whose whole
         job is language */
      const S = surface(80, 80, 1);
      S.ctx.font = `700 60px ${TH}`; S.ctx.textAlign = 'center';
      S.ctx.fillStyle = '#F2EEFF';
      S.ctx.fillText('“”', 40, 54);
      S.tex.needsUpdate = true;
      const glyph = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5),
        new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
      glyph.position.set(0, 2.15, .43);
      g.add(glyph);
    } else if (era === 6) {
      /* a team tree on the chest: one node on top branching to four —
         this unit's whole job is that it isn't working alone */
      const S = surface(96, 72, 2);
      const c = S.ctx;
      c.strokeStyle = '#CFE6FF'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(48, 18); c.lineTo(48, 36);
      c.moveTo(15, 36); c.lineTo(81, 36);
      for (const bx of [15, 37, 59, 81]) { c.moveTo(bx, 36); c.lineTo(bx, 50); }
      c.stroke();
      c.fillStyle = '#CFE6FF';
      c.beginPath(); c.arc(48, 14, 7, 0, Math.PI * 2); c.fill();
      for (const bx of [15, 37, 59, 81]) { c.beginPath(); c.arc(bx, 55, 5, 0, Math.PI * 2); c.fill(); }
      S.tex.needsUpdate = true;
      const tree = new THREE.Mesh(new THREE.PlaneGeometry(.62, .46),
        new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
      tree.position.set(0, 2.15, .43);
      g.add(tree);
    } else {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(.62, .34, .06),
        new THREE.MeshBasicMaterial({ color: C.eye, transparent: true, opacity: .8 }));
      vent.position.set(0, 2.12, .43);
      g.add(vent);
    }

    /* head */
    const head = era >= 4
      ? new THREE.Mesh(new THREE.SphereGeometry(.52, 20, 15), toon(C.body))
      : new THREE.Mesh(new RoundedBoxGeometry(.94, .8, .8, 2, .09), toon(C.body));
    head.position.y = 3.2;
    g.add(ink(head, .03));
    /* face: a lit visor band, wider as the era advances */
    const visor = new THREE.Mesh(new THREE.BoxGeometry(era >= 4 ? .82 : .66, era >= 3 ? .2 : .16, .1),
      new THREE.MeshBasicMaterial({ color: C.eye }));
    visor.position.set(0, 3.22, era >= 4 ? .48 : .43);
    g.add(visor);
    g.userData.visor = visor;
    /* antenna / crown per era */
    if (era === 2) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .7, 6), metal(C.trim));
      ant.position.set(.3, 3.9, 0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8),
        new THREE.MeshBasicMaterial({ color: C.eye }));
      bulb.position.set(.3, 4.28, 0);
      g.add(ant, bulb);
    } else if (era <= 1) {
      const key = new THREE.Mesh(new THREE.TorusGeometry(.19, .045, 6, 14), metal(C.trim));
      key.position.set(0, 3.24, -.5);
      key.userData.spin = .7;
      g.add(key);
      g.userData.key = key;
    } else if (era === 3) {
      for (const cx of [-.4, .4]) {
        const cab = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .5, 6), toon(C.trim));
        cab.position.set(cx, 3.75, -.2);
        cab.rotation.z = cx > 0 ? .3 : -.3;
        g.add(cab);
      }
    } else if (era === 5) {
      /* small floating letter glyphs orbiting the head — "ตัวอักษรลอยได้" */
      /* Latin + Thai only — the font stack (IBM Plex Sans Thai, then a
         generic sans-serif) isn't guaranteed to carry CJK or Greek glyphs,
         and a missing glyph renders as an empty box instead of a letter */
      const letters = ['A', 'ก', 'B'];
      letters.forEach((ch, i) => {
        const S = surface(48, 48, 1);
        S.ctx.font = `700 32px ${TH}`; S.ctx.textAlign = 'center';
        S.ctx.fillStyle = '#EDE7FF';
        S.ctx.fillText(ch, 24, 32);
        S.tex.needsUpdate = true;
        const a = (i / letters.length) * Math.PI * 2;
        const glyph = new THREE.Mesh(new THREE.PlaneGeometry(.34, .34),
          new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
        glyph.position.set(Math.cos(a) * .62, 3.85 + Math.sin(a * 2) * .12, Math.sin(a) * .62);
        g.add(glyph);
      });
    } else if (era === 6) {
      /* five satellites circling the head — the team it is coordinating */
      const crown = new THREE.Group();
      crown.position.y = 3.95;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8),
          new THREE.MeshBasicMaterial({ color: C.eye }));
        dot.position.set(Math.cos(a) * .66, Math.sin(a * 2) * .07, Math.sin(a) * .66);
        crown.add(dot);
      }
      g.add(crown);
      g.userData.crown = crown;
    }

    /* arms */
    for (const ax of [-.78, .78]) {
      const arm = era >= 4
        ? new THREE.Mesh(new THREE.CapsuleGeometry(.16, .9, 4, 10), toon(C.body))
        : new THREE.Mesh(new RoundedBoxGeometry(.24, 1.05, .24, 2, .035), toon(C.trim));
      arm.position.set(ax, 2.1, 0);
      arm.rotation.z = ax > 0 ? -.16 : .16;
      g.add(ink(arm, .034));
      const joint = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), metal(C.trim));
      joint.position.set(ax, 2.68, 0);
      g.add(joint);
    }
    g.userData.eye = C.eye;
    return g;
  }

  /* lobby keeper */
  const keeper = makeBot(0);
  keeper.position.set(-5.4, 0, 7.5);
  keeper.rotation.y = .55;
  scene.add(keeper);
  scene.add((() => { const s = glowSprite(2.6, 0xFFD9A0, .13); s.position.set(-5.4, .06, 7.5); return s; })());
  /* floor-1 mechanic */
  const mech = makeBot(1);
  mech.position.set(-4.6, floorY(0) + .35, FZ - 1.5);
  mech.rotation.y = .6;
  scene.add(mech);
  const mechGlow = glowSprite(2.6, 0x8FE0C4, .13);
  mechGlow.position.set(-4.6, floorY(0) + .4, FZ - 1.5);
  scene.add(mechGlow);

  /* floor-2 technician */
  const tech = makeBot(2);
  tech.position.set(-4.4, F2Y, FZ - 1.5);
  tech.rotation.y = .62;
  scene.add(tech);
  const techGlow = glowSprite(2.6, 0x8FD8E0, .13);
  techGlow.position.set(-4.4, F2Y + .05, FZ - 1.5);
  scene.add(techGlow);

  /* floor-3 researcher */
  const doc = makeBot(3);
  doc.position.set(-4.4, F3Y, FZ - 1.5);
  doc.rotation.y = .62;
  scene.add(doc);
  const docGlow = glowSprite(2.6, 0xBFE08F, .13);
  docGlow.position.set(-4.4, F3Y + .05, FZ - 1.5);
  scene.add(docGlow);

  /* floor-4 humanoid: same silhouette, but plated and glowing */
  const unit = makeBot(4);
  unit.position.set(-4.4, F4Y, FZ - 1.5);
  unit.rotation.y = .62;
  scene.add(unit);
  const unitGlow = glowSprite(2.6, 0xE0685A, .13);
  unitGlow.position.set(-4.4, F4Y + .05, FZ - 1.5);
  scene.add(unitGlow);

  /* floor-5 language unit */
  const ling = makeBot(5);
  ling.position.set(-4.4, F5Y, FZ - 1.5);
  ling.rotation.y = .62;
  scene.add(ling);
  const lingGlow = glowSprite(2.6, 0x8E7BD6, .13);
  lingGlow.position.set(-4.4, F5Y + .05, FZ - 1.5);
  scene.add(lingGlow);

  /* floor-6 team lead — the Agentic unit */
  const lead = makeBot(6);
  lead.position.set(-4.4, F6Y, FZ - 1.5);
  lead.rotation.y = .62;
  scene.add(lead);
  const leadGlow = glowSprite(2.6, 0x4E8FD6, .13);
  leadGlow.position.set(-4.4, F6Y + .05, FZ - 1.5);
  scene.add(leadGlow);

  /* player: a real rigged/animated model (KayKit's Knight — CC0, stylized
     low-poly, a large shared animation library including Idle/Walking_A/
     Running_A — loaded from the project's own assets/ folder) instead of
     the stacked-primitive body used for every other character. Toon-shaded
     on load so it still reads in the same flat/outlined world as everything
     else, and its own texture is simple/flat enough that this barely changes it. */
  const player = new THREE.Group();
  player.position.set(1.4, 0, 15);
  scene.add(player);
  let playerMixer = null, playerIdle = null, playerWalk = null, playerCurAction = null;
  function setPlayerAnim(action) {
    if (!action || playerCurAction === action) return;
    const prev = playerCurAction;
    playerCurAction = action;
    action.reset().fadeIn(.25).play();
    if (prev) prev.fadeOut(.25);
  }
  new GLTFLoader().loadAsync('./assets/RobotExpressive.glb').then(gltf => {
    const root = gltf.scene;
    /* measure the model's own bounds rather than assume its source units —
       scale it to this game's ~3.2-unit character height and drop its feet
       to local y=0 so it sits on the ground exactly like every other body */
    const box = new THREE.Box3().setFromObject(root);
    const h = box.max.y - box.min.y;
    const scl = 3.2 / (h || 1);
    root.scale.setScalar(scl);
    root.position.y -= box.min.y * scl;
    /* the model's own rest pose faces the opposite way from this game's
       forward convention — confirmed by walking it: pressing W advanced
       the group correctly but the body faced away from the travel
       direction, i.e. walking backwards. Flip it 180° here once, on the
       model only, so the group's own facing math (unchanged) lines up
       with what the mesh actually shows. */
    root.rotation.y = Math.PI;
    root.traverse(o => {
      if (!o.isMesh) return;
      const old = o.material;
      o.material = new THREE.MeshToonMaterial({
        map: old && old.map ? old.map : null,
        color: old && old.map ? 0xffffff : (old && old.color) || 0xC9B08A,
        gradientMap: ramp()
      });
      o.castShadow = true; o.receiveShadow = true;
    });
    player.add(root);
    playerMixer = new THREE.AnimationMixer(root);
    /* clip names differ per source — KayKit ships Walking_A, three.js's
       RobotExpressive ships Walking — so try the spellings rather than
       tie the game to one pack's convention. The idle falls back to
       whatever clip is first: without *some* clip playing, a skinned
       model shows its bind pose, which is often a bare T-pose. */
    const pick = (...names) => names.reduce((f, n) => f || THREE.AnimationClip.findByName(gltf.animations, n), null);
    const idleClip = pick('Idle', 'Idle_A', 'Standing') || gltf.animations[0];
    const walkClip = pick('Walking_A', 'Walking', 'Walk');
    if (idleClip) playerIdle = playerMixer.clipAction(idleClip);
    if (walkClip) playerWalk = playerMixer.clipAction(walkClip);
    setPlayerAnim(playerIdle || playerWalk);
  }).catch(e => console.error('player model failed to load:', e));
  const pshadow = glowSprite(4.2, 0xFFD9A0, .32);
  scene.add(pshadow);

  /* markers */
  function marker(text, color) {
    const S = surface(280, 78);
    const paint = t => {
      const ctx = S.ctx;
      ctx.clearRect(0, 0, S.w, S.h);
      roundRect(ctx, 4, 4, 272, 58, 29);
      ctx.fillStyle = color; ctx.fill();
      ctx.font = `700 25px ${TH}`; ctx.textAlign = 'center';
      ctx.fillStyle = '#2A1E14';
      ctx.fillText(t, 140, 41);
      S.tex.needsUpdate = true;
    };
    paint(text);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: S.tex, transparent: true, depthWrite: false, fog: false
    }));
    sp.scale.set(3.7, 1.03, 1);
    sp.userData.paint = paint;
    return sp;
  }
  const mkKeeper = marker('กด E เพื่อคุย', '#D98B3A');
  mkKeeper.position.set(keeper.position.x, 4.7, keeper.position.z);
  scene.add(mkKeeper);
  const mkLift = marker('กด E ขึ้นกระเช้า', '#C8912E');
  mkLift.position.set(LIFT_X, 6.9, LIFT_Z);
  scene.add(mkLift);
  const mkMech = marker('กด E เพื่อคุย', '#8FE0C4');
  mkMech.position.set(mech.position.x, floorY(0) + 5.05, mech.position.z);
  scene.add(mkMech);
  const mkMachine = marker('กด E ใช้เครื่อง', '#E8B45A');
  mkMachine.position.set(machine.position.x, floorY(0) + 7.4, machine.position.z);
  scene.add(mkMachine);
  const mkBoard = marker('กด E อ่านกระดาน', '#E8B45A');
  mkBoard.position.set(boards[0].position.x, floorY(0) + 5.2, boards[0].position.z);
  scene.add(mkBoard);
  const mkTech = marker('กด E เพื่อคุย', '#8FD8E0');
  mkTech.position.set(tech.position.x, F2Y + 4.7, tech.position.z);
  scene.add(mkTech);
  const mkPlant = marker('กด E ใช้เครื่อง', '#8FD8E0');
  mkPlant.position.set(plant.position.x, F2Y + 5.2, plant.position.z);
  scene.add(mkPlant);
  const mkDoc = marker('กด E เพื่อคุย', '#BFE08F');
  mkDoc.position.set(doc.position.x, F3Y + 4.7, doc.position.z);
  scene.add(mkDoc);
  const mkLab = marker('กด E ใช้แผงควบคุม', '#BFE08F');
  mkLab.position.set(lab.position.x, F3Y + 5.4, lab.position.z);
  scene.add(mkLab);
  const mkUnit = marker('กด E เพื่อคุย', '#FFAE9E');
  mkUnit.position.set(unit.position.x, F4Y + 4.7, unit.position.z);
  scene.add(mkUnit);
  const mkForge = marker('กด E ใช้แท่นสร้าง', '#FFAE9E');
  mkForge.position.set(forge.position.x, F4Y + 6.4, forge.position.z);
  scene.add(mkForge);
  const mkLing = marker('กด E เพื่อคุย', '#D8CFFF');
  mkLing.position.set(ling.position.x, F5Y + 4.7, ling.position.z);
  scene.add(mkLing);
  const mkPress = marker('กด E ใช้เครื่องผลิตคำ', '#D8CFFF');
  mkPress.position.set(press.position.x, F5Y + 5.4, press.position.z);
  scene.add(mkPress);
  /* no floating marker for the doc itself — the back wall's sign carries
     that prompt (see its own comment where it's painted) */
  const mkJevDoor = marker('กด F เข้าห้อง', '#D8CFFF');
  /* hovers over the doorway approach rather than out in the open hall —
     the old position (z=-9.8) was exactly where the screenshot showed
     all four markers lit at once, since it sat deep inside both
     ยูนิต 05's and the word press's talk radii. z=-11.5 keeps it clear
     of the doorway's own header (a solid lintel spanning the wall's
     full z-thickness, -12.25 to -11.75, above the 3.25-tall opening) —
     any higher marker height placed inside that z-range would render
     inside solid geometry instead of the open doorway gap below it. */
  mkJevDoor.position.set(0, F5Y + 4.2, -11.5);
  scene.add(mkJevDoor);
  const mkJevExit = marker('กด F ออกจากห้อง', '#D8CFFF');
  mkJevExit.position.set(0, F5Y + 3.3, JEV_WALK_NEAR - .3);
  scene.add(mkJevExit);
  const mkLead = marker('กด E เพื่อคุย', '#9FD0FF');
  mkLead.position.set(-4.4, F6Y + 4.7, FZ - 1.5);
  scene.add(mkLead);
  const mkMC = marker('กด E เปิด Mission Control', '#9FD0FF');
  mkMC.position.set(mcPos.x, F6Y + 5.2, mcPos.z);
  scene.add(mkMC);
  const mkRoster = marker('กด E แนะนำทีม', '#9FD0FF');
  mkRoster.position.set(rosterPos.x, F6Y + 3.1, rosterPos.z);
  scene.add(mkRoster);
  const mkDown = marker('กด E ลงกระเช้า', '#C8912E');
  mkDown.position.set(LIFT_X, floorY(0) + 6.9, LIFT_Z);
  mkDown.visible = false;
  scene.add(mkDown);

  /* real light and shadow, at last — every solid toon/metal surface built above
     casts and receives; flat basic-material screens/glows/sprites don't bother */
  scene.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if ((m.isMeshToonMaterial || m.isMeshStandardMaterial) && !m.transparent) {
      o.castShadow = true; o.receiveShadow = true;
    }
  });
  floorPlane.castShadow = false;

  /* --------------------------------------------------------------- UI -- */
  const ui = {
    quest: document.getElementById('quest'),
    floor: document.getElementById('floor'),
    dlg: document.getElementById('dlg'),
    who: document.getElementById('dlg-who'),
    tx: document.getElementById('dlg-tx'),
    next: document.getElementById('dlg-next'),
    items: document.getElementById('items'),
    row: document.getElementById('item-row'),
    toast: document.getElementById('toast'),
    card: document.getElementById('card'),
    rules: document.getElementById('rules'),
    docs: document.getElementById('docs'),
    fade: document.getElementById('fade')
  };
  let mode = 'walk';          // walk | talk | items | card
  let level = 0;              // 0 = lobby, 1 = floor 1
  let stage = 'lobby';        // lobby → toLift → f1intro → quest → wrap → done
  let firstMoveHandled = false;
  const startEl = document.getElementById('start');
  function dismissStart() { if (startEl) startEl.classList.add('done'); }
  let script = null, line = 0;
  let fedOk = 0, fedBad = 0, half = false;
  let fly = null, shake = 0, canT = -1, riding = 0, rideInfo = null;
  const RIDE_MS = 640;
  /* whether the player has warped through the Jev doorway — see jevWarp()
     and JEV_WARP_MS further down. Gates which side of the doorway the
     movement clamp treats as "in bounds" this frame. */
  let jevIn = false;
  /* set by jevWarp(); consumed by step()'s camera block on the next frame
     to place the camera outright instead of easing into position */
  let camSnap = false;
  let mlAcc = 0, mlInputLevel = .18, mlPhase = 'draw';
  let dlPhase = 'manual', dlLearnT = 0;
  let gaPhase = 'build', gaVerdict = null, gaScanT = 0, gaLevel = 1, gaPasses = 0;
  let llmPhase = 'tokens'; // tokens -> attention -> lifecycle -> done
  let llmPicks = [], llmAllTop = true, llmAttnDone = false, llmAttnWrong = null, llmLastSeen = null;
  const llmSeen = { pretrain: false, instruct: false, rl: false };
  const visited = new Set(), cleared = new Set();

  const setQuest = h => { ui.quest.innerHTML = h; };
  const setFloor = () => {
    ui.floor.innerHTML = level === 0
      ? `<b>โถงชั้นล่าง</b><span>หอคอย ${FLOORS.length} ชั้น</span>`
      : `<b>ชั้น ${level} · ${FLOORS[level - 1].t}</b><span>${FLOORS[level - 1].era}</span>`;
  };
  setFloor();
  setQuest('<b>ภารกิจ</b><span>เดินไปคุยกับ ยูนิต 00</span>');

  function toast(html, cls) {
    ui.toast.className = 'on ' + (cls || '');
    ui.toast.innerHTML = html;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { ui.toast.className = ''; }, 5400);
  }
  function startTalk(lines) {
    keys.clear();
    script = lines; line = 0; mode = 'talk';
    ui.dlg.classList.add('on');
    renderLine();
  }
  function renderLine() {
    ui.who.textContent = script[line][0];
    ui.tx.innerHTML = script[line][1];
    ui.next.textContent = line < script.length - 1 ? '▸ กด E หรือคลิกเพื่อไปต่อ' : '▸ กด E เพื่อจบบทสนทนา';
  }
  function advance() {
    if (line < script.length - 1) { line++; renderLine(); return; }
    ui.dlg.classList.remove('on');
    mode = 'walk';
    if (stage === 'lobby') {
      stage = 'toLift';
      setQuest('<b>ภารกิจ</b><span>ขึ้นกระเช้าไปชั้น 1</span>');
      mkLift.userData.paint('! กด E ขึ้นกระเช้า');
    } else if (stage === 'f1intro') {
      stage = 'quest';
      setQuest('<b>ภารกิจ</b><span>หย่อนของใส่ตู้ 2 แบบ<br>· ตรงเงื่อนไข <i id="q-ok">0/1</i><br>· ไม่ตรงเงื่อนไข <i id="q-bad">0/1</i></span>');
      syncQuest();
    } else if (stage === 'wrap') {
      stage = 'done';
      cleared.add(1);
      showCard(1);
      setQuest('<b>จบชั้น 1</b><span>ผ่านแล้ว ขึ้นชั้น 2 ได้</span>');
    } else if (stage === 'f2intro') {
      stage = 'f2quest';
      setQuest('<b>ภารกิจ</b><span>ไปที่เครื่องคัดผลไม้ แล้ว:<br>· ลากเส้นแบ่งเอง<br>· ปล่อยล็อตใหม่<br>· ให้เครื่องปรับเส้นเอง</span>');
    } else if (stage === 'f2wrap') {
      stage = 'f2done';
      cleared.add(2);
      showCard(2);
      setQuest('<b>จบชั้น 2</b><span>ผ่านแล้ว ขึ้นชั้น 3 ได้</span>');
    } else if (stage === 'f3intro') {
      stage = 'f3quest';
      setQuest('<b>ภารกิจ</b><span>ไปที่แผงควบคุม แล้ว:<br>· หมุน Weight ให้ทายถูกเกิน 70%<br>· แล้วให้เครื่องเรียนเอง</span>');
    } else if (stage === 'f3wrap') {
      stage = 'f3done';
      cleared.add(3);
      showCard(3);
      setQuest('<b>จบชั้น 3</b><span>ผ่านแล้ว ขึ้นชั้น 4 ได้</span>');
    } else if (stage === 'f4intro') {
      stage = 'f4quest';
      setQuest('<b>ภารกิจ</b><span>ไปที่แท่นสร้าง แล้วปั้นของ<br>ให้ผ่านตา Discriminator <b>3 รอบ</b></span>');
    } else if (stage === 'f4wrap') {
      stage = 'f4done';
      cleared.add(4);
      showCard(4);
      setQuest('<b>จบชั้น 4</b><span>ผ่านแล้ว ขึ้นชั้น 5 ได้</span>');
    } else if (stage === 'f5intro') {
      stage = 'f5quest';
      setQuest('<b>ภารกิจ</b><span>ไปที่เครื่องผลิตคำ แล้ว:<br>· ต่อคำเองทีละคำ<br>· โยงคำที่เกี่ยวกัน<br>· สอนให้ตอบเป็น</span>');
    } else if (stage === 'f5wrap') {
      stage = 'f5done';
      cleared.add(5);
      showCard(5);
      setQuest('<b>จบชั้น 5</b><span>ผ่านแล้ว ขึ้นชั้น 6 ได้</span>');
    } else if (stage === 'f6intro') {
      stage = 'f6quest';
      setQuest('<b>ภารกิจ</b><span>ไปที่ Mission Control แล้ว:<br>· เลือกโจทย์ส่งให้ทีม<br>· ดูจนทีมส่งงานเสร็จ</span>');
    } else if (stage === 'f6wrap') {
      stage = 'f6done';
      cleared.add(6);
      showCard(6);
      setQuest('<b>จบหอคอย</b><span>ครบทั้ง 6 ชั้นแล้ว</span>');
    }
  }
  function syncQuest() {
    const a = document.getElementById('q-ok'), b = document.getElementById('q-bad');
    if (a) a.textContent = Math.min(1, fedOk) + '/1';
    if (b) b.textContent = Math.min(1, fedBad) + '/1';
    if (fedOk >= 1 && fedBad >= 1 && stage === 'quest') {
      stage = 'wrap';
      setQuest('<b>ภารกิจ</b><span>กลับไปคุยกับ ยูนิต 01</span>');
      mkMech.userData.paint('! กด E เพื่อคุย');
      toast('ลองครบทั้งสองแบบแล้ว <b>กลับไปคุยกับ ยูนิต 01</b>');
    }
  }

  ITEMS.forEach(it => {
    const b = document.createElement('button');
    b.className = 'item';
    b.innerHTML = `<span>${it.label}</span>`;
    b.onclick = () => feed(it);
    ui.row.appendChild(b);
  });
  function openItems() {
    if (stage === 'f1intro') { toast('ไปอ่านกระดานเรียนรู้ (กด E) แล้วคุยกับ ยูนิต 01 ก่อนครับ'); return; }
    keys.clear();
    mode = 'items'; ui.items.classList.add('on');
  }
  function closeItems() { mode = 'walk'; ui.items.classList.remove('on'); }
  document.getElementById('item-close').onclick = closeItems;
  const seeRulesBtn = document.getElementById('item-rules');
  if (seeRulesBtn) seeRulesBtn.onclick = openRules;

  function feed(it) {
    if (fly) return;
    closeItems();
    const S = surface(180, 96);
    S.ctx.fillStyle = '#F2E4CC'; roundRect(S.ctx, 3, 3, 174, 90, 12); S.ctx.fill();
    S.ctx.strokeStyle = '#2A211A'; S.ctx.lineWidth = 3; S.ctx.stroke();
    S.ctx.font = `600 19px ${TH}`; S.ctx.fillStyle = '#2A211A'; S.ctx.textAlign = 'center';
    S.ctx.fillText(it.label, 90, 54);
    S.tex.needsUpdate = true;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .8),
      new THREE.MeshBasicMaterial({ map: S.tex, transparent: true }));
    card.position.copy(player.position).add(new THREE.Vector3(0, 3, 0));
    scene.add(card);
    fly = { card, t: 0, from: card.position.clone(), to: machine.localToWorld(new THREE.Vector3(0, 2.6, 1.1)), it };
  }
  function applyItem(it) {
    if (it.kind === 'ok' || (it.kind === 'half' && half)) {
      fedOk++; half = false; canT = 0;
      paintReadout('ตรงเงื่อนไขข้อ 1 จ่ายน้ำ', '#8FE0B4');
      paintRules(false);
      toast('<b>เครื่องทำงานได้</b> เพราะของชิ้นนี้ตรงกับเงื่อนไขที่เขียนไว้พอดี', 'ok');
    } else if (it.kind === 'half') {
      half = true;
      paintReadout('ตรงเงื่อนไขข้อ 2 รออีก 5 บาท');
      toast('เครื่องบอกว่ารออีก 5 บาท ใส่เหรียญ 5 บาทอีกเหรียญสิ');
    } else {
      fedBad++; shake = .7;
      paintReadout('ค้าง ไม่มีเงื่อนไขรองรับ', '#FF9E7A');
      paintRules(true);
      toast(`<b>เครื่องไปต่อไม่ได้</b> ${it.why} มันไม่ได้คิดว่าของชิ้นนี้คืออะไร แค่หาในเงื่อนไขแล้วไม่เจอ<br><span style="font-size:13px">กด <b>Q</b> ดูเงื่อนไขเต็มจอได้</span>`, 'bad');
    }
    syncQuest();
  }
  /* the learning board, rendered full screen so it is actually readable */
  let docsRead = false;
  function openDocs(i) {
    keys.clear();
    const d = DOCS[i] || DOCS[0];
    document.getElementById('docs-lead').textContent = d.lead;
    document.getElementById('docs-q').textContent = d.q;
    document.getElementById('docs-en').textContent = d.en;
    document.getElementById('docs-body').innerHTML =
      d.blocks.map(b => `<div class="blk"><b>${b.h}</b>${
        b.list
          ? `<div class="blk-list">${b.list.map(([lb, ds]) => `<div class="blk-item"><b>${lb}</b><span>${ds}</span></div>`).join('')}</div>`
          : `<p>${b.p}</p>`
      }</div>`).join('');
    document.getElementById('docs-next').innerHTML = d.next;
    ui.docs.classList.add('on');
    if (mode === 'walk') mode = 'docs';
    if (i === 0) {
      docsRead = true;
      const hb = document.getElementById('hint-docs');
      if (hb) hb.classList.add('done');
    }
  }
  function closeDocs() {
    ui.docs.classList.remove('on');
    if (mode === 'docs') mode = 'walk';
  }
  document.getElementById('docs-close').onclick = closeDocs;
  ui.docs.onclick = e => { if (e.target === ui.docs) closeDocs(); };

  /* the Jev doorway crossing: a fade-and-snap teleport rather than a
     walk, reusing the same #fade overlay the lift ride already uses
     (see ride()) instead of inventing a second transition system.
     mode='warp' blocks WASD/look input the same way every other non-
     'walk' mode already does (step()'s movement block and the pointer
     handlers both gate on mode==='walk'), so no separate input-lock
     flag is needed. 320ms comfortably clears #fade's own .24s CSS
     transition before the teleport happens out of sight. */
  const JEV_WARP_MS = 320;
  function jevWarp(x, z, after) {
    if (mode === 'warp') return;
    keys.clear();
    mode = 'warp';
    ui.fade.classList.add('on');
    setTimeout(() => {
      player.position.set(x, F5Y, z);
      look.yaw = 0; look.pitch = Math.max(0, look.pitch);
      /* the camera is smoothed, so without this it spends the second
         after the fade lifts *gliding* from wherever it was to where it
         belongs — and for a warp that crosses a wall, "wherever it was"
         is on the other side of it. 320ms of damp 2.6 only covers ~56%
         of the trip, so the first thing the player would see on the way
         in is the tower, from outside the room. Snapping is what the
         lift ride already does for the same reason (camPos.copy after
         positioning the camera by hand). */
      camSnap = true;
      if (after) after();
      ui.fade.classList.remove('on');
      mode = 'walk';
    }, JEV_WARP_MS);
  }
  function jevWarpIn() {
    jevIn = true;
    /* 16 units past the doorway. The camera cannot retreat past the
       door (the unlit bridge and then the tower are out there), so the
       distance it gets to stand back is however far *in* the player
       lands — 1.6 gave it .4 units and a shot of the player's own back,
       5 gave it 3.8 and still read cramped next to the rest of floor 5,
       and 16 is what puts it at floor 5's own ~16-unit framing. */
    jevWarp(0, JEV_ROOM.zNear - 16, () => toast('เดินทะลุประตูเข้ามาในห้องแล้วครับ', 'ok'));
  }
  function jevWarpOut() {
    jevIn = false;
    jevWarp(0, -9.5, null);
  }

  /* full-screen rules: readable at any distance, unlike the 3D board */
  function openRules() {
    keys.clear();
    ui.rules.classList.add('on');
    if (mode === 'walk') mode = 'rules';
  }
  function closeRules() {
    ui.rules.classList.remove('on');
    if (mode === 'rules') mode = 'walk';
  }
  document.getElementById('rules-close').onclick = closeRules;
  ui.rules.onclick = e => { if (e.target === ui.rules) closeRules(); };

  const CARDS = {
    1: {
      lead: 'สรุปชั้น 1',
      h: 'นี่คือ AI แบบ Rule-Based ทำได้เท่าที่เงื่อนไขครอบคลุม ไม่มากกว่านั้น',
      terms: [
        ['Rule-Based', 'ทำตามเงื่อนไขที่คนเขียนไว้ล่วงหน้า ถ้าเจอแบบนี้ ให้ทำแบบนี้'],
        ['Artificial Intelligence', 'ระบบอัตโนมัติที่ทำงานแทนคนได้ ชั้นตั้งต้นของหอคอยนี้'],
        ['ข้อจำกัด', 'เจอของที่ไม่มีในเงื่อนไขแล้วไปต่อไม่ได้ ต้องรอคนมาเขียนเพิ่มทุกครั้ง'],
        ['ชั้นถัดไป', 'Machine Learning แก้ข้อจำกัดนี้ ด้วยการให้เครื่องหากฎจากข้อมูลเอง']
      ]
    },
    2: {
      lead: 'สรุปชั้น 2',
      h: 'Machine Learning = ระบบ Rule-Based ที่อัปเดตตัวเองได้',
      terms: [
        ['Machine Learning', 'เงื่อนไขที่เรียนจากข้อมูลใหม่ แล้วปรับตัวเองได้ ไม่ต้องรอคนมาแก้'],
        ['Classification', 'การขีดเส้นแบ่งข้อมูลออกเป็นกลุ่ม เส้นที่คุณเพิ่งลากนั่นเอง'],
        ['Clustering', 'จับข้อมูลที่หน้าตาคล้ายกันมากองไว้ด้วยกัน โดยยังไม่ต้องตั้งชื่อกลุ่ม'],
        ['Policy Fix', 'กติกาที่คุมไว้ว่าข้อมูลใหม่ต้องไม่ทำให้สิ่งที่ทำไปแล้วเปลี่ยน เช่น จำนวนกลุ่มไม่เพิ่มเอง'],
        ['ข้อจำกัด', 'ยังต้องมีคนบอกว่าให้ดูจากอะไร (Label) แต่บางเรื่องคนก็ระบุไม่ได้'],
        ['ชั้นถัดไป', 'Deep Learning ให้เครื่องหา Feature เองด้วย Neural Network']
      ]
    },
    3: {
      lead: 'สรุปชั้น 3',
      h: 'Deep Learning = ให้เครื่องหาจุดสังเกตเอง ด้วย Neural Network',
      terms: [
        ['Neural Network', 'โครงข่ายที่แปลงข้อมูลเป็นตัวเลข แล้วคูณกันไปตลอดสายจนได้คำตอบ'],
        ['Weight', 'ตัวเลขที่บอกว่าข้อมูลแต่ละอย่างสำคัญแค่ไหน ปุ่มที่คุณเพิ่งหมุนนั่นเอง'],
        ['Backpropagation', 'เทียบคำตอบกับของจริง แล้วไล่ย้อนกลับไปบอกทุก Weight ว่าต้องหมุนทางไหน'],
        ['Supervised / Unsupervised', 'มีคน Label ไว้ชัดเจน หรือจัดกลุ่มไว้เฉย ๆ โดยยังไม่ Label'],
        ['Feature', 'จุดสังเกตที่โมเดลใช้ตัดสิน ชั้นนี้หาเองได้ ไม่ต้องรอคนบอก'],
        ['ชั้นถัดไป', 'Generative AI เพิ่มตัวที่สร้างของขึ้นมาใหม่ เพื่อลับคมโมเดลตัวนี้']
      ]
    },
    4: {
      lead: 'สรุปชั้น 4',
      h: 'Generative AI = Generator กับ Discriminator ไล่กวดกันจนทั้งคู่เก่งขึ้น',
      terms: [
        ['Generative AI', 'ชั้นที่สร้างของขึ้นมาใหม่ได้ ไม่ใช่แค่ตัดสินของที่มีอยู่'],
        ['Generator Model', 'ตัวสร้างของใหม่ (คุณเมื่อกี้) ไม่ได้เอาไปใช้งานจริง มีไว้ลับคมตัวจริง'],
        ['Discriminator Model', 'ตัวตรวจที่พัฒนามาจาก Deep Learning ตัวนี้คือ Model ที่ใช้งานจริง'],
        ['Binary Classification', 'คำตอบสองทางของตัวตรวจ: จริง หรือ ปลอม แล้วส่งผลกลับไปเกลาให้คมขึ้น'],
        ['ชั้นถัดไป', 'LLM เอา Generative AI นี้ไปสร้าง “คำ” ออกมาทีละคำ ตัวที่เราคุยด้วยทุกวัน']
      ]
    },
    5: {
      lead: 'สรุปชั้น 5',
      h: 'LLM = ทายคำถัดไปทีละคำ จากความน่าจะเป็น โดยรู้ว่าคำไหนเกี่ยวกับคำไหน',
      terms: [
        ['LLM', 'Model ที่คำนวณความน่าจะเป็นแล้วทายคำถัดไปทีละคำ จนได้คำตอบทั้งประโยค'],
        ['Tokenized / Embeddings', 'ซอยข้อความเป็นชิ้นเล็ก แล้วแปลงแต่ละชิ้นเป็นตัวเลขให้เครื่องคำนวณได้'],
        ['Attention', 'กลไกที่คำนวณว่าคำไหนในประโยคเกี่ยวข้องกับคำไหน'],
        ['Transformer', 'Neural Network ที่ใช้ใน LLM มี Encoder แปลงข้อความเป็นเวกเตอร์ และ Decoder แปลงกลับมาเป็นคำตอบ'],
        ['Pretrain / Instruct / RL', 'สามขั้นก่อนใช้งานจริง: เรียนรู้กว้าง ๆ ก่อน → ฝึกเฉพาะทาง → ให้คนติชมเพื่อปรับให้ดีขึ้น'],
        ['ชั้นถัดไป', 'Agentic AI เอา LLM ตัวนี้ไปเป็นสมองของผู้จัดการ ที่สั่งงานทีม AI ทั้งทีมได้เอง']
      ]
    },
    6: {
      lead: 'สรุปชั้น 6 จบหอคอย',
      h: 'Agentic AI = รับเป้าหมายมาแล้วจัดการเองจนจบ ไม่ใช่แค่ตอบกลับ',
      terms: [
        ['Agentic AI', 'Workflow ของ Multi-Agent โดย Agentic คือ Manager ส่วน Agent แต่ละตัวคือ Engineer'],
        ['Planning Pattern', 'แตกงานเป็น Task แล้ว Replan จน Optimized ก่อนลงมือ'],
        ['Tool Use Pattern', 'เลือก Tool ที่เหมาะสมกับ Goal ที่รับเข้ามา แล้วดำเนินการต่อจนสำเร็จ'],
        ['MultiAgent Pattern', 'ส่งให้ Agents ในทีมจัดการกันเองจนได้ Outcome ออกมา'],
        ['Reflection Pattern', 'ตรวจ Outcome จนมั่นใจก่อนค่อย Response กลับ ตอนทีมทดสอบตีงานกลับนั่นเอง'],
        ['Reasoning', 'คิดเป็นเหตุเป็นผล พร้อมคุณธรรม จริยธรรม และความเข้าใจคน ให้ใกล้เคียงการตัดสินใจของมนุษย์'],
        ['ครบทั้งหอคอย', 'ชั้นในสุดไม่ได้มาแทนชั้นนอก แต่เป็นชั้นนอกที่ถูกเพิ่มความสามารถเข้าไปเรื่อย ๆ']
      ]
    }
  };
  let cardLv = null;
  function showCard(lv) {
    const c = CARDS[lv] || CARDS[1];
    cardLv = lv;
    document.getElementById('card-lead').textContent = c.lead;
    document.querySelector('#card h2').textContent = c.h;
    document.querySelector('#card .terms').innerHTML =
      c.terms.map(([b, d]) => `<div class="term"><b>${b}</b><span>${d}</span></div>`).join('');
    const rings = document.getElementById('card-rings');
    const isEnd = lv === FLOORS.length;
    rings.classList.toggle('on', isEnd);
    if (isEnd) {
      /* outermost ring = floor 1 (AI), innermost = the last floor —
         mirrors the order the player actually climbed */
      const n = FLOORS.length;
      rings.innerHTML = FLOORS.map((f, i) => {
        const size = 168 - i * (144 / (n - 1));
        const hex = '#' + f.col.toString(16).padStart(6, '0');
        return `<i style="width:${size}px;height:${size}px;left:${(168 - size) / 2}px;top:${(168 - size) / 2}px;`
          + `border-color:${hex};animation-delay:${i * 110}ms"></i>`;
      }).join('');
    } else {
      rings.innerHTML = '';
    }
    ui.card.classList.add('on');
    mode = 'card';
  }

  const CARD_CLOSE_MSG = {
    1: 'ขึ้นกระเช้าไปชั้น 2 ได้เลยครับ Machine Learning รออยู่',
    2: 'ขึ้นกระเช้าไปชั้น 3 ได้เลยครับ Deep Learning รออยู่',
    3: 'ขึ้นกระเช้าไปชั้น 4 ได้เลยครับ Generative AI รออยู่',
    4: 'ขึ้นกระเช้าไปชั้น 5 ได้เลยครับ LLM รออยู่',
    5: 'ขึ้นกระเช้าไปชั้น 6 ได้เลยครับ ชั้นสุดท้ายของหอคอย',
    6: 'ครบทั้ง 6 ชั้นแล้วครับ 🎉 กลับไปชั้นไหนอีกก็ได้ผ่านกระเช้า'
  };
  document.getElementById('card-close').onclick = () => {
    ui.card.classList.remove('on');
    mode = 'walk';
    toast(CARD_CLOSE_MSG[cardLv] || CARD_CLOSE_MSG[1], cardLv === FLOORS.length ? 'ok' : '');
  };

  /* ---------------- floor 2 · the ML bench ----------------
     A 2D board the player draws a boundary on. Then a new batch arrives and
     the old line starts mis-sorting; the machine then re-fits it by itself. */
  const ML = {
    pts: [], line: null, shown: null, target: null, anim: false, drag: null, wrong: 0
  };
  let mlSeed = 20240917;
  const mlRnd = () => { mlSeed = (mlSeed * 1103515245 + 12345) & 0x7fffffff; return mlSeed / 0x7fffffff; };
  const mlGauss = (m, sd) => {
    let u = 0, v = 0;
    while (!u) u = mlRnd();
    while (!v) v = mlRnd();
    return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v);
  };
  function mlSeedData() {
    ML.pts = [];
    for (let i = 0; i < 16; i++) ML.pts.push({ x: mlGauss(.68, .12), y: mlGauss(.32, .11), c: 1, n: false });
    for (let i = 0; i < 16; i++) ML.pts.push({ x: mlGauss(.32, .12), y: mlGauss(.68, .11), c: 0, n: false });
  }
  mlSeedData();
  const mlSide = (p, L) => (p.x * Math.cos(L.th) + p.y * Math.sin(L.th)) - L.rho;
  function mlScore(L) {
    let a = 0, b = 0, c = 0, d = 0;
    for (const p of ML.pts) {
      if (mlSide(p, L) > 0) { p.c ? a++ : b++; } else { p.c ? c++ : d++; }
    }
    return Math.max(a + d, b + c) / Math.max(1, ML.pts.length);
  }
  function mlMark(L) {
    let a = 0, b = 0, c = 0, d = 0;
    for (const p of ML.pts) { if (mlSide(p, L) > 0) { p.c ? a++ : b++; } else { p.c ? c++ : d++; } }
    const posRipe = (a + d) >= (b + c);
    let wrong = 0;
    for (const p of ML.pts) {
      const pos = mlSide(p, L) > 0;
      const predRipe = posRipe ? pos : !pos;
      p.bad = predRipe !== !!p.c;
      if (p.bad) wrong++;
    }
    ML.wrong = wrong;
    return wrong;
  }
  function mlBest() {
    let best = { th: 0, rho: 0, s: -1 };
    for (let i = 0; i < 120; i++) {
      const th = (i / 120) * Math.PI;
      for (let j = -60; j <= 60; j++) {
        const rho = j * .017;
        const s = mlScore({ th, rho });
        if (s > best.s) best = { th, rho, s };
      }
    }
    return best;
  }

  const mlCanvas = document.getElementById('ml-canvas');
  const mlCtx = mlCanvas ? mlCanvas.getContext('2d') : null;
  function mlDraw() {
    if (!mlCtx) return;
    const W = mlCanvas.width / (window.devicePixelRatio > 1 ? 2 : 1);
    const H = mlCanvas.height / (window.devicePixelRatio > 1 ? 2 : 1);
    const ctx = mlCtx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#F2EADA'; ctx.fillRect(0, 0, W, H);
    /* grid */
    ctx.strokeStyle = 'rgba(62,90,84,.13)'; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(W * i / 10, 0); ctx.lineTo(W * i / 10, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H * i / 10); ctx.lineTo(W, H * i / 10); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(42,33,26,.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    /* axis captions */
    ctx.font = `600 13px ${TH}`; ctx.fillStyle = '#5A6E68';
    ctx.textAlign = 'center';
    ctx.fillText('ขนาดผล เล็ก → ใหญ่', W / 2, H - 9);
    ctx.save();
    ctx.translate(15, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('สีเปลือก เหลือง → เขียว', 0, 0);
    ctx.restore();
    /* the boundary */
    if (ML.shown) {
      const L = ML.shown;
      const nx = Math.cos(L.th), ny = Math.sin(L.th);
      const pts = [];
      for (const [a, b, isX] of [[0, 1, true], [1, 1, false], [0, 0, false], [1, 0, true]]) { }
      /* intersect the line with the unit square, then map to canvas */
      const cand = [];
      if (Math.abs(ny) > 1e-6) {
        for (const x of [0, 1]) { const y = (L.rho - nx * x) / ny; if (y >= 0 && y <= 1) cand.push([x, y]); }
      }
      if (Math.abs(nx) > 1e-6) {
        for (const y of [0, 1]) { const x = (L.rho - ny * y) / nx; if (x >= 0 && x <= 1) cand.push([x, y]); }
      }
      if (cand.length >= 2) {
        const P0 = cand[0], P1 = cand[cand.length - 1];
        ctx.strokeStyle = '#1E7A8C'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(P0[0] * W, (1 - P0[1]) * H);
        ctx.lineTo(P1[0] * W, (1 - P1[1]) * H);
        ctx.stroke();
      }
    }
    /* the fruit */
    for (const p of ML.pts) {
      const cx = p.x * W, cy = (1 - p.y) * H;
      if (p.bad && mlPhase !== 'draw') {
        ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 7);
        ctx.fillStyle = 'rgba(201,61,40,.25)'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, p.n ? 8.5 : 7, 0, 7);
      ctx.fillStyle = p.c ? '#E09A22' : '#4E9B58';
      ctx.fill();
      ctx.strokeStyle = 'rgba(42,33,26,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
      if (p.n) {
        ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 7);
        ctx.strokeStyle = 'rgba(30,122,140,.65)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }
  function mlSizeCanvas() {
    if (!mlCanvas) return;
    const box = mlCanvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio > 1 ? 2 : 1;
    const w = Math.max(220, Math.min(560, box.width));
    const h = Math.round(w * .66);
    mlCanvas.style.width = w + 'px';
    mlCanvas.style.height = h + 'px';
    mlCanvas.width = w * dpr;
    mlCanvas.height = h * dpr;
    mlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mlDraw();
  }
  function mlSetStatus() {
    const el = document.getElementById('ml-status');
    const pct = Math.round(mlAcc * 100);
    const good = ML.pts.length - ML.wrong;
    if (!el) return;
    if (mlPhase === 'draw') {
      el.className = '';
      el.innerHTML = 'ลากเมาส์ผ่านกระดานเพื่อขีด <b>เส้นแบ่ง</b> ให้ผลสีทอง (สุก) อยู่ฝั่งหนึ่ง สีเขียว (ดิบ) อยู่อีกฝั่ง';
    } else if (mlPhase === 'drawn') {
      el.className = 'ok';
      el.innerHTML = `เส้นของคุณแบ่งถูก <b>${good}/${ML.pts.length} ผล (${pct}%)</b><br>นี่คือกฎที่<b>คุณ</b>เขียนให้เครื่องด้วยมือ เหมือนช่างเขียนเงื่อนไขในชั้น 1`;
    } else if (mlPhase === 'drift') {
      el.className = 'bad';
      el.innerHTML = `ผลไม้ล็อตใหม่เข้ามาแล้ว เส้นเดิมเหลือ <b>${pct}%</b><br>พันธุ์ใหม่ลูกเล็กกว่าเดิม กฎเส้นเดิมจึงตัดผิด ถ้าเป็นตู้ชั้น 1 ต้องรอคนมาแก้`;
    } else if (mlPhase === 'learning') {
      el.className = '';
      el.innerHTML = 'เครื่องกำลังดูข้อมูลใหม่ แล้ว<b>ขยับเส้นของตัวเอง</b>…';
    } else {
      el.className = 'ok';
      el.innerHTML = `เครื่องปรับเส้นเองแล้ว: <b>${pct}%</b><br>ไม่มีใครไปแก้กฎให้มันเลย มันเรียนจากข้อมูลใหม่แล้วเลื่อนเส้นเอง`;
    }
    const acts = document.getElementById('ml-acts');
    if (acts) {
      acts.innerHTML =
        (mlPhase === 'drawn' ? '<button id="ml-new" class="pri">ปล่อยผลไม้ล็อตใหม่เข้ามา</button><button id="ml-again">ลากเส้นใหม่</button>' : '') +
        (mlPhase === 'drift' ? '<button id="ml-learn" class="pri">ให้เครื่องปรับเส้นเอง</button><button id="ml-again">ลากเส้นใหม่เอง</button>' : '') +
        (mlPhase === 'draw' && ML.shown ? '<button id="ml-again">ลากใหม่</button>' : '') +
        '<button id="ml-close">ปิด (Esc)</button>';
      const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
      bind('ml-close', closeML);
      bind('ml-again', () => { ML.shown = null; ML.line = null; mlPhase = 'draw'; ML.pts.forEach(p => p.bad = false); mlAcc = 0; mlDraw(); mlSetStatus(); });
      bind('ml-new', () => {
        for (let i = 0; i < 7; i++) ML.pts.push({ x: mlGauss(.5, .1), y: mlGauss(.34, .1), c: 1, n: true });
        for (let i = 0; i < 6; i++) ML.pts.push({ x: mlGauss(.44, .1), y: mlGauss(.64, .1), c: 0, n: true });
        mlAcc = mlScore(ML.shown); mlMark(ML.shown);
        mlInputLevel = .72;
        mlPhase = 'drift';
        mlDraw(); mlSetStatus();
      });
      bind('ml-learn', () => {
        const best = mlBest();
        let th = best.th, rho = best.rho;
        while (th - ML.shown.th > Math.PI / 2) { th -= Math.PI; rho = -rho; }
        while (ML.shown.th - th > Math.PI / 2) { th += Math.PI; rho = -rho; }
        ML.target = { th, rho }; ML.anim = true;
        mlPhase = 'learning';
        mlSetStatus();
      });
    }
  }
  function openML() {
    if (stage === 'f2intro') { toast('ไปอ่านกระดานเรียนรู้ (กด E) แล้วคุยกับ ยูนิต 02 ก่อนครับ'); return; }
    keys.clear();
    mode = 'ml';
    document.getElementById('ml').classList.add('on');
    mlSizeCanvas();
    mlSetStatus();
  }
  function closeML() {
    document.getElementById('ml').classList.remove('on');
    if (mode === 'ml') mode = 'walk';
  }
  if (mlCanvas) {
    const toUnit = e => {
      const r = mlCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    };
    mlCanvas.addEventListener('pointerdown', e => {
      if (mlPhase !== 'draw') return;
      try { mlCanvas.setPointerCapture(e.pointerId); } catch (err) { }
      ML.drag = toUnit(e);
    });
    mlCanvas.addEventListener('pointermove', e => {
      if (!ML.drag) return;
      const b = toUnit(e);
      const dx = b.x - ML.drag.x, dy = b.y - ML.drag.y;
      if (Math.hypot(dx, dy) < .06) return;
      const th = Math.atan2(dx, -dy);
      const rho = ML.drag.x * Math.cos(th) + ML.drag.y * Math.sin(th);
      ML.shown = { th, rho };
      mlAcc = mlScore(ML.shown); mlMark(ML.shown);
      mlInputLevel = .34;
      mlDraw();
    });
    mlCanvas.addEventListener('pointerup', () => {
      if (!ML.drag) return;
      ML.drag = null;
      if (!ML.shown) return;
      mlPhase = 'drawn';
      mlDraw(); mlSetStatus();
    });
    addEventListener('resize', () => { if (mode === 'ml') mlSizeCanvas(); });
  }

  /* ---------------- floor 3 · the Weight console ----------------
     Four dials feed two outputs. The player turns them until the model
     predicts correctly, then hands over and watches Backpropagation. */
  const DLW = [.30, .26, .62, .58];
  const DL_START = DLW.slice();
  const DL_T = .9;
  const DL_KNOBS = [
    { i: 0, from: 'อยู่นนทบุรี', to: 'กะเพราหมูสับ' },
    { i: 1, from: 'ใส่เสื้อสีส้ม', to: 'กะเพราหมูสับ' },
    { i: 2, from: 'อยู่นนทบุรี', to: 'ผัดคะน้า' },
    { i: 3, from: 'ใส่เสื้อสีส้ม', to: 'ผัดคะน้า' }
  ];
  function dlProbs() {
    const s0 = DLW[0] + DLW[1], s1 = DLW[2] + DLW[3];
    const e0 = Math.exp(s0 / DL_T), e1 = Math.exp(s1 / DL_T);
    return [e0 / (e0 + e1), e1 / (e0 + e1)];
  }
  function dlRender() {
    const p = dlProbs();
    const rows = document.getElementById('dl-knobs');
    if (rows) {
      rows.innerHTML = DL_KNOBS.map(k => {
        const v = DLW[k.i];
        return `<div class="kn">
          <div class="lb"><b>${k.from}</b> → ${k.to}</div>
          <div class="ct">
            <button class="mn" data-k="${k.i}" data-d="-1"${dlPhase !== 'manual' ? ' disabled' : ''}>−</button>
            <div class="bar"><i style="transform:scaleX(${v.toFixed(3)})"></i></div>
            <button class="mn" data-k="${k.i}" data-d="1"${dlPhase !== 'manual' ? ' disabled' : ''}>+</button>
            <span class="vv">${v.toFixed(2)}</span>
          </div>
        </div>`;
      }).join('');
      rows.querySelectorAll('.mn').forEach(b => {
        b.onclick = () => {
          if (dlPhase !== 'manual') return;
          const i = +b.dataset.k, d = +b.dataset.d;
          DLW[i] = Math.max(0, Math.min(1, DLW[i] + d * .12));
          dlRender();
        };
      });
    }
    const outs = document.getElementById('dl-outs');
    if (outs) {
      const names = ['กะเพราหมูสับ', 'ผัดคะน้า'];
      outs.innerHTML = names.map((n, i) => {
        const win = p[i] > .5;
        return `<div class="ou${win ? ' win' : ''}">
          <span class="nm">${n}</span>
          <div class="bar"><i style="transform:scaleX(${p[i].toFixed(3)})"></i></div>
          <span class="pc">${Math.round(p[i] * 100)}%</span>
        </div>`;
      }).join('');
    }
    const st = document.getElementById('dl-status');
    if (st) {
      const good = p[0] >= .7;
      if (dlPhase === 'manual') {
        st.className = good ? 'ok' : '';
        st.innerHTML = good
          ? `<b>ทายถูกแล้ว ${Math.round(p[0] * 100)}%</b><br>คุณเพิ่งทำสิ่งที่เรียกว่า “เทรนโมเดล” ด้วยมือเปล่า`
          : `เครื่องยังทายว่า <b>${p[0] > p[1] ? 'กะเพรา' : 'ผัดคะน้า'} ${Math.round(Math.max(p[0], p[1]) * 100)}%</b> ยังไม่ตรงกับความจริง<br>ลองเพิ่มสองแถวบน แล้วลดสองแถวล่าง`;
      } else if (dlPhase === 'learning') {
        st.className = 'bad';
        st.innerHTML = '<b>กำลังเรียน…</b> เครื่องเทียบคำตอบที่ผิด แล้วไล่ย้อนกลับไปบอก Weight ทุกตัวว่าควรหมุนทางไหน';
      } else {
        st.className = 'ok';
        st.innerHTML = `<b>เครื่องหมุน Weight เองจนถูก ${Math.round(p[0] * 100)}%</b><br>ไม่มีใครไปแก้ให้เลย นี่คือ Backpropagation`;
      }
    }
    const acts = document.getElementById('dl-acts');
    if (acts) {
      const good = p[0] >= .7;
      acts.innerHTML =
        (dlPhase === 'manual' && good ? '<button id="dl-auto" class="pri">ทีนี้ให้เครื่องเรียนเอง →</button>' : '') +
        (dlPhase === 'manual' ? '<button id="dl-reset">รีเซ็ต Weight</button>' : '') +
        '<button id="dl-close">ปิด (Esc)</button>';
      const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
      bind('dl-close', closeDL);
      bind('dl-reset', () => { DLW.forEach((_, i) => DLW[i] = DL_START[i]); dlRender(); });
      bind('dl-auto', () => {
        DLW[0] = .18; DLW[1] = .12; DLW[2] = .74; DLW[3] = .69;
        dlPhase = 'learning'; dlLearnT = 0;
        dlRender();
      });
    }
    const flow = document.getElementById('dl-flow');
    if (flow) flow.classList.toggle('on', dlPhase === 'learning');
  }
  function openDL() {
    if (stage === 'f3intro') { toast('ไปอ่านกระดานเรียนรู้ (กด E) แล้วคุยกับ ยูนิต 03 ก่อนครับ'); return; }
    keys.clear();
    mode = 'dl';
    document.getElementById('dl').classList.add('on');
    dlRender();
  }
  function closeDL() {
    document.getElementById('dl').classList.remove('on');
    if (mode === 'dl') mode = 'walk';
  }

  /* ---------------- floor 4 · the Generator bench ----------------
     The player picks how carefully to forge each trait, then sends the piece
     to the Discriminator. Every pass makes the Discriminator check one more
     trait — the two of them ratchet each other up. */
  const GA_TRAITS = [
    { key: 'line', t: 'ลายเส้น', opts: ['วาดละเอียดเหมือนของจริง', 'ลากหยาบ ๆ พอผ่าน'], why: 'ลายเส้นหยาบเกินไป' },
    { key: 'color', t: 'โทนสี', opts: ['ผสมสีให้ตรงเป๊ะ', 'สีเพี้ยนไปนิดหน่อย'], why: 'โทนสีเพี้ยน' },
    { key: 'mark', t: 'ลายน้ำ', opts: ['ทำลายน้ำซ่อนไว้ด้วย', 'ไม่ต้องทำ เสียเวลา'], why: 'ไม่มีลายน้ำ' }
  ];
  /* the Discriminator learns to check traits in this order */
  const GA_ORDER = ['mark', 'color', 'line'];
  const gaPick = { line: 0, color: 0, mark: 0 };

  function gaChecks() { return GA_ORDER.slice(0, gaLevel).map(k => GA_TRAITS.find(t => t.key === k)); }
  function gaRender() {
    const rows = document.getElementById('ga-traits');
    if (rows) {
      rows.innerHTML = GA_TRAITS.map(tr => `<div class="tr">
        <div class="lb">${tr.t}</div>
        <div class="op">${tr.opts.map((o, i) => `<button class="${gaPick[tr.key] === i ? 'sel' : ''}"
          data-k="${tr.key}" data-i="${i}"${gaPhase === 'scan' ? ' disabled' : ''}>${o}</button>`).join('')}</div>
      </div>`).join('');
      rows.querySelectorAll('button').forEach(b => {
        b.onclick = () => {
          if (gaPhase === 'scan') return;
          gaPick[b.dataset.k] = +b.dataset.i;
          gaVerdict = null;
          gaRender();
        };
      });
    }
    const chk = document.getElementById('ga-checks');
    if (chk) {
      chk.innerHTML = gaChecks().map(c => `<span>${c.t}</span>`).join('')
        + `<em>Discriminator ตรวจอยู่ ${gaLevel} อย่าง</em>`;
    }
    const meter = document.getElementById('ga-meter');
    if (meter) meter.style.transform = `scaleX(${(gaPasses / 3).toFixed(3)})`;
    const st = document.getElementById('ga-status');
    if (st) {
      if (gaPhase === 'scan') { st.className = ''; st.innerHTML = '<b>Discriminator กำลังสแกน…</b>'; }
      else if (gaVerdict === 'fail') {
        st.className = 'bad';
        st.innerHTML = `<b>จับได้ว่าปลอม</b> ${gaVerdict_why}<br>มันไม่ได้เดา มันตอบแค่ “จริง / ปลอม” จากจุดที่มันเคยเห็น`;
      } else if (gaVerdict === 'pass' && gaPasses < 3) {
        st.className = 'ok';
        st.innerHTML = `<b>หลอกผ่าน!</b> แต่ Discriminator จำจุดนั้นไว้แล้ว<br>รอบหน้ามันตรวจ ${gaLevel} อย่าง ต้องปั้นให้เนียนขึ้นอีก`;
      } else if (gaVerdict === 'pass') {
        st.className = 'ok';
        st.innerHTML = '<b>หลอกผ่านครบ 3 รอบ</b> ของที่คุณสร้างเนียนจนแยกไม่ออก และ Discriminator ก็คมกว่าเดิมมาก';
      } else {
        st.className = '';
        st.innerHTML = 'เลือกวิธีปั้นแต่ละจุด แล้วกดส่งไปให้ Discriminator ตรวจ';
      }
    }
    const acts = document.getElementById('ga-acts');
    if (acts) {
      acts.innerHTML =
        (gaPasses < 3 ? `<button id="ga-send" class="pri"${gaPhase === 'scan' ? ' disabled' : ''}>ส่งไปให้ Discriminator ตรวจ</button>` : '') +
        '<button id="ga-close">ปิด (Esc)</button>';
      const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
      bind('ga-close', closeGA);
      bind('ga-send', () => {
        if (gaPhase === 'scan') return;
        gaPhase = 'scan'; gaScanT = 0; gaVerdict = null;
        gaRender();
      });
    }
    /* the forged piece, drawn as a holo preview */
    const prev = document.getElementById('ga-preview');
    if (prev) {
      prev.className = 'pv'
        + (gaPick.line ? ' rough' : '')
        + (gaPick.color ? ' offhue' : '')
        + (gaPick.mark ? '' : ' marked');
      prev.innerHTML = '';
      const cap = document.getElementById('ga-cap');
      if (cap) cap.textContent = gaPick.mark ? 'ของชิ้นนี้: ไม่มีลายน้ำ' : 'ของชิ้นนี้: มีลายน้ำ';
    }
  }
  let gaVerdict_why = '';
  function gaJudge() {
    const failed = gaChecks().find(c => gaPick[c.key] === 1);
    if (failed) {
      gaVerdict = 'fail';
      gaVerdict_why = failed.why;
    } else {
      gaVerdict = 'pass';
      gaPasses++;
      if (gaPasses < 3) gaLevel = Math.min(3, gaLevel + 1);
      else if (stage === 'f4quest') {
        stage = 'f4wrap';
        setQuest('<b>ภารกิจ</b><span>กลับไปคุยกับ ยูนิต 04</span>');
        mkUnit.userData.paint('! กด E เพื่อคุย');
        toast('หลอกผ่านครบ 3 รอบ <b>กลับไปคุยกับ ยูนิต 04</b>');
      }
    }
    gaPhase = 'build';
    gaRender();
  }
  function openGA() {
    if (stage === 'f4intro') { toast('ไปอ่านกระดานเรียนรู้ (กด E) แล้วคุยกับ ยูนิต 04 ก่อนครับ'); return; }
    keys.clear();
    mode = 'ga';
    document.getElementById('ga').classList.add('on');
    gaRender();
  }
  function closeGA() {
    document.getElementById('ga').classList.remove('on');
    if (mode === 'ga') mode = 'walk';
  }

  /* ---------------- floor 5 · the word press ----------------
     One machine, three phases, run in sequence like the flow diagram in
     the source docs: Tokenized → Embeddings → Attention → Decoder.
     Phase 1: the player IS the model, picking the next token by hand from
     a probability list. Phase 2: the player wires up Attention by hand —
     which word a pronoun actually points to. Phase 3: the player compares
     Pretrain / Instruct / Reinforcement Learning answers to the same
     specialised question, and gives RL its feedback. */
  const LLM_Q = 'สัตว์อะไรน่ารักที่สุด ?';
  const LLM_STEPS = [
    { opts: [{ w: 'แมว', p: .52 }, { w: 'หมา', p: .31 }, { w: 'ปลาหมึกยักษ์', p: .02 }] },
    { opts: [{ w: 'เพราะ', p: .46 }, { w: 'ที่', p: .21 }, { w: 'แต่', p: .06 }] },
    { opts: [{ w: 'ขนมันนุ่ม', p: .39 }, { w: 'เสียงมันน่ารัก', p: .24 }, { w: 'มันเสียภาษีตรงเวลา', p: .01 }] },
    { opts: [{ w: 'แล้วก็ขี้อ้อน', p: .41 }, { w: 'และตาโต', p: .18 }, { w: 'และมันบินได้', p: .02 }] }
  ];
  const LLM_ATTN = {
    text: 'แมวตัวนั้นน่ารักเพราะ{มัน}ขนนุ่ม',
    opts: ['แมวตัวนั้น', 'น่ารัก', 'ขนนุ่ม'],
    correct: 'แมวตัวนั้น'
  };
  const LLM_LIFECYCLE = {
    q: 'ลูกค้าถาม: “สัญญาเช่าฉบับนี้ ผมยกเลิกก่อนกำหนดได้ไหม มีค่าปรับเท่าไร?”',
    pretrain: 'พูดกว้าง ๆ ว่า “สัญญาเช่าโดยทั่วไปมักมีเงื่อนไขเรื่องการยกเลิกก่อนกำหนด ซึ่งอาจมีค่าปรับหรือไม่มีก็ได้ ขึ้นอยู่กับแต่ละสัญญา” รู้กว้างแต่ไม่ตอบคำถามจริง',
    instruct: 'อ่านมาตราที่เกี่ยวกับ “การเลิกสัญญาก่อนกำหนด” ในเอกสารแล้วตอบตรงประเด็น: “ได้ครับ มาตรา 12 ระบุค่าปรับ 2 เท่าของค่าเช่าเดือนสุดท้าย” ตอบเฉพาะทางเพราะถูกฝึกมาแล้ว',
    rl: 'คำตอบเดิมจากขั้น Instruct แต่ปรับโทนตามที่มนุษย์เคยติชมไว้ก่อนหน้า (พูดสุภาพขึ้น ไม่ใช้ศัพท์กฎหมายเปล่า ๆ)'
  };

  const LLM_PHASE_TITLE = {
    tokens: 'เครื่องผลิตคำ: ต่อคำเองทีละคำ',
    attention: 'เครื่องผลิตคำ: โยงคำที่เกี่ยวกัน',
    lifecycle: 'เครื่องผลิตคำ: สอนให้ตอบเป็น'
  };
  function llmRender() {
    for (const id of ['llm-phase1', 'llm-phase2', 'llm-phase3']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    const h2 = document.getElementById('llm-h2');
    if (h2) h2.textContent = LLM_PHASE_TITLE[llmPhase];
    if (llmPhase === 'tokens') renderTokens();
    else if (llmPhase === 'attention') renderAttention();
    else renderLifecycle();
  }

  function renderTokens() {
    const el = document.getElementById('llm-phase1');
    if (el) el.style.display = '';
    const q = document.getElementById('llm-q');
    if (q) q.textContent = LLM_Q;
    const sentEl = document.getElementById('llm-sentence');
    if (sentEl) {
      sentEl.innerHTML = LLM_STEPS.map((s, i) =>
        llmPicks[i] != null ? `<b>${s.opts[llmPicks[i]].w}</b>` : '<i>…</i>').join(' ');
    }
    const step = llmPicks.length;
    const optsEl = document.getElementById('llm-opts');
    const status = document.getElementById('llm-status');
    const acts = document.getElementById('llm-acts');
    if (step < LLM_STEPS.length) {
      const opts = LLM_STEPS[step].opts;
      if (optsEl) {
        optsEl.innerHTML = opts.map((o, i) => `<button class="tokbtn" data-i="${i}">
          <span class="w">${o.w}</span>
          <span class="bar"><i style="transform:scaleX(${o.p})"></i></span>
          <span class="p">${Math.round(o.p * 100)}%</span>
        </button>`).join('');
        optsEl.querySelectorAll('button').forEach(b => {
          b.onclick = () => {
            const i = +b.dataset.i;
            llmPicks.push(i);
            if (opts[i].p !== Math.max(...opts.map(o => o.p))) llmAllTop = false;
            renderTokens();
          };
        });
      }
      if (status) { status.className = ''; status.innerHTML = `เลือกคำถัดไปคำที่ <b>${step + 1}/${LLM_STEPS.length}</b> จากความน่าจะเป็นที่เห็น`; }
      if (acts) acts.innerHTML = (llmPicks.length ? '<button id="llm-restart">เริ่มใหม่</button>' : '') + '<button id="llm-close">ปิด (Esc)</button>';
    } else {
      if (optsEl) optsEl.innerHTML = '';
      if (status) {
        status.className = llmAllTop ? 'ok' : 'bad';
        status.innerHTML = llmAllTop
          ? 'ประโยคลื่นไหลเป็นธรรมชาติ คุณเลือกคำที่ "น่าจะใช่ที่สุด" ทุกครั้ง เหมือนที่ผมทำทุกครั้งที่ตอบคุณ'
          : 'ประโยคเริ่มเพี้ยน พอเลือกคำที่ความน่าจะเป็นต่ำ คำตอบก็ไม่เป็นธรรมชาติอีกต่อไป';
      }
      if (acts) acts.innerHTML = '<button id="llm-restart">ลองใหม่</button><button id="llm-next" class="pri">ไปข้อต่อไป: โยงคำที่เกี่ยวกัน</button><button id="llm-close">ปิด (Esc)</button>';
    }
    const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    bind('llm-restart', () => { llmPicks = []; llmAllTop = true; renderTokens(); });
    bind('llm-next', () => { llmPhase = 'attention'; llmRender(); });
    bind('llm-close', closeLLM);
  }

  function renderAttention() {
    const el = document.getElementById('llm-phase2');
    if (el) el.style.display = '';
    const sentEl = document.getElementById('llm-attn-sentence');
    if (sentEl) sentEl.innerHTML = LLM_ATTN.text.replace('{มัน}', '<b class="tgt">มัน</b>');
    const optsEl = document.getElementById('llm-attn-opts');
    const status = document.getElementById('llm-status');
    const acts = document.getElementById('llm-acts');
    if (optsEl) {
      optsEl.innerHTML = LLM_ATTN.opts.map(w => `<button data-w="${w}"${llmAttnDone ? ' disabled' : ''}
        class="${llmAttnDone && w === LLM_ATTN.correct ? 'sel' : ''}">${w}</button>`).join('');
      optsEl.querySelectorAll('button').forEach(b => {
        b.onclick = () => {
          if (b.dataset.w === LLM_ATTN.correct) { llmAttnDone = true; llmAttnWrong = null; }
          else { llmAttnWrong = b.dataset.w; }
          renderAttention();
        };
      });
    }
    /* status is derived fresh from state every render — never from whatever
       class/text a previous phase or a previous render left sitting in the
       DOM, so a stale "ok" from the tokens phase can't leak in here */
    if (status) {
      if (llmAttnDone) {
        status.className = 'ok';
        status.innerHTML = '<b>โยงถูก!</b> กลไกที่คำนวณว่าคำไหนเกี่ยวกับคำไหนแบบนี้ ชื่อว่า <b>Attention</b>';
      } else if (llmAttnWrong) {
        status.className = 'bad';
        status.innerHTML = `"มัน" ไม่ได้หมายถึง "${llmAttnWrong}" ลองดูใหม่ว่ามันชี้กลับไปที่คำไหน`;
      } else {
        status.className = '';
        status.innerHTML = 'คำว่า "มัน" ในประโยคนี้ กำลังพูดถึงคำไหน?';
      }
    }
    if (acts) acts.innerHTML = (llmAttnDone
      ? '<button id="llm-next2" class="pri">ไปข้อต่อไป: สอนให้ตอบเป็น</button>'
      : '') + '<button id="llm-close">ปิด (Esc)</button>';
    const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    bind('llm-next2', () => { llmPhase = 'lifecycle'; llmRender(); });
    bind('llm-close', closeLLM);
  }

  function renderLifecycle() {
    const el = document.getElementById('llm-phase3');
    if (el) el.style.display = '';
    const q = document.getElementById('llm-life-q');
    if (q) q.textContent = LLM_LIFECYCLE.q;
    const status = document.getElementById('llm-status');
    const acts = document.getElementById('llm-acts');
    const allSeen = llmSeen.pretrain && llmSeen.instruct && llmSeen.rl;
    const btns = document.getElementById('llm-life-btns');
    if (btns) {
      btns.innerHTML = ['pretrain', 'instruct', 'rl'].map(k => {
        const label = k === 'pretrain' ? 'Pretrain' : k === 'instruct' ? 'Instruct' : 'Reinforcement Learning';
        return `<button data-k="${k}" class="${llmSeen[k] ? 'sel' : ''}">${label}</button>`;
      }).join('');
      btns.querySelectorAll('button').forEach(b => {
        b.onclick = () => {
          llmSeen[b.dataset.k] = true;
          llmLastSeen = b.dataset.k;
          renderLifecycle();
        };
      });
    }
    /* same rule as renderAttention: derive status fresh from state, tracking
       only the last button actually clicked, never a leftover class/text */
    if (status) {
      if (llmLastSeen) {
        const label = llmLastSeen === 'pretrain' ? 'Pretrain' : llmLastSeen === 'instruct' ? 'Instruct' : 'Reinforcement Learning';
        status.className = 'ok';
        status.innerHTML = `<b>${label}:</b> ${LLM_LIFECYCLE[llmLastSeen]}`;
      } else {
        status.className = '';
        status.innerHTML = 'กดดูคำตอบของโมเดลแต่ละขั้น ให้ครบทั้ง 3 ปุ่ม';
      }
    }
    if (acts) acts.innerHTML = (allSeen ? '<button id="llm-finish" class="pri">จบเครื่องผลิตคำ</button>' : '') + '<button id="llm-close">ปิด (Esc)</button>';
    const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    bind('llm-finish', () => {
      closeLLM();
      if (stage === 'f5quest') {
        stage = 'f5wrap';
        setQuest('<b>ภารกิจ</b><span>กลับไปคุยกับ ยูนิต 05</span>');
        mkLing.userData.paint('! กด E เพื่อคุย');
        toast('ครบทั้ง 3 เฟสแล้ว <b>กลับไปคุยกับ ยูนิต 05</b>');
      }
    });
    bind('llm-close', closeLLM);
  }

  function openLLM() {
    if (stage === 'f5intro') { toast('ไปอ่านกระดานเรียนรู้ (กด E) แล้วคุยกับ ยูนิต 05 ก่อนครับ'); return; }
    keys.clear();
    mode = 'llm';
    document.getElementById('llm').classList.add('on');
    llmRender();
  }
  function closeLLM() {
    document.getElementById('llm').classList.remove('on');
    if (mode === 'llm') mode = 'walk';
  }

  /* ---------------- floor 6 · Mission Control ----------------
     The only floor with no minigame. The player makes the one decision a
     human actually makes in an Agentic system — which goal to hand over —
     and then watches the four design patterns run without them. The flow
     keeps running after the panel is closed, so "สั่งทีเดียว จบงานเอง" is
     something the player experiences rather than reads. */
  const AGN_TRACK = [
    { b: 'วางแผนงาน', s: 'Planning' },
    { b: 'เลือกเครื่องมือ', s: 'Tool Use' },
    { b: 'ทีมลงมือพร้อมกัน', s: 'MultiAgent' },
    { b: 'ตรวจก่อนส่ง', s: 'Reflection' }
  ];
  const AGN_GOALS = [
    {
      id: 'pay',
      label: 'อยากให้ลูกค้าจ่ายเงินผ่านมือถือได้',
      sub: 'แตะตั้งแต่หน้าจอ ระบบตัดเงิน ไปจนถึงความปลอดภัย',
      bench: ['ops', 'data'],
      tasks: [
        { who: 'ux', t: 'ออกแบบหน้าจ่ายเงินให้กดง่าย', tool: 'เครื่องมือออกแบบ' },
        { who: 'be', t: 'ต่อระบบตัดเงินกับธนาคาร', tool: 'API ธนาคาร + ฐานข้อมูล' },
        { who: 'sec', t: 'ปิดช่องโหว่ตอนโอนเงิน', tool: 'มาตรฐานความปลอดภัยการชำระเงิน' },
        { who: 'be', t: 'เก็บข้อมูลลูกค้าเท่าที่จำเป็น', tool: 'นโยบายเก็บข้อมูลขั้นต่ำ', raw: 'เก็บข้อมูลการใช้จ่ายลูกค้าไว้ทั้งหมด' },
        { who: 'fe', t: 'ทำหน้าจอฝั่งผู้ใช้', tool: 'ชุดคอมโพเนนต์' },
        { who: 'qa', t: 'ทดสอบเส้นทางจ่ายเงินทั้งเส้น', tool: 'ชุดทดสอบอัตโนมัติ' }
      ],
      raw: [4, 1, 0, 5, 3, 2],
      note: 'ออกแบบต้องมาก่อนทำหน้าจอ และความปลอดภัยต้องเสร็จก่อนทดสอบ',
      bug: { by: 'qa', to: 'be', text: 'จ่ายเงินสำเร็จ แต่ลูกค้าไม่ได้ใบเสร็จ', fix: 'เพิ่มการส่งใบเสร็จหลังตัดเงินสำเร็จ' }
    },
    {
      id: 'scale',
      label: 'อยากให้ระบบรองรับคนใช้พร้อมกันมากขึ้น 10 เท่า',
      sub: 'ไม่มีหน้าจอใหม่เลย แต่ต้องรื้อข้างในเกือบทั้งหมด',
      bench: ['ux', 'sec'],
      tasks: [
        { who: 'data', t: 'หาจุดที่ระบบตัน', tool: 'เครื่องมือวัดภาระระบบ' },
        { who: 'be', t: 'ปรับคำสั่งฐานข้อมูลให้เร็วขึ้น', tool: 'ดัชนีฐานข้อมูล' },
        { who: 'ops', t: 'ขยายเครื่องอัตโนมัติตามภาระ', tool: 'ระบบขยายเครื่องอัตโนมัติ' },
        { who: 'data', t: 'เก็บ log เฉพาะที่ใช้หาคอขวด', tool: 'นโยบายเก็บข้อมูลขั้นต่ำ', raw: 'เก็บ log ทุกคลิกของผู้ใช้ไว้วิเคราะห์' },
        { who: 'fe', t: 'ลดของที่หน้าเว็บต้องโหลด', tool: 'แคชฝั่งผู้ใช้' },
        { who: 'qa', t: 'ยิงทดสอบโหลดจริง', tool: 'เครื่องมือทดสอบโหลด' }
      ],
      raw: [2, 5, 0, 4, 1, 3],
      note: 'ต้องรู้ก่อนว่าตันตรงไหนถึงจะแก้ถูก และทดสอบโหลดต้องอยู่ท้ายสุด',
      bug: { by: 'qa', to: 'be', text: 'รับโหลดได้ แต่พอคนเยอะจริง ตะกร้าสินค้าหาย', fix: 'ล็อกข้อมูลตะกร้าให้ถูกตัวตอนเขียนพร้อมกัน' }
    },
    {
      id: 'notify',
      label: 'อยากให้แอปแจ้งเตือนลูกค้าได้ตรงเวลาและตรงคน',
      sub: 'ยากตรงที่ต้องรู้ว่าใครควรได้รับ และแค่ไหนถึงพอ',
      bench: ['ops', 'sec'],
      tasks: [
        { who: 'data', t: 'เลือกกลุ่มลูกค้าที่ควรได้รับ', tool: 'ชุดข้อมูลพฤติกรรมลูกค้า' },
        { who: 'ux', t: 'ออกแบบหน้าตั้งค่าแจ้งเตือน', tool: 'เครื่องมือออกแบบ' },
        { who: 'be', t: 'ทำระบบส่งแจ้งเตือน', tool: 'คิวงาน + ตัวส่งข้อความ' },
        { who: 'ux', t: 'ให้ลูกค้าปิดแจ้งเตือนเองได้', tool: 'แนวทางการขอความยินยอม', raw: 'ส่งแจ้งเตือนให้ถี่ที่สุดเท่าที่ส่งได้' },
        { who: 'fe', t: 'ทำหน้าตั้งค่าให้ผู้ใช้กดเอง', tool: 'ชุดคอมโพเนนต์' },
        { who: 'qa', t: 'ทดสอบว่าส่งถูกคนถูกเวลา', tool: 'ชุดทดสอบอัตโนมัติ' }
      ],
      raw: [1, 4, 5, 0, 2, 3],
      note: 'ต้องรู้ก่อนว่าจะส่งให้ใครถึงจะออกแบบได้ และหน้าตั้งค่าต้องมาก่อนทดสอบ',
      bug: { by: 'qa', to: 'be', text: 'ส่งตรงเวลา แต่ส่งซ้ำคนเดิมสามรอบ', fix: 'กันไม่ให้คิวงานส่งซ้ำคนเดิม' }
    }
  ];
  const CREW_BY_KEY = {};
  CREW.forEach(c => { CREW_BY_KEY[c.k] = c; });

  let agnGoal = null, agnStep = -1, agnRunning = false, agnFinished = false;
  let agnEverFinished = false, agnPlainOn = false, agnAwaitingNext = false;
  /* one persistent one-line result per track node — set once when that
     node's scene settles, never overwritten by a later node the way
     #agn-status is. This is what makes the track read like a diagram
     you can look back over rather than a line of text that vanishes. */
  let agnNodeCaption = ['', '', '', ''];
  let agnSeq = [], agnCards = [], agnMems = {}, agnVerdictEl = null, agnBugEl = null;
  /* the whole visible state lives here; every scene mutates it and calls
     agnPaint, so a replay can seed any scene's end state without replaying
     the ones before it */
  let A = null;

  function agnStop() { agnSeq.forEach(clearTimeout); agnSeq = []; }
  function agnAt(ms, fn) { agnSeq.push(setTimeout(fn, ms)); }

  function agnFresh() {
    return { shown: [], order: null, moved: false, ethic: false, tools: false, meeting: false, flown: [], busy: [], done: [], flag: null, verdict: null };
  }

  function agnGoalsRender() {
    agnAwaitingNext = false;
    agnNodeCaption = ['', '', '', ''];
    const box = document.getElementById('agn-goals');
    box.innerHTML = AGN_GOALS.map((g, i) =>
      `<button data-i="${i}"><b>${g.label}</b><span>${g.sub}</span></button>`).join('');
    box.onclick = ev => {
      const b = ev.target.closest('button');
      if (b) agnBegin(AGN_GOALS[+b.dataset.i]);
    };
    document.getElementById('agn-pick').style.display = '';
    document.getElementById('agn-flow').style.display = 'none';
    document.getElementById('agn-h2').textContent = 'Mission Control: คุณเป็นแค่คนสั่ง';
    document.getElementById('agn-lead').textContent =
      'เลือกโจทย์ให้ทีมหนึ่งใบ แล้วปล่อยมือ จากนั้นคุณไม่ต้องสั่งอะไรอีกจนกว่างานจะถูกส่งกลับมา';
    const st = document.getElementById('agn-status');
    st.className = '';
    st.textContent = 'คุณคือคนเดียวในภาพนี้ที่ไม่ใช่ AI';
    document.getElementById('agn-acts').innerHTML = '<button id="agn-close">ปิด (Esc)</button>';
    document.getElementById('agn-close').onclick = closeAGN;
  }

  /* the room: a round table down the middle with the crew seated either
     side of it. Each seat carries that person's own work as text that
     stays put — the single text box below could only show one task at a
     time and overwrite it a moment later, so what each person is doing
     lives on their seat and the box is left to carry the lesson. The
     table holds the ordered queue as tokens, and each seat doubles as
     the target its token flies to. */
  const AGN_TGAP = 5;
  function agnBuild() {
    const stage = document.getElementById('agn-stage');
    const half = Math.ceil(CREW.length / 2);
    const seat = c => `<div class="agn-mem" data-k="${c.k}" style="--c:${hex(c.col)}">`
      + `<b>${c.name} <i>${c.en}</i></b><span class="job"></span></div>`;
    stage.innerHTML = '<div class="agn-round" id="agn-round">'
      + `<div class="agn-side">${CREW.slice(0, half).map(seat).join('')}</div>`
      + '<div class="agn-mid" id="agn-mid"><div class="agn-rtop"></div>'
      + '<p class="agn-tnote" id="agn-tnote"></p></div>'
      + `<div class="agn-side">${CREW.slice(half).map(seat).join('')}</div>`
      + '</div>';
    const mid = document.getElementById('agn-mid');
    agnCards = agnGoal.tasks.map(tk => {
      const el = document.createElement('div');
      el.className = 'agn-tok';
      el.style.setProperty('--c', hex(CREW_BY_KEY[tk.who].col));
      el.style.setProperty('--tc', textOn(CREW_BY_KEY[tk.who].col));
      el.textContent = tk.who.toUpperCase();
      mid.appendChild(el);
      return el;
    });
    agnBugEl = document.createElement('div');
    agnBugEl.className = 'agn-bug';
    mid.appendChild(agnBugEl);
    agnVerdictEl = document.createElement('div');
    agnVerdictEl.className = 'agn-verdict';
    agnVerdictEl.style.display = 'none';
    stage.appendChild(agnVerdictEl);
    agnMems = {};
    stage.querySelectorAll('.agn-mem').forEach(el => { agnMems[el.dataset.k] = el; });
  }

  const hex = c => '#' + c.toString(16).padStart(6, '0');
  /* the crew palette is all light/pastel identity colors meant to read on
     3D desks and glow sprites — every one of them fails WCAG contrast
     with white text at these small sizes (8.5-10.5px chips/tokens/speaker
     pills), some badly (ops/qa ~2.1:1 against a 4.5:1 floor). Rather than
     hardcoding white and hoping, pick whichever of white or near-black
     actually wins against this specific background — the standard
     max-contrast approach, computed once per color instead of eyeballed
     per component. Verified against all 6 crew colors before shipping:
     dark wins every one of them (5.1-11.4:1), white still wins for the
     one non-crew case that uses this (Mission Control's own blue). */
  const textOn = col => {
    const r = (col >> 16 & 255) / 255, g = (col >> 8 & 255) / 255, b = (col & 255) / 255;
    const f = v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    const L = .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
    const crWhite = 1.05 / (L + .05), crDark = (L + .05) / .05757; // .05757 ≈ luminance(#1A1410)+.05
    return crDark > crWhite ? '#1A1410' : '#fff';
  };

  /* the flow-diagram spine: 4 boxes joined by drawn arrows. Each box's
     checkmark/caption/mini-widget are driven off agnStep + agnNodeCaption
     (persistent) rather than being replaced by whatever agn-status prose
     is currently saying, so scanning left-to-right after a run tells the
     whole story on its own — an actual diagram, not a status line. */
  function agnTrackRender() {
    const used = agnGoal ? agnUsed() : [];
    const bug = agnGoal ? agnGoal.bug : null;
    document.getElementById('agn-track').innerHTML = AGN_TRACK.map((s, i) => {
      const state = agnNodeCaption[i] ? 'done' : i === agnStep ? 'active' : '';
      let mini = '';
      if (i === 0 && A && A.busy.length) {
        /* the meeting: seats around a table, not a row of tags */
        const half = Math.ceil(A.busy.length / 2);
        const seat = k => `<span class="seat busy" style="--c:${hex(CREW_BY_KEY[k].col)}"></span>`;
        mini = `<div class="mini table"><div class="row">${A.busy.slice(0, half).map(seat).join('')}</div>`
          + `<div class="tbl"></div><div class="row">${A.busy.slice(half).map(seat).join('')}</div></div>`;
      } else if (i === 2 && used.length) {
        /* MultiAgent fans out into one chip per dispatched crew member —
           a real branch in the diagram, not just a status dot */
        mini = `<div class="mini crew"><div class="stem"></div><div class="row">${used.map(k => {
          const c = CREW_BY_KEY[k];
          const cls = A && A.done.includes(k) ? 'done' : A && A.busy.includes(k) ? 'busy' : '';
          return `<span class="chip ${cls}" style="--c:${hex(c.col)};--tc:${textOn(c.col)}">${c.k.toUpperCase()}</span>`;
        }).join('')}</div></div>`;
      } else if (i === 3 && bug) {
        /* Reflection shows the two roles it actually bounced between */
        const vk = A && A.verdict ? A.verdict.k : '';
        mini = `<div class="mini loop ${vk === 'bad' ? 'bad' : vk === 'good' ? 'good' : ''}">`
          + `<div class="stem"></div><div class="row">`
          + `<span class="chip by">${bug.by.toUpperCase()}</span>`
          + `<span class="bar"></span>`
          + `<span class="chip">${bug.to.toUpperCase()}</span></div></div>`;
      }
      const arrow = i < AGN_TRACK.length - 1
        ? `<div class="agn-arrow${agnNodeCaption[i] ? ' lit' : ''}"></div>` : '';
      return `<div class="agn-node ${state}">`
        + `<div class="agn-box"><b><i class="chk"></i>${s.b}</b><span class="sub">${s.s}</span></div>`
        + `<p class="cap">${agnNodeCaption[i]}</p>${mini}</div>${arrow}`;
    }).join('');
  }

  /* one line in the game text box, optionally with whoever is saying it
     named on the box's rim */
  function agnSay(html, cls, who) {
    const st = document.getElementById('agn-status');
    st.className = cls || '';
    const c = who && CREW_BY_KEY[who];
    st.innerHTML = (c ? `<span class="spk" style="--c:${hex(c.col)};--tc:${textOn(c.col)}">${c.name}</span>` : '')
      + `<span>${html}</span>`;
  }

  /* the caption written across the empty table — the meeting beat before
     any task exists, and again once every card has been handed out. Only
     shown while the table really is empty, and never over the verdict. */
  function agnTableNote() {
    const el = document.getElementById('agn-tnote');
    if (!el) return;
    const onTable = agnGoal.tasks.some((_, i) => A.shown.includes(i) && !A.flown.includes(i));
    const msg = A.meeting ? 'ทุกคนที่เกี่ยวข้องมานั่งโต๊ะแล้ว'
      : (!onTable && A.flown.length) ? 'โต๊ะว่างแล้ว งานอยู่ที่แต่ละคน' : '';
    if (msg) el.textContent = msg;
    /* the verdict strip would otherwise sit under this; once the run has
       finished the bug card is gone and the bare table can carry it */
    el.classList.toggle('on', !!msg && (!A.verdict || agnFinished));
  }

  /* sends every not-yet-flown token belonging to k off the table to that
     member's own seat on the rim. The token already carries an x offset
     from the table's centre (dataset.x), so that has to be added back in
     or it would snap to the middle before setting off. */
  function agnFlyCards(k) {
    const memEl = agnMems[k];
    if (!memEl) return;
    const b = memEl.getBoundingClientRect();
    agnGoal.tasks.forEach((tk, i) => {
      if (tk.who !== k || A.flown.includes(i)) return;
      const el = agnCards[i];
      const a = el.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
      const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      el.style.transform = `translate(calc(-50% + ${((+el.dataset.x || 0) + dx).toFixed(1)}px),`
        + ` calc(-50% + ${((+el.dataset.ty || 0) + dy).toFixed(1)}px)) scale(.55)`;
      el.style.opacity = '0';
      A.flown.push(i);
    });
  }

  /* Reflection: the kicked-back work itself, as a card that travels
     between the two seats involved. Which seat it sits at is derived from
     state AGN_SCENES[3] already sets (A.flag / A.busy / A.verdict) rather
     than a timeline of its own, so replays land it in the right place.
     Targets are measured from the round container's own origin — the card
     is parked at left:0/top:0 inside it — so a re-render never compounds
     an offset onto the one it already has. */
  function agnBugRender() {
    const el = agnBugEl;
    if (!el) return;
    const bug = agnGoal && agnGoal.bug;
    /* agnFinished keeps agnStep at 3, so without it this card would stay
       parked over whoever last held the work once the run is over — it is
       a beat inside Reflection, not part of the finished summary */
    if (agnStep !== 3 || !bug || agnPlainOn || agnFinished) { el.classList.remove('on'); return; }
    const good = !!(A.verdict && A.verdict.k === 'good');
    const atTo = A.flag === bug.by || A.busy.includes(bug.to);
    const holder = atTo ? bug.to : bug.by;
    el.innerHTML = `<span class="who">${CREW_BY_KEY[holder].name}</span>`
      + `<span>${good ? 'แก้แล้ว ตรวจซ้ำผ่าน' : atTo ? bug.fix : bug.text}</span>`;
    el.classList.toggle('good', good);
    el.classList.add('on');
    const table = document.getElementById('agn-mid');
    if (!table) return;
    /* it slides to the table's own left or right edge — whichever side
       that person is seated on — rather than landing on the seat itself.
       Landing on the seat covered that seat's job text, and the panel is
       not wide enough for the card to sit beside one. Which column the
       holder is in is enough to read the hand-off direction, and it keeps
       the card inside the table whatever the seat's height works out to. */
    const side = CREW.findIndex(c => c.k === holder) < Math.ceil(CREW.length / 2) ? -1 : 1;
    const room = Math.max(0, (table.offsetWidth - el.offsetWidth) / 2 - 6);
    el.style.transform = `translate(${(table.offsetWidth - el.offsetWidth) / 2 + side * room}px,`
      + `${(table.offsetHeight - el.offsetHeight) / 2}px)`;
  }

  function agnPaint() {
    agnTableNote();
    const order = A.order || agnGoal.raw;
    agnCards.forEach((el, i) => {
      const pos = order.indexOf(i);
      const tk = agnGoal.tasks[i];
      el.classList.toggle('cut', !!tk.raw && !A.ethic);
      el.classList.toggle('moved', !!A.moved && agnGoal.raw.indexOf(i) !== pos);
      el.classList.toggle('tooled', !!A.tools);
      el.classList.toggle('flown', A.flown.includes(i));
      /* a flown token keeps the transform/opacity agnFlyCards() gave it —
         skip it here, or every later agnPaint() would drag it back onto
         the table and undo the flight */
      if (!A.flown.includes(i)) el.style.opacity = A.shown.includes(i) ? '1' : '0';
    });
    /* lay the tokens still on the table out centred on it, wrapping at 3
       per row so six of them stay inside the tabletop. The row closes up
       as tokens are handed out, and Replan's reshuffle is a visible swap. */
    const live = order.filter(idx => !A.flown.includes(idx));
    const per = 3, rows = Math.ceil(live.length / per) || 1;
    live.forEach((idx, n) => {
      const el = agnCards[idx];
      const r = Math.floor(n / per), col = n % per;
      const inRow = Math.min(per, live.length - r * per);
      const w = el.offsetWidth || 36;
      const cx = (col - (inRow - 1) / 2) * (w + AGN_TGAP);
      const cy = (r - (rows - 1) / 2) * 28;
      el.dataset.x = cx;
      el.dataset.ty = cy;
      el.style.transform = `translate(calc(-50% + ${cx.toFixed(1)}px), calc(-50% + ${cy.toFixed(1)}px))`;
    });

    CREW.forEach(c => {
      const el = agnMems[c.k];
      if (!el) return;
      const used = !agnGoal.bench.includes(c.k);
      el.classList.toggle('on', used);
      el.classList.toggle('busy', A.busy.includes(c.k));
      el.classList.toggle('done', A.done.includes(c.k));
      el.classList.toggle('flag', A.flag === c.k);
      /* this person's own work, written on their own seat and left there.
         Driven off A.shown, so it appears as the work is handed out and
         then stays — nothing here is ever overwritten by a later beat. */
      const job = el.querySelector('.job');
      if (job) {
        const mine = agnGoal.tasks
          .map((t, i) => ({ t, i }))
          .filter(o => o.t.who === c.k && A.shown.includes(o.i));
        job.innerHTML = !used ? 'ไม่ถูกเรียกในงานนี้'
          : !mine.length ? 'รอรับงาน'
            : mine.map(({ t }) => (t.raw && A.ethic ? `<s>${t.raw}</s> ${t.t}` : t.raw || t.t)
              + (A.tools ? ` <i>→ ${t.tool}</i>` : '')).join('<br>');
      }
      const d = desks[c.k];
      if (d) { d.on = used; d.busy = A.busy.includes(c.k); }
    });
    if (A.verdict) {
      agnVerdictEl.style.display = '';
      agnVerdictEl.className = 'agn-verdict ' + (A.verdict.k || '');
      agnVerdictEl.innerHTML = `<b>${A.verdict.h}</b><span>${A.verdict.p}</span>`;
    } else agnVerdictEl.style.display = 'none';
    agnBugRender();
    if (paintMC) {
      paintMC(agnFinished ? 'ส่งงานแล้ว' : agnRunning ? (AGN_TRACK[agnStep] || AGN_TRACK[0]).b : 'Mission Control',
        agnFinished ? 'ทีมส่งงานกลับมาให้คุณแล้ว' : agnRunning ? agnGoal.label : 'กด E เพื่อส่งโจทย์ให้ทีม');
    }
  }

  const agnUsed = () => CREW.filter(c => !agnGoal.bench.includes(c.k)).map(c => c.k);
  const agnBenchNames = () => agnGoal.bench.map(k => CREW_BY_KEY[k].name).join(' กับ ');

  /* every scene: seed() snaps to its end state, run() plays it */
  const AGN_SCENES = [
    {
      dur: 6600,
      seed() { A.shown = agnGoal.tasks.map((_, i) => i); A.order = agnGoal.tasks.map((_, i) => i); A.moved = true; A.ethic = true; },
      run() {
        A.shown = [];
        A.order = agnGoal.raw.slice();
        /* the meeting: everyone needed is already seated around the room's
           table, so this beat is just the table sitting empty with the
           whole group pulsing — the huddle before work gets broken up,
           not after. agnTrackRender() is called explicitly here (not just
           agnPaint) because the track already rendered once, before
           A.busy was set, when agnRunScene kicked off this scene. */
        A.busy = agnUsed();
        A.meeting = true;
        agnSay('หัวหน้าทีมเรียกทุกคนที่เกี่ยวข้องมาประชุมสั้น ๆ ก่อนแตกงาน');
        agnTrackRender();
        agnPaint();
        agnAt(900, () => {
          A.busy = [];
          A.meeting = false;
          agnSay('PM ส่งโจทย์ให้หัวหน้าทีมแล้ว <b>ตั้งแต่นี้คุณไม่ต้องสั่งอะไรอีก</b>');
          agnTrackRender();
          agnPaint();
        });
        /* each task lands on its owner's seat and stays there — the box
           below is left free to carry the lesson instead of being
           overwritten once per task */
        agnGoal.raw.forEach((idx, n) => agnAt(1220 + n * 420, () => {
          A.shown.push(idx);
          agnSay('หัวหน้าทีมแตกโจทย์ แล้ว<b>แจกงานเข้าที่แต่ละคน</b>เอง');
          agnPaint();
        }));
        const revealed = 1220 + agnGoal.raw.length * 420;
        agnAt(revealed + 300, () => {
          agnSay('หัวหน้าทีมแตกโจทย์เป็น Task แล้ว <b>Replan</b> ลำดับใหม่เอง ' + agnGoal.note);
          A.order = agnGoal.tasks.map((_, i) => i);
          A.moved = true;
          agnPaint();
        });
        agnAt(revealed + 2100, () => {
          agnSay('<b>ทำได้ ไม่ได้แปลว่าควรทำ</b> หัวหน้าทีมตีโจทย์ข้อหนึ่งใหม่เองก่อนส่งต่อ'
            + ' (ดูที่ที่นั่งของเขา) นี่คือ <b>Reasoning</b>');
          A.ethic = true;
          agnPaint();
        });
      }
    },
    {
      dur: 3200,
      seed() { A.tools = true; },
      run() {
        agnSay('เลือก <b>Tool</b> ให้แต่ละงาน โผล่ที่ที่นั่งของแต่ละคน '
          + agnBenchNames() + 'ไม่ถูกเรียก เพราะงานนี้ไม่ต้องใช้');
        agnAt(400, () => { A.tools = true; agnPaint(); });
      }
    },
    {
      dur: 4400,
      seed() { A.tools = true; A.busy = []; A.done = agnUsed(); A.flown = agnGoal.tasks.map((_, i) => i); },
      run() {
        agnSay('งานถูกส่งถึงทุกคน<b>พร้อมกัน</b> ไม่ใช่ทีละคน หัวหน้าทีมไม่ต้องจิ้มทีละงาน');
        A.busy = agnUsed();
        agnPaint();
        /* each member's card(s) leave the table for their own seat the
           moment their turn comes up — a real measured hand-off, not
           every card fading out together at once. */
        agnUsed().forEach((k, n) => agnAt(500 + n * 420, () => {
          agnFlyCards(k);
          A.busy = A.busy.filter(x => x !== k);
          A.done.push(k);
          agnPaint();
        }));
      }
    },
    {
      dur: 6900,
      seed() {
        A.tools = true; A.busy = []; A.done = agnUsed(); A.flag = null;
        A.verdict = { k: 'good', h: 'ตรวจผ่าน ส่งงานได้', p: 'แก้แล้วตรวจซ้ำจนผ่าน หัวหน้าทีมถึงตัดสินใจส่ง' };
      },
      run() {
        const bug = agnGoal.bug;
        const byName = CREW_BY_KEY[bug.by].name, toName = CREW_BY_KEY[bug.to].name;
        A.busy = [bug.by]; A.done = agnUsed().filter(k => k !== bug.by);
        A.verdict = { k: '', h: byName + 'กำลังตรวจงาน', p: 'ได้ผลลัพธ์แล้ว แต่ยังไม่ส่ง' };
        agnSay('กำลังตรวจงานที่ทีมประกอบเสร็จ', '', bug.by);
        agnPaint();
        agnAt(1600, () => {
          A.busy = []; A.flag = bug.by;
          A.verdict = { k: 'bad', h: 'ยังส่งไม่ได้', p: bug.text };
          agnSay('เจอปัญหา <b>ตีกลับไปที่' + toName + '</b> ไม่ส่งออกไปทั้งอย่างนี้', 'bad', bug.by);
          agnPaint();
        });
        agnAt(3600, () => {
          A.flag = null; A.busy = [bug.to];
          A.done = A.done.filter(k => k !== bug.to);
          A.verdict = { k: '', h: toName + 'กำลังแก้', p: bug.fix };
          agnSay('แก้ตามที่ถูกตีกลับ แล้วส่งกลับไปให้ตรวจใหม่', '', bug.to);
          agnPaint();
        });
        agnAt(5400, () => {
          A.busy = []; A.done = agnUsed();
          A.verdict = { k: 'good', h: 'ตรวจผ่าน ส่งงานได้', p: 'แก้แล้วตรวจซ้ำจนผ่าน หัวหน้าทีมถึงตัดสินใจส่ง' };
          agnSay('ผ่านแล้ว หัวหน้าทีมถึงค่อยส่ง <b>Agent ธรรมดาจะส่งไปตั้งแต่รอบแรก</b>', 'ok', bug.by);
          agnPaint();
        });
      }
    }
  ];

  /* one caption per track node, set once that node's scene settles into its
     resolved end-state (by dur, every scene has already reached the good
     outcome — Reflection's bad/fix beats are mid-scene, not its ending) */
  const AGN_CAPTIONS = [
    'จัดลำดับงานใหม่แล้ว',
    'เลือกเครื่องมือครบทุกงานแล้ว',
    'ทีมที่ถูกเรียกทำงานเสร็จหมดแล้ว',
    'ตรวจซ้ำจนผ่านแล้ว ส่งงานได้'
  ];

  /* advanceGate=true is a real playthrough: each scene settles, then either
     waits for the player to click "ต่อไป" (so they can look at the finished
     diagram before moving on — this is the whole point of gating instead of
     auto-chaining) or, on the last scene, finishes outright. advanceGate=
     false is a one-off single-scene replay that just settles back to the
     normal action row, no gate. */
  function agnRunScene(i, advanceGate) {
    agnStop();
    agnStep = i;
    agnRunning = true;
    agnFinished = false;
    agnAwaitingNext = false;
    document.getElementById('agn-h2').textContent = 'Mission Control: ' + AGN_TRACK[i].b;
    agnTrackRender();
    AGN_SCENES[i].run();
    agnPaint();
    agnActs();
    agnAt(AGN_SCENES[i].dur, () => {
      agnRunning = false;
      agnNodeCaption[i] = AGN_CAPTIONS[i];
      if (advanceGate && i + 1 < AGN_SCENES.length) {
        agnAwaitingNext = true;
      } else if (advanceGate) {
        agnFinish(true);
        return;
      }
      agnTrackRender();
      agnPaint();
      agnActs();
    });
  }

  function agnFinish(full) {
    agnRunning = false;
    if (full) {
      agnStep = AGN_SCENES.length - 1;
      agnFinished = true;
      agnEverFinished = true;
      document.getElementById('agn-h2').textContent = 'Mission Control: ส่งงานแล้ว';
      agnSay('จบหนึ่งรอบ คุณสั่งครั้งเดียวตอนต้น ที่เหลือทีมทำเองทั้งหมด', 'ok');
      if (stage === 'f6quest') {
        stage = 'f6wrap';
        setQuest('<b>ภารกิจ</b><span>กลับไปคุยกับ ยูนิต 06</span>');
        mkLead.userData.paint('! กด E เพื่อคุย');
        if (mode !== 'agn') toast('ทีมส่งงานแล้ว <b>กลับไปคุยกับ ยูนิต 06</b>', 'ok');
      }
    }
    agnTrackRender();
    agnPaint();
    agnActs();
  }

  function agnActs() {
    const acts = document.getElementById('agn-acts');
    if (agnAwaitingNext) {
      const next = AGN_TRACK[agnStep + 1];
      acts.innerHTML = `<button id="agn-next" class="pri">ต่อไป: ${next.b} ▸</button>`
        + '<button id="agn-close">ปิด (Esc)</button>';
      document.getElementById('agn-next').onclick = () => agnRunScene(agnStep + 1, true);
      document.getElementById('agn-close').onclick = closeAGN;
      return;
    }
    const replay = !agnRunning
      ? AGN_TRACK.map((s, i) => `<button data-rp="${i}">ดูซ้ำ ${s.b}</button>`).join('')
      : '';
    const plainBtn = (!agnRunning && agnEverFinished)
      ? '<button id="agn-plain">ถ้าเป็น Agent ธรรมดาล่ะ?</button>' : '';
    acts.innerHTML = replay + plainBtn
      + (agnRunning ? '' : '<button id="agn-again" class="pri">เปลี่ยนโจทย์</button>')
      + '<button id="agn-close">ปิด (Esc)</button>';
    acts.querySelectorAll('[data-rp]').forEach(b => {
      b.onclick = () => {
        const i = +b.dataset.rp;
        A = agnFresh();
        for (let k = 0; k < i; k++) AGN_SCENES[k].seed();
        agnRunScene(i, false);
      };
    });
    const pl = document.getElementById('agn-plain');
    if (pl) pl.onclick = agnPlainRun;
    const ag = document.getElementById('agn-again');
    if (ag) ag.onclick = () => { agnStop(); agnRunning = false; agnFinished = false; agnStep = -1; agnClearDesks(); agnGoalsRender(); };
    const cl = document.getElementById('agn-close');
    if (cl) cl.onclick = closeAGN;
  }

  function agnTrackRenderSkip() {
    document.getElementById('agn-track').innerHTML = AGN_TRACK.map((s, i) =>
      `<div class="agn-node skip"><div class="agn-box"><b class="strike">${s.b}</b>`
      + `<span class="sub">ข้ามไปเลย</span></div></div>`
      + (i < AGN_TRACK.length - 1 ? '<div class="agn-arrow"></div>' : '')
    ).join('');
  }

  /* the contrast shot: same goal, same bug, but no Planning / Tool Use /
     MultiAgent staging and no Reflection catch at the end — this is what
     "Agent = รับงาน → ทำ → ส่ง" (no Agentic wrapper) actually looks like */
  function agnPlainRun() {
    agnStop();
    agnPlainOn = true;
    agnRunning = true;
    agnFinished = false;
    agnAwaitingNext = false;
    A = agnFresh();
    document.getElementById('agn-h2').textContent = 'ถ้าเป็น Agent ธรรมดา: รับงาน → ทำ → ส่ง';
    agnTrackRenderSkip();
    A.shown = agnGoal.tasks.map((_, i) => i);
    A.order = agnGoal.tasks.map((_, i) => i);
    agnSay('ไม่มี Planning ไม่มี Tool Use ไม่มี Reflection รับโจทย์มาแล้วลงมือทำเลยทันที');
    agnPaint();
    agnActs();
    agnAt(500, () => { A.busy = agnUsed(); agnPaint(); });
    agnAt(2500, () => {
      A.busy = [];
      A.done = agnUsed();
      A.verdict = { k: 'bad', h: 'ส่งออกไปแล้ว ไม่มีใครตรวจก่อน', p: agnGoal.bug.text };
      agnSay('<b>Agent</b> รับงาน → ทำ → ส่ง จบแค่นั้น ปัญหานี้ไปโผล่ตอนลูกค้าเจอเอง ไม่มีใครจับได้ก่อนส่ง', 'bad');
      agnPaint();
    });
    agnAt(3100, () => {
      agnRunning = false;
      agnPlainOn = false;
      agnActs();
    });
  }

  function agnClearDesks() {
    CREW.forEach(c => { const d = desks[c.k]; if (d) { d.on = false; d.busy = false; } });
    if (paintMC) paintMC('Mission Control', 'กด E เพื่อส่งโจทย์ให้ทีม');
  }

  function agnBegin(goal) {
    agnGoal = goal;
    agnNodeCaption = ['', '', '', ''];
    A = agnFresh();
    document.getElementById('agn-pick').style.display = 'none';
    document.getElementById('agn-flow').style.display = '';
    document.getElementById('agn-lead').textContent = goal.label;
    agnBuild();
    agnRunScene(0, true);
  }

  function openAGN() {
    if (stage === 'f6intro') { toast('ไปอ่านกระดานเรียนรู้ (กด E) แล้วคุยกับ ยูนิต 06 ก่อนครับ'); return; }
    keys.clear();
    mode = 'agn';
    document.getElementById('agn').classList.add('on');
    if (!agnGoal) agnGoalsRender();
  }
  function closeAGN() {
    /* deliberately does not stop a scene mid-animation: the team keeps
       working while the player walks away. Once a scene settles it now
       waits at the "ต่อไป" gate instead of auto-chaining, so a close there
       is a real pause, not "still working" — the two states get different
       toasts so the player isn't told to wait for something that already
       finished and is just sitting there for them. */
    document.getElementById('agn').classList.remove('on');
    if (mode === 'agn') mode = 'walk';
    if (agnRunning) toast('ปล่อยให้ทีมทำต่อได้เลยครับ เดี๋ยวมีแจ้งตอนส่งงาน');
    else if (agnAwaitingNext) toast('พร้อมดูขั้นต่อไปเมื่อไหร่ค่อยกลับมากด E ครับ');
  }

  /* who's who at the desks — same left-to-right order CREW already builds
     them in, so the list reads top-to-bottom exactly as the desks read
     left-to-right. Kept separate from Mission Control entirely: this is
     the "meet the team" beat, not part of the flow itself. */
  const ROSTER_DESC = {
    ux: 'ออกแบบหน้าตาและการใช้งานให้คนทั่วไปกดง่าย',
    fe: 'ทำสิ่งที่ลูกค้าเห็นและกดบนหน้าจอ',
    be: 'ทำตรรกะและข้อมูลที่อยู่เบื้องหลังหน้าจอ',
    ops: 'เตรียมเซิร์ฟเวอร์และดูแลให้ระบบรันอยู่ได้',
    qa: 'ตรวจว่าทุกอย่างใช้งานได้จริงก่อนปล่อย',
    data: 'ดูแลข้อมูลและอ่านพฤติกรรมผู้ใช้',
    sec: 'ปิดช่องโหว่และดูแลความปลอดภัยของระบบ'
  };
  function rosterRender() {
    document.getElementById('roster-list').innerHTML = CREW.map(c =>
      `<div class="roster-row${c.bench ? ' bench' : ''}">`
      + `<i class="dot" style="--c:${hex(c.col)}"></i>`
      + `<div class="txt"><b>${c.name}</b><span class="en">${c.en}</span>`
      + `<span class="desc">${ROSTER_DESC[c.k]}${c.bench ? ' <b>ยังไม่ถูกเรียกในภารกิจนี้</b>' : ''}</span></div>`
      + `</div>`).join('');
  }
  function openRoster() {
    keys.clear();
    mode = 'roster';
    rosterRender();
    document.getElementById('roster').classList.add('on');
  }
  function closeRoster() {
    document.getElementById('roster').classList.remove('on');
    if (mode === 'roster') mode = 'walk';
  }
  { const b = document.getElementById('roster-close'); if (b) b.onclick = closeRoster; }

  /* ---- the lift: a floor picker, since more than one floor is open ---- */
  /* every floor is open — the lobby signs and the keeper both say so */
  function floorUnlocked() { return true; }
  function openLift() {
    keys.clear();
    mode = 'lift';
    const el = document.getElementById('lift');
    const rows = Array.from({ length: FLOORS.length + 1 }, (_, i) => i).map(i => {
      if (i === 0) {
        return `<button class="lf${level === 0 ? ' cur' : ''}" data-lv="0">
          <span class="n">G</span><span class="tt"><b>โถงชั้นล่าง</b><span>จุดเริ่มต้น</span></span></button>`;
      }
      const f = FLOORS[i - 1];
      const ok = floorUnlocked(i);
      /* floor 5's own era string (f.era) is shared with the 3D floor sign
         and the in-game HUD — appending here instead of editing FLOORS[4]
         itself keeps the Jev mention local to the lift list, the one
         place a returning player actually chooses where to go */
      const extra = i === 5 ? ' + ห้อง Jev' : '';
      return `<button class="lf${level === i ? ' cur' : ''}${ok ? '' : ' lock'}" data-lv="${i}"${ok ? '' : ' disabled'}>
        <span class="n" style="color:${f.tx}">${i}</span>
        <span class="tt"><b>${f.t}</b><span>${f.era}${extra}</span></span>
        <span class="st">${ok ? (level === i ? 'อยู่ที่นี่' : 'ไปชั้นนี้') : 'ยังไม่เปิด'}</span></button>`;
    }).join('');
    document.getElementById('lift-rows').innerHTML = rows;
    const rowsEl = document.getElementById('lift-rows');
    rowsEl.onclick = ev => {
      const b = ev.target.closest('.lf');
      if (!b || b.disabled) return;
      const lv = +b.dataset.lv;
      closeLift();
      if (lv !== level) ride(lv);
    };
    el.classList.add('on');
  }
  { const b = document.getElementById('lift-close'); if (b) b.onclick = () => closeLift(); }
  function closeLift() {
    document.getElementById('lift').classList.remove('on');
    if (mode === 'lift') mode = 'walk';
  }

  /* ---- riding the lift ---- */
  function ride(to) {
    if (riding) return;
    riding = .001;
    mode = 'ride';
    const fromY = level === 0 ? 0 : floorY(level - 1) + .35;
    const toY = to === 0 ? 0 : floorY(to - 1) + .35;
    rideInfo = { t: 0, dur: RIDE_MS / 1000, fromY, toY };
    ui.fade.classList.add('on', 'ride');
    setTimeout(() => {
      level = to;
      const y = to === 0 ? 0 : floorY(to - 1) + .35;
      player.position.set(to === 0 ? LIFT_X - 3.4 : LIFT_X - 3.8, y, LIFT_Z + (to === 0 ? 3 : 0));
      look.yaw = 0; look.pitch = 0;
      lift.position.y = to === 0 ? 0 : floorY(to - 1) + .35;
      rideInfo = null;
      setFloor();
      /* floors can be visited in any order: start the quest on first entry,
         restore the finished state on a revisit */
      const F = {
        1: { intro: 'f1intro', quest: 'quest', done: 'done', mk: mkMech, who: ' ยูนิต 01' },
        2: { intro: 'f2intro', quest: 'f2quest', done: 'f2done', mk: mkTech, who: ' ยูนิต 02' },
        3: { intro: 'f3intro', quest: 'f3quest', done: 'f3done', mk: mkDoc, who: ' ยูนิต 03' },
        4: { intro: 'f4intro', quest: 'f4quest', done: 'f4done', mk: mkUnit, who: 'ยูนิต 04' },
        5: { intro: 'f5intro', quest: 'f5quest', done: 'f5done', mk: mkLing, who: ' ยูนิต 05' },
        6: { intro: 'f6intro', quest: 'f6quest', done: 'f6done', mk: mkLead, who: ' ยูนิต 06' }
      }[to];
      if (F) {
        if (cleared.has(to)) {
          stage = F.done;
          setQuest(`<b>ชั้น ${to}</b><span>${FLOORS[to - 1].t} ผ่านแล้ว</span>`);
        } else if (!visited.has(to)) {
          visited.add(to);
          stage = F.intro;
          setQuest(`<b>ภารกิจ</b><span>ไปอ่านกระดานเรียนรู้ (กด E)<br>แล้วคุยกับ${F.who}</span>`);
          F.mk.userData.paint('! กด E เพื่อคุย');
        } else {
          stage = F.quest;
        }
      }
      mkDown.visible = to !== 0;
      mkLift.visible = to === 0;
      ui.fade.classList.remove('on', 'ride');
      riding = 0;
      mode = 'walk';
    }, RIDE_MS);
  }

  /* ------------------------------------------------------------ input -- */
  const keys = new Set();
  const nearKeeper = () => level === 0 && player.position.distanceTo(keeper.position) < 5.4;
  const nearLift = () => Math.hypot(player.position.x - LIFT_X, player.position.z - LIFT_Z) < 5.2;
  const nearMech = () => level === 1 && player.position.distanceTo(mech.position) < 5.2;
  const nearMachine = () => level === 1 && player.position.distanceTo(machine.position) < 5.6;
  const nearBoard = () => level >= 1 && player.position.distanceTo(boards[level - 1].position) < 5;
  const nearTech = () => level === 2 && player.position.distanceTo(tech.position) < 5.2;
  const nearDoc = () => level === 3 && player.position.distanceTo(doc.position) < 5.2;
  const nearUnit = () => level === 4 && player.position.distanceTo(unit.position) < 5.2;
  const nearForge = () => level === 4 && player.position.distanceTo(forge.position) < 6;
  const nearLing = () => level === 5 && player.position.distanceTo(ling.position) < 5.2;
  const nearPress = () => level === 5 && player.position.distanceTo(press.position) < 6;
  /* the doorway threshold — pressing F here is the only way across (see
     jevWarp() below for why walking the bridge itself was dropped:
     round 18's screenshot showed the follow-camera, which has no
     collision handling of its own, pinned against the rail-lined
     corridor). Went through two E-based versions first — round 19's box
     sat *entirely inside* both ยูนิต 05's and the word press's talk
     circles; round 20 shrank it to a zero-overlap sliver right in the
     doorway's mouth, which round 21's follow-up ("กดปุ่มอื่นเถอะ ขอร้อง")
     showed was correct but unusably precise. Round 22 moved the whole
     Jev crossing off E onto its own key instead of continuing to trade
     hitbox size against E ambiguity — see the 'f' handler in onKeyDown,
     where this shares bounds with JEV_DOOR_WALK (the comfortable
     approach zone) with no overlap concern left to design around. */
  const nearJevDoor = () => level === 5 && !jevIn && player.position.x > JEV_DOOR_WALK.x0 && player.position.x < JEV_DOOR_WALK.x1
    && player.position.z > JEV_DOOR_WALK.z0 && player.position.z < JEV_DOOR_WALK.z1;
  /* a box check, not a radius — JEV_ROOM is walled on 3 sides, so "near"
     just means "standing inside it" (only reachable via jevWarp() now). */
  const nearJev = () => level === 5 && jevIn && player.position.x > JEV_ROOM.x0 && player.position.x < JEV_ROOM.x1
    && player.position.z < JEV_ROOM.zNear && player.position.z > JEV_ROOM.zFar;
  /* the shallow band nearest the room's open side — checked before nearJev
     in onKeyDown so standing right at the threshold exits rather than
     re-opening the doc; the two zones overlap on purpose, chain order
     settles it, same as every other pair of markers in this file. */
  const nearJevExit = () => level === 5 && jevIn && player.position.z > JEV_WALK_NEAR - 1.6;
  const nearLead = () => level === 6 && player.position.distanceTo(lead.position) < 5.2;
  const nearMC = () => level === 6 && player.position.distanceTo(mcPos) < 6;
  const nearRoster = () => level === 6 && player.position.distanceTo(rosterPos) < 4.6;
  const nearLab = () => level === 3 && player.position.distanceTo(lab.position) < 5.8;
  const nearPlant = () => level === 2 && player.position.distanceTo(plant.position) < 5.8;

  let lastKeyStamp = 0, lastKeyName = '';
  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    /* the same press can arrive twice (window + document) — ignore the echo */
    const now = performance.now();
    if (k === lastKeyName && now - lastKeyStamp < 8) return;
    lastKeyName = k; lastKeyStamp = now;
    if (k === 'e') {
      e.preventDefault();
      if (mode === 'talk') { advance(); return; }
      if (ui.rules.classList.contains('on')) { closeRules(); return; }
      if (mode === 'items') { openRules(); return; }
      if (mode === 'ml' || mode === 'dl' || mode === 'ga' || mode === 'llm' || mode === 'agn' || mode === 'roster') { return; }
      if (mode === 'lift') { closeLift(); return; }
      if (mode !== 'walk') return;
      if (nearKeeper()) { startTalk(TALK_LOBBY); return; }
      if (nearBoard()) { openDocs(level - 1); return; }
      if (nearMech()) { startTalk(stage === 'wrap' ? TALK_F1_B : TALK_F1_A); return; }
      if (nearMachine()) { openItems(); return; }
      if (nearTech()) { startTalk(stage === 'f2wrap' ? TALK_F2_B : TALK_F2_A); return; }
      if (nearPlant()) { openML(); return; }
      if (nearDoc()) { startTalk(stage === 'f3wrap' ? TALK_F3_B : TALK_F3_A); return; }
      if (nearLab()) { openDL(); return; }
      if (nearUnit()) { startTalk(stage === 'f4wrap' ? TALK_F4_B : TALK_F4_A); return; }
      if (nearForge()) { openGA(); return; }
      if (nearLing()) { startTalk(stage === 'f5wrap' ? TALK_F5_B : TALK_F5_A); return; }
      if (nearPress()) { openLLM(); return; }
      /* the whole Jev crossing (door/exit/sign) moved off E entirely —
         see the 'f' handler below. E kept clashing with ยูนิต 05's and
         the word press's own talk radii no matter how the box was
         shaped or prioritized (rounds 20-21); a separate key sidesteps
         that class of conflict outright instead of continuing to tune
         around it, per explicit instruction. */
      if (nearLead()) { startTalk(stage === 'f6wrap' ? TALK_F6_B : TALK_F6_A); return; }
      if (nearMC()) { openAGN(); return; }
      if (nearRoster()) { openRoster(); return; }
      if (nearLift()) {
        if (stage === 'lobby') { toast('คุยกับ ยูนิต 00 ก่อนครับ'); return; }
        openLift();
        return;
      }
      return;
    }
    if (k === 'f') {
      /* the Jev crossing uses its own key, by explicit instruction —
         E kept being ambiguous with ยูนิต 05's and the word press's
         talk radii no matter how the trigger box was shaped (rounds
         20-21). F has no other proximity use on floor 5, so it can't
         collide with anything the way E did; falls through to F's
         existing job (reopen the current floor's board) everywhere else. */
      if (mode === 'walk' && nearJevDoor()) { jevWarpIn(); return; }
      if (mode === 'walk' && nearJevExit()) { jevWarpOut(); return; }
      if (mode === 'walk' && nearJev()) { openDocs(JEV_DOC); return; }
      ui.docs.classList.contains('on') ? closeDocs() : openDocs(Math.max(0, level - 1));
      return;
    }
    if (k === 'q') { ui.rules.classList.contains('on') ? closeRules() : openRules(); return; }
    if (k === 'escape') {
      if (document.getElementById('ml').classList.contains('on')) { closeML(); return; }
      if (document.getElementById('dl').classList.contains('on')) { closeDL(); return; }
      if (document.getElementById('ga').classList.contains('on')) { closeGA(); return; }
      if (document.getElementById('llm').classList.contains('on')) { closeLLM(); return; }
      if (document.getElementById('agn').classList.contains('on')) { closeAGN(); return; }
      if (document.getElementById('roster').classList.contains('on')) { closeRoster(); return; }
      if (document.getElementById('lift').classList.contains('on')) { closeLift(); return; }
      if (ui.docs.classList.contains('on')) { closeDocs(); return; }
      if (ui.rules.classList.contains('on')) { closeRules(); return; }
      if (mode === 'items') { closeItems(); return; }
      return;
    }
    if (k === 'r') { look.yaw = 0; look.pitch = 0; look.dist = 5.5; return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
      const hf = document.getElementById('hint-focus');
      if (hf) hf.classList.add('done');
      dismissStart();
      /* the hint panel opened itself on load so a first-timer can see the
         controls before doing anything; once movement actually works,
         it has done its job — collapse it so it stops covering the scene */
      if (!firstMoveHandled) {
        firstMoveHandled = true;
        setTimeout(() => { hintEl.classList.remove('open'); hintBtn.textContent = '? ปุ่มควบคุม'; }, 900);
      }
    }
    keys.add(k);
  }
  function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  /* a keyup that never arrives (blur, alt-tab, overlay click) used to leave the
     key held down forever — always drop everything when focus goes away */
  addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
  canvas.addEventListener('pointerdown', () => keys.clear());
  /* keyboard focus: without this, a real key press never reaches the page */
  const hintEl = document.getElementById('hint');
  const hintBtn = document.getElementById('hint-toggle');
  if (hintBtn) hintBtn.onclick = () => {
    hintEl.classList.toggle('open');
    hintBtn.textContent = hintEl.classList.contains('open') ? '× ปิดคำแนะนำ' : '? ปุ่มควบคุม';
  };
  canvas.setAttribute('tabindex', '0');
  canvas.style.outline = 'none';
  const claimFocus = () => { try { window.focus(); canvas.focus({ preventScroll: true }); } catch (e) { } };
  canvas.addEventListener('pointerdown', () => { claimFocus(); dismissStart(); });
  addEventListener('pointerdown', claimFocus);
  claimFocus();
  setTimeout(claimFocus, 300);
  /* listen on the document too, so a focused child element still drives the game */
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  ui.dlg.onclick = () => { if (mode === 'talk') advance(); };

  /* ------------------------------------------------------------- loop -- */
  /* postprocessing: a light bloom pass for the glows/holograms/lanterns that
     were faked with flat sprites — real HDR-ish bleed now, tone-mapped back down */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .45, .55, .86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); /* applies tone mapping + sRGB on the final composited frame */

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w < 2 || h < 2) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
    composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }
  resize();
  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);

  let t = 0, prev = performance.now(), walk = 0, faceY = Math.PI;
  const camPos = new THREE.Vector3(1.4, 8, 30);
  /* free look: offsets applied on top of the follow camera */
  const look = { yaw: 0, pitch: 0, dist: 5.5, dragging: false, lx: 0, ly: 0 };
  canvas.addEventListener('pointerdown', e => {
    if (mode !== 'walk') return;
    look.dragging = true; look.lx = e.clientX; look.ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', e => {
    if (!look.dragging) return;
    look.yaw -= (e.clientX - look.lx) * .0055;
    look.pitch = Math.max(-.5, Math.min(1.15, look.pitch - (e.clientY - look.ly) * .0045));
    look.lx = e.clientX; look.ly = e.clientY;
  });
  const endLook = () => { look.dragging = false; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    look.dist = Math.max(-7, Math.min(16, look.dist + e.deltaY * .014));
  }, { passive: false });
  canvas.style.cursor = 'grab';

  function step(dt) {
    /* riding the lift: the cage actually climbs the shaft now, camera tracking
       it, instead of a flat color fade standing in for the whole trip */
    if (rideInfo) {
      rideInfo.t = Math.min(rideInfo.dur, rideInfo.t + dt);
      const e = rideInfo.t / rideInfo.dur, ez = 1 - Math.pow(1 - e, 3);
      const y = rideInfo.fromY + (rideInfo.toY - rideInfo.fromY) * ez;
      lift.position.y = y;
      camera.position.set(LIFT_X + 5.6, y + 3.4, LIFT_Z + 8.6);
      camera.lookAt(LIFT_X, y + 1.8, LIFT_Z);
      camPos.copy(camera.position);
      return;
    }
    let mx = 0, mz = 0;
    if (mode === 'walk') {
      /* belt-and-suspenders: WASD is already bound on document/window so it
         should never need canvas focus at all, but on some browsers focus
         can still silently drift (an extension, a stray click on chrome UI);
         keep quietly reclaiming it every frame while nothing else needs it */
      if (document.activeElement !== canvas) claimFocus();
      if (keys.has('w') || keys.has('arrowup')) mz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) mz += 1;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
      if (keys.has('d') || keys.has('arrowright')) mx += 1;
    }
    const moving = mx || mz;
    if (moving) {
      const len = Math.hypot(mx, mz), sp = 8.2 * dt;
      /* steer relative to the camera's yaw */
      const ca = Math.cos(-look.yaw), sa = Math.sin(-look.yaw);
      const rx = (mx / len) * ca - (mz / len) * sa;
      const rz = (mx / len) * sa + (mz / len) * ca;
      player.position.x += rx * sp;
      player.position.z += rz * sp;
      /* bounds: the lobby apron, or the deck of the floor you are on */
      if (level === 0) {
        player.position.x = Math.max(-12, Math.min(16, player.position.x));
        player.position.z = Math.max(-1.5, Math.min(20, player.position.z));
      } else {
        /* the Jev bridge+room sits through floor 5's own back wall,
           outside the normal deck rectangle — but as of round 18 it is
           never walked into, only warped into via jevWarp() (see that
           function's own comment for why: the bridge is a narrow rail-
           lined corridor, and this game's follow-camera has no collision
           handling of its own, so it eventually gets pinned against
           whatever wall is closest). That means the clamp only needs two
           flat states, not a hand-off between bridge-width and room-width
           the way it did when the bridge itself was walkable — jevIn
           picks which box applies (round 33 replaced the lift's own
           single-box "inLift" flag with a proper nearest-of-three-shapes
           clamp — see LIFT_CORRIDOR's comment — but the Jev room's own
           two flat states are unaffected: unlike the lift, they're not
           separated by a real gap, so the simple version still holds). */
        /* detection is deliberately looser than the clamp target below
           it (a .4 buffer past x0/z0 — there's no neighbouring soft zone
           on those two edges to hand off to, unlike z1 which already
           overlaps the hall clamp on purpose). Without that buffer, one
           frame of movement overshooting past x0/z0 flips this false and
           the *next* branch (the plain hall clamp, x±8.5/z 'til -11)
           catches it instead — snapping the player 1.4 units back to
           z=-11 rather than being gently stopped right at the door. */
        const inJevDoorWalk = level === 5 && !jevIn
          && player.position.x > JEV_DOOR_WALK.x0 - .4 && player.position.x < JEV_DOOR_WALK.x1 + .4
          && player.position.z > JEV_DOOR_WALK.z0 - .4 && player.position.z < JEV_DOOR_WALK.z1;
        if (level === 5 && jevIn) {
          player.position.x = Math.max(JEV_ROOM.x0 + .3, Math.min(JEV_ROOM.x1 - .3, player.position.x));
          player.position.z = Math.max(JEV_ROOM.zFar + .3, Math.min(JEV_WALK_NEAR, player.position.z));
        } else if (inJevDoorWalk) {
          /* held to the doorway approach itself — not left unclamped,
             or overshooting past z0 would exit this branch and the
             normal deck clamp below would yank the player straight back
             to -11, and undershooting sideways would walk them into the
             solid wall segments flanking the gap instead of the opening */
          player.position.x = Math.max(JEV_DOOR_WALK.x0, Math.min(JEV_DOOR_WALK.x1, player.position.x));
          player.position.z = Math.max(JEV_DOOR_WALK.z0, Math.min(JEV_DOOR_WALK.z1, player.position.z));
        } else {
          /* the deck, the lift pad, and the corridor bridging the gap
             between them are three separate shapes with real gaps in
             between (see LIFT_CORRIDOR's own comment) — so this can't be
             "detect which zone you're in, then clamp within it" the way
             every other zone above is. Instead: if the player's raw new
             position already sits inside any of the three, leave it
             alone; otherwise, find whichever of the three shapes has the
             nearest edge and snap there. That's the same "stopped at the
             boundary you're walking into" feel as a normal wall, applied
             to a boundary made of three pieces instead of one rectangle. */
          const DX0 = -FW / 2 + 1, DX1 = FW / 2 - 1, DZ0 = FZ - FD / 2 + 1, DZ1 = FZ + FD / 2 - .8;
          const px = player.position.x, pz = player.position.z;
          const onDeck = px >= DX0 && px <= DX1 && pz >= DZ0 && pz <= DZ1;
          const onCorridor = px >= LIFT_CORRIDOR.x0 && px <= LIFT_CORRIDOR.x1 && pz >= LIFT_CORRIDOR.z0 && pz <= LIFT_CORRIDOR.z1;
          const onPad = Math.hypot(px - LIFT_X, pz - LIFT_Z) <= LIFT_PAD_R;
          if (!(onDeck || onCorridor || onPad)) {
            const cands = [
              nearestInRect(px, pz, DX0, DX1, DZ0, DZ1),
              nearestInRect(px, pz, LIFT_CORRIDOR.x0, LIFT_CORRIDOR.x1, LIFT_CORRIDOR.z0, LIFT_CORRIDOR.z1),
              nearestOnLiftPad(px, pz)
            ];
            let best = cands[0], bestD = Math.hypot(best[0] - px, best[1] - pz);
            for (let i = 1; i < cands.length; i++) {
              const d = Math.hypot(cands[i][0] - px, cands[i][1] - pz);
              if (d < bestD) { best = cands[i]; bestD = d; }
            }
            player.position.x = best[0];
            player.position.z = best[1];
          }
        }
      }
      faceY = Math.atan2(rx, rz) + Math.PI;
      walk += dt * 9;
    } else walk += dt * 1.6;

    let want = faceY;
    const face = nearKeeper() ? keeper : (nearMech() ? mech : (nearTech() ? tech : (nearDoc() ? doc : (nearUnit() ? unit : null))));
    if (face && (mode === 'talk' || !moving)) {
      want = Math.atan2(face.position.x - player.position.x, face.position.z - player.position.z) + Math.PI;
    }
    let d = want - player.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    player.rotation.y += d * Math.min(1, dt * 9);

    const baseY = level === 0 ? 0 : floorY(level - 1) + .35;
    player.position.y = baseY;
    pshadow.position.set(player.position.x, baseY + .06, player.position.z);
    if (playerMixer) {
      setPlayerAnim(moving ? (playerWalk || playerIdle) : playerIdle);
      playerMixer.update(dt);
    }

    /* light tints gently toward whatever floor you're standing on — the same
       era palette used for props and characters now colors the light itself */
    const tint = level === 0 ? null : FLOOR_TINT[level - 1];
    const lightK = Math.min(1, dt * 1.1);
    _hemiGoal.copy(HEMI_BASE); if (tint) _hemiGoal.lerp(tint, .16);
    hemi.color.lerp(_hemiGoal, lightK);
    _sunGoal.copy(SUN_BASE); if (tint) _sunGoal.lerp(tint, .12);
    sun.color.lerp(_sunGoal, lightK);

    /* camera: in the lobby tilt up the tower, on a floor track along the deck */
    const camTune = CAM_TUNE[level];
    if (level === 5 && jevIn) {
      /* the Jev room gets an entirely separate camera, not a variant of
         the shared orbit formula in the else branch below — that
         formula's look-at target is a flat `FZ-2` constant that every
         other floor can afford to ignore, because nothing before this
         ever put the player more than a few units from it. Swept the
         same formula across every reachable player position in the
         room and every look.yaw/pitch/dist a player could dial in
         first (not assumed): the computed camera position swings by as
         much as ~23 units from the room, including angles that land it
         on the *tower's own side* of the doorway. No static enclosure —
         a dome, a wall at the doorway — can reliably hide anything from
         a camera that can end up on the wrong side of it; tried a
         `THREE.BackSide` dome first and it needed to be large enough to
         swallow the tower itself to cover that swing, which defeats
         the point.
         First version of this dedicated camera (capped camZ at -13,
         "one unit past the wall") was still wrong in a different way:
         z=-13 sits *on the bridge* (z0=-12.3..z1=-14.5), not inside the
         room (zNear=-14.6..zFar=-19.1) — a narrow, unlit corridor with
         no light source of its own, so the camera ended up parked there
         looking back through the player's own model into the room,
         which is exactly the near-black, filled-by-the-player's-back
         frame the next screenshot showed. Fixed with a guarantee that
         doesn't depend on getting a single threshold right: camZ is
         pinned to a fixed point (`JEV_ROOM.zNear - 1.2`, comfortably
         past the bridge, inside the room's own lit space) and the
         look-at target is *always* built by subtracting from camZ, so
         it is mathematically impossible for the gaze to point back
         toward the doorway — it can only ever look deeper into the
         room, toward the solid back wall that the sign hangs on.
         Round 24 enlarged the room enough that a fixed camZ would leave
         the player off-screen once they walked past the entrance, so the
         pin became a clamp: camZ trails player.z but never crosses past
         `zNear-1.2`, and lookZ is still derived from camZ (never from a
         fixed value) so "always look deeper than the camera itself"
         holds at every depth.
         The numbers below are floor 5's own, not invented for this room
         (round 27). Three screenshots in a row said the same thing —
         it feels cramped in here compared to the rest of the floor — so
         rather than nudge the distance again, the shared orbit formula
         in the else branch was solved for what it actually produces on
         floor 5: the camera ends up ~16 units from the player, 7.4
         above them, view axis ~15° down, looking at a point 3 above the
         floor. Reproduced here directly, with the same fov (camTune is
         shared, so that comes for free). The follow distance is what
         forced the room to be 30 deep rather than the other way round —
         see JEV_ROOM's own comment. */
      const camZ = Math.min(player.position.z + 14.8, JEV_ROOM.zNear - 1.2);
      const lookZ = Math.max(JEV_ROOM.zFar + .5, Math.min(player.position.z, camZ - 1.5));
      /* camera and gaze share the x factor on purpose: it keeps the view
         axis parallel to the hall instead of angling across it, and .55
         holds the player inside ~2/3 of the frame's half-width even out
         at the side walls (measured against floor 5, where the player
         reaches ~73% of it at the deck's edge). */
      /* height is derived from the gap rather than fixed, so the view
         axis holds floor 5's ~15° pitch wherever the camera ends up: at
         the full 14.8 that works out to 7.4 above the player (floor 5's
         own figure), and as the player walks back toward the exit and
         the gap closes to 6, the camera lowers with it instead of
         tipping into a 36° near-overhead shot. */
      const goal = new THREE.Vector3(player.position.x * .55, F5Y + 3 + (camZ - lookZ) * .298, camZ);
      camPos.lerp(goal, camSnap ? 1 : 1 - Math.exp(-camTune.damp * dt));
      camSnap = false;
      camera.position.copy(camPos);
      camera.lookAt(player.position.x * .55, F5Y + 3, lookZ);
    } else {
      /* follow point + free-look orbit around it */
      const lobby = level === 0;
      const anchor = lobby
        ? new THREE.Vector3(player.position.x * .6 + 1.5, 12.4 * LOBBY_K, player.position.z + 27 * LOBBY_K)
        : new THREE.Vector3(player.position.x * .5 + 1, baseY + 7.4, player.position.z + 13.5);
      const target = lobby
        ? new THREE.Vector3(0, 15.4 * LOBBY_K, -4)
        : new THREE.Vector3(player.position.x * .4, baseY + 3, FZ - 2);
      /* rotate the camera offset about the target, then push in/out on the wheel */
      const off = anchor.clone().sub(target);
      const radius = Math.max(6, off.length() + look.dist);
      const yaw = Math.atan2(off.x, off.z) + look.yaw;
      const rise = off.y / off.length();
      const goal = new THREE.Vector3(
        target.x + Math.sin(yaw) * radius,
        Math.max(baseY + 1.8, target.y + rise * radius - look.pitch * 2.2),
        target.z + Math.cos(yaw) * radius
      );
      camPos.lerp(goal, camSnap ? 1 : 1 - Math.exp(-(look.dragging ? 14 : camTune.damp) * dt));
      camSnap = false;
      camera.position.copy(camPos);
      /* tilt the gaze up the tower as you drag up */
      camera.lookAt(target.x, target.y + look.pitch * 17, target.z);
    }
    if (Math.abs(camera.fov - camTune.fov) > .03) {
      camera.fov += (camTune.fov - camera.fov) * Math.min(1, dt * 1.6);
      camera.updateProjectionMatrix();
    }

    /* markers */
    const sh = (m, on, y) => {
      m.material.opacity = on ? .96 : .32;
      m.position.y = y + Math.sin(t * 2.2) * .1;
    };
    mkKeeper.visible = level === 0;
    if (mkKeeper.visible) sh(mkKeeper, mode === 'walk' && nearKeeper(), 4.7);
    mkLift.visible = level === 0;
    if (mkLift.visible) sh(mkLift, mode === 'walk' && nearLift() && stage !== 'lobby', 6.9);
    drift.forEach(d => {
      const dy = Math.sin(t * .18 + d.phase) * d.amp;
      d.o.position.y += (dy - (d.o.userData.lastDy || 0));
      d.o.userData.lastDy = dy;
      if (d.spin) d.o.rotation.y += d.spin * dt;
      if (d.halo) { d.halo.position.y = d.o.position.y; }
      if (d.cord) { d.cord.position.y = d.o.position.y + 7.6; }
    });
    signs.forEach(sg => { sg.visible = level === 0; });
    boards.forEach((b, i) => { b.visible = level === 0 || level - 1 === i; });
    mkBoard.visible = level >= 1;
    if (mkBoard.visible) {
      mkBoard.position.x = boards[level - 1].position.x;
      mkBoard.position.z = boards[level - 1].position.z;
      sh(mkBoard, mode === 'walk' && nearBoard(), floorY(level - 1) + 5.2);
    }
    mkMech.visible = level === 1;
    if (mkMech.visible) sh(mkMech, mode === 'walk' && nearMech(), floorY(0) + 5.05);
    mkMachine.visible = level === 1 && stage !== 'f1intro';
    if (mkMachine.visible) sh(mkMachine, mode === 'walk' && nearMachine(), floorY(0) + 7.4);
    /* floor 2 */
    machine.visible = level !== 2;
    mech.visible = level !== 2;
    mechGlow.visible = level !== 2;
    plant.visible = level !== 1;
    tech.visible = level !== 1;
    techGlow.visible = level !== 1;
    mkTech.visible = level === 2;
    if (mkTech.visible) sh(mkTech, mode === 'walk' && nearTech(), F2Y + 4.7);
    mkPlant.visible = level === 2 && stage !== 'f2intro';
    if (mkPlant.visible) sh(mkPlant, mode === 'walk' && nearPlant(), F2Y + 5.2);
    lab.visible = level !== 1 && level !== 2;
    doc.visible = level === 3 || level === 0;
    docGlow.visible = doc.visible;
    mkDoc.visible = level === 3;
    if (mkDoc.visible) sh(mkDoc, mode === 'walk' && nearDoc(), F3Y + 4.7);
    mkLab.visible = level === 3 && stage !== 'f3intro';
    if (mkLab.visible) sh(mkLab, mode === 'walk' && nearLab(), F3Y + 5.4);
    doc.rotation.y = .62 + Math.sin(t * .48) * .08;
    doc.position.y = F3Y + Math.sin(t * 1.5) * .05;
    rackLights.forEach(r => {
      const v = .4 + .6 * Math.abs(Math.sin(t * r.sp + r.ph));
      r.led.material.color.setRGB(.35 * v, .75 * v, .3 * v);
    });
    if (armJoints.length) {
      const busy = dlPhase === 'learning';
      const sp = busy ? 3.4 : .8;
      armJoints[0].rotation.y = Math.sin(t * sp * .5) * (busy ? .7 : .3);
      armJoints[1].rotation.z = -.5 + Math.sin(t * sp * .7) * (busy ? .5 : .2);
      armJoints[2].rotation.z = Math.sin(t * sp) * (busy ? .8 : .3);
    }
    forge.visible = level === 4 || level === 0;
    unit.visible = forge.visible;
    unitGlow.visible = forge.visible;
    mkUnit.visible = level === 4;
    if (mkUnit.visible) sh(mkUnit, mode === 'walk' && nearUnit(), F4Y + 4.7);
    mkForge.visible = level === 4 && stage !== 'f4intro';
    if (mkForge.visible) sh(mkForge, mode === 'walk' && nearForge(), F4Y + 6.4);
    unit.rotation.y = .62 + Math.sin(t * .44) * .07;
    unit.position.y = F4Y + Math.sin(t * 1.4) * .05;
    press.visible = level === 5 || level === 0;
    ling.visible = press.visible;
    lingGlow.visible = press.visible;
    mkLing.visible = level === 5;
    if (mkLing.visible) sh(mkLing, mode === 'walk' && nearLing(), F5Y + 4.7);
    mkPress.visible = level === 5 && stage !== 'f5intro';
    if (mkPress.visible) sh(mkPress, mode === 'walk' && nearPress(), F5Y + 5.4);
    mkJevDoor.visible = level === 5 && stage !== 'f5intro' && !jevIn;
    if (mkJevDoor.visible) sh(mkJevDoor, mode === 'walk' && nearJevDoor(), F5Y + 4.2);
    mkJevExit.visible = level === 5 && stage !== 'f5intro' && jevIn;
    if (mkJevExit.visible) sh(mkJevExit, mode === 'walk' && nearJevExit(), F5Y + 3.3);
    ling.rotation.y = .62 + Math.sin(t * .5) * .07;
    ling.position.y = F5Y + Math.sin(t * 1.6) * .05;
    letterRing.rotation.y += dt * .3;
    f6.visible = level === 6 || level === 0;
    lead.visible = f6.visible;
    leadGlow.visible = f6.visible;
    mkLead.visible = level === 6;
    if (mkLead.visible) sh(mkLead, mode === 'walk' && nearLead(), F6Y + 4.7);
    mkMC.visible = level === 6 && stage !== 'f6intro';
    if (mkMC.visible) sh(mkMC, mode === 'walk' && nearMC(), F6Y + 5.2);
    mkRoster.visible = level === 6 && stage !== 'f6intro';
    if (mkRoster.visible) sh(mkRoster, mode === 'walk' && nearRoster(), F6Y + 3.1);
    lead.rotation.y = .62 + Math.sin(t * .46) * .07;
    lead.position.y = F6Y + Math.sin(t * 1.45) * .05;
    if (mcScreenGlow) mcScreenGlow.material.opacity = .16 + Math.sin(t * 1.8) * .05;
    /* every desk breathes a little; the ones pulled into the running job
       breathe faster and brighter — set by the flow, read here */
    CREW.forEach((cw, i) => {
      const d = desks[cw.k];
      if (!d) return;
      const busy = !!d.busy;
      d.fig.position.y = Math.sin(t * (busy ? 4.2 : 1.1) + i) * (busy ? .06 : .02);
      d.mon.material.opacity = busy ? .72 + Math.sin(t * 6 + i) * .18 : (d.on ? .5 : .2);
      d.glow.visible = busy || !!d.on;
      if (d.glow.visible) d.glow.material.opacity = busy ? .34 : .16;
    });
    if (holoCore) {
      holoCore.rotation.y += dt * .7;
      holoCore.rotation.x = Math.sin(t * .5) * .3;
      holoCore.position.y = 2.7 + Math.sin(t * 1.1) * .12;
      holoCore.material.opacity = .42 + Math.sin(t * 2.2) * .12;
    }
    holoRings.forEach((r, i) => { r.rotation.z += dt * (.3 + i * .16); });
    if (scanIris) {
      const busy = gaPhase === 'scan';
      scanIris.material.color.setHex(busy ? 0xFFFFFF : (gaVerdict === 'pass' ? 0x6FD8A8 : gaVerdict === 'fail' ? 0xFF7A5A : 0xE0685A));
      scanIris.scale.setScalar(busy ? 1 + Math.sin(t * 14) * .14 : 1 + Math.sin(t * 2) * .05);
      scanEye.rotation.y = busy ? Math.sin(t * 5) * .5 : Math.sin(t * .6) * .2;
    }
    tech.rotation.y = .62 + Math.sin(t * .52) * .08;
    tech.position.y = F2Y + Math.sin(t * 1.55) * .05;
    if (plant.userData.rolls) plant.userData.rolls.forEach(r => { r.rotation.y += dt * 2.4; });
    gauges.forEach((g2, i) => {
      const target = i === 0 ? mlInputLevel : mlAcc;
      g2.shown = g2.shown == null ? target : g2.shown + (target - g2.shown) * Math.min(1, dt * 3);
      g2.needle.rotation.z = Math.PI * 1.25 - g2.shown * Math.PI * 1.5 - Math.PI / 2;
    });
    /* follows the floor you're actually standing on. It used to be pinned
       to `floorY(0) + 6.9` — floor 1's height — so the prompt was correct
       on floor 1 and then sat further below the deck on every floor above
       it (24 units under your feet by floor 5), which is why riding up
       looked like the lift had no prompt at all. The offset is the same
       one floor 1 was already tuned to, just measured from the current
       deck instead of a fixed one. */
    if (mkDown.visible) sh(mkDown, mode === 'walk' && nearLift(), baseY + 6.55);

    /* robot idle: gears turn, needles twitch, visors breathe */
    for (const bot of [keeper, mech, tech, doc, unit, lead]) {
      const u = bot.userData;
      if (u.gear) u.gear.rotation.z += dt * u.gear.userData.spin;
      if (u.key) u.key.rotation.z += dt * u.key.userData.spin;
      if (u.needle) u.needle.rotation.z = Math.sin(t * 1.7 + bot.position.y) * .5;
      if (u.crown) u.crown.rotation.y += dt * (agnRunning ? 1.7 : .45);
      if (u.visor) u.visor.material.opacity = 1;
    }
    keeper.rotation.y = .55 + Math.sin(t * .5) * .08;
    keeper.position.y = Math.sin(t * 1.5) * .05;
    mech.rotation.y = .6 + Math.sin(t * .55) * .08;
    mech.position.y = floorY(0) + .35 + Math.sin(t * 1.6) * .05;
    mechGlow.position.y = floorY(0) + .4;
    if (machine.userData.gears) machine.userData.gears.forEach(g => { g.rotation.z += g.userData.spin * dt * .5; });
    if (machine.userData.lever) machine.userData.lever.rotation.z = Math.sin(t * 1.2) * .12;

    if (fly) {
      fly.t = Math.min(1, fly.t + dt * 1.5);
      const e = fly.t, p = fly.from.clone().lerp(fly.to, e);
      p.y += Math.sin(e * Math.PI) * 2;
      fly.card.position.copy(p);
      fly.card.rotation.z = e * 2.4;
      fly.card.scale.setScalar(1 - e * .55);
      fly.card.lookAt(camera.position);
      if (e >= 1) { scene.remove(fly.card); const it = fly.it; fly = null; applyItem(it); }
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      machine.position.x = 5.4 + Math.sin(t * 46) * .1 * shake;
    } else machine.position.x = 5.4;
    if (gaPhase === 'scan') {
      gaScanT += dt;
      if (gaScanT > 1.5) gaJudge();
    }
    if (dlPhase === 'learning') {
      dlLearnT += dt;
      const steps = Math.min(3, Math.ceil(dt * 90));
      for (let k = 0; k < steps; k++) {
        const p = dlProbs(), lr = .05;
        const g0 = (p[0] - 1) / DL_T, g1 = (p[1] - 0) / DL_T;
        DLW[0] = Math.max(0, Math.min(1, DLW[0] - lr * g0));
        DLW[1] = Math.max(0, Math.min(1, DLW[1] - lr * g0));
        DLW[2] = Math.max(0, Math.min(1, DLW[2] - lr * g1));
        DLW[3] = Math.max(0, Math.min(1, DLW[3] - lr * g1));
      }
      if (dlLearnT > 3.2) {
        dlPhase = 'done';
        if (stage === 'f3quest') {
          stage = 'f3wrap';
          setQuest('<b>ภารกิจ</b><span>กลับไปคุยกับ ยูนิต 03</span>');
          mkDoc.userData.paint('! กด E เพื่อคุย');
          toast('เครื่องเรียนเองได้แล้ว <b>กลับไปคุยกับ ยูนิต 03</b>');
        }
      }
      dlRender();
    }
    if (ML.anim && ML.shown && ML.target) {
      const k = 1 - Math.exp(-2.6 * dt);
      ML.shown.th += (ML.target.th - ML.shown.th) * k;
      ML.shown.rho += (ML.target.rho - ML.shown.rho) * k;
      mlAcc = mlScore(ML.shown);
      mlMark(ML.shown);
      mlDraw();
      if (Math.abs(ML.shown.th - ML.target.th) < .004 && Math.abs(ML.shown.rho - ML.target.rho) < .006) {
        ML.anim = false;
        mlPhase = 'learned';
        mlInputLevel = .5;
        mlSetStatus();
        if (stage === 'f2quest') {
          stage = 'f2wrap';
          setQuest('<b>ภารกิจ</b><span>กลับไปคุยกับ ยูนิต 02</span>');
          mkTech.userData.paint('! กด E เพื่อคุย');
          toast('เครื่องปรับเส้นเองได้แล้ว <b>กลับไปคุยกับ ยูนิต 02</b>');
        }
      }
    }
    if (canT >= 0) {
      canT += dt * 1.3;
      can.visible = true;
      const e = Math.min(1, canT);
      can.position.set(0, 2.4 - e * 1.25, .4 + e * .65);
      can.rotation.x = e * 2.2;
      if (canT > 3.4) { can.visible = false; canT = -1; }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    t += dt;
    resize();
    step(dt);
    composer.render();
  }

  window.__tower = {
    scene, camera, player, keeper, mech, machine,
    goto(x, z, lv) { if (lv != null) level = lv; const y = level === 0 ? 0 : floorY(level - 1) + .35; player.position.set(x, y, z); camPos.set(x * .5 + 1, y + 5.4, z + 12.5); },
    tick(sec = 1, n = 30) { for (let i = 0; i < n; i++) { const d = sec / n; t += d; step(d); } composer.render(); },
    state: () => ({ mode, level, stage, fedOk, fedBad, nearKeeper: nearKeeper(), nearLift: nearLift(), nearMech: nearMech(), nearMachine: nearMachine(), nearTech: nearTech(), nearPlant: nearPlant(), nearDoc: nearDoc(), nearLab: nearLab(), mlAcc, mlPhase, dlPhase, gaPhase, gaVerdict, gaLevel, gaPasses }),
    ride, feed, look, openDocs, closeDocs, boards, nearBoard, tech, plant, openML, closeML, nearTech, nearPlant, openLift, closeLift, ML, mlBest, showCard,
    doc, lab, openDL, closeDL, nearDoc, nearLab, DLW, dlProbs,
    unit, forge, openGA, closeGA, nearUnit, nearForge, gaPick
  };
  requestAnimationFrame(frame);
  setTimeout(() => document.getElementById('load').classList.add('off'), 200);
}
