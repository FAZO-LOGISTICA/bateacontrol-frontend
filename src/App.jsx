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

const API_URL = "https://bateacontrol-backend.onrender.com";
const CLOUDINARY_CLOUD = "drhceyh7g";
const CLOUDINARY_PRESET = "bateacontrol";

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

function FotoUploader({ label, preview, subiendo, onUpload }) {
  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    onUpload(null, null, true);
    const reader = new FileReader();
    reader.onload = (ev) => onUpload(ev.target.result, null, true);
    reader.readAsDataURL(file);
    try { const url = await subirCloudinary(file); onUpload(preview, url, false); }
    catch { onUpload(preview, null, false); }
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <label style={{ fontSize:13, fontWeight:600, color:"#333" }}>{label}</label>
      <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", width:"100%", height:110, border:"2px dashed #CCC", borderRadius:10, cursor:"pointer", background:"#F8F8F8", overflow:"hidden" }}>
        {preview ? <img src={preview} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <><span style={{ fontSize:28 }}>📷</span><span style={{ fontSize:11, color:"#888", marginTop:4 }}>Subir foto</span></>}
        <input type="file" accept="image/*" onChange={handleChange} style={{ display:"none" }} />
      </label>
      {subiendo && <span style={{ fontSize:11, color:C.azul }}>⏳ Subiendo...</span>}
      {preview && !subiendo && <span style={{ fontSize:11, color:C.verde }}>✅ Guardada en la nube</span>}
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

function ModalBatea({ onClose, onGuardar }) {
  const [form, setForm] = useState({ nombre:"", rut:"", direccion:"", telefono:"", latitud:"", longitud:"", observaciones:"", foto_preview:"", foto_url:"", subiendo:false });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [alertaHistorial, setAlertaHistorial] = useState(null);
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
    if (!form.nombre.trim()) e.nombre="Requerido";
    if (!form.rut.trim()) e.rut="Requerido";
    if (!form.direccion.trim()) e.direccion="Requerido";
    if (!form.latitud||isNaN(parseFloat(form.latitud))) e.latitud="Inválida";
    if (!form.longitud||isNaN(parseFloat(form.longitud))) e.longitud="Inválida";
    setErrores(e); return Object.keys(e).length===0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/api/solicitudes`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nombre_vecino:form.nombre, rut:form.rut, direccion:form.direccion, telefono:form.telefono, latitud:parseFloat(form.latitud), longitud:parseFloat(form.longitud), observaciones:form.observaciones, foto_url:form.foto_url||form.foto_preview||"" })
      });
      const data = await res.json();
      if (!res.ok) { alert("❌ "+(data.detail||"Error")); setGuardando(false); return; }
      onGuardar(data);
    } catch { alert("❌ Error de conexión"); }
    setGuardando(false);
  };

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
      <SeccionForm titulo="👤 Datos del Vecino" color={C.azul}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Nombre completo" required error={errores.nombre}>
            <input style={{...inp, borderColor:errores.nombre?C.rojo:"#DDD"}} value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="María González Riquelme" />
          </Field>
          <Field label="RUT" required error={errores.rut}>
            <input style={{...inp, borderColor:errores.rut?C.rojo:"#DDD"}} value={form.rut} onChange={e=>set("rut",e.target.value)} onBlur={e=>verificarRUT(e.target.value)} placeholder="12.345.678-9" />
          </Field>
          <Field label="Teléfono">
            <input style={inp} value={form.telefono} onChange={e=>set("telefono",e.target.value)} placeholder="+56912345678" />
          </Field>
          <Field label="Dirección" required error={errores.direccion}>
            <input style={{...inp, borderColor:errores.direccion?C.rojo:"#DDD"}} value={form.direccion} onChange={e=>set("direccion",e.target.value)} placeholder="Av. Argentina 1234" />
          </Field>
        </div>
      </SeccionForm>
      <SeccionGeorref errores={errores} latitud={form.latitud} longitud={form.longitud} set={set} />
      <FotoUploader label="📷 Foto del sector (ANTES)" preview={form.foto_preview} subiendo={form.subiendo}
        onUpload={(preview,url,sub)=>{ if(preview) set("foto_preview",preview); if(url) set("foto_url",url); set("subiendo",sub); }} />
      <Field label="Observaciones">
        <textarea style={{...inp, minHeight:70, resize:"vertical"}} value={form.observaciones} onChange={e=>set("observaciones",e.target.value)} placeholder="Información adicional..." />
      </Field>
      <BotonesModal onClose={onClose} onGuardar={handleGuardar} guardando={guardando} subiendo={form.subiendo} />
    </Modal>
  );
}

function ModalDesmalezado({ onClose, onGuardar }) {
  const [form, setForm] = useState({ nombre:"", es_recordatorio:false, direccion:"", descripcion:"", latitud:"", longitud:"", foto_preview:"", foto_url:"", subiendo:false });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const validar = () => {
    const e = {};
    if (!form.direccion.trim()) e.direccion="Requerido";
    if (!form.latitud||isNaN(parseFloat(form.latitud))) e.latitud="Inválida";
    if (!form.longitud||isNaN(parseFloat(form.longitud))) e.longitud="Inválida";
    setErrores(e); return Object.keys(e).length===0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/api/desmalezados`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nombre_solicitante:form.nombre, es_recordatorio:form.es_recordatorio, direccion:form.direccion, descripcion:form.descripcion, latitud:parseFloat(form.latitud), longitud:parseFloat(form.longitud), foto_antes:form.foto_url||"" })
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
      <SeccionForm titulo="📋 Datos del Registro" color={C.verde}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Nombre / Referencia">
            <input style={inp} value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Nombre o referencia interna" />
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
        </div>
      </SeccionForm>
      <SeccionGeorref errores={errores} latitud={form.latitud} longitud={form.longitud} set={set} />
      <FotoUploader label="📷 Foto ANTES del desmalezado" preview={form.foto_preview} subiendo={form.subiendo}
        onUpload={(preview,url,sub)=>{ if(preview) set("foto_preview",preview); if(url) set("foto_url",url); set("subiendo",sub); }} />
      <div style={{ background:"#E8F5E9", borderRadius:8, padding:"10px 14px", fontSize:12, color:C.verde }}>
        🔧 Si hay una batea pendiente a menos de 100m, el sistema sugerirá crear un Operativo Conjunto automáticamente.
      </div>
      <BotonesModal onClose={onClose} onGuardar={handleGuardar} guardando={guardando} subiendo={form.subiendo} />
    </Modal>
  );
}

