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

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────
const API_URL = "https://bateacontrol-backend.onrender.com";
const CLOUDINARY_CLOUD = "drhceyh7g";
const CLOUDINARY_PRESET = "bateacontrol";

// ── PALETA ────────────────────────────────────────────────────────────────────
const C = {
  azul:"#1565C0", azulC:"#1976D2", azulS:"#E3F2FD",
  verde:"#2E7D32", verdeS:"#E8F5E9",
  rojo:"#C62828", rojoS:"#FFEBEE",
  naranja:"#E65100", naranjaS:"#FFF3E0",
  blanco:"#FFFFFF", fondo:"#F0F4F8",
};

const ESTADOS = {
  pendiente:  { color:"#1565C0", bg:"#E3F2FD", label:"Pendiente" },
  agrupada:   { color:"#7B1FA2", bg:"#F3E5F5", label:"Agrupada"  },
  asignada:   { color:"#2E7D32", bg:"#E8F5E9", label:"Asignada"  },
  instalada:  { color:"#00838F", bg:"#E0F7FA", label:"Instalada" },
  retirada:   { color:"#37474F", bg:"#ECEFF1", label:"Retirada"  },
  finalizada: { color:"#546E7A", bg:"#ECEFF1", label:"Finalizada"},
  critica:    { color:"#C62828", bg:"#FFEBEE", label:"Crítica"   },
};

const ALERTAS = {
  normal:      { color:"#2E7D32", bg:"#E8F5E9", icon:"✓",  label:"normal"      },
  advertencia: { color:"#E65100", bg:"#FFF3E0", icon:"⚠",  label:"advertencia" },
  critica:     { color:"#C62828", bg:"#FFEBEE", icon:"🔴", label:"crítica"     },
};

// ── COMPONENTES BASE ──────────────────────────────────────────────────────────

function Badge({ estado, alerta, small }) {
  const cfg = alerta ? ALERTAS[alerta] : ESTADOS[estado] || ESTADOS.pendiente;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      background:cfg.bg, color:cfg.color,
      padding: small ? "2px 8px" : "3px 10px",
      borderRadius:20, fontSize: small ? 11 : 12,
      fontWeight:600, whiteSpace:"nowrap",
      border:`1px solid ${cfg.color}22`
    }}>
      {alerta && <span>{cfg.icon}</span>}
      {alerta ? cfg.label : cfg.label}
    </span>
  );
}

function KPICard({ label, value, icon, color, bg, sub }) {
  return (
    <div style={{
      background:C.blanco, border:"1px solid #E0E0E0", borderRadius:12,
      padding:"18px 20px", borderLeft:`4px solid ${color}`,
      display:"flex", flexDirection:"column", gap:4,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ fontSize:13, color:"#666", fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:22, background:bg, borderRadius:8, padding:"4px 8px" }}>{icon}</span>
      </div>
      <div style={{ fontSize:32, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#888" }}>{sub}</div>}
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <label style={{ fontSize:13, fontWeight:600, color:"#333" }}>
        {label} {required && <span style={{ color:C.rojo }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize:11, color:C.rojo }}>{error}</span>}
    </div>
  );
}

const inp = {
  padding:"10px 14px", borderRadius:8, border:"1px solid #DDD",
  fontSize:14, outline:"none", background:"#FFF",
  width:"100%", boxSizing:"border-box"
};

// ── SUBIDA A CLOUDINARY ───────────────────────────────────────────────────────
async function subirFotoCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("cloud_name", CLOUDINARY_CLOUD);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method:"POST", body:formData }
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error("Error al subir imagen");
  return data.secure_url;
}

