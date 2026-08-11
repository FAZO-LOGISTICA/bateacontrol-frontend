import { useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, LayerGroup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const API_URL = "https://8017-200-50-126-98.ngrok-free.app";
const CLOUDINARY_CLOUD = "drhceyh7g";
const CLOUDINARY_PRESET = "bateacontrol";

// ngrok (plan gratis) muestra una pagina de advertencia a quien entra por navegador.
// Este header le dice a ngrok que la peticion viene de nuestra app y que la deje pasar directo.
// No afecta nada si el backend esta detras de Cloudflare Tunnel (el header simplemente se ignora).
(function () {
  const _origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (url.startsWith(API_URL)) {
      init = { ...(init || {}), headers: { ...((init && init.headers) || {}), "ngrok-skip-browser-warning": "true" } };
    }
    return _origFetch(input, init);
  };
})();

const C = {
  azul:"#1565C0", azulC:"#1976D2", azulS:"#E3F2FD",
  verde:"#2E7D32", verdeS:"#E8F5E9",
  rojo:"#C62828", rojoS:"#FFEBEE",
  naranja:"#E65100", naranjaS:"#FFF3E0",
  morado:"#6A1B9A", moradoS:"#F3E5F5",
  blanco:"#FFFFFF", fondo:"#F0F4F8",
};

const ESTADOS = {
  pendiente:   { color:"#1565C0", bg:"#E3F2FD", label:"Pendiente"   },
  agrupada:    { color:"#7B1FA2", bg:"#F3E5F5", label:"Agrupada"    },
  asignada:    { color:"#2E7D32", bg:"#E8F5E9", label:"Asignada"    },
  planificado: { color:"#E65100", bg:"#FFF3E0", label:"Planificado" },
  instalada:   { color:"#00838F", bg:"#E0F7FA", label:"Instalada"   },
  completado:  { color:"#2E7D32", bg:"#E8F5E9", label:"Completado"  },
  retirada:    { color:"#37474F", bg:"#ECEFF1", label:"Retirada"    },
  critica:     { color:"#C62828", bg:"#FFEBEE", label:"Crítica"     },
};

const ALERTAS = {
  normal:      { color:"#2E7D32", bg:"#E8F5E9", icon:"✓",  label:"normal"      },
  advertencia: { color:"#E65100", bg:"#FFF3E0", icon:"⚠",  label:"advertencia" },
  critica:     { color:"#C62828", bg:"#FFEBEE", icon:"🔴", label:"crítica"     },
};

async function subirCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_PRESET);
  fd.append("cloud_name", CLOUDINARY_CLOUD);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method:"POST", body:fd });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Error subiendo imagen");
  return data.secure_url;
}

function Badge({ estado, alerta, small }) {
  const cfg = alerta ? ALERTAS[alerta] : ESTADOS[estado] || ESTADOS.pendiente;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:cfg.bg, color:cfg.color, padding:small?"2px 8px":"3px 10px", borderRadius:20, fontSize:small?11:12, fontWeight:600, whiteSpace:"nowrap", border:`1px solid ${cfg.color}22` }}>
      {alerta && <span>{cfg.icon}</span>}{cfg.label}
    </span>
  );
}

function EmergenciaBadge({ small }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#C62828", color:"#FFF", padding:small?"2px 8px":"3px 10px", borderRadius:20, fontSize:small?10:11, fontWeight:700, whiteSpace:"nowrap", animation:"pulse 1.5s infinite" }}>
      🚨 EMERGENCIA
    </span>
  );
}

function KPICard({ label, value, icon, color, bg, sub }) {
  return (
    <div style={{ background:C.blanco, border:"1px solid #E0E0E0", borderRadius:12, padding:"16px 20px", borderLeft:`4px solid ${color}`, display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ fontSize:12, color:"#666", fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:20, background:bg, borderRadius:8, padding:"3px 7px" }}>{icon}</span>
      </div>
      <div style={{ fontSize:30, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#888" }}>{sub}</div>}
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      <label style={{ fontSize:13, fontWeight:600, color:"#333" }}>{label}{required&&<span style={{ color:C.rojo }}> *</span>}</label>
      {children}
      {error && <span style={{ fontSize:11, color:C.rojo }}>{error}</span>}
    </div>
  );
}

const inp = { padding:"10px 14px", borderRadius:8, border:"1px solid #DDD", fontSize:14, outline:"none", background:"#FFF", width:"100%", boxSizing:"border-box" };

function CheckboxEmergencia({ checked, onChange }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
      background:checked?"#FFEBEE":"#FAFAFA", border:checked?"2px solid #C62828":"1px solid #DDD",
      borderRadius:10, cursor:"pointer"
    }} onClick={()=>onChange(!checked)}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{ width:18, height:18, cursor:"pointer" }} />
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:checked?"#C62828":"#333" }}>🚨 Solicitud de Emergencia</div>
        <div style={{ fontSize:11, color:"#888" }}>Aluvión, temporal u otra emergencia — prioridad inmediata, no espera en la fila normal</div>
      </div>
    </div>
  );
}

// ── UPLOADER MÚLTIPLES FOTOS (máx 5) ─────────────────────────────────────────
function MultiFotoUploader({ label, fotos, setFotos, maxFotos=5 }) {
  const [subiendo, setSubiendo] = useState(false);
  const handleAgregar = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const disponibles = maxFotos - fotos.length;
    const aSubir = files.slice(0, disponibles);
    if (!aSubir.length) return;
    setSubiendo(true);
    const nuevasUrls = [];
    for (const file of aSubir) {
      try {
        const url = await subirCloudinary(file);
        nuevasUrls.push(url);
      } catch { console.error("Error subiendo foto"); }
    }
    setFotos(prev => [...prev, ...nuevasUrls]);
    setSubiendo(false);
    e.target.value = ""; // reset input
  };
  const handleEliminar = (idx) => {
    setFotos(prev => prev.filter((_, i) => i !== idx));
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <label style={{ fontSize:13, fontWeight:600, color:"#333" }}>{label}</label>
        <span style={{ fontSize:11, color:"#888" }}>{fotos.length}/{maxFotos} fotos</span>
      </div>
      {/* Grid de fotos subidas */}
      {fotos.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {fotos.map((url, i) => (
            <div key={i} style={{ position:"relative", width:80, height:80 }}>
              <img src={url} alt={`foto ${i+1}`} style={{ width:80, height:80, objectFit:"cover", borderRadius:8, border:"2px solid #DDD" }} />
              <button
                onClick={() => handleEliminar(i)}
                style={{
                  position:"absolute", top:-6, right:-6,
                  width:20, height:20, borderRadius:"50%",
                  background:C.rojo, border:"2px solid #FFF",
                  color:"#FFF", fontSize:12, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  lineHeight:1, padding:0
                }}>×</button>
            </div>
          ))}
        </div>
      )}
      {/* Botón agregar fotos */}
      {fotos.length < maxFotos && (
        <label style={{
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          padding:"10px 16px", border:`2px dashed #CCC`, borderRadius:10,
          cursor:"pointer", background:"#F8F8F8",
          color:"#888", fontSize:13, fontWeight:500,
          opacity: subiendo ? 0.6 : 1
        }}>
          {subiendo ? (
            <><span>⏳</span> Subiendo fotos...</>
          ) : (
            <><span style={{ fontSize:18 }}>📷</span> Agregar foto ({fotos.length}/{maxFotos})</>
          )}
          <input
            type="file" accept="image/*" multiple
            onChange={handleAgregar}
            disabled={subiendo}
            style={{ display:"none" }}
          />
        </label>
      )}
      {fotos.length >= maxFotos && (
        <div style={{ fontSize:11, color:C.naranja, textAlign:"center" }}>
          ⚠️ Límite de {maxFotos} fotos alcanzado
        </div>
      )}
    </div>
  );
}

function Modal({ titulo, color, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:640, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"20px 24px", background:color, borderRadius:"16px 16px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ margin:0, color:"#FFF", fontSize:17, fontWeight:700 }}>{titulo}</h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF", width:34, height:34, borderRadius:"50%", cursor:"pointer", fontSize:20 }}>×</button>
        </div>
        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:16 }}>{children}</div>
      </div>
    </div>
  );
}

function SeccionForm({ titulo, color, children }) {
  return (
    <div style={{ background:"#F8FAFE", borderRadius:10, padding:16 }}>
      <h3 style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color }}>{titulo}</h3>
      {children}
    </div>
  );
}

function SeccionGeorref({ errores, latitud, longitud, set }) {
  return (
    <div style={{ background:"#F0F7FF", borderRadius:10, padding:16, border:"1px solid #BBDEFB" }}>
      <h3 style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:C.azul }}>📍 Georreferencia</h3>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Field label="Latitud" required error={errores.latitud}>
          <input style={{...inp, fontFamily:"monospace", borderColor:errores.latitud?C.rojo:"#DDD"}} value={latitud} onChange={e=>set("latitud",e.target.value)} placeholder="-33.0458" type="number" step="any" />
        </Field>
        <Field label="Longitud" required error={errores.longitud}>
          <input style={{...inp, fontFamily:"monospace", borderColor:errores.longitud?C.rojo:"#DDD"}} value={longitud} onChange={e=>set("longitud",e.target.value)} placeholder="-71.6197" type="number" step="any" />
        </Field>
      </div>
      {latitud && longitud && !isNaN(parseFloat(latitud)) && !isNaN(parseFloat(longitud)) && (
        <div style={{ marginTop:10, padding:"7px 12px", background:"#E3F2FD", borderRadius:8, fontSize:12, color:C.azul, fontFamily:"monospace" }}>
          ✅ {parseFloat(latitud).toFixed(6)}, {parseFloat(longitud).toFixed(6)}
        </div>
      )}
    </div>
  );
}