function ModalCamino({ onClose, onGuardar }) {
  const [form, setForm] = useState({ nombre:"", es_recordatorio:false, direccion:"", tipo_camino:"camino", descripcion_problema:"", prioridad:"normal", latitud:"", longitud:"", foto_preview:"", foto_url:"", subiendo:false });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const validar = () => {
    const e = {};
    if (!form.direccion.trim()) e.direccion="Requerido";
    if (!form.latitud||isNaN(parseFloat(form.latitud))) e.latitud="Inválida";
    if (!form.longitud||isNaN(parseFloat(form.longitud))) e.longitud="Inválida";
    setErrores(e); return Object.keys(e).length===0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const res = await fetch(`${API_URL}/api/caminos`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ nombre_solicitante:form.nombre, es_recordatorio:form.es_recordatorio, direccion:form.direccion, tipo_camino:form.tipo_camino, descripcion_problema:form.descripcion_problema, prioridad:form.prioridad, latitud:parseFloat(form.latitud), longitud:parseFloat(form.longitud), foto_antes:form.foto_url||"" })
      });
      const data = await res.json();
      if (!res.ok) { alert("❌ "+(data.detail||"Error")); setGuardando(false); return; }
      onGuardar(data);
    } catch { alert("❌ Error de conexión"); }
    setGuardando(false);
  };

  return (
    <Modal titulo="🛤️ Nuevo Arreglo de Camino" color={C.naranja} onClose={onClose}>
      <SeccionForm titulo="📋 Datos del Registro" color={C.naranja}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Field label="Nombre / Referencia">
            <input style={inp} value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Nombre o referencia interna" />
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
            <select style={inp} value={form.prioridad} onChange={e=>set("prioridad",e.target.value)}>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </Field>
          <Field label="Descripción del problema">
            <input style={inp} value={form.descripcion_problema} onChange={e=>set("descripcion_problema",e.target.value)} placeholder="Bache, derrumbe, erosión..." />
          </Field>
        </div>
      </SeccionForm>
      <SeccionGeorref errores={errores} latitud={form.latitud} longitud={form.longitud} set={set} />
      <FotoUploader label="📷 Foto ANTES del arreglo" preview={form.foto_preview} subiendo={form.subiendo}
        onUpload={(preview,url,sub)=>{ if(preview) set("foto_preview",preview); if(url) set("foto_url",url); set("subiendo",sub); }} />
      <BotonesModal onClose={onClose} onGuardar={handleGuardar} guardando={guardando} subiendo={form.subiendo} />
    </Modal>
  );
}