// ── MODAL NUEVA SOLICITUD ─────────────────────────────────────────────────────
function ModalNuevaSolicitud({ onClose, onGuardar }) {
  const [form, setForm] = useState({
    nombre:"", rut:"", direccion:"", telefono:"",
    latitud:"", longitud:"", observaciones:"",
    foto_solicitud: null, foto_preview:"",
    foto_url_cloudinary:"", subiendo_foto:false
  });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [alertaDuplicado, setAlertaDuplicado] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));

  // Verificar historial del vecino al ingresar RUT
  const verificarRUT = async (rut) => {
    if (rut.length < 9) return;
    try {
      const res = await fetch(`${API_URL}/api/vecinos/${rut}/historial`);
      if (res.ok) {
        const data = await res.json();
        if (data.alerta) setAlertaDuplicado(data);
        else setAlertaDuplicado(null);
      }
    } catch {}
  };

  const handleFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Preview inmediato
    const reader = new FileReader();
    reader.onload = (ev) => set("foto_preview", ev.target.result);
    reader.readAsDataURL(file);
    set("foto_solicitud", file);
    set("subiendo_foto", true);
    try {
      const url = await subirFotoCloudinary(file);
      set("foto_url_cloudinary", url);
    } catch (err) {
      console.error("Error subiendo foto:", err);
    }
    set("subiendo_foto", false);
  };

  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Requerido";
    if (!form.rut.trim()) e.rut = "Requerido";
    if (!form.direccion.trim()) e.direccion = "Requerido";
    if (!form.latitud || isNaN(parseFloat(form.latitud))) e.latitud = "Coordenada inválida";
    if (!form.longitud || isNaN(parseFloat(form.longitud))) e.longitud = "Coordenada inválida";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const payload = {
        nombre_vecino: form.nombre,
        rut: form.rut,
        direccion: form.direccion,
        telefono: form.telefono,
        latitud: parseFloat(form.latitud),
        longitud: parseFloat(form.longitud),
        observaciones: form.observaciones,
        foto_url: form.foto_url_cloudinary || form.foto_preview || "",
      };

      const res = await fetch(`${API_URL}/api/solicitudes`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        alert("❌ " + (data.detail || "Error al guardar"));
        setGuardando(false);
        return;
      }

      onGuardar(data);

    } catch (err) {
      alert("❌ Error de conexión con el servidor");
    }
    setGuardando(false);
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20
    }}>
      <div style={{
        background:"#FFF", borderRadius:16, width:"100%", maxWidth:640,
        maxHeight:"92vh", overflowY:"auto",
        boxShadow:"0 20px 60px rgba(0,0,0,0.35)"
      }}>
        {/* Header */}
        <div style={{
          padding:"20px 24px", background:C.azul,
          borderRadius:"16px 16px 0 0",
          display:"flex", justifyContent:"space-between", alignItems:"center"
        }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:18, fontWeight:700 }}>🗑️ Nueva Solicitud de Batea</h2>
            <p style={{ margin:"2px 0 0", color:"#90CAF9", fontSize:13 }}>Complete todos los campos requeridos</p>
          </div>
          <button onClick={onClose} style={{
            background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF",
            width:34, height:34, borderRadius:"50%", cursor:"pointer", fontSize:20,
            display:"flex", alignItems:"center", justifyContent:"center"
          }}>×</button>
        </div>

        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:18 }}>

          {/* Alerta vecino con historial */}
          {alertaDuplicado && (
            <div style={{
              background:"#FFF3E0", border:"1px solid #FFB300", borderRadius:10,
              padding:"14px 16px", display:"flex", gap:12, alignItems:"flex-start"
            }}>
              <span style={{ fontSize:24 }}>⚠️</span>
              <div>
                <div style={{ fontWeight:700, color:"#E65100", fontSize:14 }}>
                  Vecino con historial de batea
                </div>
                <div style={{ fontSize:13, color:"#555", marginTop:4 }}>
                  {alertaDuplicado.alerta}
                </div>
                {alertaDuplicado.historial_bateas?.map((h, i) => (
                  <div key={i} style={{ fontSize:12, color:"#777", marginTop:2 }}>
                    • Batea {h.numero_batea} — {h.fecha_asignacion} — {h.direccion}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Datos personales */}
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:16 }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:C.azul }}>👤 Datos del Vecino</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Nombre completo" required error={errores.nombre}>
                <input style={{ ...inp, borderColor:errores.nombre ? C.rojo : "#DDD" }}
                  value={form.nombre} onChange={e => set("nombre", e.target.value)}
                  placeholder="Ej: María González Riquelme" />
              </Field>
              <Field label="RUT" required error={errores.rut}>
                <input style={{ ...inp, borderColor:errores.rut ? C.rojo : "#DDD" }}
                  value={form.rut}
                  onChange={e => set("rut", e.target.value)}
                  onBlur={e => verificarRUT(e.target.value)}
                  placeholder="Ej: 12.345.678-9" />
              </Field>
              <Field label="Teléfono">
                <input style={inp} value={form.telefono}
                  onChange={e => set("telefono", e.target.value)}
                  placeholder="Ej: +56912345678" />
              </Field>
              <Field label="Dirección" required error={errores.direccion}>
                <input style={{ ...inp, borderColor:errores.direccion ? C.rojo : "#DDD" }}
                  value={form.direccion} onChange={e => set("direccion", e.target.value)}
                  placeholder="Ej: Av. Argentina 1234" />
              </Field>
            </div>
          </div>

          {/* Georreferencia */}
          <div style={{ background:"#F0F7FF", borderRadius:10, padding:16, border:"1px solid #BBDEFB" }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:C.azul }}>📍 Georreferencia</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Latitud" required error={errores.latitud}>
                <input style={{ ...inp, fontFamily:"monospace", borderColor:errores.latitud ? C.rojo : "#DDD" }}
                  value={form.latitud} onChange={e => set("latitud", e.target.value)}
                  placeholder="Ej: -33.0458" type="number" step="any" />
              </Field>
              <Field label="Longitud" required error={errores.longitud}>
                <input style={{ ...inp, fontFamily:"monospace", borderColor:errores.longitud ? C.rojo : "#DDD" }}
                  value={form.longitud} onChange={e => set("longitud", e.target.value)}
                  placeholder="Ej: -71.6197" type="number" step="any" />
              </Field>
            </div>
            {form.latitud && form.longitud && !isNaN(parseFloat(form.latitud)) && !isNaN(parseFloat(form.longitud)) && (
              <div style={{ marginTop:10, padding:"8px 12px", background:"#E3F2FD", borderRadius:8, fontSize:12, color:C.azul, fontFamily:"monospace" }}>
                ✅ {parseFloat(form.latitud).toFixed(6)}, {parseFloat(form.longitud).toFixed(6)}
              </div>
            )}
          </div>

          {/* Fotografía del sector */}
          <div style={{ background:"#F8F8F8", borderRadius:10, padding:16 }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:"#555" }}>📷 Fotografía del Sector (ANTES)</h3>
            <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
              <label style={{
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                width:130, height:110, border:"2px dashed #CCC", borderRadius:10,
                cursor:"pointer", background:"#FFF", flexShrink:0, position:"relative"
              }}>
                {form.foto_preview ? (
                  <img src={form.foto_preview} alt="preview"
                    style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:8 }} />
                ) : (
                  <><span style={{ fontSize:30 }}>📷</span>
                  <span style={{ fontSize:11, color:"#888", marginTop:4, textAlign:"center" }}>Subir foto del sector</span></>
                )}
                <input type="file" accept="image/*" onChange={handleFoto} style={{ display:"none" }} />
              </label>
              <div style={{ fontSize:12, color:"#888", lineHeight:1.7 }}>
                <p style={{ margin:0, fontWeight:600, color:"#555" }}>Foto ANTES de la instalación</p>
                <p style={{ margin:"4px 0 0" }}>Esta foto quedará guardada en Cloudinary y aparecerá en el informe oficial.</p>
                <p style={{ margin:"4px 0 0" }}>Formatos: JPG, PNG, WEBP (máx 10MB)</p>
                {form.subiendo_foto && <p style={{ margin:"6px 0 0", color:C.azul }}>⏳ Subiendo imagen...</p>}
                {form.foto_url_cloudinary && <p style={{ margin:"6px 0 0", color:C.verde }}>✅ Imagen guardada en la nube</p>}
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <Field label="Observaciones">
            <textarea style={{ ...inp, minHeight:80, resize:"vertical" }}
              value={form.observaciones} onChange={e => set("observaciones", e.target.value)}
              placeholder="Información adicional relevante..." />
          </Field>

          {/* Botones */}
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end", paddingTop:8 }}>
            <button onClick={onClose} style={{
              padding:"10px 24px", borderRadius:8, border:"1px solid #DDD",
              background:"#FFF", fontSize:14, cursor:"pointer", fontWeight:500
            }}>Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando || form.subiendo_foto} style={{
              padding:"10px 28px", borderRadius:8, border:"none",
              background: (guardando || form.subiendo_foto) ? "#888" : C.azul,
              color:"#FFF", fontSize:14, fontWeight:700,
              cursor: (guardando || form.subiendo_foto) ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", gap:8
            }}>
              {guardando ? "⏳ Guardando..." : form.subiendo_foto ? "⏳ Subiendo foto..." : "✅ Guardar Solicitud"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function Sidebar({ activeView, setActiveView }) {
  const items = [
    { id:"dashboard",   icon:"📊", label:"Dashboard"       },
    { id:"solicitudes", icon:"📋", label:"Solicitudes"     },
    { id:"mapa",        icon:"🗺️", label:"Mapa operacional" },
    { id:"bateas",      icon:"🗑️", label:"Bateas"          },
    { id:"alertas",     icon:"🔔", label:"Alertas"         },
    { id:"reportes",    icon:"📄", label:"Reportes"        },
    { id:"config",      icon:"⚙️", label:"Configuración"   },
  ];
  return (
    <div style={{ width:220, minHeight:"100vh", background:"#0D2137", display:"flex", flexDirection:"column", flexShrink:0 }}>
      <div style={{ padding:"24px 20px 20px", borderBottom:"1px solid #1E3A5F" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, background:C.azulC, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🗑️</div>
          <div>
            <div style={{ color:"#FFF", fontWeight:700, fontSize:16 }}>BateaControl</div>
            <div style={{ color:"#7FB3D3", fontSize:11 }}>Sistema Municipal</div>
          </div>
        </div>
      </div>
      <nav style={{ padding:"12px 8px", flex:1 }}>
        {items.map(item => (
          <button key={item.id} onClick={() => setActiveView(item.id)} style={{
            width:"100%", display:"flex", alignItems:"center", gap:10,
            padding:"10px 14px", margin:"2px 0", borderRadius:8,
            background: activeView===item.id ? "rgba(25,118,210,0.3)" : "transparent",
            border: activeView===item.id ? "1px solid rgba(25,118,210,0.5)" : "1px solid transparent",
            color: activeView===item.id ? "#90CAF9" : "#B0C4DE",
            cursor:"pointer", textAlign:"left", fontSize:14,
            fontWeight: activeView===item.id ? 600 : 400,
          }}>
            <span style={{ fontSize:17 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding:"16px 20px", borderTop:"1px solid #1E3A5F" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:C.azulC, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#FFF", fontWeight:700 }}>A</div>
          <div>
            <div style={{ color:"#FFF", fontSize:13, fontWeight:600 }}>Administrador</div>
            <div style={{ color:"#7FB3D3", fontSize:11 }}>admin@municipio.cl</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function ViewDashboard({ solicitudes, kpis, onAsignarBatea, clustering }) {
  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>Panel de Control Municipal</h1>
          <p style={{ margin:"4px 0 0", color:"#666", fontSize:14 }}>
            {new Date().toLocaleDateString("es-CL", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          </p>
        </div>
        <button onClick={onAsignarBatea} disabled={clustering} style={{
          background: clustering ? "#888" : C.azul, color:"#FFF",
          border:"none", borderRadius:10, padding:"12px 24px",
          fontSize:15, fontWeight:700, cursor: clustering ? "not-allowed" : "pointer",
          display:"flex", alignItems:"center", gap:8,
          boxShadow: clustering ? "none" : "0 4px 12px rgba(21,101,192,0.4)",
        }}>
          {clustering ? <>⏳ Procesando...</> : <>🗑️ ASIGNAR BATEA</>}
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
        <KPICard label="Solicitudes Pendientes" value={kpis.pendientes||0} icon="📋" color={C.azul} bg={C.azulS} sub="Esperando agrupación" />
        <KPICard label="Solicitudes Críticas" value={kpis.criticas||0} icon="🔴" color={C.rojo} bg={C.rojoS} sub="≥20 días sin respuesta" />
        <KPICard label="Grupos Territoriales" value={kpis.grupos||0} icon="📍" color={C.naranja} bg={C.naranjaS} sub="Formados por clustering" />
        <KPICard label="Total Solicitudes" value={kpis.total||0} icon="📂" color="#546E7A" bg="#ECEFF1" />
      </div>

      <div style={{ background:C.blanco, borderRadius:12, border:"1px solid #E0E0E0", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #E0E0E0", display:"flex", justifyContent:"space-between" }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Solicitudes Recientes</h3>
          <span style={{ fontSize:12, color:"#888" }}>Ordenadas por prioridad</span>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFE" }}>
              {["Folio","Vecino","Dirección","Estado","Alerta","Días"].map(h => (
                <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:12, fontWeight:600, color:"#555", borderBottom:"1px solid #E0E0E0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {solicitudes.slice(0,6).map((s, i) => (
              <tr key={s.id} style={{ background:i%2===0?"#FFF":"#FAFAFA", borderBottom:"1px solid #F0F0F0" }}>
                <td style={{ padding:"10px 16px", fontSize:12, fontFamily:"monospace", color:C.azul, fontWeight:600 }}>{s.folio}</td>
                <td style={{ padding:"10px 16px", fontSize:13, fontWeight:500 }}>
                  {s.nombre_vecino}
                  {s.tuvo_batea_antes && <span style={{ marginLeft:6, fontSize:10, background:"#FFF3E0", color:"#E65100", padding:"1px 6px", borderRadius:10, border:"1px solid #FFB30044" }}>historial</span>}
                </td>
                <td style={{ padding:"10px 16px", fontSize:12, color:"#666" }}>{s.direccion}</td>
                <td style={{ padding:"10px 16px" }}><Badge estado={s.estado} /></td>
                <td style={{ padding:"10px 16px" }}><Badge alerta={s.nivel_alerta} /></td>
                <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color:s.dias_pendiente>=20?C.rojo:s.dias_pendiente>=11?C.naranja:C.verde }}>{s.dias_pendiente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── SOLICITUDES ───────────────────────────────────────────────────────────────
function ViewSolicitudes({ solicitudes, onNueva, loading }) {
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  const filtradas = solicitudes.filter(s => {
    const matchE = filtro==="todos" || s.estado===filtro;
    const matchB = busqueda==="" ||
      (s.nombre_vecino||"").toLowerCase().includes(busqueda.toLowerCase()) ||
      (s.direccion||"").toLowerCase().includes(busqueda.toLowerCase()) ||
      (s.folio||"").toLowerCase().includes(busqueda.toLowerCase()) ||
      (s.rut||"").toLowerCase().includes(busqueda.toLowerCase());
    return matchE && matchB;
  });

  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>Gestión de Solicitudes</h1>
        <button onClick={onNueva} style={{
          background:C.azul, color:"#FFF", border:"none", borderRadius:8,
          padding:"10px 18px", fontSize:14, fontWeight:600, cursor:"pointer",
          display:"flex", alignItems:"center", gap:6
        }}>+ Nueva Solicitud</button>
      </div>

      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        <input placeholder="🔍 Buscar por nombre, RUT, dirección o folio..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ flex:1, minWidth:250, padding:"10px 14px", borderRadius:8, border:"1px solid #DDD", fontSize:14, outline:"none" }} />
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ padding:"10px 14px", borderRadius:8, border:"1px solid #DDD", fontSize:14, background:"#FFF", cursor:"pointer" }}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#888" }}>⏳ Cargando solicitudes...</div>
      ) : (
        <div style={{ background:C.blanco, borderRadius:12, border:"1px solid #E0E0E0", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#F8FAFE" }}>
                {["Folio","Vecino","RUT","Dirección","Coords","Estado","Alerta","Días","Foto"].map(h => (
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:12, fontWeight:600, color:"#555", borderBottom:"1px solid #E0E0E0", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s, i) => (
                <tr key={s.id} style={{
                  background: s.nivel_alerta==="critica"?"#FFFAFA":i%2===0?"#FFF":"#FAFAFA",
                  borderBottom:"1px solid #F0F0F0",
                  borderLeft: s.nivel_alerta==="critica"?`3px solid ${C.rojo}`:"3px solid transparent"
                }}>
                  <td style={{ padding:"10px 16px", fontSize:12, fontFamily:"monospace", color:C.azul, fontWeight:600 }}>{s.folio}</td>
                  <td style={{ padding:"10px 16px", fontSize:13, fontWeight:500 }}>
                    {s.nombre_vecino}
                    {s.tuvo_batea_antes && <span title="Ya tuvo batea antes" style={{ marginLeft:6, fontSize:10, background:"#FFF3E0", color:"#E65100", padding:"1px 6px", borderRadius:10 }}>⚠ historial</span>}
                  </td>
                  <td style={{ padding:"10px 16px", fontSize:12, color:"#666", fontFamily:"monospace" }}>{s.rut}</td>
                  <td style={{ padding:"10px 16px", fontSize:12, color:"#666" }}>{s.direccion}</td>
                  <td style={{ padding:"10px 16px", fontSize:11, color:"#888", fontFamily:"monospace" }}>
                    {s.latitud?.toFixed ? s.latitud.toFixed(4) : s.latitud}, {s.longitud?.toFixed ? s.longitud.toFixed(4) : s.longitud}
                  </td>
                  <td style={{ padding:"10px 16px" }}><Badge estado={s.estado} small /></td>
                  <td style={{ padding:"10px 16px" }}><Badge alerta={s.nivel_alerta} small /></td>
                  <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color:s.dias_pendiente>=20?C.rojo:s.dias_pendiente>=11?C.naranja:C.verde }}>{s.dias_pendiente}d</td>
                  <td style={{ padding:"10px 16px" }}>
                    {s.foto_url ? (
                      <a href={s.foto_url} target="_blank" rel="noreferrer">
                        <img src={s.foto_url} alt="foto" style={{ width:38, height:38, objectFit:"cover", borderRadius:6, border:"1px solid #DDD" }} />
                      </a>
                    ) : <span style={{ fontSize:11, color:"#CCC" }}>Sin foto</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"12px 20px", borderTop:"1px solid #E0E0E0", fontSize:13, color:"#666" }}>
            Mostrando {filtradas.length} de {solicitudes.length} solicitudes
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAPA OPERACIONAL ──────────────────────────────────────────────────────────
function ViewMapa({ solicitudes }) {
  const center = [-33.0458, -71.6197];

  const iconFor = (s) => {
    const color = s.nivel_alerta==="critica"?"#C62828":s.nivel_alerta==="advertencia"?"#E65100":"#1565C0";
    return L.divIcon({
      className:"",
      html:`<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #FFF;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#FFF;font-size:12px;font-weight:700;">S</div>`,
      iconSize:[28,28], iconAnchor:[14,14]
    });
  };

  const iconBatea = L.divIcon({
    className:"",
    html:`<div style="width:34px;height:34px;border-radius:8px;background:#2E7D32;border:3px solid #FFF;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;">🗑️</div>`,
    iconSize:[34,34], iconAnchor:[17,17]
  });

  const solConCoords = solicitudes.filter(s => s.latitud && s.longitud && !isNaN(parseFloat(s.latitud)));

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"20px 28px 12px", background:"#FFF", borderBottom:"1px solid #E0E0E0" }}>
        <h1 style={{ margin:0, fontSize:20, fontWeight:700 }}>Mapa Operacional</h1>
        <div style={{ display:"flex", gap:16, marginTop:10, flexWrap:"wrap" }}>
          {[["#C62828","Crítica (20+ días)"],["#E65100","Advertencia (11-19 días)"],["#1565C0","Normal (0-10 días)"],["#2E7D32","Batea activa"]].map(([color,label]) => (
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
            {solConCoords.map(s => (
              <Circle key={`c-${s.id}`} center={[parseFloat(s.latitud), parseFloat(s.longitud)]} radius={100}
                pathOptions={{ color:s.nivel_alerta==="critica"?"#C62828":s.nivel_alerta==="advertencia"?"#E65100":"#1565C0", fillOpacity:0.06, weight:1, dashArray:"6 4" }} />
            ))}
          </LayerGroup>
          <LayerGroup>
            {solConCoords.map(s => (
              <Marker key={s.id} position={[parseFloat(s.latitud), parseFloat(s.longitud)]} icon={iconFor(s)}>
                <Popup>
                  <div style={{ minWidth:220, fontFamily:"sans-serif" }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{s.nombre_vecino}</div>
                    <div style={{ fontSize:12, color:"#666" }}>{s.direccion}</div>
                    {s.foto_url && (
                      <img src={s.foto_url} alt="foto sector"
                        style={{ width:"100%", borderRadius:6, margin:"8px 0", maxHeight:120, objectFit:"cover" }} />
                    )}
                    <div style={{ display:"flex", gap:6, margin:"6px 0" }}>
                      <Badge estado={s.estado} small />
                      <Badge alerta={s.nivel_alerta} small />
                    </div>
                    <div style={{ fontSize:11, color:"#888" }}>
                      <div><strong>Folio:</strong> {s.folio}</div>
                      <div><strong>Días:</strong> {s.dias_pendiente}</div>
                      {s.tuvo_batea_antes && <div style={{ color:"#E65100", marginTop:4 }}>⚠ Vecino con historial</div>}
                    </div>
                  </div>
                </Popup>
                <Tooltip>{s.nombre_vecino}</Tooltip>
              </Marker>
            ))}
          </LayerGroup>
        </MapContainer>
      </div>
    </div>
  );
}

// ── ALERTAS ───────────────────────────────────────────────────────────────────
function ViewAlertas({ solicitudes }) {
  const criticas = solicitudes.filter(s => s.nivel_alerta==="critica" && s.estado==="pendiente");
  const advertencias = solicitudes.filter(s => s.nivel_alerta==="advertencia" && s.estado==="pendiente");
  const normales = solicitudes.filter(s => s.nivel_alerta==="normal" && s.estado==="pendiente");

  const Grupo = ({ titulo, items, color }) => (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color }}>{titulo}</h2>
        <span style={{ background:`${color}22`, color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:600 }}>{items.length}</span>
      </div>
      {items.length===0 ? (
        <div style={{ padding:20, textAlign:"center", color:"#999", background:"#FAFAFA", borderRadius:8, border:"1px dashed #DDD" }}>Sin solicitudes en este nivel</div>
      ) : items.map(s => (
        <div key={s.id} style={{
          background:"#FFF", border:`1px solid ${color}33`,
          borderLeft:`4px solid ${color}`, borderRadius:10,
          padding:"14px 18px", display:"flex",
          justifyContent:"space-between", alignItems:"center",
          gap:16, marginBottom:8
        }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>
              {s.nombre_vecino}
              {s.tuvo_batea_antes && <span style={{ marginLeft:8, fontSize:11, color:"#E65100" }}>⚠ Ya tuvo batea</span>}
            </div>
            <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{s.direccion} · {s.folio}</div>
            <div style={{ fontSize:11, color:"#999", marginTop:2 }}>Desde: {s.fecha_solicitud}</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:28, fontWeight:700, color }}>{s.dias_pendiente}</div>
            <div style={{ fontSize:11, color:"#888" }}>días</div>
          </div>
          <Badge alerta={s.nivel_alerta} small />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding:28 }}>
      <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:700, color:"#1A2A3A" }}>Sistema de Alertas</h1>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
        <div style={{ background:C.rojoS, border:"1px solid #FFCDD2", borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:800, color:C.rojo }}>{criticas.length}</div>
          <div style={{ fontSize:14, fontWeight:600, color:C.rojo }}>🔴 Críticas</div>
          <div style={{ fontSize:12, color:"#888", marginTop:4 }}>≥20 días pendiente</div>
        </div>
        <div style={{ background:C.naranjaS, border:"1px solid #FFE0B2", borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:800, color:C.naranja }}>{advertencias.length}</div>
          <div style={{ fontSize:14, fontWeight:600, color:C.naranja }}>⚠️ Advertencia</div>
          <div style={{ fontSize:12, color:"#888", marginTop:4 }}>11-19 días pendiente</div>
        </div>
        <div style={{ background:C.verdeS, border:"1px solid #C8E6C9", borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:800, color:C.verde }}>{normales.length}</div>
          <div style={{ fontSize:14, fontWeight:600, color:C.verde }}>✅ Normal</div>
          <div style={{ fontSize:12, color:"#888", marginTop:4 }}>0-10 días pendiente</div>
        </div>
      </div>
      <Grupo titulo="🔴 Críticas — Atención inmediata" items={criticas} color={C.rojo} />
      <Grupo titulo="⚠️ Advertencia" items={advertencias} color={C.naranja} />
      <Grupo titulo="✅ Normal" items={normales} color={C.verde} />
    </div>
  );
}

// ── MODAL RESULTADO CLUSTERING ────────────────────────────────────────────────
function ModalClusteringResultado({ resultado, onClose }) {
  if (!resultado) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FFF", borderRadius:16, padding:32, maxWidth:560, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:52, marginBottom:8 }}>✅</div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>Clustering Completado</h2>
          <p style={{ margin:"6px 0 0", color:"#666", fontSize:14 }}>{resultado.mensaje}</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          {[
            ["Grupos creados", resultado.grupos_creados, C.verde],
            ["Bateas asignadas", resultado.bateas_asignadas, C.azul],
            ["Vecinos atendidos", resultado.solicitudes_agrupadas, "#7B1FA2"],
            ["Bateas evitadas", resultado.grupos_omitidos, C.naranja],
          ].map(([label,value,color]) => (
            <div key={label} style={{ background:"#F8FAFE", borderRadius:10, padding:"14px", textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {resultado.detalle_grupos?.length > 0 && (
          <div style={{ background:"#F8FAFE", borderRadius:10, padding:14, marginBottom:20, maxHeight:200, overflowY:"auto" }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:"#333" }}>Detalle de grupos creados:</div>
            {resultado.detalle_grupos.map((g, i) => (
              <div key={i} style={{ padding:"8px 0", borderBottom:"1px solid #E0E0E0", fontSize:12 }}>
                <div style={{ fontWeight:600, color:C.azul }}>{g.numero_batea} — {g.codigo_grupo}</div>
                <div style={{ color:"#666", marginTop:2 }}>{g.vecinos} vecino(s): {g.nombres?.join(", ")}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background:"#E8F5E9", borderRadius:8, padding:"12px 16px", marginBottom:20, fontSize:13, color:"#2E7D32" }}>
          📄 Historial actualizado — los vecinos quedan registrados para control de rotación
        </div>
        <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:C.azul, color:"#FFF", fontSize:15, fontWeight:700, cursor:"pointer" }}>
          Aceptar
        </button>
      </div>
    </div>
  );
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [solicitudes, setSolicitudes] = useState([]);
  const [kpis, setKpis] = useState({ pendientes:0, criticas:0, grupos:0, total:0 });
  const [loading, setLoading] = useState(true);
  const [modalNueva, setModalNueva] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [resultadoClustering, setResultadoClustering] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      const [resSol, resKpis] = await Promise.all([
        fetch(`${API_URL}/api/solicitudes`),
        fetch(`${API_URL}/api/dashboard/kpis`)
      ]);
      if (resSol.ok) {
        const data = await resSol.json();
        setSolicitudes(data.solicitudes || []);
      }
      if (resKpis.ok) {
        const data = await resKpis.json();
        setKpis(data);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleAsignarBatea = useCallback(async () => {
    setClustering(true);
    try {
      const res = await fetch(`${API_URL}/api/clustering/ejecutar?radio_metros=100`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setResultadoClustering(data);
        await cargarDatos(); // recargar datos actualizados
      } else {
        alert("❌ Error en clustering: " + (data.detail || "Error desconocido"));
      }
    } catch (err) {
      alert("❌ Error de conexión con el servidor");
    }
    setClustering(false);
  }, [cargarDatos]);

  const handleGuardarSolicitud = async (data) => {
    setModalNueva(false);
    if (data.alerta_duplicado) {
      alert(data.alerta_duplicado);
    }
    await cargarDatos();
    setActiveView("solicitudes");
  };

  const renderView = () => {
    switch(activeView) {
      case "dashboard":
        return <ViewDashboard solicitudes={solicitudes} kpis={kpis} onAsignarBatea={handleAsignarBatea} clustering={clustering} />;
      case "solicitudes":
        return <ViewSolicitudes solicitudes={solicitudes} onNueva={() => setModalNueva(true)} loading={loading} />;
      case "mapa":
        return <ViewMapa solicitudes={solicitudes} />;
      case "alertas":
        return <ViewAlertas solicitudes={solicitudes} />;
      default:
        return (
          <div style={{ padding:40, textAlign:"center", color:"#888" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🚧</div>
            <h2 style={{ color:"#1A2A3A" }}>Módulo en desarrollo</h2>
            <p>Esta sección estará disponible pronto</p>
          </div>
        );
    }
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.fondo, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`* { box-sizing:border-box; } .leaflet-container { z-index:1; }`}</style>
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>
        {renderView()}
      </main>
      {modalNueva && <ModalNuevaSolicitud onClose={() => setModalNueva(false)} onGuardar={handleGuardarSolicitud} />}
      {resultadoClustering && <ModalClusteringResultado resultado={resultadoClustering} onClose={() => setResultadoClustering(null)} />}
    </div>
  );
}