function BotonesModal({ onClose, onGuardar, guardando, subiendo }) {
  return (
    <div style={{ display:"flex", gap:12, justifyContent:"flex-end", paddingTop:4 }}>
      <button onClick={onClose} style={{ padding:"10px 24px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:14, cursor:"pointer" }}>Cancelar</button>
      <button onClick={onGuardar} disabled={guardando||subiendo} style={{ padding:"10px 28px", borderRadius:8, border:"none", background:(guardando||subiendo)?"#888":C.azul, color:"#FFF", fontSize:14, fontWeight:700, cursor:(guardando||subiendo)?"not-allowed":"pointer" }}>
        {guardando?"⏳ Guardando...":subiendo?"⏳ Subiendo foto...":"✅ Guardar"}
      </button>
    </div>
  );
}

// ── MODAL AGREGAR OTRO SERVICIO PARA EL MISMO VECINO ─────────────────────────
function ModalOtroServicio({ vecino, onClose, onAgregarDesmalezado, onAgregarCamino }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:3500, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:460, boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"18px 24px", background:"#1565C0", borderRadius:"16px 16px 0 0" }}>
          <h2 style={{ margin:0, color:"#FFF", fontSize:16, fontWeight:700 }}>✅ Solicitud registrada</h2>
          <p style={{ margin:"4px 0 0", color:"#90CAF9", fontSize:13 }}>¿Este vecino también necesita otro servicio además de la batea?</p>
        </div>
        <div style={{ padding:22 }}>
          <div style={{ background:"#E3F2FD", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#1565C0" }}>
            <strong>{vecino.nombre_vecino}</strong>
            {vecino.rut && vecino.rut !== "SIN-RUT" && ` — ${vecino.rut}`}
            {vecino.direccion && vecino.direccion !== "Sin dirección" && ` — ${vecino.direccion}`}
          </div>
          <p style={{ fontSize:13, color:"#555", marginBottom:16 }}>
            Si este vecino también necesita desmalezado o arreglo de camino, el sistema pre-llenará sus datos y detectará automáticamente si se puede crear un <strong>Operativo Conjunto</strong>.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={onAgregarDesmalezado} style={{
              padding:"12px 18px", borderRadius:10, border:"none",
              background:C.verde, color:"#FFF", fontSize:14, fontWeight:600, cursor:"pointer",
              display:"flex", alignItems:"center", gap:10
            }}>
              <span style={{ fontSize:20 }}>🌿</span>
              <div style={{ textAlign:"left" }}>
                <div>Agregar Desmalezado</div>
                <div style={{ fontSize:11, opacity:.85 }}>Pre-llenará datos del vecino automáticamente</div>
              </div>
            </button>
            <button onClick={onAgregarCamino} style={{
              padding:"12px 18px", borderRadius:10, border:"none",
              background:C.naranja, color:"#FFF", fontSize:14, fontWeight:600, cursor:"pointer",
              display:"flex", alignItems:"center", gap:10
            }}>
              <span style={{ fontSize:20 }}>🛤️</span>
              <div style={{ textAlign:"left" }}>
                <div>Agregar Arreglo de Camino</div>
                <div style={{ fontSize:11, opacity:.85 }}>Pre-llenará datos del vecino automáticamente</div>
              </div>
            </button>
            <button onClick={onClose} style={{
              padding:"10px 18px", borderRadius:10, border:"1px solid #DDD",
              background:"#FFF", color:"#555", fontSize:13, cursor:"pointer"
            }}>
              No, solo la batea — Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function ModalBatea({ onClose, onGuardar, vecinoPrelleno }) {
  const [form, setForm] = useState({
    nombre: vecinoPrelleno?.nombre_vecino || "",
    rut: vecinoPrelleno?.rut && vecinoPrelleno.rut !== "SIN-RUT" ? vecinoPrelleno.rut : "",
    direccion: vecinoPrelleno?.direccion && vecinoPrelleno.direccion !== "Sin dirección" ? vecinoPrelleno.direccion : "",
    telefono: vecinoPrelleno?.telefono || "",
    latitud: vecinoPrelleno?.latitud || "",
    longitud: vecinoPrelleno?.longitud || "",
    observaciones: "",
    es_emergencia: false
  });
  const [fotosAntes, setFotosAntes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [alertaHistorial, setAlertaHistorial] = useState(null);
  const [alertaDuplicado, setAlertaDuplicado] = useState(null);
  const [vecinoGuardado, setVecinoGuardado] = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const verificarRUT = async (rut) => {
    if (rut.length < 9) return;
    try {
      const res = await fetch(`${API_URL}/api/vecinos/${rut}/historial`);
      if (res.ok) { const d=await res.json(); if(d.alerta) setAlertaHistorial(d); else setAlertaHistorial(null); }
    } catch {}
  };
  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre="El nombre es obligatorio para identificar la solicitud";
    setErrores(e); return Object.keys(e).length===0;
  };
  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const lat = form.latitud && !isNaN(parseFloat(form.latitud)) ? parseFloat(form.latitud) : null;
      const lon = form.longitud && !isNaN(parseFloat(form.longitud)) ? parseFloat(form.longitud) : null;
      const res = await fetch(`${API_URL}/api/solicitudes`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nombre_vecino:form.nombre, rut:form.rut||"SIN-RUT", direccion:form.direccion||"Sin dirección", telefono:form.telefono, latitud:lat, longitud:lon, observaciones:form.observaciones, fotos_antes:fotosAntes, es_emergencia:form.es_emergencia })
      });
      const data = await res.json();
      if (!res.ok) { alert("❌ "+(data.detail||"Error")); setGuardando(false); return; }
      // Mostrar advertencia si ya tenía batea pendiente (ya no bloquea, solo avisa)
      if (data.alerta_duplicado) setAlertaDuplicado(data.alerta_duplicado);
      // Guardar vecino para ofrecer otro servicio
      setVecinoGuardado(data);
      onGuardar(data); // actualiza la lista
    } catch { alert("❌ Error de conexión"); }
    setGuardando(false);
  };
  // Si ya guardó, mostrar modal "¿otro servicio?"
  if (vecinoGuardado) {
    return (
      <ModalOtroServicio
        vecino={vecinoGuardado}
        onClose={onClose}
        onAgregarDesmalezado={() => { onClose(); onGuardar({ _abrirDesmalezado: vecinoGuardado }); }}
        onAgregarCamino={() => { onClose(); onGuardar({ _abrirCamino: vecinoGuardado }); }}
      />
    );
  }
  return (
    <Modal titulo="🗑️ Nueva Solicitud de Batea" color={C.azul} onClose={onClose}>
      {alertaHistorial && (
        <div style={{ background:"#FFF3E0", border:"1px solid #FFB300", borderRadius:10, padding:"12px 16px", display:"flex", gap:10 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight:700, color:"#E65100", fontSize:13 }}>Vecino con historial de batea</div>
            <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{alertaHistorial.alerta}</div>
          </div>
        </div>
      )}
      {alertaDuplicado && (
        <div style={{ background:"#FFF3E0", border:"1px solid #FFB300", borderRadius:10, padding:"12px 16px", display:"flex", gap:10 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div style={{ fontSize:13, color:"#E65100" }}>{alertaDuplicado} — Se guardó igual, puede tener múltiples servicios.</div>
        </div>
      )}
      {/* Aviso datos incompletos */}
      <div style={{ background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.azul }}>
        💡 Solo el <strong>nombre</strong> es obligatorio. Puedes guardar ahora y completar RUT, coordenadas y fotos después usando <strong>✏️ Editar</strong>.
      </div>
      <CheckboxEmergencia checked={form.es_emergencia} onChange={v=>set("es_emergencia",v)} />
      <SeccionForm titulo="👤 Datos del Vecino" color={C.azul}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Nombre completo" required error={errores.nombre}>
            <input style={{...inp, borderColor:errores.nombre?C.rojo:"#DDD"}} value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="María González Riquelme" />
          </Field>
          <Field label="RUT">
            <input style={inp} value={form.rut} onChange={e=>set("rut",e.target.value)} onBlur={e=>verificarRUT(e.target.value)} placeholder="12.345.678-9 (opcional)" />
          </Field>
          <Field label="Teléfono">
            <input style={inp} value={form.telefono} onChange={e=>set("telefono",e.target.value)} placeholder="+56912345678" />
          </Field>
          <Field label="Dirección">
            <input style={inp} value={form.direccion} onChange={e=>set("direccion",e.target.value)} placeholder="Av. Argentina 1234 (opcional)" />
          </Field>
        </div>
      </SeccionForm>
      <div style={{ background:"#F0F7FF", borderRadius:10, padding:16, border:"1px solid #BBDEFB" }}>
        <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.azul }}>📍 Georreferencia <span style={{ fontWeight:400, color:"#888", fontSize:11 }}>(opcional — puedes agregar después)</span></h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Latitud">
            <input style={{...inp, fontFamily:"monospace"}} value={form.latitud} onChange={e=>set("latitud",e.target.value)} placeholder="-33.0458 (opcional)" type="number" step="any" />
          </Field>
          <Field label="Longitud">
            <input style={{...inp, fontFamily:"monospace"}} value={form.longitud} onChange={e=>set("longitud",e.target.value)} placeholder="-71.6197 (opcional)" type="number" step="any" />
          </Field>
        </div>
        {form.latitud && form.longitud && !isNaN(parseFloat(form.latitud)) && !isNaN(parseFloat(form.longitud)) && (
          <div style={{ marginTop:10, padding:"7px 12px", background:"#E3F2FD", borderRadius:8, fontSize:12, color:C.azul, fontFamily:"monospace" }}>
            ✅ {parseFloat(form.latitud).toFixed(6)}, {parseFloat(form.longitud).toFixed(6)}
          </div>
        )}
      </div>
      <MultiFotoUploader label="📷 Fotos del sector (ANTES) — máx 5, opcional" fotos={fotosAntes} setFotos={setFotosAntes} />
      <Field label="Observaciones">
        <textarea style={{...inp, minHeight:70, resize:"vertical"}} value={form.observaciones} onChange={e=>set("observaciones",e.target.value)} placeholder="Información adicional..." />
      </Field>
      <BotonesModal onClose={onClose} onGuardar={handleGuardar} guardando={guardando} subiendo={false} />
    </Modal>
  );
}
function ModalDesmalezado({ onClose, onGuardar, vecinoPrelleno }) {
  const [form, setForm] = useState({
    nombre: vecinoPrelleno?.nombre_vecino || "",
    rut: vecinoPrelleno?.rut && vecinoPrelleno.rut !== "SIN-RUT" ? vecinoPrelleno.rut : "",
    telefono: vecinoPrelleno?.telefono || "",
    es_recordatorio: false,
    direccion: vecinoPrelleno?.direccion && vecinoPrelleno.direccion !== "Sin dirección" ? vecinoPrelleno.direccion : "",
    descripcion: "", observaciones: "",
    latitud: vecinoPrelleno?.latitud || "",
    longitud: vecinoPrelleno?.longitud || "",
    es_emergencia: false
  });
  const [fotosAntes, setFotosAntes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const validar = () => {
    const e = {};
    if (!form.direccion.trim()) e.direccion="Al menos la dirección es necesaria para ubicar el punto";
    setErrores(e); return Object.keys(e).length===0;
  };
  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const lat = form.latitud && !isNaN(parseFloat(form.latitud)) ? parseFloat(form.latitud) : null;
      const lon = form.longitud && !isNaN(parseFloat(form.longitud)) ? parseFloat(form.longitud) : null;
      const res = await fetch(`${API_URL}/api/desmalezados`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nombre_solicitante:form.nombre, rut:form.rut||"SIN-RUT", telefono:form.telefono, es_recordatorio:form.es_recordatorio, direccion:form.direccion, descripcion:form.descripcion, observaciones:form.observaciones, latitud:lat, longitud:lon, fotos_antes:fotosAntes, es_emergencia:form.es_emergencia })
      });
      const data = await res.json();
      if (!res.ok) { alert("❌ "+(data.detail||"Error")); setGuardando(false); return; }
      if (data.alerta_conjunto) {
        const confirmar = window.confirm(`${data.alerta_conjunto}\n\n¿Crear Operativo Conjunto automáticamente?`);
        if (confirmar && data.sugerencia_operativo_conjunto) {
          await fetch(`${API_URL}/api/operativos-conjuntos?solicitud_batea_id=${data.sugerencia_operativo_conjunto.batea_id}&desmalezado_id=${data.id}`, { method:"POST" });
          alert("✅ Operativo Conjunto creado exitosamente");
        }
      }
      onGuardar(data);
    } catch { alert("❌ Error de conexión"); }
    setGuardando(false);
  };
  return (
    <Modal titulo="🌿 Nuevo Desmalezado" color={C.verde} onClose={onClose}>
      {vecinoPrelleno && (
        <div style={{ background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:10, padding:"10px 14px", display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:18 }}>✅</span>
          <div style={{ fontSize:13, color:C.verde }}>
            <strong>Datos prellenados</strong> desde la solicitud de batea de <strong>{vecinoPrelleno.nombre_vecino}</strong> — revisa y ajusta si es necesario.
          </div>
        </div>
      )}
      <div style={{ background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.verde }}>
        💡 Solo la <strong>dirección</strong> es obligatoria. Las coordenadas y fotos las puedes agregar después con <strong>✏️ Editar</strong>.
      </div>
      <CheckboxEmergencia checked={form.es_emergencia} onChange={v=>set("es_emergencia",v)} />
      <SeccionForm titulo="📋 Datos del Registro" color={C.verde}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Nombre / Referencia">
            <input style={inp} value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Nombre o referencia interna" />
          </Field>
          <Field label="RUT">
            <input style={inp} value={form.rut} onChange={e=>set("rut",e.target.value)} placeholder="12.345.678-9 (opcional)" />
          </Field>
          <Field label="Teléfono">
            <input style={inp} value={form.telefono} onChange={e=>set("telefono",e.target.value)} placeholder="+56912345678 (opcional)" />
          </Field>
          <Field label="Tipo de registro">
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0", cursor:"pointer" }}>
              <input type="checkbox" checked={form.es_recordatorio} onChange={e=>set("es_recordatorio",e.target.checked)} />
              <span style={{ fontSize:14 }}>Recordatorio interno</span>
            </div>
          </Field>
          <Field label="Dirección / Ubicación" required error={errores.direccion}>
            <input style={{...inp, borderColor:errores.direccion?C.rojo:"#DDD"}} value={form.direccion} onChange={e=>set("direccion",e.target.value)} placeholder="Ubicación del desmalezado" />
          </Field>
          <Field label="Descripción">
            <input style={inp} value={form.descripcion} onChange={e=>set("descripcion",e.target.value)} placeholder="Tipo de vegetación, tamaño..." />
          </Field>
          <div style={{ gridColumn:"1/-1" }}>
            <Field label="Observaciones">
              <textarea style={{...inp, minHeight:60, resize:"vertical"}} value={form.observaciones} onChange={e=>set("observaciones",e.target.value)} placeholder="Información adicional..." />
            </Field>
          </div>
        </div>
      </SeccionForm>
      <div style={{ background:"#F0F7FF", borderRadius:10, padding:16, border:"1px solid #BBDEFB" }}>
        <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.azul }}>📍 Georreferencia <span style={{ fontWeight:400, color:"#888", fontSize:11 }}>(opcional)</span></h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Latitud">
            <input style={{...inp, fontFamily:"monospace"}} value={form.latitud} onChange={e=>set("latitud",e.target.value)} placeholder="-33.0458 (opcional)" type="number" step="any" />
          </Field>
          <Field label="Longitud">
            <input style={{...inp, fontFamily:"monospace"}} value={form.longitud} onChange={e=>set("longitud",e.target.value)} placeholder="-71.6197 (opcional)" type="number" step="any" />
          </Field>
        </div>
      </div>
      <MultiFotoUploader label="📷 Fotos ANTES del desmalezado — máx 5, opcional" fotos={fotosAntes} setFotos={setFotosAntes} />
      <div style={{ background:"#E8F5E9", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.verde }}>
        🔧 Si hay una batea pendiente a menos de 100m, el sistema sugerirá crear un Operativo Conjunto automáticamente.
      </div>
      <BotonesModal onClose={onClose} onGuardar={handleGuardar} guardando={guardando} subiendo={false} />
    </Modal>
  );
}
function ModalCamino({ onClose, onGuardar, vecinoPrelleno }) {
  const [form, setForm] = useState({
    nombre: vecinoPrelleno?.nombre_vecino || "",
    rut: vecinoPrelleno?.rut && vecinoPrelleno.rut !== "SIN-RUT" ? vecinoPrelleno.rut : "",
    telefono: vecinoPrelleno?.telefono || "",
    es_recordatorio: false,
    direccion: vecinoPrelleno?.direccion && vecinoPrelleno.direccion !== "Sin dirección" ? vecinoPrelleno.direccion : "",
    tipo_camino: "camino", descripcion_problema: "", observaciones: "",
    prioridad: "normal",
    latitud: vecinoPrelleno?.latitud || "",
    longitud: vecinoPrelleno?.longitud || "",
    es_emergencia: false
  });
  const [fotosAntes, setFotosAntes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const validar = () => {
    const e = {};
    if (!form.direccion.trim()) e.direccion="Al menos la dirección es necesaria";
    setErrores(e); return Object.keys(e).length===0;
  };
  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const lat = form.latitud && !isNaN(parseFloat(form.latitud)) ? parseFloat(form.latitud) : null;
      const lon = form.longitud && !isNaN(parseFloat(form.longitud)) ? parseFloat(form.longitud) : null;
      const res = await fetch(`${API_URL}/api/caminos`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nombre_solicitante:form.nombre, rut:form.rut||"SIN-RUT", telefono:form.telefono, es_recordatorio:form.es_recordatorio, direccion:form.direccion, tipo_camino:form.tipo_camino, descripcion_problema:form.descripcion_problema, observaciones:form.observaciones, prioridad:form.es_emergencia?"urgente":form.prioridad, latitud:lat, longitud:lon, fotos_antes:fotosAntes, es_emergencia:form.es_emergencia })
      });
      const data = await res.json();
      if (!res.ok) { alert("❌ "+(data.detail||"Error")); setGuardando(false); return; }
      onGuardar(data);
    } catch { alert("❌ Error de conexión"); }
    setGuardando(false);
  };
  return (
    <Modal titulo="🛤️ Nuevo Arreglo de Camino" color={C.naranja} onClose={onClose}>
      {vecinoPrelleno && (
        <div style={{ background:"#FFF3E0", border:"1px solid #FFCC80", borderRadius:10, padding:"10px 14px", display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:18 }}>✅</span>
          <div style={{ fontSize:13, color:C.naranja }}>
            <strong>Datos prellenados</strong> desde la solicitud de batea de <strong>{vecinoPrelleno.nombre_vecino}</strong> — revisa y ajusta si es necesario.
          </div>
        </div>
      )}
      <div style={{ background:"#FFF3E0", border:"1px solid #FFCC80", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.naranja }}>
        💡 Solo la <strong>dirección</strong> es obligatoria. Completa el resto después con ✏️ Editar.
      </div>
      <CheckboxEmergencia checked={form.es_emergencia} onChange={v=>set("es_emergencia",v)} />
      <SeccionForm titulo="📋 Datos del Registro" color={C.naranja}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Nombre / Referencia">
            <input style={inp} value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Nombre o referencia interna" />
          </Field>
          <Field label="RUT">
            <input style={inp} value={form.rut} onChange={e=>set("rut",e.target.value)} placeholder="12.345.678-9 (opcional)" />
          </Field>
          <Field label="Teléfono">
            <input style={inp} value={form.telefono} onChange={e=>set("telefono",e.target.value)} placeholder="+56912345678 (opcional)" />
          </Field>
          <Field label="Tipo de registro">
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0", cursor:"pointer" }}>
              <input type="checkbox" checked={form.es_recordatorio} onChange={e=>set("es_recordatorio",e.target.checked)} />
              <span style={{ fontSize:14 }}>Recordatorio interno</span>
            </div>
          </Field>
          <Field label="Dirección / Ubicación" required error={errores.direccion}>
            <input style={{...inp, borderColor:errores.direccion?C.rojo:"#DDD"}} value={form.direccion} onChange={e=>set("direccion",e.target.value)} placeholder="Nombre del pasaje, calle o camino" />
          </Field>
          <Field label="Tipo de vía">
            <select style={inp} value={form.tipo_camino} onChange={e=>set("tipo_camino",e.target.value)}>
              <option value="camino">Camino</option>
              <option value="pasaje">Pasaje</option>
              <option value="escalera">Escalera</option>
              <option value="calle">Calle</option>
              <option value="acceso">Acceso vehicular</option>
            </select>
          </Field>
          <Field label="Prioridad">
            <select style={inp} value={form.prioridad} onChange={e=>set("prioridad",e.target.value)} disabled={form.es_emergencia}>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </Field>
          <Field label="Descripción del problema">
            <input style={inp} value={form.descripcion_problema} onChange={e=>set("descripcion_problema",e.target.value)} placeholder="Bache, derrumbe, erosión..." />
          </Field>
          <div style={{ gridColumn:"1/-1" }}>
            <Field label="Observaciones">
              <textarea style={{...inp, minHeight:60, resize:"vertical"}} value={form.observaciones} onChange={e=>set("observaciones",e.target.value)} placeholder="Información adicional..." />
            </Field>
          </div>
        </div>
      </SeccionForm>
      <div style={{ background:"#F0F7FF", borderRadius:10, padding:16, border:"1px solid #BBDEFB" }}>
        <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.azul }}>📍 Georreferencia <span style={{ fontWeight:400, color:"#888", fontSize:11 }}>(opcional)</span></h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Latitud">
            <input style={{...inp, fontFamily:"monospace"}} value={form.latitud} onChange={e=>set("latitud",e.target.value)} placeholder="-33.0458 (opcional)" type="number" step="any" />
          </Field>
          <Field label="Longitud">
            <input style={{...inp, fontFamily:"monospace"}} value={form.longitud} onChange={e=>set("longitud",e.target.value)} placeholder="-71.6197 (opcional)" type="number" step="any" />
          </Field>
        </div>
      </div>
      <MultiFotoUploader label="📷 Fotos ANTES del arreglo — máx 5, opcional" fotos={fotosAntes} setFotos={setFotosAntes} />
      <div style={{ background:"#FFF3E0", border:"1px solid #FFCC80", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.naranja }}>
        💡 Solo la dirección es obligatoria. Completa el resto después con ✏️ Editar.
      </div>
      <BotonesModal onClose={onClose} onGuardar={handleGuardar} guardando={guardando} subiendo={false} />
    </Modal>
  );
}
function Sidebar({ activeView, setActiveView }) {
  const items = [
    { id:"dashboard",    icon:"📊", label:"Dashboard"        },
    { id:"visitas",      icon:"🧭", label:"Visitas Técnicas" },
    { id:"bateas",       icon:"🗑️", label:"Bateas"           },
    { id:"desmalezados", icon:"🌿", label:"Desmalezados"     },
    { id:"caminos",      icon:"🛤️", label:"Arreglo Caminos"  },
    { id:"operativos",   icon:"🔧", label:"Op. Conjuntos"    },
    { id:"op_central",   icon:"🏛️", label:"Op. Central"      },
    { id:"mapa",         icon:"🗺️", label:"Mapa Operacional" },
    { id:"alertas",      icon:"🔔", label:"Alertas"          },
    { id:"reportes",     icon:"📄", label:"Reportes"         },
  ];
  return (
    <div style={{ width:220, minHeight:"100vh", background:"#0D2137", display:"flex", flexDirection:"column", flexShrink:0 }}>
      <div style={{ padding:"22px 20px 18px", borderBottom:"1px solid #1E3A5F" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, background:C.azulC, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🗑️</div>
          <div>
            <div style={{ color:"#FFF", fontWeight:700, fontSize:15 }}>BateaControl</div>
            <div style={{ color:"#7FB3D3", fontSize:11 }}>Sistema Municipal v2</div>
          </div>
        </div>
      </div>
      <nav style={{ padding:"10px 8px", flex:1 }}>
        {items.map(item => (
          <button key={item.id} onClick={() => setActiveView(item.id)} style={{
            width:"100%", display:"flex", alignItems:"center", gap:10,
            padding:"9px 14px", margin:"2px 0", borderRadius:8,
            background: activeView===item.id ? "rgba(25,118,210,0.3)" : "transparent",
            border: activeView===item.id ? "1px solid rgba(25,118,210,0.5)" : "1px solid transparent",
            color: activeView===item.id ? "#90CAF9" : "#B0C4DE",
            cursor:"pointer", textAlign:"left", fontSize:13,
            fontWeight: activeView===item.id ? 600 : 400,
          }}>
            <span style={{ fontSize:16 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding:"14px 20px", borderTop:"1px solid #1E3A5F" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:C.azulC, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#FFF", fontWeight:700 }}>A</div>
          <div>
            <div style={{ color:"#FFF", fontSize:12, fontWeight:600 }}>Administrador</div>
            <div style={{ color:"#7FB3D3", fontSize:10 }}>admin@municipio.cl</div>
          </div>
        </div>
      </div>
    </div>
  );
}
function TablaGenerica({ columnas, filas, total }) {
  return (
    <div style={{ background:C.blanco, borderRadius:12, border:"1px solid #E0E0E0", overflow:"hidden" }}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFE" }}>
              {columnas.map(h => <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:12, fontWeight:600, color:"#555", borderBottom:"1px solid #E0E0E0", whiteSpace:"nowrap" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.length===0 ? (
              <tr><td colSpan={columnas.length} style={{ padding:40, textAlign:"center", color:"#888", fontSize:14 }}>No hay registros</td></tr>
            ) : filas.map(fila => (
              <tr key={fila.key} style={{ background:fila.critica?"#FFFAFA":fila.par?"#FFF":"#FAFAFA", borderBottom:"1px solid #F0F0F0", borderLeft:fila.critica?`3px solid ${C.rojo}`:"3px solid transparent" }}>
                {fila.celdas.map((celda,i) => <td key={i} style={{ padding:"9px 14px" }}>{celda}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding:"10px 20px", borderTop:"1px solid #E0E0E0", fontSize:12, color:"#888" }}>{filas.length} de {total} registros</div>
    </div>
  );
}
// ── DASHBOARD — SOLO VISUALIZACIÓN ───────────────────────────────────────────
function ViewDashboard({ kpis, stats }) {
  const s = stats || {};
  const b = s.bateas || {};
  const d = s.desmalezados || {};
  const c = s.caminos || {};
  const oc = s.op_conjuntos || {};
  const oce = s.op_centrales || {};
  const totalEmergencias = s.total_emergencias || 0;
  const StatCard = ({ label, value, icon, color, bg, sub }) => (
    <div style={{ background:"#FFF", borderRadius:12, padding:"16px 18px", borderLeft:`4px solid ${color}`, border:`1px solid #E8E8E8`, borderLeftWidth:4 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:600, color:"#888", textTransform:"uppercase", letterSpacing:.5 }}>{label}</span>
        <span style={{ fontSize:22, background:bg, borderRadius:8, padding:"3px 7px" }}>{icon}</span>
      </div>
      <div style={{ fontSize:34, fontWeight:800, color, lineHeight:1 }}>{value ?? 0}</div>
      {sub && <div style={{ fontSize:11, color:"#888", marginTop:4 }}>{sub}</div>}
    </div>
  );
  const MiniStat = ({ label, value, color }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #F5F5F5" }}>
      <span style={{ fontSize:13, color:"#555" }}>{label}</span>
      <span style={{ fontSize:15, fontWeight:700, color }}>{value ?? 0}</span>
    </div>
  );
  const SeccionStats = ({ emoji, titulo, color, bg, children }) => (
    <div style={{ background:"#FFF", borderRadius:12, border:"1px solid #E8E8E8", overflow:"hidden" }}>
      <div style={{ padding:"11px 18px", background:bg, borderBottom:`2px solid ${color}`, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:17 }}>{emoji}</span>
        <span style={{ fontSize:13, fontWeight:700, color }}>{titulo}</span>
      </div>
      <div style={{ padding:"8px 18px 14px" }}>{children}</div>
    </div>
  );
  return (
    <div style={{ padding:28, background:C.fondo, minHeight:"100vh" }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>Panel de Control Municipal</h1>
        <p style={{ margin:"4px 0 0", color:"#666", fontSize:14 }}>
          {new Date().toLocaleDateString("es-CL",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
        </p>
      </div>
      {totalEmergencias > 0 && (
        <div style={{ background:"#C62828", color:"#FFF", borderRadius:12, padding:"14px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:28 }}>🚨</span>
          <div>
            <div style={{ fontWeight:800, fontSize:16 }}>{totalEmergencias} solicitud(es) de EMERGENCIA pendiente(s)</div>
            <div style={{ fontSize:12, opacity:.9 }}>Requieren atención inmediata — revisa Bateas, Desmalezados y Arreglo de Caminos.</div>
          </div>
        </div>
      )}
      {/* Tarjetas grandes resumen */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        <StatCard label="Total Realizados" value={s.total_realizados} icon="✅" color="#1B5E20" bg="#E8F5E9" sub="Todos los servicios" />
        <StatCard label="Bateas Asignadas" value={(b.instaladas||0)+(b.completadas||0)+(b.asignadas||0)} icon="🗑️" color={C.azul} bg={C.azulS} sub={`de ${b.total||0} solicitadas`} />
        <StatCard label="Registros Este Mes" value={(b.este_mes||0)+(d.este_mes||0)+(c.este_mes||0)} icon="📅" color={C.morado} bg={C.moradoS} sub="Bateas+Desm.+Caminos" />
        <StatCard label="Emergencias Activas" value={totalEmergencias} icon="🚨" color={C.rojo} bg={C.rojoS} sub="Prioridad inmediata" />
      </div>
      {/* Grid estadísticas por servicio */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
        <SeccionStats emoji="🗑️" titulo="Bateas Comunitarias" color={C.azul} bg={C.azulS}>
          <MiniStat label="Total solicitudes" value={b.total} color={C.azul} />
          <MiniStat label="Pendientes" value={b.pendientes} color="#999" />
          <MiniStat label="Asignadas" value={b.asignadas} color={C.naranja} />
          <MiniStat label="Instaladas / Completadas" value={(b.instaladas||0)+(b.completadas||0)} color={C.verde} />
          <MiniStat label="Registradas este mes" value={b.este_mes} color={C.azul} />
          <MiniStat label="🚨 Emergencias" value={b.emergencias} color={C.rojo} />
        </SeccionStats>
        <SeccionStats emoji="🌿" titulo="Desmalezados" color={C.verde} bg={C.verdeS}>
          <MiniStat label="Total registrados" value={d.total} color={C.verde} />
          <MiniStat label="Pendientes" value={d.pendientes} color="#999" />
          <MiniStat label="Asignados" value={d.asignados} color={C.naranja} />
          <MiniStat label="Completados" value={d.completados} color={C.verde} />
          <MiniStat label="Registrados este mes" value={d.este_mes} color={C.verde} />
          <MiniStat label="🚨 Emergencias" value={d.emergencias} color={C.rojo} />
        </SeccionStats>
        <SeccionStats emoji="🛤️" titulo="Arreglo de Caminos" color={C.naranja} bg={C.naranjaS}>
          <MiniStat label="Total registrados" value={c.total} color={C.naranja} />
          <MiniStat label="Pendientes" value={c.pendientes} color="#999" />
          <MiniStat label="Asignados" value={c.asignados} color={C.azul} />
          <MiniStat label="Completados" value={c.completados} color={C.verde} />
          <MiniStat label="Registrados este mes" value={c.este_mes} color={C.naranja} />
          <MiniStat label="🚨 Emergencias" value={c.emergencias} color={C.rojo} />
        </SeccionStats>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <SeccionStats emoji="🔧" titulo="Operativos Conjuntos" color={C.morado} bg={C.moradoS}>
            <MiniStat label="Total creados" value={oc.total} color={C.morado} />
            <MiniStat label="Planificados" value={oc.planificados} color={C.azul} />
            <MiniStat label="Completados" value={oc.completados} color={C.verde} />
            <MiniStat label="Este mes" value={oc.este_mes} color={C.morado} />
          </SeccionStats>
          <SeccionStats emoji="🏛️" titulo="Operativos Centrales" color="#1B5E20" bg="#E8F5E9">
            <MiniStat label="Total registrados" value={oce.total} color="#1B5E20" />
            <MiniStat label="En ejecución" value={oce.en_ejecucion} color={C.naranja} />
            <MiniStat label="Completados" value={oce.completados} color={C.verde} />
            <MiniStat label="Este mes" value={oce.este_mes} color="#1B5E20" />
            <MiniStat label="🚨 Emergencias" value={oce.emergencias} color={C.rojo} />
          </SeccionStats>
        </div>
      </div>
      {/* Resumen ejecutivo */}
      <div style={{ background:"#FFF", borderRadius:12, border:"1px solid #E8E8E8", padding:"18px 22px" }}>
        <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:"#333" }}>📊 Resumen Ejecutivo — A la fecha</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
          {[
            { label:"Bateas asignadas",        value:(b.instaladas||0)+(b.completadas||0)+(b.asignadas||0), icon:"🗑️", color:C.azul },
            { label:"Desmalezados realizados",  value:d.completados, icon:"🌿", color:C.verde },
            { label:"Caminos arreglados",       value:c.completados, icon:"🛤️", color:C.naranja },
            { label:"Op. Conjuntos realizados", value:oc.completados, icon:"🔧", color:C.morado },
            { label:"Op. Centrales realizados", value:oce.completados, icon:"🏛️", color:"#1B5E20" },
          ].map(item => (
            <div key={item.label} style={{ textAlign:"center", padding:"14px 8px", background:C.fondo, borderRadius:10 }}>
              <div style={{ fontSize:26 }}>{item.icon}</div>
              <div style={{ fontSize:30, fontWeight:800, color:item.color, margin:"6px 0 4px" }}>{item.value ?? 0}</div>
              <div style={{ fontSize:11, color:"#666", lineHeight:1.3 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function ViewBateas({ solicitudes, onNueva, loading, onAsignarBatea, clustering, onRecargar }) {
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState(null); // registro seleccionado para editar
  const filtradas = solicitudes.filter(s => {
    const mE = filtro==="todos"||s.estado===filtro;
    const mB = busqueda===""||[s.nombre_vecino,s.direccion,s.folio,s.rut].some(v=>(v||"").toLowerCase().includes(busqueda.toLowerCase()));
    return mE&&mB;
  });
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🗑️ Solicitudes de Batea</h1>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onAsignarBatea} disabled={clustering} style={{ background:clustering?"#888":C.azul, color:"#FFF", border:"none", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:clustering?"not-allowed":"pointer" }}>
            {clustering?"⏳ Procesando...":"🗑️ ASIGNAR BATEA"}
          </button>
          <button onClick={onNueva} style={{ background:C.azulS, color:C.azul, border:`1px solid ${C.azul}33`, borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Nueva</button>
        </div>
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        <input placeholder="🔍 Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={{ flex:1, padding:"10px 14px", borderRadius:8, border:"1px solid #DDD", fontSize:14, outline:"none" }} />
        <select value={filtro} onChange={e=>setFiltro(e.target.value)} style={{ padding:"10px 14px", borderRadius:8, border:"1px solid #DDD", fontSize:14, background:"#FFF", cursor:"pointer" }}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando...</div> : (
        <TablaGenerica
          columnas={["Folio","Vecino","Dirección","Coords","Estado","Alerta","Días","Fotos","Acción"]}
          filas={filtradas.map((s,i) => ({
            key:s.id, critica:s.nivel_alerta==="critica"||s.es_emergencia, par:i%2===0,
            celdas:[
              <span style={{ fontFamily:"monospace", color:C.azul, fontWeight:600, fontSize:12 }}>{s.folio}</span>,
              <span>{s.nombre_vecino}
                {s.es_emergencia&&<span style={{ marginLeft:6 }}><EmergenciaBadge small /></span>}
                {s.tuvo_batea_antes&&<span style={{ marginLeft:6, fontSize:10, background:"#FFF3E0", color:"#E65100", padding:"1px 6px", borderRadius:10 }}>⚠ historial</span>}
                {(!s.latitud || s.rut==="SIN-RUT" || s.direccion==="Sin dirección") && <span style={{ marginLeft:6, fontSize:10, background:"#FFF3E0", color:"#E65100", padding:"1px 6px", borderRadius:10 }}>⚠ incompleto</span>}
              </span>,
              <span style={{ fontSize:12, color:"#666" }}>{s.direccion}</span>,
              <span style={{ fontSize:11, color:"#888", fontFamily:"monospace" }}>{parseFloat(s.latitud||0).toFixed(4)}, {parseFloat(s.longitud||0).toFixed(4)}</span>,
              <Badge estado={s.estado} small />,
              <Badge alerta={s.nivel_alerta} small />,
              <span style={{ fontWeight:700, color:s.dias_pendiente>=20?C.rojo:s.dias_pendiente>=11?C.naranja:C.verde }}>{s.dias_pendiente}d</span>,
              <div style={{ display:"flex", gap:4 }}>
                {(s.fotos_antes||[]).slice(0,3).map((url,i)=>(
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="foto" style={{ width:28,height:28,objectFit:"cover",borderRadius:4,border:"1px solid #DDD" }} />
                  </a>
                ))}
                {!(s.fotos_antes?.length) && <span style={{ fontSize:11, color:"#CCC" }}>Sin fotos</span>}
              </div>,
              <BotonesAccion
                id={s.id} endpoint="solicitudes" estado={s.estado} color={C.azul}
                labelAsignar="🗑️ Asignar"
                onAsignar={onAsignarBatea}
                onEditar={()=>setEditando(s)}
                onRecargar={onRecargar}
              />
            ]
          }))}
          total={solicitudes.length}
        />
      )}
      {editando && (
        <ModalEditar tipo="batea" registro={editando}
          onClose={()=>setEditando(null)}
          onGuardar={()=>{ setEditando(null); window.location.reload(); }} />
      )}
    </div>
  );
}
// ── MODAL EDITAR REGISTRO (universal para bateas, desmalezados y caminos) ─────
// ── MODAL NUEVA VISITA TÉCNICA ───────────────────────────────────────────────
function ModalVisita({ onClose, onGuardar }) {
  const [form, setForm] = useState({
    nombre_vecino: "", rut: "", telefono: "", direccion: "",
    motivo: "", observaciones: "",
    latitud: "", longitud: "",
    es_emergencia: false
  });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const validar = () => {
    const e = {};
    if (!form.nombre_vecino.trim()) e.nombre_vecino="El nombre del vecino es obligatorio";
    if (!form.direccion.trim()) e.direccion="La dirección es necesaria para ubicar la visita";
    if (!form.motivo.trim()) e.motivo="Indica qué está solicitando el vecino";
    setErrores(e); return Object.keys(e).length===0;
  };
  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const lat = form.latitud && !isNaN(parseFloat(form.latitud)) ? parseFloat(form.latitud) : null;
      const lon = form.longitud && !isNaN(parseFloat(form.longitud)) ? parseFloat(form.longitud) : null;
      const res = await fetch(`${API_URL}/api/visitas`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nombre_vecino:form.nombre_vecino, rut:form.rut||"SIN-RUT", telefono:form.telefono, direccion:form.direccion, motivo:form.motivo, observaciones:form.observaciones, latitud:lat, longitud:lon, es_emergencia:form.es_emergencia })
      });
      const data = await res.json();
      if (!res.ok) { alert("❌ "+(data.detail||"Error")); setGuardando(false); return; }
      onGuardar(data);
    } catch { alert("❌ Error de conexión"); }
    setGuardando(false);
  };
  return (
    <Modal titulo="🧭 Nueva Visita Técnica" color={C.morado} onClose={onClose}>
      <div style={{ background:"#F3E5F5", border:"1px solid #E1BEE7", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.morado }}>
        💡 Usa esta opción cuando antes de crear una solicitud (batea, desmalezado, arreglo de camino, etc.) se necesita ir primero a inspeccionar en terreno.
      </div>
      <CheckboxEmergencia checked={form.es_emergencia} onChange={v=>set("es_emergencia",v)} />
      <SeccionForm titulo="📋 Datos del Vecino" color={C.morado}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Nombre completo" required error={errores.nombre_vecino}>
            <input style={{...inp, borderColor:errores.nombre_vecino?C.rojo:"#DDD"}} value={form.nombre_vecino} onChange={e=>set("nombre_vecino",e.target.value)} placeholder="Nombre del vecino" />
          </Field>
          <Field label="RUT">
            <input style={inp} value={form.rut} onChange={e=>set("rut",e.target.value)} placeholder="12.345.678-9 (opcional)" />
          </Field>
          <Field label="Teléfono">
            <input style={inp} value={form.telefono} onChange={e=>set("telefono",e.target.value)} placeholder="+56912345678 (opcional)" />
          </Field>
          <Field label="Dirección" required error={errores.direccion}>
            <input style={{...inp, borderColor:errores.direccion?C.rojo:"#DDD"}} value={form.direccion} onChange={e=>set("direccion",e.target.value)} placeholder="Dirección a visitar" />
          </Field>
          <div style={{ gridColumn:"1/-1" }}>
            <Field label="¿Qué está solicitando el vecino?" required error={errores.motivo}>
              <textarea style={{...inp, minHeight:60, resize:"vertical", borderColor:errores.motivo?C.rojo:"#DDD"}} value={form.motivo} onChange={e=>set("motivo",e.target.value)} placeholder="Ej: solicita batea comunitaria, necesita desmalezado, problema en el camino de acceso..." />
            </Field>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <Field label="Observaciones">
              <textarea style={{...inp, minHeight:50, resize:"vertical"}} value={form.observaciones} onChange={e=>set("observaciones",e.target.value)} placeholder="Información adicional..." />
            </Field>
          </div>
        </div>
      </SeccionForm>
      <div style={{ background:"#F0F7FF", borderRadius:10, padding:16, border:"1px solid #BBDEFB" }}>
        <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.azul }}>📍 Georreferencia <span style={{ fontWeight:400, color:"#888", fontSize:11 }}>(opcional)</span></h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Latitud">
            <input style={{...inp, fontFamily:"monospace"}} value={form.latitud} onChange={e=>set("latitud",e.target.value)} placeholder="-33.0458 (opcional)" type="number" step="any" />
          </Field>
          <Field label="Longitud">
            <input style={{...inp, fontFamily:"monospace"}} value={form.longitud} onChange={e=>set("longitud",e.target.value)} placeholder="-71.6197 (opcional)" type="number" step="any" />
          </Field>
        </div>
      </div>
      <div style={{ background:"#F3E5F5", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.morado }}>
        📅 Una vez ingresada, agenda la fecha de la visita desde el botón <strong>"Agendar Visita"</strong> en el listado.
      </div>
      <BotonesModal onClose={onClose} onGuardar={handleGuardar} guardando={guardando} subiendo={false} />
    </Modal>
  );
}
// ── MODAL AGENDAR VISITA ──────────────────────────────────────────────────────
function ModalAsignarVisita({ onClose, onConfirmar }) {
  const hoy = new Date().toISOString().split("T")[0];
  const [fechaVisita, setFechaVisita] = useState(hoy);
  const [responsable, setResponsable] = useState("");
  const [guardando, setGuardando] = useState(false);
  const handleConfirmar = async () => {
    setGuardando(true);
    await onConfirmar(fechaVisita, responsable);
    setGuardando(false);
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:460, boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"18px 24px", background:C.morado, borderRadius:"16px 16px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:16, fontWeight:700 }}>🧭 Agendar Visita</h2>
            <p style={{ margin:"2px 0 0", color:"rgba(255,255,255,0.8)", fontSize:12 }}>Elige la fecha y quién realizará la inspección</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:22, display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>👷 Responsable de la visita</label>
            <input value={responsable} onChange={e=>setResponsable(e.target.value)}
              placeholder="Nombre del inspector o cuadrilla"
              style={{ padding:"10px 14px", borderRadius:8, border:`2px solid ${C.morado}`, fontSize:14, outline:"none", background:"#FFF", width:"100%", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>📅 Fecha de la visita</label>
            <input type="date" value={fechaVisita} min={hoy}
              onChange={e=>setFechaVisita(e.target.value)}
              style={{ padding:"10px 14px", borderRadius:8, border:`2px solid ${C.morado}`, fontSize:14, outline:"none", color:C.morado, fontWeight:600, cursor:"pointer" }} />
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"9px 22px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:13, cursor:"pointer" }}>Cancelar</button>
            <button onClick={handleConfirmar} disabled={guardando} style={{
              padding:"9px 22px", borderRadius:8, border:"none",
              background:guardando?"#888":C.morado, color:"#FFF", fontSize:13, fontWeight:700,
              cursor:guardando?"not-allowed":"pointer"
            }}>
              {guardando ? "⏳ Guardando..." : "✅ Confirmar Fecha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── VISTA VISITAS TÉCNICAS ────────────────────────────────────────────────────
function ViewVisitas({ visitas, onNueva, loading, onRecargar }) {
  const [modalAsignarId, setModalAsignarId] = useState(null);
  const [editando, setEditando] = useState(null);
  const handleAsignar = async (fechaVisita, responsable) => {
    try {
      const res = await fetch(`${API_URL}/api/visitas/${modalAsignarId}/asignar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fecha_visita:fechaVisita, responsable })
      });
      const data = await res.json();
      if (res.ok) { alert(`✅ ${data.mensaje}`); setModalAsignarId(null); onRecargar(); }
      else alert("❌ " + (data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🧭 Visitas Técnicas</h1>
        <button onClick={onNueva} style={{ background:C.morado, color:"#FFF", border:"none", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Nueva Visita</button>
      </div>
      <div style={{ background:"#F3E5F5", border:"1px solid #E1BEE7", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.morado, marginBottom:18 }}>
        💡 Registra aquí las solicitudes que requieren una inspección en terreno antes de crear la solicitud definitiva de batea, desmalezado o arreglo de camino.
      </div>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando...</div> : (
        <TablaGenerica
          columnas={["Folio","Vecino","Dirección","Motivo","F. Solicitud","F. Visita","Responsable","Estado","Acción"]}
          filas={visitas.map((v,i) => ({
            key:v.id, critica:!!v.es_emergencia, par:i%2===0,
            celdas:[
              <span style={{ fontFamily:"monospace", color:C.morado, fontWeight:600, fontSize:12 }}>{v.folio}</span>,
              <span style={{ fontSize:12 }}>{v.nombre_vecino}
                {v.es_emergencia&&<span style={{ marginLeft:6 }}><EmergenciaBadge small /></span>}
              </span>,
              <span style={{ fontSize:12, color:"#666" }}>{v.direccion}</span>,
              <span style={{ fontSize:12, color:"#555", maxWidth:220, display:"inline-block" }}>{v.motivo}</span>,
              <span style={{ fontSize:12, color:"#666" }}>{v.fecha_solicitud}</span>,
              <span style={{ fontSize:12, color:C.morado, fontWeight:600 }}>{v.fecha_visita||"—"}</span>,
              <span style={{ fontSize:12, color:"#555" }}>{v.responsable||"—"}</span>,
              <Badge estado={v.estado} small />,
              <BotonesAccion
                id={v.id} endpoint="visitas" estado={v.estado} color={C.morado}
                labelAsignar="🧭 Agendar Visita"
                onAsignar={()=>setModalAsignarId(v.id)}
                onEditar={()=>setEditando(v)}
                onRecargar={onRecargar}
              />
            ]
          }))}
          total={visitas.length}
        />
      )}
      {modalAsignarId && (
        <ModalAsignarVisita onClose={()=>setModalAsignarId(null)} onConfirmar={handleAsignar} />
      )}
      {editando && (
        <ModalEditar tipo="visita" registro={editando}
          onClose={()=>setEditando(null)}
          onGuardar={()=>{ setEditando(null); onRecargar(); }} />
      )}
    </div>
  );
}
function ModalEditar({ tipo, registro, onClose, onGuardar }) {
  const [form, setForm] = useState({ ...registro });
  const [fotosAntes, setFotosAntes] = useState(registro.fotos_antes || []);
  const [guardando, setGuardando] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const endpointMap = { batea:"solicitudes", desmalezado:"desmalezados", camino:"caminos", visita:"visitas" };
  const colorMap = { batea:C.azul, desmalezado:C.verde, camino:C.naranja, visita:C.morado };
  const tituloMap = { batea:"✏️ Editar Solicitud de Batea", desmalezado:"✏️ Editar Desmalezado", camino:"✏️ Editar Arreglo de Camino", visita:"✏️ Editar Visita Técnica" };
  const color = colorMap[tipo] || C.azul;
  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const endpoint = endpointMap[tipo];
      const body = tipo === "batea"
        ? { nombre_vecino:form.nombre_vecino, rut:form.rut, direccion:form.direccion, telefono:form.telefono, latitud:parseFloat(form.latitud)||0, longitud:parseFloat(form.longitud)||0, observaciones:form.observaciones, fotos_antes:fotosAntes, es_emergencia:!!form.es_emergencia }
        : tipo === "desmalezado"
        ? { nombre_solicitante:form.nombre_solicitante, es_recordatorio:form.es_recordatorio, direccion:form.direccion, descripcion:form.descripcion, latitud:parseFloat(form.latitud)||0, longitud:parseFloat(form.longitud)||0, fotos_antes:fotosAntes, es_emergencia:!!form.es_emergencia }
        : tipo === "camino"
        ? { nombre_solicitante:form.nombre_solicitante, es_recordatorio:form.es_recordatorio, direccion:form.direccion, tipo_camino:form.tipo_camino, descripcion_problema:form.descripcion_problema, prioridad:form.es_emergencia?"urgente":form.prioridad, latitud:parseFloat(form.latitud)||0, longitud:parseFloat(form.longitud)||0, fotos_antes:fotosAntes, es_emergencia:!!form.es_emergencia }
        : { nombre_vecino:form.nombre_vecino, rut:form.rut, telefono:form.telefono, direccion:form.direccion, motivo:form.motivo, observaciones:form.observaciones, latitud:parseFloat(form.latitud)||0, longitud:parseFloat(form.longitud)||0, es_emergencia:!!form.es_emergencia };
      const res = await fetch(`${API_URL}/api/${endpoint}/${registro.id}/editar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) { alert("✅ Registro actualizado correctamente"); onGuardar(); }
      else alert("❌ " + (data.detail||"Error al guardar"));
    } catch { alert("❌ Error de conexión"); }
    setGuardando(false);
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:620, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"18px 24px", background:color, borderRadius:"16px 16px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:16, fontWeight:700 }}>{tituloMap[tipo]}</h2>
            <p style={{ margin:"2px 0 0", color:"rgba(255,255,255,0.8)", fontSize:12 }}>Folio: {registro.folio} — Modifica solo los campos que necesitas corregir</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:22, display:"flex", flexDirection:"column", gap:14 }}>
          <CheckboxEmergencia checked={!!form.es_emergencia} onChange={v=>set("es_emergencia",v)} />
          {/* Campos específicos por tipo */}
          {tipo === "batea" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Nombre vecino" required>
                <input style={inp} value={form.nombre_vecino||""} onChange={e=>set("nombre_vecino",e.target.value)} placeholder="Nombre completo" />
              </Field>
              <Field label="RUT">
                <input style={inp} value={form.rut||""} onChange={e=>set("rut",e.target.value)} placeholder="12.345.678-9" />
              </Field>
              <Field label="Dirección" required>
                <input style={inp} value={form.direccion||""} onChange={e=>set("direccion",e.target.value)} placeholder="Dirección completa" />
              </Field>
              <Field label="Teléfono">
                <input style={inp} value={form.telefono||""} onChange={e=>set("telefono",e.target.value)} placeholder="+56912345678" />
              </Field>
              <Field label="Latitud">
                <input style={{...inp, fontFamily:"monospace"}} type="number" step="any" value={form.latitud||""} onChange={e=>set("latitud",e.target.value)} />
              </Field>
              <Field label="Longitud">
                <input style={{...inp, fontFamily:"monospace"}} type="number" step="any" value={form.longitud||""} onChange={e=>set("longitud",e.target.value)} />
              </Field>
              <div style={{ gridColumn:"1/-1" }}>
                <Field label="Observaciones">
                  <textarea style={{...inp, minHeight:60, resize:"vertical"}} value={form.observaciones||""} onChange={e=>set("observaciones",e.target.value)} />
                </Field>
              </div>
            </div>
          )}
          {tipo === "desmalezado" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Nombre / Referencia">
                <input style={inp} value={form.nombre_solicitante||""} onChange={e=>set("nombre_solicitante",e.target.value)} placeholder="Nombre o referencia" />
              </Field>
              <Field label="Tipo">
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0" }}>
                  <input type="checkbox" checked={form.es_recordatorio||false} onChange={e=>set("es_recordatorio",e.target.checked)} />
                  <span style={{ fontSize:14 }}>Recordatorio interno</span>
                </div>
              </Field>
              <Field label="Dirección" required>
                <input style={inp} value={form.direccion||""} onChange={e=>set("direccion",e.target.value)} />
              </Field>
              <Field label="Descripción">
                <input style={inp} value={form.descripcion||""} onChange={e=>set("descripcion",e.target.value)} />
              </Field>
              <Field label="Latitud">
                <input style={{...inp, fontFamily:"monospace"}} type="number" step="any" value={form.latitud||""} onChange={e=>set("latitud",e.target.value)} />
              </Field>
              <Field label="Longitud">
                <input style={{...inp, fontFamily:"monospace"}} type="number" step="any" value={form.longitud||""} onChange={e=>set("longitud",e.target.value)} />
              </Field>
            </div>
          )}
          {tipo === "camino" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Nombre / Referencia">
                <input style={inp} value={form.nombre_solicitante||""} onChange={e=>set("nombre_solicitante",e.target.value)} />
              </Field>
              <Field label="Prioridad">
                <select style={inp} value={form.prioridad||"normal"} onChange={e=>set("prioridad",e.target.value)} disabled={!!form.es_emergencia}>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </Field>
              <Field label="Dirección" required>
                <input style={inp} value={form.direccion||""} onChange={e=>set("direccion",e.target.value)} />
              </Field>
              <Field label="Tipo de vía">
                <select style={inp} value={form.tipo_camino||"camino"} onChange={e=>set("tipo_camino",e.target.value)}>
                  <option value="camino">Camino</option>
                  <option value="pasaje">Pasaje</option>
                  <option value="escalera">Escalera</option>
                  <option value="calle">Calle</option>
                  <option value="acceso">Acceso vehicular</option>
                </select>
              </Field>
              <Field label="Descripción del problema">
                <input style={inp} value={form.descripcion_problema||""} onChange={e=>set("descripcion_problema",e.target.value)} />
              </Field>
              <Field label="Tipo de registro">
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0" }}>
                  <input type="checkbox" checked={form.es_recordatorio||false} onChange={e=>set("es_recordatorio",e.target.checked)} />
                  <span style={{ fontSize:14 }}>Recordatorio interno</span>
                </div>
              </Field>
              <Field label="Latitud">
                <input style={{...inp, fontFamily:"monospace"}} type="number" step="any" value={form.latitud||""} onChange={e=>set("latitud",e.target.value)} />
              </Field>
              <Field label="Longitud">
                <input style={{...inp, fontFamily:"monospace"}} type="number" step="any" value={form.longitud||""} onChange={e=>set("longitud",e.target.value)} />
              </Field>
            </div>
          )}
          {tipo === "visita" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Nombre vecino" required>
                <input style={inp} value={form.nombre_vecino||""} onChange={e=>set("nombre_vecino",e.target.value)} placeholder="Nombre completo" />
              </Field>
              <Field label="RUT">
                <input style={inp} value={form.rut||""} onChange={e=>set("rut",e.target.value)} placeholder="12.345.678-9" />
              </Field>
              <Field label="Dirección" required>
                <input style={inp} value={form.direccion||""} onChange={e=>set("direccion",e.target.value)} placeholder="Dirección completa" />
              </Field>
              <Field label="Teléfono">
                <input style={inp} value={form.telefono||""} onChange={e=>set("telefono",e.target.value)} placeholder="+56912345678" />
              </Field>
              <Field label="Latitud">
                <input style={{...inp, fontFamily:"monospace"}} type="number" step="any" value={form.latitud||""} onChange={e=>set("latitud",e.target.value)} />
              </Field>
              <Field label="Longitud">
                <input style={{...inp, fontFamily:"monospace"}} type="number" step="any" value={form.longitud||""} onChange={e=>set("longitud",e.target.value)} />
              </Field>
              <div style={{ gridColumn:"1/-1" }}>
                <Field label="¿Qué está solicitando el vecino?">
                  <textarea style={{...inp, minHeight:60, resize:"vertical"}} value={form.motivo||""} onChange={e=>set("motivo",e.target.value)} />
                </Field>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <Field label="Observaciones">
                  <textarea style={{...inp, minHeight:50, resize:"vertical"}} value={form.observaciones||""} onChange={e=>set("observaciones",e.target.value)} />
                </Field>
              </div>
            </div>
          )}
          {/* Fotos ANTES — editables y se pueden agregar después (no aplica a Visitas) */}
          {tipo !== "visita" && (
            <div style={{ background:"#F8FAFE", borderRadius:10, padding:14, border:"1px solid #E3F2FD" }}>
              <div style={{ fontSize:13, fontWeight:700, color:color, marginBottom:10 }}>📷 Fotos ANTES — puedes agregar o eliminar</div>
              <MultiFotoUploader label="" fotos={fotosAntes} setFotos={setFotosAntes} />
            </div>
          )}
          {/* Info */}
          <div style={{ background:"#FFF3E0", border:"1px solid #FFE0B2", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.naranja }}>
            ⚠️ Solo se actualizarán los campos que modifiques. El estado, folio y fecha de solicitud no cambian.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"9px 22px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:13, cursor:"pointer" }}>Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando} style={{
              padding:"9px 22px", borderRadius:8, border:"none",
              background:guardando?"#888":color, color:"#FFF", fontSize:13, fontWeight:700, cursor:guardando?"not-allowed":"pointer"
            }}>
              {guardando ? "⏳ Guardando..." : "✅ Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── MODAL ASIGNAR DESMALEZADO / CAMINO ───────────────────────────────────────
function ModalAsignarServicio({ titulo, color, onClose, onConfirmar }) {
  const hoy = new Date().toISOString().split("T")[0];
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [diasUso, setDiasUso] = useState(3);
  const [responsable, setResponsable] = useState("");
  const opciones = [1, 2, 3, 5, 7, 10, 14, 21, 30];
  const calcFechaTermino = () => {
    const d = new Date(fechaInicio);
    d.setDate(d.getDate() + diasUso);
    return d.toLocaleDateString("es-CL");
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:500, boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"18px 24px", background:color, borderRadius:"16px 16px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:16, fontWeight:700 }}>{titulo}</h2>
            <p style={{ margin:"2px 0 0", color:"rgba(255,255,255,0.8)", fontSize:12 }}>Configure fecha y días de ejecución</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:22, display:"flex", flexDirection:"column", gap:16 }}>
          {/* Responsable */}
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>👷 Responsable / Cuadrilla</label>
            <input value={responsable} onChange={e=>setResponsable(e.target.value)}
              placeholder="Nombre del responsable o cuadrilla asignada"
              style={{ ...{padding:"10px 14px", borderRadius:8, border:`2px solid ${color}`, fontSize:14, outline:"none", background:"#FFF", width:"100%", boxSizing:"border-box"} }} />
          </div>
          {/* Fecha inicio */}
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>📅 Fecha de inicio</label>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <input type="date" value={fechaInicio} min={hoy}
                onChange={e=>setFechaInicio(e.target.value)}
                style={{ padding:"10px 14px", borderRadius:8, border:`2px solid ${color}`, fontSize:14, outline:"none", color, fontWeight:600, cursor:"pointer" }} />
              <span style={{ fontSize:12, color:"#666" }}>
                {fechaInicio===hoy ? "📌 Hoy" : `📌 Programado ${new Date(fechaInicio).toLocaleDateString("es-CL")}`}
              </span>
            </div>
          </div>
          {/* Días */}
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:14 }}>
            <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:10 }}>⏱ Días de ejecución</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:12 }}>
              {opciones.map(d => (
                <button key={d} onClick={()=>setDiasUso(d)} style={{
                  padding:"7px 13px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                  background:diasUso===d?color:"#FFF", color:diasUso===d?"#FFF":"#555",
                  border:diasUso===d?`2px solid ${color}`:"1px solid #DDD"
                }}>{d}d</button>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, color:"#555" }}>Manual:</span>
              <input type="number" min={1} max={365} value={diasUso}
                onChange={e=>setDiasUso(Math.max(1,Math.min(365,parseInt(e.target.value)||1)))}
                style={{ width:70, padding:"7px 10px", borderRadius:8, border:`2px solid ${color}`, fontSize:14, textAlign:"center", outline:"none", fontWeight:600, color }} />
              <span style={{ fontSize:13, color:"#555" }}>días</span>
            </div>
          </div>
          {/* Resumen */}
          <div style={{ background:"#F0FFF4", border:"1px solid #C8E6C9", borderRadius:10, padding:"12px 16px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, textAlign:"center" }}>
              <div style={{ background:"#FFF", borderRadius:8, padding:"8px" }}>
                <div style={{ fontSize:11, color:"#888" }}>INICIO</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.azul }}>{new Date(fechaInicio).toLocaleDateString("es-CL")}</div>
              </div>
              <div style={{ background:"#FFF", borderRadius:8, padding:"8px" }}>
                <div style={{ fontSize:11, color:"#888" }}>DURACIÓN</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.naranja }}>{diasUso} días</div>
              </div>
              <div style={{ background:"#FFF", borderRadius:8, padding:"8px" }}>
                <div style={{ fontSize:11, color:"#888" }}>TÉRMINO</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.rojo }}>{calcFechaTermino()}</div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"9px 22px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:13, cursor:"pointer" }}>Cancelar</button>
            <button onClick={()=>onConfirmar(fechaInicio, diasUso, responsable)} style={{
              padding:"9px 22px", borderRadius:8, border:"none",
              background:color, color:"#FFF", fontSize:13, fontWeight:700, cursor:"pointer"
            }}>✅ Confirmar Asignación</button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── MODAL CIERRE CON FOTO DESPUÉS ────────────────────────────────────────────
function ModalCierre({ titulo, color, onClose, onConfirmar }) {
  const [fotosDespues, setFotosDespues] = useState([]);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const handleConfirmar = async () => {
    setGuardando(true);
    await onConfirmar(fotosDespues, observaciones);
    setGuardando(false);
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:500, boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"18px 24px", background:color, borderRadius:"16px 16px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:16, fontWeight:700 }}>{titulo}</h2>
            <p style={{ margin:"2px 0 0", color:"rgba(255,255,255,0.8)", fontSize:12 }}>Sube hasta 5 fotos del resultado final</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:22, display:"flex", flexDirection:"column", gap:16 }}>
          <MultiFotoUploader
            label="📷 Fotos DESPUÉS del trabajo — máx 5"
            fotos={fotosDespues}
            setFotos={setFotosDespues}
          />
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>📝 Observaciones del cierre</label>
            <textarea value={observaciones} onChange={e=>setObservaciones(e.target.value)}
              placeholder="Descripción del trabajo realizado, materiales usados, novedades..."
              style={{ padding:"10px 14px", borderRadius:8, border:"1px solid #DDD", fontSize:13, outline:"none", background:"#FFF", width:"100%", boxSizing:"border-box", minHeight:80, resize:"vertical" }} />
          </div>
          <div style={{ background:"#E8F5E9", border:"1px solid #C8E6C9", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.verde }}>
            ✅ Al cerrar, el estado cambiará a <strong>"completado"</strong> y las fotos quedarán guardadas para el informe final con ANTES y DESPUÉS.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"9px 22px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:13, cursor:"pointer" }}>Cancelar</button>
            <button onClick={handleConfirmar} disabled={guardando} style={{
              padding:"9px 22px", borderRadius:8, border:"none",
              background:guardando?"#888":C.verde, color:"#FFF", fontSize:13, fontWeight:700,
              cursor:guardando?"not-allowed":"pointer"
            }}>
              {guardando ? "⏳ Cerrando..." : "✅ Cerrar Operativo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function ViewDesmalezados({ desmalezados, onNuevo, loading, onRecargar }) {
  const [modalAsignarId, setModalAsignarId] = useState(null);
  const [modalCerrarId, setModalCerrarId] = useState(null);
  const [editando, setEditando] = useState(null);
  const handleAsignar = async (fechaInicio, diasUso, responsable) => {
    try {
      const res = await fetch(`${API_URL}/api/desmalezados/${modalAsignarId}/asignar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fecha_inicio:fechaInicio, dias_uso:diasUso, responsable })
      });
      const data = await res.json();
      if (res.ok) { alert(`✅ ${data.mensaje}`); setModalAsignarId(null); onRecargar(); }
      else alert("❌ " + (data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  const handleCerrar = async (fotos_despues, observaciones) => {
    try {
      const res = await fetch(`${API_URL}/api/desmalezados/${modalCerrarId}/cerrar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fotos_despues, observaciones_cierre:observaciones })
      });
      const data = await res.json();
      if (res.ok) { alert("✅ Desmalezado cerrado exitosamente"); setModalCerrarId(null); onRecargar(); }
      else alert("❌ " + (data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🌿 Desmalezados</h1>
        <button onClick={onNuevo} style={{ background:C.verde, color:"#FFF", border:"none", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Nuevo Desmalezado</button>
      </div>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando...</div> : (
        <TablaGenerica
          columnas={["Folio","Solicitante","Dirección","Estado","Inicio","Término","Días","Responsable","Fotos","Acción"]}
          filas={desmalezados.map((d,i) => ({
            key:d.id, critica:!!d.es_emergencia, par:i%2===0,
            celdas:[
              <span style={{ fontFamily:"monospace", color:C.verde, fontWeight:600, fontSize:12 }}>{d.folio}</span>,
              <span style={{ fontSize:12 }}>{d.nombre_solicitante}
                {d.es_emergencia&&<span style={{ marginLeft:6 }}><EmergenciaBadge small /></span>}
                {d.es_recordatorio&&<span style={{ marginLeft:4, fontSize:10, background:"#E8F5E9", color:C.verde, padding:"1px 5px", borderRadius:8 }}>📝</span>}
              </span>,
              <span style={{ fontSize:12, color:"#666" }}>{d.direccion}</span>,
              <Badge estado={d.estado} small />,
              <span style={{ fontSize:12, color:C.azul, fontWeight:600 }}>{d.fecha_inicio||"—"}</span>,
              <span style={{ fontSize:12, color:C.rojo, fontWeight:600 }}>{d.fecha_termino||"—"}</span>,
              <span style={{ fontWeight:700, color:d.dias_uso>0?C.verde:"#888" }}>{d.dias_uso>0?`${d.dias_uso}d`:"—"}</span>,
              <span style={{ fontSize:12, color:"#555" }}>{d.responsable||"—"}</span>,
              <div style={{ display:"flex", gap:4 }}>
                {d.foto_antes?<a href={d.foto_antes} target="_blank" rel="noreferrer"><img src={d.foto_antes} alt="antes" style={{ width:30,height:30,objectFit:"cover",borderRadius:4,border:"1px solid #DDD" }} /></a>:<span style={{ fontSize:10, color:"#CCC" }}>—</span>}
                {d.foto_despues?<a href={d.foto_despues} target="_blank" rel="noreferrer"><img src={d.foto_despues} alt="dsp" style={{ width:30,height:30,objectFit:"cover",borderRadius:4,border:`2px solid ${C.verde}` }} /></a>:<span style={{ fontSize:10, color:"#CCC" }}>—</span>}
              </div>,
              <BotonesAccion
                id={d.id} endpoint="desmalezados" estado={d.estado} color={C.verde}
                labelAsignar="🌿 Asignar"
                onAsignar={()=>setModalAsignarId(d.id)}
                onEditar={()=>setEditando(d)}
                onRecargar={onRecargar}
              />
            ]
          }))}
          total={desmalezados.length}
        />
      )}
      {modalAsignarId && (
        <ModalAsignarServicio titulo="🌿 Asignar Desmalezado" color={C.verde}
          onClose={()=>setModalAsignarId(null)} onConfirmar={handleAsignar} />
      )}
      {modalCerrarId && (
        <ModalCierre titulo="🌿 Cerrar Desmalezado" color={C.verde}
          onClose={()=>setModalCerrarId(null)} onConfirmar={handleCerrar} />
      )}
      {editando && (
        <ModalEditar tipo="desmalezado" registro={editando}
          onClose={()=>setEditando(null)}
          onGuardar={()=>{ setEditando(null); onRecargar(); }} />
      )}
    </div>
  );
}
function ViewCaminos({ caminos, onNuevo, loading, onRecargar }) {
  const pc = { urgente:C.rojo, alta:C.naranja, normal:C.verde };
  const [modalAsignarId, setModalAsignarId] = useState(null);
  const [modalCerrarId, setModalCerrarId] = useState(null);
  const [editando, setEditando] = useState(null);
  const handleAsignar = async (fechaInicio, diasUso, responsable) => {
    try {
      const res = await fetch(`${API_URL}/api/caminos/${modalAsignarId}/asignar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fecha_inicio:fechaInicio, dias_uso:diasUso, responsable })
      });
      const data = await res.json();
      if (res.ok) { alert(`✅ ${data.mensaje}`); setModalAsignarId(null); onRecargar(); }
      else alert("❌ " + (data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  const handleCerrar = async (fotos_despues, observaciones) => {
    try {
      const res = await fetch(`${API_URL}/api/caminos/${modalCerrarId}/cerrar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fotos_despues, observaciones_cierre:observaciones })
      });
      const data = await res.json();
      if (res.ok) { alert("✅ Arreglo de camino cerrado exitosamente"); setModalCerrarId(null); onRecargar(); }
      else alert("❌ " + (data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🛤️ Arreglo de Caminos</h1>
        <button onClick={onNuevo} style={{ background:C.naranja, color:"#FFF", border:"none", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Nuevo Camino</button>
      </div>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando...</div> : (
        <TablaGenerica
          columnas={["Folio","Solicitante","Dirección","Tipo","Prioridad","Estado","Inicio","Término","Responsable","Fotos","Acción"]}
          filas={caminos.map((c,i) => ({
            key:c.id, critica:c.prioridad==="urgente"||!!c.es_emergencia, par:i%2===0,
            celdas:[
              <span style={{ fontFamily:"monospace", color:C.naranja, fontWeight:600, fontSize:12 }}>{c.folio}</span>,
              <span style={{ fontSize:12 }}>{c.nombre_solicitante}
                {c.es_emergencia&&<span style={{ marginLeft:6 }}><EmergenciaBadge small /></span>}
                {c.es_recordatorio&&<span style={{ marginLeft:4, fontSize:10, background:"#FFF3E0", color:C.naranja, padding:"1px 5px", borderRadius:8 }}>📝</span>}
              </span>,
              <span style={{ fontSize:12, color:"#666" }}>{c.direccion}</span>,
              <span style={{ fontSize:12 }}>{c.tipo_camino}</span>,
              <span style={{ fontSize:12, fontWeight:600, color:pc[c.prioridad]||C.verde }}>{c.prioridad}</span>,
              <Badge estado={c.estado} small />,
              <span style={{ fontSize:12, color:C.azul, fontWeight:600 }}>{c.fecha_inicio||"—"}</span>,
              <span style={{ fontSize:12, color:C.rojo, fontWeight:600 }}>{c.fecha_termino||"—"}</span>,
              <span style={{ fontSize:12, color:"#555" }}>{c.responsable||"—"}</span>,
              <div style={{ display:"flex", gap:4 }}>
                {c.foto_antes?<a href={c.foto_antes} target="_blank" rel="noreferrer"><img src={c.foto_antes} alt="antes" style={{ width:30,height:30,objectFit:"cover",borderRadius:4,border:"1px solid #DDD" }} /></a>:<span style={{ fontSize:10, color:"#CCC" }}>—</span>}
                {c.foto_despues?<a href={c.foto_despues} target="_blank" rel="noreferrer"><img src={c.foto_despues} alt="dsp" style={{ width:30,height:30,objectFit:"cover",borderRadius:4,border:`2px solid ${C.verde}` }} /></a>:<span style={{ fontSize:10, color:"#CCC" }}>—</span>}
              </div>,
              <BotonesAccion
                id={c.id} endpoint="caminos" estado={c.estado} color={C.naranja}
                labelAsignar="🛤️ Asignar"
                onAsignar={()=>setModalAsignarId(c.id)}
                onEditar={()=>setEditando(c)}
                onRecargar={onRecargar}
              />
            ]
          }))}
          total={caminos.length}
        />
      )}
      {modalAsignarId && (
        <ModalAsignarServicio titulo="🛤️ Asignar Arreglo de Camino" color={C.naranja}
          onClose={()=>setModalAsignarId(null)} onConfirmar={handleAsignar} />
      )}
      {modalCerrarId && (
        <ModalCierre titulo="🛤️ Cerrar Arreglo de Camino" color={C.naranja}
          onClose={()=>setModalCerrarId(null)} onConfirmar={handleCerrar} />
      )}
      {editando && (
        <ModalEditar tipo="camino" registro={editando}
          onClose={()=>setEditando(null)}
          onGuardar={()=>{ setEditando(null); onRecargar(); }} />
      )}
    </div>
  );
}
function ViewOperativos({ operativos, solicitudes, desmalezados, loading, onRecargar }) {
  const [paresDetectados, setParesDetectados] = useState([]);
  const [modalPar, setModalPar] = useState(null); // par seleccionado para crear operativo
  const [creando, setCreando] = useState(false);
  // Detectar pares batea+desmalezado cercanos (100m) en el frontend
  useEffect(() => {
    const bateasPendientes = solicitudes.filter(s => s.estado === "pendiente" && s.latitud && s.longitud);
    const desmalezadosPendientes = desmalezados.filter(d => d.estado === "pendiente" && d.latitud && d.longitud);
    const pares = [];
    const usados = new Set();
    for (const b of bateasPendientes) {
      for (const d of desmalezadosPendientes) {
        if (usados.has(b.id) || usados.has(d.id)) continue;
        const dist = calcDistancia(parseFloat(b.latitud), parseFloat(b.longitud), parseFloat(d.latitud), parseFloat(d.longitud));
        if (dist <= 100) {
          pares.push({ batea: b, desmalezado: d, distancia: Math.round(dist) });
          usados.add(b.id);
          usados.add(d.id);
        }
      }
    }
    setParesDetectados(pares);
  }, [solicitudes, desmalezados]);
  const calcDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const phi1 = lat1 * Math.PI/180, phi2 = lat2 * Math.PI/180;
    const dphi = (lat2-lat1) * Math.PI/180;
    const dlambda = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dphi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlambda/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };
  const handleCrearOperativo = async (fechaInicio, diasUso, responsable) => {
    if (!modalPar) return;
    setCreando(true);
    try {
      // Crear operativo conjunto
      const res = await fetch(`${API_URL}/api/operativos-conjuntos?solicitud_batea_id=${modalPar.batea.id}&desmalezado_id=${modalPar.desmalezado.id}`, { method:"POST" });
      const data = await res.json();
      if (!res.ok) { alert("❌ " + (data.detail||"Error")); setCreando(false); return; }
      // Asignar fechas al desmalezado
      await fetch(`${API_URL}/api/desmalezados/${modalPar.desmalezado.id}/asignar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fecha_inicio:fechaInicio, dias_uso:diasUso, responsable })
      });
      alert(`✅ Operativo Conjunto ${data.codigo} creado\n🗑️ Batea: ${data.numero_batea}\n📅 Inicio: ${new Date(fechaInicio).toLocaleDateString("es-CL")}\n⏱ Duración: ${diasUso} días`);
      setModalPar(null);
      onRecargar();
    } catch { alert("❌ Error de conexión"); }
    setCreando(false);
  };
  return (
    <div style={{ padding:28 }}>
      <h1 style={{ margin:"0 0 8px", fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🔧 Operativos Conjuntos</h1>
      <p style={{ margin:"0 0 20px", color:"#666", fontSize:14 }}>Batea + Desmalezado en un mismo punto — un solo viaje, dos servicios</p>
      {/* Pares detectados automáticamente */}
      {paresDetectados.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:C.morado }}>🎯 Pares detectados automáticamente</h2>
            <span style={{ background:C.moradoS, color:C.morado, border:`1px solid ${C.morado}44`, borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:600 }}>{paresDetectados.length}</span>
          </div>
          <div style={{ display:"grid", gap:10 }}>
            {paresDetectados.map((par, i) => (
              <div key={i} style={{
                background:"#FFF", border:`2px solid ${C.morado}44`, borderLeft:`5px solid ${C.morado}`,
                borderRadius:12, padding:"16px 20px",
                display:"flex", justifyContent:"space-between", alignItems:"center", gap:16
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.morado, marginBottom:6 }}>
                    🔧 Par detectado — {par.distancia}m de distancia
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div style={{ background:C.azulS, borderRadius:8, padding:"10px 14px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.azul, marginBottom:3 }}>🗑️ BATEA</div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{par.batea.nombre_vecino}</div>
                      <div style={{ fontSize:12, color:"#666" }}>{par.batea.direccion}</div>
                      <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{par.batea.folio} · {par.batea.dias_pendiente}d pendiente</div>
                    </div>
                    <div style={{ background:C.verdeS, borderRadius:8, padding:"10px 14px" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.verde, marginBottom:3 }}>🌿 DESMALEZADO</div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{par.desmalezado.nombre_solicitante||"Sin nombre"}</div>
                      <div style={{ fontSize:12, color:"#666" }}>{par.desmalezado.direccion}</div>
                      <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{par.desmalezado.folio} · {par.desmalezado.dias_pendiente}d pendiente</div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setModalPar(par)}
                  disabled={creando}
                  style={{
                    padding:"10px 18px", borderRadius:10, border:"none",
                    background:C.morado, color:"#FFF", fontSize:13, fontWeight:700,
                    cursor:"pointer", whiteSpace:"nowrap",
                    boxShadow:"0 2px 8px rgba(106,27,154,0.3)"
                  }}>
                  🔧 Crear Operativo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Sin pares detectados */}
      {paresDetectados.length === 0 && !loading && operativos.length === 0 && (
        <div style={{ background:"#F3E5F5", border:"1px solid #CE93D8", borderRadius:12, padding:32, textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
          <div style={{ fontSize:15, fontWeight:600, color:C.morado }}>Sin pares detectados actualmente</div>
          <div style={{ fontSize:13, color:"#888", marginTop:6, maxWidth:400, margin:"8px auto 0" }}>
            El sistema detecta automáticamente cuando hay una batea pendiente y un desmalezado pendiente dentro de 100 metros de distancia.
          </div>
        </div>
      )}
      {/* Operativos ya creados */}
      {operativos.length > 0 && (
        <div>
          <h2 style={{ fontSize:15, fontWeight:700, color:"#333", marginBottom:12 }}>📋 Operativos Creados</h2>
          <div style={{ display:"grid", gap:10 }}>
            {operativos.map(op => (
              <div key={op.id} style={{
                background:C.blanco, border:"1px solid #CE93D8",
                borderLeft:`4px solid ${C.morado}`, borderRadius:10, padding:"14px 18px"
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:C.morado }}>{op.codigo}</div>
                    <div style={{ fontSize:13, color:"#555", marginTop:4 }}>
                      🗑️ Batea: <strong>{op.numero_batea}</strong> — {op.direccion_batea}
                    </div>
                    <div style={{ fontSize:13, color:"#555", marginTop:2 }}>
                      🌿 Desmalezado: {op.direccion_desmalezado}
                    </div>
                    <div style={{ fontSize:12, color:"#888", marginTop:4 }}>
                      📅 Planificado: {op.fecha_planificacion}
                    </div>
                  </div>
                  <Badge estado={op.estado} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Modal crear operativo con fechas */}
      {modalPar && (
        <ModalAsignarServicio
          titulo="🔧 Crear Operativo Conjunto"
          color={C.morado}
          onClose={() => setModalPar(null)}
          onConfirmar={handleCrearOperativo}
        />
      )}
    </div>
  );
}
function ViewMapa({ solicitudes, desmalezados, caminos, operativos }) {
  const center = [-33.0458, -71.6197];
  const mkIcon = (emoji, color, size=28) => L.divIcon({
    className:"",
    html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #FFF;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.45)}px;">${emoji}</div>`,
    iconSize:[size,size], iconAnchor:[size/2,size/2]
  });
  const solC = solicitudes.filter(s=>s.latitud&&s.longitud&&!isNaN(parseFloat(s.latitud)));
  const desC = desmalezados.filter(d=>d.latitud&&d.longitud&&!isNaN(parseFloat(d.latitud)));
  const camC = caminos.filter(c=>c.latitud&&c.longitud&&!isNaN(parseFloat(c.latitud)));
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"18px 28px 12px", background:"#FFF", borderBottom:"1px solid #E0E0E0" }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:700 }}>Mapa Operacional</h1>
        <div style={{ display:"flex", gap:16, marginTop:10, flexWrap:"wrap" }}>
          {[["#C62828","🗑️ Batea crítica"],["#1565C0","🗑️ Batea normal"],["#2E7D32","🌿 Desmalezado"],["#E65100","🛤️ Camino"],["#6A1B9A","🔧 Op. Conjunto"]].map(([color,label])=>(
            <div key={label} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:12, height:12, borderRadius:"50%", background:color }} />
              <span style={{ fontSize:12, color:"#555" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex:1, minHeight:500 }}>
        <MapContainer center={center} zoom={15} style={{ height:"100%", width:"100%" }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LayerGroup>
            {solC.map(s=>(
              <Marker key={s.id} position={[parseFloat(s.latitud),parseFloat(s.longitud)]} icon={mkIcon("🗑️",s.nivel_alerta==="critica"?"#C62828":"#1565C0")}>
                <Popup>
                  <div style={{ minWidth:200, fontFamily:"sans-serif" }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{s.nombre_vecino}</div>
                    <div style={{ fontSize:12, color:"#666" }}>{s.direccion}</div>
                    {s.foto_url && <img src={s.foto_url} alt="foto" style={{ width:"100%", borderRadius:6, margin:"6px 0", maxHeight:100, objectFit:"cover" }} />}
                    <div style={{ display:"flex", gap:6, margin:"6px 0" }}><Badge estado={s.estado} small /><Badge alerta={s.nivel_alerta} small /></div>
                    <div style={{ fontSize:11, color:"#888" }}>{s.folio} · {s.dias_pendiente} días</div>
                  </div>
                </Popup>
                <Tooltip>{s.nombre_vecino}</Tooltip>
              </Marker>
            ))}
          </LayerGroup>
          <LayerGroup>
            {desC.map(d=>(
              <Marker key={d.id} position={[parseFloat(d.latitud),parseFloat(d.longitud)]} icon={mkIcon("🌿","#2E7D32")}>
                <Popup>
                  <div style={{ minWidth:200, fontFamily:"sans-serif" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:C.verde }}>🌿 {d.folio}</div>
                    <div style={{ fontSize:12 }}>{d.direccion}</div>
                    {d.foto_antes && <img src={d.foto_antes} alt="antes" style={{ width:"100%", borderRadius:6, margin:"6px 0", maxHeight:80, objectFit:"cover" }} />}
                    <Badge estado={d.estado} small />
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
          <LayerGroup>
            {camC.map(c=>(
              <Marker key={c.id} position={[parseFloat(c.latitud),parseFloat(c.longitud)]} icon={mkIcon("🛤️","#E65100")}>
                <Popup>
                  <div style={{ minWidth:200, fontFamily:"sans-serif" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:C.naranja }}>🛤️ {c.folio}</div>
                    <div style={{ fontSize:12 }}>{c.direccion} — {c.tipo_camino}</div>
                    {c.foto_antes && <img src={c.foto_antes} alt="antes" style={{ width:"100%", borderRadius:6, margin:"6px 0", maxHeight:80, objectFit:"cover" }} />}
                    <div style={{ fontSize:12, marginTop:4 }}>Prioridad: <strong>{c.prioridad}</strong></div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
          <LayerGroup>
            {operativos.filter(o=>o.centroide_lat&&o.centroide_lon).map(o=>(
              <Marker key={o.id} position={[o.centroide_lat,o.centroide_lon]} icon={mkIcon("🔧","#6A1B9A",34)}>
                <Popup>
                  <div style={{ minWidth:200, fontFamily:"sans-serif" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:C.morado }}>🔧 {o.codigo}</div>
                    <div style={{ fontSize:12 }}>Batea: {o.numero_batea}</div>
                    <div style={{ fontSize:12 }}>Vecino: {o.nombre_vecino}</div>
                    <Badge estado={o.estado} small />
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
          <LayerGroup>
            {solC.filter(s=>s.estado==="pendiente").map(s=>(
              <Circle key={`c-${s.id}`} center={[parseFloat(s.latitud),parseFloat(s.longitud)]} radius={100}
                pathOptions={{ color:s.nivel_alerta==="critica"?"#C62828":"#1565C0", fillOpacity:0.05, weight:1, dashArray:"6 4" }} />
            ))}
          </LayerGroup>
        </MapContainer>
      </div>
    </div>
  );
}
function ViewAlertas({ solicitudes, desmalezados, caminos }) {
  const emergenciasBatea = solicitudes.filter(s=>s.es_emergencia&&s.estado==="pendiente");
  const emergenciasDesmalezado = desmalezados.filter(d=>d.es_emergencia&&d.estado==="pendiente");
  const emergenciasCamino = caminos.filter(c=>c.es_emergencia&&c.estado==="pendiente");
  const totalEmergencias = emergenciasBatea.length + emergenciasDesmalezado.length + emergenciasCamino.length;
  const criticas = solicitudes.filter(s=>s.nivel_alerta==="critica"&&s.estado==="pendiente"&&!s.es_emergencia);
  const advertencias = solicitudes.filter(s=>s.nivel_alerta==="advertencia"&&s.estado==="pendiente");
  const caminosUrgentes = caminos.filter(c=>c.prioridad==="urgente"&&c.estado==="pendiente"&&!c.es_emergencia);
  return (
    <div style={{ padding:28 }}>
      <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🔔 Sistema de Alertas</h1>
      {totalEmergencias > 0 && (
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:"#C62828", marginBottom:12 }}>🚨 Emergencias Activas — Prioridad Inmediata</h2>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {emergenciasBatea.map(s=>(
              <div key={s.id} style={{ background:"#FFEBEE", border:"2px solid #C62828", borderRadius:10, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><span style={{ fontWeight:700 }}>🗑️ {s.nombre_vecino}</span> — {s.direccion} <span style={{ fontSize:11, color:"#888" }}>({s.folio})</span></div>
                <EmergenciaBadge />
              </div>
            ))}
            {emergenciasDesmalezado.map(d=>(
              <div key={d.id} style={{ background:"#FFEBEE", border:"2px solid #C62828", borderRadius:10, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><span style={{ fontWeight:700 }}>🌿 {d.nombre_solicitante||"Sin nombre"}</span> — {d.direccion} <span style={{ fontSize:11, color:"#888" }}>({d.folio})</span></div>
                <EmergenciaBadge />
              </div>
            ))}
            {emergenciasCamino.map(c=>(
              <div key={c.id} style={{ background:"#FFEBEE", border:"2px solid #C62828", borderRadius:10, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><span style={{ fontWeight:700 }}>🛤️ {c.nombre_solicitante||"Registro interno"}</span> — {c.direccion} <span style={{ fontSize:11, color:"#888" }}>({c.folio})</span></div>
                <EmergenciaBadge />
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
        <div style={{ background:"#FFEBEE", border:"2px solid #C62828", borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
          <div style={{ fontSize:34, fontWeight:800, color:"#C62828" }}>{totalEmergencias}</div>
          <div style={{ fontSize:13, fontWeight:600, color:"#C62828" }}>🚨 Emergencias</div>
          <div style={{ fontSize:11, color:"#888", marginTop:3 }}>Prioridad inmediata</div>
        </div>
        <div style={{ background:C.rojoS, border:"1px solid #FFCDD2", borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
          <div style={{ fontSize:34, fontWeight:800, color:C.rojo }}>{criticas.length}</div>
          <div style={{ fontSize:13, fontWeight:600, color:C.rojo }}>🔴 Bateas Críticas</div>
          <div style={{ fontSize:11, color:"#888", marginTop:3 }}>≥20 días</div>
        </div>
        <div style={{ background:C.naranjaS, border:"1px solid #FFE0B2", borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
          <div style={{ fontSize:34, fontWeight:800, color:C.naranja }}>{advertencias.length}</div>
          <div style={{ fontSize:13, fontWeight:600, color:C.naranja }}>⚠️ Advertencia</div>
          <div style={{ fontSize:11, color:"#888", marginTop:3 }}>11-19 días</div>
        </div>
        <div style={{ background:C.verdeS, border:"1px solid #C8E6C9", borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
          <div style={{ fontSize:34, fontWeight:800, color:C.verde }}>{desmalezados.filter(d=>d.estado==="pendiente").length}</div>
          <div style={{ fontSize:13, fontWeight:600, color:C.verde }}>🌿 Desmalezados</div>
          <div style={{ fontSize:11, color:"#888", marginTop:3 }}>Pendientes</div>
        </div>
      </div>
      {criticas.length>0 && (
        <div style={{ marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:C.rojo, marginBottom:10 }}>🔴 Bateas Críticas — Atención Inmediata</h2>
          {criticas.map(s=>(
            <div key={s.id} style={{ background:"#FFF", border:`1px solid ${C.rojo}33`, borderLeft:`4px solid ${C.rojo}`, borderRadius:10, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{s.nombre_vecino}</div>
                <div style={{ fontSize:12, color:"#666" }}>{s.direccion} · {s.folio}</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:26, fontWeight:700, color:C.rojo }}>{s.dias_pendiente}</div>
                <div style={{ fontSize:11, color:"#888" }}>días</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {caminosUrgentes.length>0 && (
        <div>
          <h2 style={{ fontSize:15, fontWeight:700, color:C.naranja, marginBottom:10 }}>🛤️ Caminos Urgentes</h2>
          {caminosUrgentes.map(c=>(
            <div key={c.id} style={{ background:"#FFF", border:`1px solid ${C.naranja}33`, borderLeft:`4px solid ${C.naranja}`, borderRadius:10, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{c.direccion}</div>
                <div style={{ fontSize:12, color:"#666" }}>{c.tipo_camino} · {c.folio}</div>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:C.rojo }}>URGENTE</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function ModalClusteringResultado({ resultado, onClose }) {
  if (!resultado) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FFF", borderRadius:16, padding:32, maxWidth:560, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>✅</div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>Clustering Completado</h2>
          <p style={{ margin:"6px 0 0", color:"#666", fontSize:14 }}>{resultado.mensaje}</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {[["Grupos creados",resultado.grupos_creados,C.verde],["Bateas asignadas",resultado.bateas_asignadas,C.azul],["Vecinos atendidos",resultado.solicitudes_agrupadas,"#7B1FA2"],["Bateas evitadas",resultado.grupos_omitidos,C.naranja]].map(([label,value,color])=>(
            <div key={label} style={{ background:"#F8FAFE", borderRadius:10, padding:"12px", textAlign:"center" }}>
              <div style={{ fontSize:26, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:11, color:"#666", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        {resultado.detalle_grupos?.length>0 && (
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:12, marginBottom:16, maxHeight:180, overflowY:"auto" }}>
            {resultado.detalle_grupos.map((g,i)=>(
              <div key={i} style={{ padding:"6px 0", borderBottom:"1px solid #E0E0E0", fontSize:12 }}>
                <span style={{ fontWeight:600, color:C.azul }}>{g.numero_batea}</span> — {g.vecinos} vecino(s): {g.nombres?.join(", ")}
                {g.incompleto && <span style={{ marginLeft:6, color:"#E65100", fontWeight:600 }}>⚠ sin coordenadas</span>}
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:C.azul, color:"#FFF", fontSize:15, fontWeight:700, cursor:"pointer" }}>Aceptar</button>
      </div>
    </div>
  );
}
// ── MODAL ASIGNAR BATEA CON FECHA INICIO Y DÍAS EDITABLES ────────────────────
function ModalAsignarBatea({ onClose, onConfirmar }) {
  const hoy = new Date().toISOString().split("T")[0];
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [diasUso, setDiasUso] = useState(7);
  const [preview, setPreview] = useState(null);
  const [cargando, setCargando] = useState(true);
  const opciones = [3, 5, 7, 10, 14, 21, 30, 45, 60];
  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/clustering/preview?radio_metros=100`);
        if (res.ok) { const d = await res.json(); setPreview(d); }
      } catch {}
      setCargando(false);
    };
    cargar();
  }, []);
  // Calcular fecha de término en base a fecha inicio + días
  const calcFechaTermino = () => {
    const d = new Date(fechaInicio);
    d.setDate(d.getDate() + diasUso);
    return d.toLocaleDateString("es-CL");
  };
  const formatFechaInicio = () => {
    const d = new Date(fechaInicio);
    return d.toLocaleDateString("es-CL");
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:580, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        {/* Header */}
        <div style={{ padding:"20px 24px", background:C.azul, borderRadius:"16px 16px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:17, fontWeight:700 }}>🗑️ Asignar Bateas Comunitarias</h2>
            <p style={{ margin:"2px 0 0", color:"#90CAF9", fontSize:13 }}>Configure fechas y días de uso — se informará a los vecinos</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF", width:34, height:34, borderRadius:"50%", cursor:"pointer", fontSize:20 }}>×</button>
        </div>
        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:18 }}>
          {/* Vista previa clustering */}
          {cargando ? (
            <div style={{ textAlign:"center", padding:16, color:"#888", fontSize:14 }}>⏳ Analizando solicitudes pendientes...</div>
          ) : preview && (
            <div style={{ background:C.azulS, borderRadius:10, padding:"14px 16px", border:"1px solid #BBDEFB" }}>
              <div style={{ fontWeight:700, color:C.azul, fontSize:13, marginBottom:10 }}>📊 Vista previa del clustering</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div style={{ background:"#FFF", borderRadius:8, padding:"10px 14px", textAlign:"center" }}>
                  <div style={{ fontSize:26, fontWeight:700, color:C.azul }}>{preview.total_pendientes}</div>
                  <div style={{ fontSize:12, color:"#666" }}>Solicitudes pendientes</div>
                </div>
                <div style={{ background:"#FFF", borderRadius:8, padding:"10px 14px", textAlign:"center" }}>
                  <div style={{ fontSize:26, fontWeight:700, color:C.verde }}>{preview.grupos_estimados}</div>
                  <div style={{ fontSize:12, color:"#666" }}>Grupos a crear</div>
                </div>
              </div>
              {preview.sin_coordenadas > 0 && (
                <div style={{ marginTop:10, background:"#FFF3E0", border:"1px solid #FFE0B2", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#E65100" }}>
                  ⚠️ {preview.sin_coordenadas} solicitud(es) sin coordenadas — se asignarán igual, cada una como grupo individual (no se pudieron agrupar por cercanía).
                </div>
              )}
              {preview.grupos?.length > 0 && (
                <div style={{ marginTop:10, maxHeight:90, overflowY:"auto" }}>
                  {preview.grupos.map((g, i) => (
                    <div key={i} style={{ fontSize:12, color:"#555", padding:"3px 0", borderBottom:"1px solid #E3F2FD" }}>
                      Grupo {i+1}: {g.vecinos} vecino(s) — máx {g.dias_max} días pendiente
                      {g.incompleto && <span style={{ marginLeft:6, color:"#E65100", fontWeight:600 }}>⚠ sin coordenadas</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Fecha de inicio EDITABLE */}
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:16 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#333", marginBottom:12 }}>
              📅 Fecha de inicio de la asignación
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <input
                type="date"
                value={fechaInicio}
                min={hoy}
                onChange={e => setFechaInicio(e.target.value)}
                style={{
                  padding:"10px 14px", borderRadius:8, border:`2px solid ${C.azul}`,
                  fontSize:14, outline:"none", background:"#FFF",
                  color:C.azul, fontWeight:600, cursor:"pointer"
                }}
              />
              <div style={{ fontSize:13, color:"#555" }}>
                {fechaInicio === hoy
                  ? "📌 Hoy — asignación inmediata"
                  : `📌 Asignación programada para el ${formatFechaInicio()}`
                }
              </div>
            </div>
            <div style={{ marginTop:10, fontSize:12, color:"#888" }}>
              💡 Puedes programar la asignación para una fecha futura y notificar a los vecinos con anticipación.
            </div>
          </div>
          {/* Días de uso */}
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:16 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#333", marginBottom:12 }}>⏱ Días de uso de la batea</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
              {opciones.map(d => (
                <button key={d} onClick={() => setDiasUso(d)} style={{
                  padding:"8px 14px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
                  background: diasUso===d ? C.azul : "#FFF",
                  color: diasUso===d ? "#FFF" : "#555",
                  border: diasUso===d ? `2px solid ${C.azul}` : "1px solid #DDD",
                  transition:"all 0.15s"
                }}>
                  {d} días
                </button>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:13, color:"#555" }}>O ingresa manualmente:</span>
              <input
                type="number" min={1} max={365} value={diasUso}
                onChange={e => setDiasUso(Math.max(1, Math.min(365, parseInt(e.target.value)||1)))}
                style={{ width:80, padding:"8px 10px", borderRadius:8, border:`2px solid ${C.azul}`, fontSize:14, textAlign:"center", outline:"none", fontWeight:600, color:C.azul }}
              />
              <span style={{ fontSize:13, color:"#555" }}>días</span>
            </div>
          </div>
          {/* Resumen final para vecinos */}
          <div style={{ background:C.verdeS, border:"1px solid #C8E6C9", borderRadius:10, padding:"14px 18px" }}>
            <div style={{ fontWeight:700, fontSize:13, color:C.verde, marginBottom:8 }}>
              📋 Información que recibirán los vecinos
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <div style={{ background:"#FFF", borderRadius:8, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>FECHA INICIO</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.azul }}>{formatFechaInicio()}</div>
              </div>
              <div style={{ background:"#FFF", borderRadius:8, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>DURACIÓN</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.naranja }}>{diasUso} días</div>
              </div>
              <div style={{ background:"#FFF", borderRadius:8, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>FECHA TÉRMINO</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.rojo }}>{calcFechaTermino()}</div>
              </div>
            </div>
          </div>
          <div style={{ background:"#FFF3E0", border:"1px solid #FFE0B2", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.naranja }}>
            ⚠️ El sistema priorizará automáticamente las solicitudes más antiguas y críticas — y siempre primero las marcadas como Emergencia. Las bateas se asignarán solo a vecinos sin batea activa cercana.
          </div>
          {/* Botones */}
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"10px 24px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:14, cursor:"pointer" }}>Cancelar</button>
            <button
              onClick={() => onConfirmar(diasUso, fechaInicio)}
              disabled={!preview || preview.total_pendientes === 0}
              style={{
                padding:"10px 28px", borderRadius:8, border:"none",
                background: (!preview || preview.total_pendientes === 0) ? "#888" : C.azul,
                color:"#FFF", fontSize:14, fontWeight:700,
                cursor: (!preview || preview.total_pendientes === 0) ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", gap:8
              }}>
              🗑️ Confirmar Asignación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// OPERATIVO CENTRAL
// ═══════════════════════════════════════════════════════════════════════════════
const TIPOS_OPERATIVO = [
  "general","bateas","desmalezado","arreglo_caminos","limpieza",
  "pavimentación","iluminación","areas_verdes","emergencia","otro"
];
const COLOR_OC = "#1B5E20";
const BG_OC = "#E8F5E9";
function ModalNuevoOperativoCentral({ onClose, onGuardar }) {
  const hoy = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    titulo:"", descripcion:"", tipo_operativo:"general",
    departamento:"", responsable_principal:"",
    prioridad:"normal", sector:"", fecha_programada:hoy,
    latitud:"", longitud:"", observaciones:""
  });
  const [equipo, setEquipo] = useState([]);
  const [nuevoMiembro, setNuevoMiembro] = useState("");
  const [servicios, setServicios] = useState([]);
  const [fotosAntes, setFotosAntes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleServicio = (s) => setServicios(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev,s]);
  const agregarMiembro = () => { if (nuevoMiembro.trim()) { setEquipo(e=>[...e,nuevoMiembro.trim()]); setNuevoMiembro(""); } };
  const handleGuardar = async () => {
    if (!form.titulo.trim()) { setError("El título es obligatorio"); return; }
    setGuardando(true);
    try {
      const lat = form.latitud && !isNaN(parseFloat(form.latitud)) ? parseFloat(form.latitud) : null;
      const lon = form.longitud && !isNaN(parseFloat(form.longitud)) ? parseFloat(form.longitud) : null;
      const res = await fetch(`${API_URL}/api/operativos-centrales`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...form, latitud:lat, longitud:lon, equipo, servicios_incluidos:servicios, fotos_antes:fotosAntes })
      });
      const data = await res.json();
      if (res.ok) { alert(`✅ ${data.mensaje}`); onGuardar(); }
      else setError(data.detail||"Error al guardar");
    } catch { setError("Error de conexión"); }
    setGuardando(false);
  };
  const serviciosOpts = ["🗑️ Bateas","🌿 Desmalezado","🛤️ Arreglo Caminos","💡 Iluminación","🌳 Áreas Verdes","🧹 Limpieza","🚧 Pavimentación","🔧 Mantención","🚒 Emergencia","📋 Otro"];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:680, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"18px 24px", background:COLOR_OC, borderRadius:"16px 16px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:17, fontWeight:700 }}>🏛️ Nuevo Operativo Central</h2>
            <p style={{ margin:"2px 0 0", color:"rgba(255,255,255,0.8)", fontSize:12 }}>Operativo ejecutado desde la Dirección de Operaciones</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:22, display:"flex", flexDirection:"column", gap:16 }}>
          {error && <div style={{ background:"#FFEBEE", border:"1px solid #FFCDD2", borderRadius:8, padding:"10px 14px", fontSize:13, color:C.rojo }}>{error}</div>}
          <SeccionForm titulo="📋 Identificación del Operativo" color={COLOR_OC}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <Field label="Título del Operativo" required>
                  <input style={inp} value={form.titulo} onChange={e=>set("titulo",e.target.value)} placeholder="Ej: Operativo Limpieza Sector Norte — Junio 2026" />
                </Field>
              </div>
              <Field label="Tipo de Operativo">
                <select style={inp} value={form.tipo_operativo} onChange={e=>set("tipo_operativo",e.target.value)}>
                  {TIPOS_OPERATIVO.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1).replace("_"," ")}</option>)}
                </select>
              </Field>
              <Field label="Prioridad">
                <select style={inp} value={form.prioridad} onChange={e=>set("prioridad",e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </Field>
              <Field label="Departamento / Dirección">
                <input style={inp} value={form.departamento} onChange={e=>set("departamento",e.target.value)} placeholder="Dirección de Operaciones" />
              </Field>
              <Field label="Responsable Principal">
                <input style={inp} value={form.responsable_principal} onChange={e=>set("responsable_principal",e.target.value)} placeholder="Nombre del responsable" />
              </Field>
              <Field label="Sector / Área">
                <input style={inp} value={form.sector} onChange={e=>set("sector",e.target.value)} placeholder="Sector Norte, Villa X..." />
              </Field>
              <Field label="Fecha Programada">
                <input style={inp} type="date" value={form.fecha_programada} onChange={e=>set("fecha_programada",e.target.value)} />
              </Field>
              <div style={{ gridColumn:"1/-1" }}>
                <Field label="Descripción">
                  <textarea style={{...inp, minHeight:70, resize:"vertical"}} value={form.descripcion} onChange={e=>set("descripcion",e.target.value)} placeholder="Descripción del operativo, objetivos, alcance..." />
                </Field>
              </div>
            </div>
          </SeccionForm>
          {/* Equipo */}
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:COLOR_OC, marginBottom:10 }}>👷 Equipo / Personal</div>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <input style={{...inp, flex:1}} value={nuevoMiembro} onChange={e=>setNuevoMiembro(e.target.value)} onKeyDown={e=>e.key==="Enter"&&agregarMiembro()} placeholder="Nombre del integrante o cuadrilla" />
              <button onClick={agregarMiembro} style={{ padding:"0 18px", borderRadius:8, border:"none", background:COLOR_OC, color:"#FFF", fontSize:14, fontWeight:600, cursor:"pointer" }}>+</button>
            </div>
            {equipo.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {equipo.map((m,i) => (
                  <span key={i} style={{ background:BG_OC, color:COLOR_OC, border:`1px solid ${COLOR_OC}33`, borderRadius:20, padding:"3px 12px", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
                    {m}
                    <button onClick={()=>setEquipo(e=>e.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:COLOR_OC, fontSize:14, lineHeight:1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Servicios incluidos */}
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:COLOR_OC, marginBottom:10 }}>🔧 Servicios incluidos en este operativo</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {serviciosOpts.map(s => (
                <button key={s} onClick={()=>toggleServicio(s)} style={{
                  padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                  background:servicios.includes(s)?COLOR_OC:"#FFF",
                  color:servicios.includes(s)?"#FFF":"#555",
                  border:servicios.includes(s)?`2px solid ${COLOR_OC}`:"1px solid #DDD"
                }}>{s}</button>
              ))}
            </div>
          </div>
          {/* Georref */}
          <div style={{ background:"#F0F7FF", borderRadius:10, padding:14, border:"1px solid #BBDEFB" }}>
            <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.azul }}>📍 Georreferencia <span style={{ fontWeight:400, color:"#888", fontSize:11 }}>(opcional)</span></h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Latitud"><input style={{...inp, fontFamily:"monospace"}} value={form.latitud} onChange={e=>set("latitud",e.target.value)} placeholder="-33.0458" type="number" step="any" /></Field>
              <Field label="Longitud"><input style={{...inp, fontFamily:"monospace"}} value={form.longitud} onChange={e=>set("longitud",e.target.value)} placeholder="-71.6197" type="number" step="any" /></Field>
            </div>
          </div>
          <MultiFotoUploader label="📷 Fotos ANTES del operativo — máx 5" fotos={fotosAntes} setFotos={setFotosAntes} />
          <Field label="Observaciones">
            <textarea style={{...inp, minHeight:60, resize:"vertical"}} value={form.observaciones} onChange={e=>set("observaciones",e.target.value)} placeholder="Notas adicionales, condiciones especiales..." />
          </Field>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"9px 22px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:13, cursor:"pointer" }}>Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando} style={{ padding:"9px 24px", borderRadius:8, border:"none", background:guardando?"#888":COLOR_OC, color:"#FFF", fontSize:13, fontWeight:700, cursor:guardando?"not-allowed":"pointer" }}>
              {guardando ? "⏳ Guardando..." : "✅ Crear Operativo Central"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function ModalEditarOperativoCentral({ operativo, onClose, onGuardar }) {
  const [form, setForm] = useState({
    titulo: operativo.titulo || "",
    descripcion: operativo.descripcion || "",
    tipo_operativo: operativo.tipo_operativo || "general",
    departamento: operativo.departamento || "",
    responsable_principal: operativo.responsable_principal || "",
    prioridad: operativo.prioridad || "normal",
    sector: operativo.sector || "",
    fecha_programada: operativo.fecha_programada
      ? operativo.fecha_programada.split("/").reverse().join("-")
      : new Date().toISOString().split("T")[0],
    latitud: operativo.latitud || "",
    longitud: operativo.longitud || "",
    observaciones: operativo.observaciones || "",
  });
  const [equipo, setEquipo] = useState(operativo.equipo || []);
  const [nuevoMiembro, setNuevoMiembro] = useState("");
  const [servicios, setServicios] = useState(operativo.servicios_incluidos || []);
  const [fotosAntes, setFotosAntes] = useState(operativo.fotos_antes || []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleServicio = (s) => setServicios(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev,s]);
  const agregarMiembro = () => { if (nuevoMiembro.trim()) { setEquipo(e=>[...e,nuevoMiembro.trim()]); setNuevoMiembro(""); } };
  const handleGuardar = async () => {
    if (!form.titulo.trim()) { setError("El título es obligatorio"); return; }
    setGuardando(true);
    try {
      const lat = form.latitud && !isNaN(parseFloat(form.latitud)) ? parseFloat(form.latitud) : null;
      const lon = form.longitud && !isNaN(parseFloat(form.longitud)) ? parseFloat(form.longitud) : null;
      const res = await fetch(`${API_URL}/api/operativos-centrales/${operativo.id}/editar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...form, latitud:lat, longitud:lon, equipo, servicios_incluidos:servicios, fotos_antes:fotosAntes })
      });
      const data = await res.json();
      if (res.ok) { alert("✅ Operativo actualizado correctamente"); onGuardar(); }
      else setError(data.detail||"Error al guardar");
    } catch { setError("Error de conexión"); }
    setGuardando(false);
  };
  const serviciosOpts = ["🗑️ Bateas","🌿 Desmalezado","🛤️ Arreglo Caminos","💡 Iluminación","🌳 Áreas Verdes","🧹 Limpieza","🚧 Pavimentación","🔧 Mantención","🚒 Emergencia","📋 Otro"];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#FFF", borderRadius:16, width:"100%", maxWidth:680, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ padding:"18px 24px", background:COLOR_OC, borderRadius:"16px 16px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:17, fontWeight:700 }}>✏️ Editar Operativo Central</h2>
            <p style={{ margin:"2px 0 0", color:"rgba(255,255,255,0.8)", fontSize:12 }}>Código: {operativo.codigo} — Modifica solo lo que necesitas corregir</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:22, display:"flex", flexDirection:"column", gap:16 }}>
          {error && <div style={{ background:"#FFEBEE", border:"1px solid #FFCDD2", borderRadius:8, padding:"10px 14px", fontSize:13, color:C.rojo }}>{error}</div>}
          <SeccionForm titulo="📋 Identificación del Operativo" color={COLOR_OC}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <Field label="Título del Operativo" required>
                  <input style={inp} value={form.titulo} onChange={e=>set("titulo",e.target.value)} />
                </Field>
              </div>
              <Field label="Tipo de Operativo">
                <select style={inp} value={form.tipo_operativo} onChange={e=>set("tipo_operativo",e.target.value)}>
                  {["general","bateas","desmalezado","arreglo_caminos","limpieza","pavimentación","iluminación","areas_verdes","emergencia","otro"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1).replace("_"," ")}</option>)}
                </select>
              </Field>
              <Field label="Prioridad">
                <select style={inp} value={form.prioridad} onChange={e=>set("prioridad",e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </Field>
              <Field label="Departamento / Dirección">
                <input style={inp} value={form.departamento} onChange={e=>set("departamento",e.target.value)} />
              </Field>
              <Field label="Responsable Principal">
                <input style={inp} value={form.responsable_principal} onChange={e=>set("responsable_principal",e.target.value)} />
              </Field>
              <Field label="Sector / Área">
                <input style={inp} value={form.sector} onChange={e=>set("sector",e.target.value)} />
              </Field>
              <Field label="Fecha Programada">
                <input style={inp} type="date" value={form.fecha_programada} onChange={e=>set("fecha_programada",e.target.value)} />
              </Field>
              <div style={{ gridColumn:"1/-1" }}>
                <Field label="Descripción">
                  <textarea style={{...inp, minHeight:70, resize:"vertical"}} value={form.descripcion} onChange={e=>set("descripcion",e.target.value)} />
                </Field>
              </div>
            </div>
          </SeccionForm>
          {/* Equipo */}
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:COLOR_OC, marginBottom:10 }}>👷 Equipo / Personal</div>
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <input style={{...inp, flex:1}} value={nuevoMiembro} onChange={e=>setNuevoMiembro(e.target.value)} onKeyDown={e=>e.key==="Enter"&&agregarMiembro()} placeholder="Nombre del integrante o cuadrilla" />
              <button onClick={agregarMiembro} style={{ padding:"0 18px", borderRadius:8, border:"none", background:COLOR_OC, color:"#FFF", fontSize:14, fontWeight:600, cursor:"pointer" }}>+</button>
            </div>
            {equipo.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {equipo.map((m,i) => (
                  <span key={i} style={{ background:BG_OC, color:COLOR_OC, border:`1px solid ${COLOR_OC}33`, borderRadius:20, padding:"3px 12px", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
                    {m}
                    <button onClick={()=>setEquipo(e=>e.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:COLOR_OC, fontSize:14, lineHeight:1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Servicios */}
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:COLOR_OC, marginBottom:10 }}>🔧 Servicios incluidos</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {serviciosOpts.map(s => (
                <button key={s} onClick={()=>toggleServicio(s)} style={{
                  padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                  background:servicios.includes(s)?COLOR_OC:"#FFF",
                  color:servicios.includes(s)?"#FFF":"#555",
                  border:servicios.includes(s)?`2px solid ${COLOR_OC}`:"1px solid #DDD"
                }}>{s}</button>
              ))}
            </div>
          </div>
          {/* Georref */}
          <div style={{ background:"#F0F7FF", borderRadius:10, padding:14, border:"1px solid #BBDEFB" }}>
            <h3 style={{ margin:"0 0 8px", fontSize:13, fontWeight:700, color:C.azul }}>📍 Georreferencia <span style={{ fontWeight:400, color:"#888", fontSize:11 }}>(opcional)</span></h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Latitud"><input style={{...inp, fontFamily:"monospace"}} value={form.latitud} onChange={e=>set("latitud",e.target.value)} type="number" step="any" /></Field>
              <Field label="Longitud"><input style={{...inp, fontFamily:"monospace"}} value={form.longitud} onChange={e=>set("longitud",e.target.value)} type="number" step="any" /></Field>
            </div>
          </div>
          <MultiFotoUploader label="📷 Fotos ANTES — editar o agregar (máx 5)" fotos={fotosAntes} setFotos={setFotosAntes} />
          <Field label="Observaciones">
            <textarea style={{...inp, minHeight:60, resize:"vertical"}} value={form.observaciones} onChange={e=>set("observaciones",e.target.value)} />
          </Field>
          <div style={{ background:"#FFF3E0", border:"1px solid #FFE0B2", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.naranja }}>
            ⚠️ Solo se actualizarán los campos que modifiques. El código, estado y fecha de creación no cambian.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ padding:"9px 22px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:13, cursor:"pointer" }}>Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando} style={{ padding:"9px 24px", borderRadius:8, border:"none", background:guardando?"#888":COLOR_OC, color:"#FFF", fontSize:13, fontWeight:700, cursor:guardando?"not-allowed":"pointer" }}>
              {guardando ? "⏳ Guardando..." : "✅ Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function ViewOperativoCentral({ operativos, loading, onRecargar }) {
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalAsignarId, setModalAsignarId] = useState(null);
  const [modalCerrarId, setModalCerrarId] = useState(null);
  const [editando, setEditando] = useState(null);
  const pc = { urgente:C.rojo, alta:C.naranja, normal:C.verde };
  const handleAsignar = async (fechaInicio, diasUso, responsable) => {
    try {
      const res = await fetch(`${API_URL}/api/operativos-centrales/${modalAsignarId}/asignar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fecha_inicio:fechaInicio, dias_uso:diasUso, responsable_principal:responsable, equipo:[] })
      });
      const data = await res.json();
      if (res.ok) { alert(`✅ ${data.mensaje}`); setModalAsignarId(null); onRecargar(); }
      else alert("❌ "+(data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  const handleCerrar = async (fotos_despues, observaciones) => {
    try {
      const res = await fetch(`${API_URL}/api/operativos-centrales/${modalCerrarId}/cerrar`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fotos_despues, observaciones_cierre:observaciones })
      });
      const data = await res.json();
      if (res.ok) { alert("✅ Operativo Central cerrado"); setModalCerrarId(null); onRecargar(); }
      else alert("❌ "+(data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  const estadoColor = { planificado:C.azul, en_ejecucion:C.naranja, completado:C.verde };
  const estadoBg = { planificado:C.azulS, en_ejecucion:C.naranjaS, completado:C.verdeS };
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🏛️ Operativos Centrales</h1>
        <button onClick={()=>setModalNuevo(true)} style={{ background:COLOR_OC, color:"#FFF", border:"none", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>
          + Nuevo Operativo Central
        </button>
      </div>
      <p style={{ margin:"0 0 20px", color:"#666", fontSize:14 }}>
        Operativos mayores ejecutados desde la Dirección de Operaciones o la Municipalidad — bateas, desmalezados, caminos, limpieza, emergencias y más.
      </p>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando...</div> :
        operativos.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, background:"#F8F8F8", borderRadius:12, color:"#888" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏛️</div>
            <div style={{ fontSize:16, fontWeight:600 }}>Sin operativos centrales registrados</div>
            <div style={{ fontSize:13, marginTop:6 }}>Registra aquí los operativos municipales mayores que no quedaban en ningún otro módulo.</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {operativos.map(op => (
              <div key={op.id} style={{ background:"#FFF", border: op.tipo_operativo==="emergencia" ? "2px solid #C62828" : "1px solid #E0E0E0", borderLeft:`5px solid ${op.tipo_operativo==="emergencia"?"#C62828":(estadoColor[op.estado]||COLOR_OC)}`, borderRadius:12, padding:"18px 22px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                      <span style={{ fontWeight:700, color:COLOR_OC, fontFamily:"monospace", fontSize:13 }}>{op.codigo}</span>
                      {op.tipo_operativo==="emergencia" && <EmergenciaBadge small />}
                      <span style={{ background:estadoBg[op.estado]||BG_OC, color:estadoColor[op.estado]||COLOR_OC, border:`1px solid ${estadoColor[op.estado]||COLOR_OC}33`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:600 }}>
                        {op.estado?.replace("_"," ").toUpperCase()}
                      </span>
                      <span style={{ background:pc[op.prioridad]+"22", color:pc[op.prioridad], border:`1px solid ${pc[op.prioridad]}33`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:600 }}>
                        {op.prioridad}
                      </span>
                    </div>
                    <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{op.titulo}</div>
                    <div style={{ fontSize:13, color:"#555", marginBottom:6 }}>{op.descripcion}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:16, fontSize:12, color:"#888" }}>
                      {op.departamento && <span>🏢 {op.departamento}</span>}
                      {op.responsable_principal && <span>👤 {op.responsable_principal}</span>}
                      {op.sector && <span>📍 {op.sector}</span>}
                      {op.fecha_programada && <span>📅 {op.fecha_programada}</span>}
                      {op.fecha_inicio && <span>▶️ {op.fecha_inicio} → {op.fecha_termino||"..."}</span>}
                    </div>
                    {op.servicios_incluidos?.length > 0 && (
                      <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:6 }}>
                        {op.servicios_incluidos.map((s,i)=>(
                          <span key={i} style={{ background:BG_OC, color:COLOR_OC, borderRadius:20, padding:"2px 10px", fontSize:11 }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {op.equipo?.length > 0 && (
                      <div style={{ marginTop:6, fontSize:12, color:"#666" }}>
                        👷 {op.equipo.join(", ")}
                      </div>
                    )}
                    {/* Fotos miniatura */}
                    {(op.fotos_antes?.length > 0 || op.fotos_despues?.length > 0) && (
                      <div style={{ marginTop:8, display:"flex", gap:6 }}>
                        {op.fotos_antes?.slice(0,3).map((url,i)=>(
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="antes" style={{ width:36,height:36,objectFit:"cover",borderRadius:6,border:"2px solid #DDD" }} />
                          </a>
                        ))}
                        {op.fotos_despues?.slice(0,3).map((url,i)=>(
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="después" style={{ width:36,height:36,objectFit:"cover",borderRadius:6,border:`2px solid ${C.verde}` }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, minWidth:110 }}>
                    {op.estado==="planificado" && (
                      <button onClick={()=>setModalAsignarId(op.id)} style={{ padding:"7px 14px", borderRadius:8, border:"none", background:COLOR_OC, color:"#FFF", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        ▶️ Asignar
                      </button>
                    )}
                    {op.estado==="en_ejecucion" && (
                      <button onClick={()=>setModalCerrarId(op.id)} style={{ padding:"7px 14px", borderRadius:8, border:"none", background:C.azul, color:"#FFF", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        📷 Cerrar
                      </button>
                    )}
                    <button onClick={()=>setEditando(op)} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${COLOR_OC}`, background:"#FFF", color:COLOR_OC, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      ✏️ Editar
                    </button>
                    <button onClick={async ()=>{
                      if (!window.confirm(`¿Eliminar el operativo ${op.codigo} — "${op.titulo}"?\n\nEsto no se puede deshacer.`)) return;
                      const res = await fetch(`${API_URL}/api/operativos-centrales/${op.id}`,{method:"DELETE"});
                      const data = await res.json();
                      if (res.ok) { alert("✅ "+data.mensaje); onRecargar(); }
                      else alert("❌ "+(data.detail||"Error"));
                    }} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.rojo}`, background:"#FFF", color:C.rojo, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
      {modalNuevo && <ModalNuevoOperativoCentral onClose={()=>setModalNuevo(false)} onGuardar={()=>{ setModalNuevo(false); onRecargar(); }} />}
      {modalAsignarId && <ModalAsignarServicio titulo="🏛️ Asignar Operativo Central" color={COLOR_OC} onClose={()=>setModalAsignarId(null)} onConfirmar={handleAsignar} />}
      {modalCerrarId && <ModalCierre titulo="🏛️ Cerrar Operativo Central" color={COLOR_OC} onClose={()=>setModalCerrarId(null)} onConfirmar={handleCerrar} />}
      {editando && <ModalEditarOperativoCentral operativo={editando} onClose={()=>setEditando(null)} onGuardar={()=>{ setEditando(null); onRecargar(); }} />}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// GENERADOR DE REPORTES PDF (abre ventana nueva con HTML imprimible)
// ═══════════════════════════════════════════════════════════════════════════════
function generarHTMLReporte(tipo, datos) {
  const hoy = new Date().toLocaleDateString("es-CL", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const horaGen = new Date().toLocaleTimeString("es-CL");
  const esEmergencia = !!datos.es_emergencia || datos.tipo_operativo === "emergencia";
  const cfg = {
    batea:            { color: esEmergencia?"#C62828":"#1565C0", bg: esEmergencia?"#FFEBEE":"#E3F2FD", emoji: esEmergencia?"🚨":"🗑️", titulo:"Asignación de Batea Comunitaria" },
    desmalezado:      { color: esEmergencia?"#C62828":"#2E7D32", bg: esEmergencia?"#FFEBEE":"#E8F5E9", emoji: esEmergencia?"🚨":"🌿", titulo:"Operativo de Desmalezado" },
    camino:           { color: esEmergencia?"#C62828":"#E65100", bg: esEmergencia?"#FFEBEE":"#FFF3E0", emoji: esEmergencia?"🚨":"🛤️", titulo:"Arreglo de Camino" },
    operativo:        { color:"#6A1B9A", bg:"#F3E5F5", emoji:"🔧", titulo:"Operativo Conjunto Batea + Desmalezado" },
    operativo_central:{ color: esEmergencia?"#C62828":"#1B5E20", bg: esEmergencia?"#FFEBEE":"#E8F5E9", emoji: esEmergencia?"🚨":"🏛️", titulo:"Operativo Central Municipal" },
    visita:           { color: esEmergencia?"#C62828":"#6A1B9A", bg: esEmergencia?"#FFEBEE":"#F3E5F5", emoji: esEmergencia?"🚨":"🧭", titulo:"Visita Técnica — Inspección en Terreno" },
  }[tipo] || { color:"#1565C0", bg:"#E3F2FD", emoji:"📄", titulo:"Informe" };
  const renderFotos = (fotos, label) => {
    if (!fotos || fotos.length === 0)
      return `<div style="padding:16px;background:#F5F5F5;border-radius:8px;text-align:center;color:#999;font-size:13px;">Sin fotos registradas</div>`;
    const cols = Math.min(fotos.length, 3);
    return `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;margin-top:8px;">
      ${fotos.map((url, i) => `<div style="position:relative;">
        <img src="${url}" style="width:100%;height:160px;object-fit:cover;border-radius:8px;border:2px solid #DDD;" onerror="this.style.display='none'" />
        <div style="position:absolute;bottom:4px;left:4px;background:rgba(0,0,0,0.6);color:#FFF;font-size:10px;padding:2px 6px;border-radius:4px;">${label} ${i+1}</div>
      </div>`).join("")}
    </div>`;
  };
  const lat = datos.latitud || datos.centroide_lat || 0;
  const lon = datos.longitud || datos.centroide_lon || 0;
  // Mapa estático OSM — imagen fija, funciona en correos y PDFs
  const zoom = 16;
  const mapaEstatico = lat
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=760x280&markers=${lat},${lon},red-pushpin`
    : null;
  // Nombre del archivo PDF
  const nombreArchivo = `BateaControl_${datos.folio||datos.codigo||"informe"}_${new Date().toLocaleDateString("es-CL").replace(/\//g,"-")}.pdf`;
  const filaEmergencia = `<div class="dato" style="grid-column:1/-1;background:${esEmergencia?"#FFEBEE":"#F8F8F8"};border-left:3px solid ${esEmergencia?"#C62828":cfg.color}"><div class="dato-label">Tipo de Solicitud</div><div class="dato-valor" style="color:${esEmergencia?"#C62828":"#1a1a1a"}">${esEmergencia?"🚨 EMERGENCIA — Prioridad Inmediata":"Normal"}</div></div>`;
  const datosPrincipales = tipo === "batea" ? `
    <div class="dato"><div class="dato-label">Vecino Solicitante</div><div class="dato-valor">${datos.nombre_vecino||"—"}</div></div>
    <div class="dato"><div class="dato-label">RUT</div><div class="dato-valor">${datos.rut||"—"}</div></div>
    <div class="dato"><div class="dato-label">Dirección</div><div class="dato-valor">${datos.direccion||"—"}</div></div>
    <div class="dato"><div class="dato-label">Teléfono</div><div class="dato-valor">${datos.telefono||"—"}</div></div>
    <div class="dato"><div class="dato-label">Número de Batea</div><div class="dato-valor">${datos.numero_batea||"—"}</div></div>
    <div class="dato"><div class="dato-label">Fecha Solicitud</div><div class="dato-valor">${datos.fecha_solicitud||"—"}</div></div>
    ${filaEmergencia}
  ` : tipo === "desmalezado" ? `
    <div class="dato"><div class="dato-label">Solicitante / Referencia</div><div class="dato-valor">${datos.nombre_solicitante||"Registro interno"}</div></div>
    <div class="dato"><div class="dato-label">Tipo</div><div class="dato-valor">${datos.es_recordatorio?"📝 Recordatorio interno":"👤 Solicitud vecinal"}</div></div>
    <div class="dato"><div class="dato-label">Dirección</div><div class="dato-valor">${datos.direccion||"—"}</div></div>
    <div class="dato"><div class="dato-label">Descripción</div><div class="dato-valor">${datos.descripcion||"—"}</div></div>
    <div class="dato"><div class="dato-label">Responsable</div><div class="dato-valor">${datos.responsable||"—"}</div></div>
    <div class="dato"><div class="dato-label">Fecha Solicitud</div><div class="dato-valor">${datos.fecha_solicitud||"—"}</div></div>
    ${filaEmergencia}
  ` : tipo === "camino" ? `
    <div class="dato"><div class="dato-label">Solicitante / Referencia</div><div class="dato-valor">${datos.nombre_solicitante||"Registro interno"}</div></div>
    <div class="dato"><div class="dato-label">Tipo de Vía</div><div class="dato-valor">${datos.tipo_camino||"—"}</div></div>
    <div class="dato"><div class="dato-label">Dirección</div><div class="dato-valor">${datos.direccion||"—"}</div></div>
    <div class="dato"><div class="dato-label">Problema Reportado</div><div class="dato-valor">${datos.descripcion_problema||"—"}</div></div>
    <div class="dato"><div class="dato-label">Prioridad</div><div class="dato-valor">${(datos.prioridad||"normal").toUpperCase()}</div></div>
    <div class="dato"><div class="dato-label">Responsable</div><div class="dato-valor">${datos.responsable||"—"}</div></div>
    ${filaEmergencia}
  ` : tipo === "operativo_central" ? `
    <div class="dato"><div class="dato-label">Código</div><div class="dato-valor">${datos.codigo||"—"}</div></div>
    <div class="dato"><div class="dato-label">Tipo de Operativo</div><div class="dato-valor">${datos.tipo_operativo||"—"}</div></div>
    <div class="dato"><div class="dato-label">Departamento</div><div class="dato-valor">${datos.departamento||"—"}</div></div>
    <div class="dato"><div class="dato-label">Responsable Principal</div><div class="dato-valor">${datos.responsable_principal||"—"}</div></div>
    <div class="dato"><div class="dato-label">Sector / Área</div><div class="dato-valor">${datos.sector||"—"}</div></div>
    <div class="dato"><div class="dato-label">Prioridad</div><div class="dato-valor">${(datos.prioridad||"normal").toUpperCase()}</div></div>
    ${datos.equipo?.length>0?`<div class="dato" style="grid-column:1/-1"><div class="dato-label">Equipo / Personal</div><div class="dato-valor">${datos.equipo.join(", ")}</div></div>`:""}
    ${datos.servicios_incluidos?.length>0?`<div class="dato" style="grid-column:1/-1"><div class="dato-label">Servicios Incluidos</div><div class="dato-valor">${datos.servicios_incluidos.join(" · ")}</div></div>`:""}
  ` : tipo === "visita" ? `
    <div class="dato"><div class="dato-label">Vecino</div><div class="dato-valor">${datos.nombre_vecino||"—"}</div></div>
    <div class="dato"><div class="dato-label">RUT</div><div class="dato-valor">${datos.rut||"—"}</div></div>
    <div class="dato"><div class="dato-label">Dirección</div><div class="dato-valor">${datos.direccion||"—"}</div></div>
    <div class="dato"><div class="dato-label">Teléfono</div><div class="dato-valor">${datos.telefono||"—"}</div></div>
    <div class="dato"><div class="dato-label">Responsable de la visita</div><div class="dato-valor">${datos.responsable||"—"}</div></div>
    <div class="dato"><div class="dato-label">Fecha Solicitud</div><div class="dato-valor">${datos.fecha_solicitud||"—"}</div></div>
    <div class="dato" style="grid-column:1/-1"><div class="dato-label">¿Qué está solicitando el vecino?</div><div class="dato-valor">${datos.motivo||"—"}</div></div>
    ${filaEmergencia}
  ` : `
    <div class="dato"><div class="dato-label">Código Operativo</div><div class="dato-valor">${datos.codigo||"—"}</div></div>
    <div class="dato"><div class="dato-label">Batea Asignada</div><div class="dato-valor">${datos.numero_batea||"—"}</div></div>
    <div class="dato"><div class="dato-label">Vecino (Batea)</div><div class="dato-valor">${datos.nombre_vecino||"—"}</div></div>
    <div class="dato"><div class="dato-label">Dirección Batea</div><div class="dato-valor">${datos.direccion_batea||"—"}</div></div>
    <div class="dato"><div class="dato-label">Dirección Desmalezado</div><div class="dato-valor">${datos.direccion_desmalezado||"—"}</div></div>
    <div class="dato"><div class="dato-label">Responsable</div><div class="dato-valor">${datos.responsable||"—"}</div></div>
  `;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Informe — ${datos.folio||datos.codigo||""}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;background:#FFF}
.page{max-width:800px;margin:0 auto;padding:32px}
.header{border-bottom:4px solid ${cfg.color};padding-bottom:20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start}
.municipio{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.titulo{font-size:22px;font-weight:bold;color:${cfg.color}}
.subtitulo{font-size:13px;color:#555;margin-top:4px}
.badge{background:${cfg.color};color:#FFF;padding:8px 18px;border-radius:8px;font-size:16px;font-weight:bold;text-align:center}
.seccion{margin-bottom:24px}
.sec-titulo{font-size:12px;font-weight:bold;color:${cfg.color};border-bottom:2px solid ${cfg.color};padding-bottom:5px;margin-bottom:14px;text-transform:uppercase;letter-spacing:.5px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.dato{padding:10px 14px;background:#F8F8F8;border-radius:8px;border-left:3px solid ${cfg.color}}
.dato-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.dato-valor{font-size:14px;font-weight:bold;color:#1a1a1a}
.fechas-box{background:${cfg.bg};border:1px solid ${cfg.color}33;border-radius:10px;padding:16px}
.fecha-item{background:#FFF;border-radius:8px;padding:12px;text-align:center}
.fecha-label{font-size:10px;color:#888;text-transform:uppercase;margin-bottom:4px}
.fecha-valor{font-size:15px;font-weight:bold;color:${cfg.color}}
.mapa-img{width:100%;height:280px;object-fit:cover;border-radius:10px;border:2px solid #DDD;display:block}
.mapa-caption{font-size:11px;color:#888;text-align:center;margin-top:6px}
.estado-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}44}
.firma-sec{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:60px}
.firma{border-top:1px solid #333;padding-top:8px;text-align:center;font-size:12px;color:#555}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #DDD;display:flex;justify-content:space-between;font-size:10px;color:#999}
.btn-bar{margin-bottom:20px;display:flex;gap:10px;justify-content:flex-end;align-items:center}
.btn-pdf{padding:11px 24px;background:${cfg.color};color:#FFF;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;display:flex;align-items:center;gap:8px}
.btn-close{padding:11px 20px;background:#F5F5F5;color:#555;border:1px solid #DDD;border-radius:8px;font-size:14px;cursor:pointer}
.btn-pdf:disabled{background:#AAA;cursor:not-allowed}
@media print{.btn-bar{display:none}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><div class="page">
<div class="btn-bar">
  <span id="estado-btn" style="font-size:12px;color:#888"></span>
  <button class="btn-pdf" id="btn-pdf" onclick="descargarPDF()">⬇️ Descargar PDF</button>
  <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
</div>
<div id="contenido-pdf">
<div class="header">
  <div>
    <div class="municipio">BateaControl — Sistema Municipal de Gestión Territorial</div>
    <div class="titulo">${cfg.emoji} ${cfg.titulo}${esEmergencia?" — EMERGENCIA":""}</div>
    <div class="subtitulo">Informe Oficial — ${hoy} a las ${horaGen}</div>
  </div>
  <div><div class="badge">${datos.folio||datos.codigo||"—"}</div></div>
</div>
<div class="seccion"><span class="estado-badge">Estado: ${(datos.estado||"").toUpperCase()}</span></div>
<div class="seccion">
  <div class="sec-titulo">📋 Datos del Registro</div>
  <div class="grid-2">${datosPrincipales}</div>
</div>
${(datos.fecha_inicio||datos.fecha_asignacion||datos.fecha_visita) ? `
<div class="seccion">
  <div class="sec-titulo">📅 Planificación Temporal</div>
  <div class="fechas-box">
    <div class="grid-3">
      <div class="fecha-item"><div class="fecha-label">${tipo==="visita"?"Fecha de Visita":"Fecha Inicio"}</div><div class="fecha-valor">${datos.fecha_inicio||datos.fecha_asignacion||datos.fecha_visita||"—"}</div></div>
      <div class="fecha-item"><div class="fecha-label">Duración</div><div class="fecha-valor">${datos.dias_uso?datos.dias_uso+" días":"—"}</div></div>
      <div class="fecha-item"><div class="fecha-label">Fecha Término</div><div class="fecha-valor">${datos.fecha_termino||"—"}</div></div>
    </div>
  </div>
</div>` : ""}
${mapaEstatico ? `
<div class="seccion">
  <div class="sec-titulo">📍 Georreferencia</div>
  <div class="grid-2" style="margin-bottom:12px">
    <div class="dato"><div class="dato-label">Latitud</div><div class="dato-valor" style="font-family:monospace">${parseFloat(lat).toFixed(6)}</div></div>
    <div class="dato"><div class="dato-label">Longitud</div><div class="dato-valor" style="font-family:monospace">${parseFloat(lon).toFixed(6)}</div></div>
  </div>
  <img class="mapa-img" src="${mapaEstatico}" alt="Mapa de ubicación" crossorigin="anonymous" onerror="this.src='';this.alt='Mapa no disponible';this.style.height='60px';this.style.background='#F5F5F5'" />
  <div class="mapa-caption">📌 Ubicación georreferenciada — ${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)} — OpenStreetMap</div>
</div>` : ""}
${tipo !== "visita" ? `
<div class="seccion">
  <div class="sec-titulo">📷 Fotografías — Estado ANTES</div>
  ${renderFotos(datos.fotos_antes, "ANTES")}
</div>` : ""}
<div class="seccion">
  <div class="sec-titulo">${tipo==="visita"?"📷 Fotografías de la Visita":"📷 Fotografías — Estado DESPUÉS"}</div>
  ${datos.estado === "completado"
    ? renderFotos(datos.fotos_despues, tipo==="visita"?"VISITA":"DESPUÉS")
    : `<div style="padding:16px;background:#FFF3E0;border-radius:8px;text-align:center;color:#E65100;font-size:13px;border:1px solid #FFE0B2">⏳ ${tipo==="visita"?"Visita pendiente de realizar":"Operativo pendiente de cierre"} — Las fotos se agregarán al completar.</div>`}
</div>
${(datos.observaciones||datos.observaciones_cierre) ? `
<div class="seccion">
  <div class="sec-titulo">📝 Observaciones</div>
  <div style="padding:14px;background:#F8F8F8;border-radius:8px;border-left:3px solid ${cfg.color};font-size:13px;line-height:1.6">${datos.observaciones||datos.observaciones_cierre}</div>
</div>` : ""}
<div class="firma-sec">
  <div class="firma"><div style="margin-bottom:40px"></div>Responsable del Operativo</div>
  <div class="firma"><div style="margin-bottom:40px"></div>Jefe de Servicio Municipal</div>
</div>
<div class="footer">
  <div>BateaControl — Sistema Municipal de Gestión Territorial</div>
  <div>Folio: ${datos.folio||datos.codigo||"—"} | Generado: ${hoy}</div>
</div>
</div><!-- fin contenido-pdf -->
<script>
function descargarPDF() {
  const btn = document.getElementById('btn-pdf');
  const estado = document.getElementById('estado-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Generando PDF...';
  estado.textContent = 'Procesando imágenes y mapa...';
  const elemento = document.getElementById('contenido-pdf');
  const opciones = {
    margin: [10, 10, 10, 10],
    filename: '${nombreArchivo}',
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    }
  };
  html2pdf().set(opciones).from(elemento).save()
    .then(() => {
      btn.disabled = false;
      btn.textContent = '⬇️ Descargar PDF';
      estado.textContent = '✅ PDF descargado correctamente';
      setTimeout(() => { estado.textContent = ''; }, 4000);
    })
    .catch(err => {
      btn.disabled = false;
      btn.textContent = '⬇️ Descargar PDF';
      estado.textContent = '❌ Error al generar PDF';
      console.error(err);
    });
}
</script>
</div></body></html>`;
}
function generarReporte(tipo, datos) {
  const html = generarHTMLReporte(tipo, datos);
  const ventana = window.open("", "_blank", "width=900,height=800,scrollbars=yes");
  if (ventana) { ventana.document.write(html); ventana.document.close(); }
}
// ── VISTA REPORTES ────────────────────────────────────────────────────────────
function ViewReportes({ solicitudes, desmalezados, caminos, operativos, operativosCentrales, visitas }) {
  const [filtro, setFiltro] = useState("todos");
  const bateasAsig = solicitudes.filter(s => s.numero_batea);
  const desAsig = desmalezados.filter(d => d.estado !== "pendiente");
  const camAsig = caminos.filter(c => c.estado !== "pendiente");
  const ocLista = operativosCentrales || [];
  const visAsig = (visitas||[]).filter(v => v.estado !== "pendiente");
  const total = bateasAsig.length + desAsig.length + camAsig.length + operativos.length + ocLista.length + visAsig.length;
  const ItemReporte = ({ emoji, folio, titulo, subtitulo, info, color, esEmergencia, onGenerar }) => (
    <div style={{ background:"#FFF", border: esEmergencia?"2px solid #C62828":"1px solid #E0E0E0", borderLeft:`4px solid ${esEmergencia?"#C62828":color}`, borderRadius:10, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <span style={{ fontSize:16 }}>{emoji}</span>
          <span style={{ fontWeight:700, color:esEmergencia?"#C62828":color, fontFamily:"monospace", fontSize:13 }}>{folio}</span>
          {esEmergencia && <EmergenciaBadge small />}
        </div>
        <div style={{ fontSize:13, fontWeight:500 }}>{titulo}</div>
        <div style={{ fontSize:12, color:"#666" }}>{subtitulo}</div>
        <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{info}</div>
      </div>
      <button onClick={onGenerar} style={{ padding:"8px 18px", borderRadius:8, border:"none", background:esEmergencia?"#C62828":color, color:"#FFF", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", marginLeft:16 }}>
        📄 Generar PDF
      </button>
    </div>
  );
  return (
    <div style={{ padding:28 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>📄 Reportes e Informes</h1>
        <p style={{ margin:"4px 0 0", color:"#666", fontSize:14 }}>Genera informes PDF oficiales con fotos ANTES y DESPUÉS, mapa y datos completos</p>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        {[
          { id:"todos", label:"Todos", count:total },
          { id:"visitas", label:"🧭 Visitas", count:visAsig.length },
          { id:"bateas", label:"🗑️ Bateas", count:bateasAsig.length },
          { id:"desmalezados", label:"🌿 Desmalezados", count:desAsig.length },
          { id:"caminos", label:"🛤️ Caminos", count:camAsig.length },
          { id:"operativos", label:"🔧 Op. Conjuntos", count:operativos.length },
          { id:"op_central", label:"🏛️ Op. Central", count:ocLista.length },
        ].map(f => (
          <button key={f.id} onClick={()=>setFiltro(f.id)} style={{
            padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer",
            background:filtro===f.id ? "#1565C0" : "#FFF",
            color:filtro===f.id ? "#FFF" : "#555",
            border:filtro===f.id ? "2px solid #1565C0" : "1px solid #DDD",
          }}>
            {f.label} <span style={{ opacity:.7 }}>({f.count})</span>
          </button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {(filtro==="todos"||filtro==="visitas") && visAsig.map(v => (
          <ItemReporte key={v.id} emoji="🧭" folio={v.folio} titulo={v.nombre_vecino} subtitulo={v.direccion}
            info={`${v.fecha_visita?`Visita: ${v.fecha_visita}`:""}${v.responsable?` · 👷 ${v.responsable}`:""} · ${v.fecha_solicitud}`}
            color="#6A1B9A" esEmergencia={!!v.es_emergencia} onGenerar={()=>generarReporte("visita",v)} />
        ))}
        {(filtro==="todos"||filtro==="bateas") && bateasAsig.map(s => (
          <ItemReporte key={s.id} emoji="🗑️" folio={s.folio} titulo={s.nombre_vecino} subtitulo={s.direccion}
            info={`Batea: ${s.numero_batea||"—"} · ${s.fecha_solicitud}${s.fotos_antes?.length>0?` · 📷 ${s.fotos_antes.length} foto(s)`:""}`}
            color="#1565C0" esEmergencia={!!s.es_emergencia} onGenerar={()=>generarReporte("batea",s)} />
        ))}
        {(filtro==="todos"||filtro==="desmalezados") && desAsig.map(d => (
          <ItemReporte key={d.id} emoji="🌿" folio={d.folio} titulo={d.nombre_solicitante||"Registro interno"} subtitulo={d.direccion}
            info={`${d.fecha_inicio?`Inicio: ${d.fecha_inicio}`:""}${d.fecha_termino?` → ${d.fecha_termino}`:""}${d.dias_uso?` (${d.dias_uso}d)`:""} · 📷 ${(d.fotos_antes?.length||0)} antes / ${(d.fotos_despues?.length||0)} después`}
            color="#2E7D32" esEmergencia={!!d.es_emergencia} onGenerar={()=>generarReporte("desmalezado",d)} />
        ))}
        {(filtro==="todos"||filtro==="caminos") && camAsig.map(c => (
          <ItemReporte key={c.id} emoji="🛤️" folio={c.folio} titulo={`${c.nombre_solicitante||"Registro interno"} — ${c.tipo_camino}`} subtitulo={c.direccion}
            info={`${c.fecha_inicio?`Inicio: ${c.fecha_inicio}`:""}${c.fecha_termino?` → ${c.fecha_termino}`:""}${c.dias_uso?` (${c.dias_uso}d)`:""} · 📷 ${(c.fotos_antes?.length||0)} antes / ${(c.fotos_despues?.length||0)} después`}
            color="#E65100" esEmergencia={!!c.es_emergencia} onGenerar={()=>generarReporte("camino",c)} />
        ))}
        {(filtro==="todos"||filtro==="operativos") && operativos.map(op => (
          <ItemReporte key={op.id} emoji="🔧" folio={op.codigo} titulo={`Batea: ${op.numero_batea} — ${op.nombre_vecino||""}`} subtitulo={op.direccion_batea||""}
            info={`${op.fecha_inicio?`Inicio: ${op.fecha_inicio}`:""}${op.fecha_termino?` → ${op.fecha_termino}`:""} · 📷 ${(op.fotos_antes?.length||0)} antes / ${(op.fotos_despues?.length||0)} después`}
            color="#6A1B9A" onGenerar={()=>generarReporte("operativo",op)} />
        ))}
        {(filtro==="todos"||filtro==="op_central") && ocLista.map(op => (
          <ItemReporte key={op.id} emoji="🏛️" folio={op.codigo}
            titulo={op.titulo}
            subtitulo={`${op.departamento||""} ${op.departamento&&op.sector?"·":""} ${op.sector||""}`}
            info={`${op.responsable_principal?`👤 ${op.responsable_principal}`:""} ${op.fecha_inicio?`· Inicio: ${op.fecha_inicio}`:""}${op.fecha_termino?` → ${op.fecha_termino}`:""} · 📷 ${(op.fotos_antes?.length||0)} antes / ${(op.fotos_despues?.length||0)} después`}
            color="#1B5E20" esEmergencia={op.tipo_operativo==="emergencia"} onGenerar={()=>generarReporte("operativo_central",op)} />
        ))}
        {total === 0 && (
          <div style={{ textAlign:"center", padding:60, color:"#888" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📄</div>
            <div style={{ fontSize:16, fontWeight:600 }}>Sin registros para reportar</div>
            <div style={{ fontSize:13, marginTop:6 }}>Los reportes aparecerán cuando se asignen bateas, desmalezados o caminos.</div>
          </div>
        )}
      </div>
    </div>
  );
}
// ── BOTONES DE ACCIÓN AGRUPADOS (Asignar / Editar / Realizada / Eliminar) ─────
function BotonesAccion({ id, endpoint, estado, color, onAsignar, onEditar, onRecargar, labelAsignar="📋 Asignar" }) {
  const handleRealizada = async () => {
    if (!window.confirm("¿Marcar este registro como Realizada/Completada?")) return;
    try {
      const res = await fetch(`${API_URL}/api/${endpoint}/${id}/realizar`, { method:"PUT" });
      const data = await res.json();
      if (res.ok) { alert("✅ "+data.mensaje); onRecargar(); }
      else alert("❌ "+(data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  const handleEliminar = async () => {
    if (!window.confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    try {
      const res = await fetch(`${API_URL}/api/${endpoint}/${id}`, { method:"DELETE" });
      const data = await res.json();
      if (res.ok) { alert("✅ "+data.mensaje); onRecargar(); }
      else alert("❌ "+(data.detail||"Error"));
    } catch { alert("❌ Error de conexión"); }
  };
  // Estados finales — ya no se puede asignar ni marcar realizada
  const estadoFinal = ["completado","instalada","retirada","finalizada"].includes(estado);
  const btnBase = {
    padding:"6px 0", borderRadius:7, fontSize:12, fontWeight:700,
    cursor:"pointer", width:96, textAlign:"center",
    border:"1px solid transparent", display:"flex",
    alignItems:"center", justifyContent:"center", gap:4
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"stretch", minWidth:100 }}>
      {/* Asignar — siempre visible */}
      {onAsignar && (
        <button onClick={onAsignar} style={{...btnBase, background:color, color:"#FFF", border:`1px solid ${color}`}}>
          {labelAsignar}
        </button>
      )}
      {/* Editar — siempre visible */}
      <button onClick={onEditar} style={{...btnBase, background:"#FFF", color:"#E65100", border:"1px solid #E65100"}}>
        ✏️ Editar
      </button>
      {/* Realizada — siempre visible */}
      <button onClick={handleRealizada} style={{...btnBase, background:"#FFF", color:C.verde, border:`1px solid ${C.verde}`}}>
        ✅ Realizada
      </button>
      {/* Eliminar — siempre visible */}
      <button onClick={handleEliminar} style={{...btnBase, background:"#FFF", color:C.rojo, border:`1px solid ${C.rojo}`}}>
        🗑️ Eliminar
      </button>
    </div>
  );
}
// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [solicitudes, setSolicitudes] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [desmalezados, setDesmalezados] = useState([]);
  const [caminos, setCaminos] = useState([]);
  const [operativos, setOperativos] = useState([]);
  const [operativosCentrales, setOperativosCentrales] = useState([]);
  const [kpis, setKpis] = useState({});
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalActivo, setModalActivo] = useState(null);
  const [modalAsignar, setModalAsignar] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [resultadoClustering, setResultadoClustering] = useState(null);
  const cargarDatos = useCallback(async () => {
    try {
      const [rSol, rDes, rCam, rOpe, rKpi, rOC, rSt, rVis] = await Promise.all([
        fetch(`${API_URL}/api/solicitudes`),
        fetch(`${API_URL}/api/desmalezados`),
        fetch(`${API_URL}/api/caminos`),
        fetch(`${API_URL}/api/operativos-conjuntos`),
        fetch(`${API_URL}/api/dashboard/kpis`),
        fetch(`${API_URL}/api/operativos-centrales`),
        fetch(`${API_URL}/api/estadisticas`),
        fetch(`${API_URL}/api/visitas`),
      ]);
      if (rSol.ok) { const d=await rSol.json(); setSolicitudes(d.solicitudes||[]); }
      if (rVis.ok) { const d=await rVis.json(); setVisitas(d.visitas||[]); }
      if (rDes.ok) { const d=await rDes.json(); setDesmalezados(d.desmalezados||[]); }
      if (rCam.ok) { const d=await rCam.json(); setCaminos(d.caminos||[]); }
      if (rOpe.ok) { const d=await rOpe.json(); setOperativos(d.operativos||[]); }
      if (rKpi.ok) { const d=await rKpi.json(); setKpis(d); }
      if (rOC.ok)  { const d=await rOC.json();  setOperativosCentrales(d.operativos_centrales||[]); }
      if (rSt.ok)  { const d=await rSt.json();  setStats(d); }
    } catch(err) { console.error("Error:", err); }
    setLoading(false);
  }, []);
  useEffect(() => { cargarDatos(); }, [cargarDatos]);
  const handleAsignarBatea = () => setModalAsignar(true);
  const handleConfirmarAsignacion = useCallback(async (diasUso, fechaInicio) => {
    setModalAsignar(false);
    setClustering(true);
    try {
      const res = await fetch(`${API_URL}/api/clustering/ejecutar`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ radio_metros:100, dias_uso:diasUso, fecha_inicio:fechaInicio })
      });
      const data = await res.json();
      if (res.ok) { setResultadoClustering(data); await cargarDatos(); }
      else alert("❌ Error: "+(data.detail||"Error desconocido"));
    } catch { alert("❌ Error de conexión"); }
    setClustering(false);
  }, [cargarDatos]);
  const [vecinoPrelleno, setVecinoPrelleno] = useState(null);
  const handleGuardar = async (data) => {
    setModalActivo(null);
    // Si viene señal para abrir otro servicio con datos prellenados
    if (data?._abrirDesmalezado) {
      setVecinoPrelleno(data._abrirDesmalezado);
      setModalActivo("desmalezado");
    } else if (data?._abrirCamino) {
      setVecinoPrelleno(data._abrirCamino);
      setModalActivo("camino");
    } else {
      setVecinoPrelleno(null);
    }
    await cargarDatos();
  };
  const renderView = () => {
    switch(activeView) {
      case "dashboard":    return <ViewDashboard kpis={kpis} stats={stats} />;
      case "visitas":      return <ViewVisitas visitas={visitas} onNueva={()=>setModalActivo("visita")} loading={loading} onRecargar={cargarDatos} />;
      case "bateas":       return <ViewBateas solicitudes={solicitudes} onNueva={()=>setModalActivo("batea")} loading={loading} onAsignarBatea={handleAsignarBatea} clustering={clustering} onRecargar={cargarDatos} />;
      case "desmalezados": return <ViewDesmalezados desmalezados={desmalezados} onNuevo={()=>setModalActivo("desmalezado")} loading={loading} onRecargar={cargarDatos} />;
      case "caminos":      return <ViewCaminos caminos={caminos} onNuevo={()=>setModalActivo("camino")} loading={loading} onRecargar={cargarDatos} />;
      case "operativos":   return <ViewOperativos operativos={operativos} solicitudes={solicitudes} desmalezados={desmalezados} loading={loading} onRecargar={cargarDatos} />;
      case "op_central":   return <ViewOperativoCentral operativos={operativosCentrales} loading={loading} onRecargar={cargarDatos} />;
      case "mapa":         return <ViewMapa solicitudes={solicitudes} desmalezados={desmalezados} caminos={caminos} operativos={operativos} />;
      case "alertas":      return <ViewAlertas solicitudes={solicitudes} desmalezados={desmalezados} caminos={caminos} />;
      case "reportes":     return <ViewReportes solicitudes={solicitudes} desmalezados={desmalezados} caminos={caminos} operativos={operativos} operativosCentrales={operativosCentrales} visitas={visitas} />;
      default: return <div style={{ padding:40, textAlign:"center", color:"#888" }}><div style={{ fontSize:48, marginBottom:16 }}>🚧</div><h2>Módulo en desarrollo</h2></div>;
    }
  };
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.fondo, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`* { box-sizing:border-box; } .leaflet-container { z-index:1; } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.6; } }`}</style>
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>{renderView()}</main>
      {modalActivo==="visita"      && <ModalVisita      onClose={()=>setModalActivo(null)} onGuardar={handleGuardar} />}
      {modalActivo==="batea"       && <ModalBatea       onClose={()=>setModalActivo(null)} onGuardar={handleGuardar} vecinoPrelleno={vecinoPrelleno} />}
      {modalActivo==="desmalezado" && <ModalDesmalezado onClose={()=>setModalActivo(null)} onGuardar={handleGuardar} vecinoPrelleno={vecinoPrelleno} />}
      {modalActivo==="camino"      && <ModalCamino      onClose={()=>setModalActivo(null)} onGuardar={handleGuardar} vecinoPrelleno={vecinoPrelleno} />}
      {modalAsignar && <ModalAsignarBatea onClose={()=>setModalAsignar(false)} onConfirmar={handleConfirmarAsignacion} />}
      {resultadoClustering && <ModalClusteringResultado resultado={resultadoClustering} onClose={()=>setResultadoClustering(null)} />}
    </div>
  );
}