function Sidebar({ activeView, setActiveView }) {
  const items = [
    { id:"dashboard",    icon:"📊", label:"Dashboard"        },
    { id:"bateas",       icon:"🗑️", label:"Bateas"           },
    { id:"desmalezados", icon:"🌿", label:"Desmalezados"     },
    { id:"caminos",      icon:"🛤️", label:"Arreglo Caminos"  },
    { id:"operativos",   icon:"🔧", label:"Op. Conjuntos"    },
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

function ViewDashboard({ solicitudes, kpis, onAsignarBatea, clustering, setActiveView, setModalActivo }) {
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>Panel de Control Municipal</h1>
          <p style={{ margin:"4px 0 0", color:"#666", fontSize:14 }}>{new Date().toLocaleDateString("es-CL",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        <button onClick={onAsignarBatea} disabled={clustering} style={{ background:clustering?"#888":C.azul, color:"#FFF", border:"none", borderRadius:10, padding:"12px 24px", fontSize:14, fontWeight:700, cursor:clustering?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:clustering?"none":"0 4px 12px rgba(21,101,192,0.4)" }}>
          {clustering?"⏳ Procesando...":"🗑️ ASIGNAR BATEA"}
        </button>
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🗑️ Bateas</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
        <KPICard label="Pendientes" value={kpis.pendientes||0} icon="📋" color={C.azul} bg={C.azulS} sub="Esperando agrupación" />
        <KPICard label="Críticas" value={kpis.criticas||0} icon="🔴" color={C.rojo} bg={C.rojoS} sub="≥20 días sin respuesta" />
        <KPICard label="Grupos creados" value={kpis.grupos||0} icon="📍" color={C.naranja} bg={C.naranjaS} />
        <KPICard label="Total solicitudes" value={kpis.total||0} icon="📂" color="#546E7A" bg="#ECEFF1" />
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🌿 Otros Servicios</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
        <KPICard label="Desmalezados pendientes" value={kpis.desmalezados_pendientes||0} icon="🌿" color={C.verde} bg={C.verdeS} />
        <KPICard label="Caminos pendientes" value={kpis.caminos_pendientes||0} icon="🛤️" color={C.naranja} bg={C.naranjaS} />
        <KPICard label="Op. Conjuntos planificados" value={kpis.operativos_conjuntos||0} icon="🔧" color={C.morado} bg={C.moradoS} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { icon:"🗑️", label:"Nueva Batea", color:C.azul, action:()=>setModalActivo("batea") },
          { icon:"🌿", label:"Nuevo Desmalezado", color:C.verde, action:()=>setModalActivo("desmalezado") },
          { icon:"🛤️", label:"Nuevo Camino", color:C.naranja, action:()=>setModalActivo("camino") },
          { icon:"🗺️", label:"Ver Mapa", color:"#546E7A", action:()=>setActiveView("mapa") },
        ].map(item => (
          <button key={item.label} onClick={item.action} style={{ padding:"14px", borderRadius:10, border:`1px solid ${item.color}33`, background:`${item.color}11`, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:24 }}>{item.icon}</span>
            <span style={{ fontSize:12, fontWeight:600, color:item.color }}>{item.label}</span>
          </button>
        ))}
      </div>
      <div style={{ background:C.blanco, borderRadius:12, border:"1px solid #E0E0E0", overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #E0E0E0" }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>Solicitudes de Batea Recientes</h3>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFE" }}>
              {["Folio","Vecino","Dirección","Estado","Alerta","Días"].map(h => <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:12, fontWeight:600, color:"#555", borderBottom:"1px solid #E0E0E0" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {solicitudes.slice(0,5).map((s,i) => (
              <tr key={s.id} style={{ background:i%2===0?"#FFF":"#FAFAFA", borderBottom:"1px solid #F0F0F0" }}>
                <td style={{ padding:"9px 16px", fontSize:12, fontFamily:"monospace", color:C.azul, fontWeight:600 }}>{s.folio}</td>
                <td style={{ padding:"9px 16px", fontSize:13 }}>{s.nombre_vecino}{s.tuvo_batea_antes&&<span style={{ marginLeft:6, fontSize:10, background:"#FFF3E0", color:"#E65100", padding:"1px 6px", borderRadius:10 }}>historial</span>}</td>
                <td style={{ padding:"9px 16px", fontSize:12, color:"#666" }}>{s.direccion}</td>
                <td style={{ padding:"9px 16px" }}><Badge estado={s.estado} small /></td>
                <td style={{ padding:"9px 16px" }}><Badge alerta={s.nivel_alerta} small /></td>
                <td style={{ padding:"9px 16px", fontSize:13, fontWeight:700, color:s.dias_pendiente>=20?C.rojo:s.dias_pendiente>=11?C.naranja:C.verde }}>{s.dias_pendiente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViewBateas({ solicitudes, onNueva, loading, onAsignarBatea, clustering }) {
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
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
          columnas={["Folio","Vecino","Dirección","Coords","Estado","Alerta","Días","Foto"]}
          filas={filtradas.map((s,i) => ({
            key:s.id, critica:s.nivel_alerta==="critica", par:i%2===0,
            celdas:[
              <span style={{ fontFamily:"monospace", color:C.azul, fontWeight:600, fontSize:12 }}>{s.folio}</span>,
              <span>{s.nombre_vecino}{s.tuvo_batea_antes&&<span style={{ marginLeft:6, fontSize:10, background:"#FFF3E0", color:"#E65100", padding:"1px 6px", borderRadius:10 }}>⚠ historial</span>}</span>,
              <span style={{ fontSize:12, color:"#666" }}>{s.direccion}</span>,
              <span style={{ fontSize:11, color:"#888", fontFamily:"monospace" }}>{parseFloat(s.latitud||0).toFixed(4)}, {parseFloat(s.longitud||0).toFixed(4)}</span>,
              <Badge estado={s.estado} small />,
              <Badge alerta={s.nivel_alerta} small />,
              <span style={{ fontWeight:700, color:s.dias_pendiente>=20?C.rojo:s.dias_pendiente>=11?C.naranja:C.verde }}>{s.dias_pendiente}d</span>,
              s.foto_url ? <a href={s.foto_url} target="_blank" rel="noreferrer"><img src={s.foto_url} alt="foto" style={{ width:36,height:36,objectFit:"cover",borderRadius:6,border:"1px solid #DDD" }} /></a> : <span style={{ fontSize:11, color:"#CCC" }}>Sin foto</span>
            ]
          }))}
          total={solicitudes.length}
        />
      )}
    </div>
  );
}

function ViewDesmalezados({ desmalezados, onNuevo, loading }) {
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🌿 Desmalezados</h1>
        <button onClick={onNuevo} style={{ background:C.verde, color:"#FFF", border:"none", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Nuevo Desmalezado</button>
      </div>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando...</div> : (
        <TablaGenerica
          columnas={["Folio","Solicitante","Dirección","Estado","Días","Foto ANTES","Foto DESPUÉS"]}
          filas={desmalezados.map((d,i) => ({
            key:d.id, critica:false, par:i%2===0,
            celdas:[
              <span style={{ fontFamily:"monospace", color:C.verde, fontWeight:600, fontSize:12 }}>{d.folio}</span>,
              <span>{d.nombre_solicitante}{d.es_recordatorio&&<span style={{ marginLeft:6, fontSize:10, background:"#E8F5E9", color:C.verde, padding:"1px 6px", borderRadius:10 }}>📝 interno</span>}</span>,
              <span style={{ fontSize:12, color:"#666" }}>{d.direccion}</span>,
              <Badge estado={d.estado} small />,
              <span style={{ fontWeight:700, color:d.dias_pendiente>=20?C.rojo:d.dias_pendiente>=11?C.naranja:C.verde }}>{d.dias_pendiente}d</span>,
              d.foto_antes ? <a href={d.foto_antes} target="_blank" rel="noreferrer"><img src={d.foto_antes} alt="antes" style={{ width:36,height:36,objectFit:"cover",borderRadius:6,border:"1px solid #DDD" }} /></a> : <span style={{ fontSize:11, color:"#CCC" }}>Sin foto</span>,
              d.foto_despues ? <a href={d.foto_despues} target="_blank" rel="noreferrer"><img src={d.foto_despues} alt="después" style={{ width:36,height:36,objectFit:"cover",borderRadius:6,border:`2px solid ${C.verde}` }} /></a> : <span style={{ fontSize:11, color:"#CCC" }}>Pendiente</span>
            ]
          }))}
          total={desmalezados.length}
        />
      )}
    </div>
  );
}

function ViewCaminos({ caminos, onNuevo, loading }) {
  const pc = { urgente:C.rojo, alta:C.naranja, normal:C.verde };
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🛤️ Arreglo de Caminos</h1>
        <button onClick={onNuevo} style={{ background:C.naranja, color:"#FFF", border:"none", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer" }}>+ Nuevo Camino</button>
      </div>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando...</div> : (
        <TablaGenerica
          columnas={["Folio","Solicitante","Dirección","Tipo","Prioridad","Estado","Días","Foto ANTES","Foto DESPUÉS"]}
          filas={caminos.map((c,i) => ({
            key:c.id, critica:c.prioridad==="urgente", par:i%2===0,
            celdas:[
              <span style={{ fontFamily:"monospace", color:C.naranja, fontWeight:600, fontSize:12 }}>{c.folio}</span>,
              <span>{c.nombre_solicitante}{c.es_recordatorio&&<span style={{ marginLeft:6, fontSize:10, background:"#FFF3E0", color:C.naranja, padding:"1px 6px", borderRadius:10 }}>📝 interno</span>}</span>,
              <span style={{ fontSize:12, color:"#666" }}>{c.direccion}</span>,
              <span style={{ fontSize:12 }}>{c.tipo_camino}</span>,
              <span style={{ fontSize:12, fontWeight:600, color:pc[c.prioridad]||C.verde }}>{c.prioridad}</span>,
              <Badge estado={c.estado} small />,
              <span style={{ fontWeight:700, color:c.dias_pendiente>=20?C.rojo:c.dias_pendiente>=11?C.naranja:C.verde }}>{c.dias_pendiente}d</span>,
              c.foto_antes ? <a href={c.foto_antes} target="_blank" rel="noreferrer"><img src={c.foto_antes} alt="antes" style={{ width:36,height:36,objectFit:"cover",borderRadius:6,border:"1px solid #DDD" }} /></a> : <span style={{ fontSize:11, color:"#CCC" }}>Sin foto</span>,
              c.foto_despues ? <a href={c.foto_despues} target="_blank" rel="noreferrer"><img src={c.foto_despues} alt="después" style={{ width:36,height:36,objectFit:"cover",borderRadius:6,border:`2px solid ${C.verde}` }} /></a> : <span style={{ fontSize:11, color:"#CCC" }}>Pendiente</span>
            ]
          }))}
          total={caminos.length}
        />
      )}
    </div>
  );
}

function ViewOperativos({ operativos, loading }) {
  return (
    <div style={{ padding:28 }}>
      <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🔧 Operativos Conjuntos</h1>
      <div style={{ background:"#F3E5F5", border:"1px solid #CE93D8", borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:C.morado }}>
        🔧 Combinan <strong>Batea + Desmalezado</strong> en un mismo punto. Los operarios depositan las ramas directamente en la batea — un solo viaje, dos servicios.
      </div>
      {loading ? <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando...</div> :
        operativos.length===0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#888" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔧</div>
            <div style={{ fontSize:16, fontWeight:600 }}>No hay operativos conjuntos</div>
            <div style={{ fontSize:13, marginTop:6 }}>Se crean automáticamente al registrar un desmalezado cerca de una batea pendiente</div>
          </div>
        ) : (
          <div style={{ display:"grid", gap:12 }}>
            {operativos.map(op => (
              <div key={op.id} style={{ background:C.blanco, border:"1px solid #CE93D8", borderLeft:`4px solid ${C.morado}`, borderRadius:10, padding:"16px 20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, color:C.morado }}>{op.codigo}</div>
                    <div style={{ fontSize:13, color:"#555", marginTop:4 }}>🗑️ Batea: <strong>{op.numero_batea}</strong> — {op.direccion_batea}</div>
                    <div style={{ fontSize:13, color:"#555", marginTop:2 }}>🌿 Desmalezado: {op.direccion_desmalezado}</div>
                    <div style={{ fontSize:12, color:"#888", marginTop:4 }}>Planificado: {op.fecha_planificacion}</div>
                  </div>
                  <Badge estado={op.estado} />
                </div>
              </div>
            ))}
          </div>
        )
      }
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
  const criticas = solicitudes.filter(s=>s.nivel_alerta==="critica"&&s.estado==="pendiente");
  const advertencias = solicitudes.filter(s=>s.nivel_alerta==="advertencia"&&s.estado==="pendiente");
  const caminosUrgentes = caminos.filter(c=>c.prioridad==="urgente"&&c.estado==="pendiente");
  return (
    <div style={{ padding:28 }}>
      <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:700, color:"#1A2A3A" }}>🔔 Sistema de Alertas</h1>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
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
        <div style={{ background:C.rojoS, border:"1px solid #FFCDD2", borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
          <div style={{ fontSize:34, fontWeight:800, color:C.rojo }}>{caminosUrgentes.length}</div>
          <div style={{ fontSize:13, fontWeight:600, color:C.rojo }}>🛤️ Caminos Urgentes</div>
          <div style={{ fontSize:11, color:"#888", marginTop:3 }}>Prioridad urgente</div>
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
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:C.azul, color:"#FFF", fontSize:15, fontWeight:700, cursor:"pointer" }}>Aceptar</button>
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [solicitudes, setSolicitudes] = useState([]);
  const [desmalezados, setDesmalezados] = useState([]);
  const [caminos, setCaminos] = useState([]);
  const [operativos, setOperativos] = useState([]);
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalActivo, setModalActivo] = useState(null);
  const [clustering, setClustering] = useState(false);
  const [resultadoClustering, setResultadoClustering] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      const [rSol, rDes, rCam, rOpe, rKpi] = await Promise.all([
        fetch(`${API_URL}/api/solicitudes`),
        fetch(`${API_URL}/api/desmalezados`),
        fetch(`${API_URL}/api/caminos`),
        fetch(`${API_URL}/api/operativos-conjuntos`),
        fetch(`${API_URL}/api/dashboard/kpis`),
      ]);
      if (rSol.ok) { const d=await rSol.json(); setSolicitudes(d.solicitudes||[]); }
      if (rDes.ok) { const d=await rDes.json(); setDesmalezados(d.desmalezados||[]); }
      if (rCam.ok) { const d=await rCam.json(); setCaminos(d.caminos||[]); }
      if (rOpe.ok) { const d=await rOpe.json(); setOperativos(d.operativos||[]); }
      if (rKpi.ok) { const d=await rKpi.json(); setKpis(d); }
    } catch(err) { console.error("Error:", err); }
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleAsignarBatea = useCallback(async () => {
    setClustering(true);
    try {
      const res = await fetch(`${API_URL}/api/clustering/ejecutar?radio_metros=100`, { method:"POST" });
      const data = await res.json();
      if (res.ok) { setResultadoClustering(data); await cargarDatos(); }
      else alert("❌ Error: "+(data.detail||"Error desconocido"));
    } catch { alert("❌ Error de conexión"); }
    setClustering(false);
  }, [cargarDatos]);

  const handleGuardar = async () => {
    setModalActivo(null);
    await cargarDatos();
  };

  const renderView = () => {
    switch(activeView) {
      case "dashboard":    return <ViewDashboard solicitudes={solicitudes} kpis={kpis} onAsignarBatea={handleAsignarBatea} clustering={clustering} setActiveView={setActiveView} setModalActivo={setModalActivo} />;
      case "bateas":       return <ViewBateas solicitudes={solicitudes} onNueva={()=>setModalActivo("batea")} loading={loading} onAsignarBatea={handleAsignarBatea} clustering={clustering} />;
      case "desmalezados": return <ViewDesmalezados desmalezados={desmalezados} onNuevo={()=>setModalActivo("desmalezado")} loading={loading} />;
      case "caminos":      return <ViewCaminos caminos={caminos} onNuevo={()=>setModalActivo("camino")} loading={loading} />;
      case "operativos":   return <ViewOperativos operativos={operativos} loading={loading} />;
      case "mapa":         return <ViewMapa solicitudes={solicitudes} desmalezados={desmalezados} caminos={caminos} operativos={operativos} />;
      case "alertas":      return <ViewAlertas solicitudes={solicitudes} desmalezados={desmalezados} caminos={caminos} />;
      default: return <div style={{ padding:40, textAlign:"center", color:"#888" }}><div style={{ fontSize:48, marginBottom:16 }}>🚧</div><h2>Módulo en desarrollo</h2></div>;
    }
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.fondo, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`* { box-sizing:border-box; } .leaflet-container { z-index:1; }`}</style>
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>{renderView()}</main>
      {modalActivo==="batea"       && <ModalBatea       onClose={()=>setModalActivo(null)} onGuardar={handleGuardar} />}
      {modalActivo==="desmalezado" && <ModalDesmalezado onClose={()=>setModalActivo(null)} onGuardar={handleGuardar} />}
      {modalActivo==="camino"      && <ModalCamino      onClose={()=>setModalActivo(null)} onGuardar={handleGuardar} />}
      {resultadoClustering && <ModalClusteringResultado resultado={resultadoClustering} onClose={()=>setResultadoClustering(null)} />}
    </div>
  );
}
