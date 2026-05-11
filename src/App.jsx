import { useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, LayerGroup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const COLORS = {
  azul:"#1565C0", azulClaro:"#1976D2", azulSuave:"#E3F2FD",
  verde:"#2E7D32", verdeClaro:"#E8F5E9",
  rojo:"#C62828", rojoClaro:"#FFEBEE",
  naranja:"#E65100", naranjaClaro:"#FFF3E0",
  gris:"#37474F", grisSuave:"#ECEFF1",
  blanco:"#FFFFFF", fondo:"#F0F4F8",
};

const ESTADO_CONFIG = {
  pendiente:  { color:"#1565C0", bg:"#E3F2FD", label:"Pendiente" },
  agrupada:   { color:"#7B1FA2", bg:"#F3E5F5", label:"Agrupada"  },
  asignada:   { color:"#2E7D32", bg:"#E8F5E9", label:"Asignada"  },
  instalada:  { color:"#00838F", bg:"#E0F7FA", label:"Instalada" },
  retirada:   { color:"#37474F", bg:"#ECEFF1", label:"Retirada"  },
  finalizada: { color:"#546E7A", bg:"#ECEFF1", label:"Finalizada"},
  critica:    { color:"#C62828", bg:"#FFEBEE", label:"Crítica"   },
};

const ALERTA_CONFIG = {
  normal:      { color:"#2E7D32", bg:"#E8F5E9", icon:"✓" },
  advertencia: { color:"#E65100", bg:"#FFF3E0", icon:"⚠" },
  critica:     { color:"#C62828", bg:"#FFEBEE", icon:"🔴" },
};

const SOLICITUDES_INICIAL = [
  { id:"s1", folio:"SOL-2024-0001", nombre:"María González Riquelme", rut:"12.345.678-9", direccion:"Av. Argentina 1234", telefono:"+56912345678", estado:"pendiente", nivel_alerta:"critica", dias:23, lat:-33.0458, lon:-71.6197, observaciones:"Zona con alta generación de residuos", foto_url:"" },
  { id:"s2", folio:"SOL-2024-0002", nombre:"Carlos Muñoz Soto", rut:"13.456.789-0", direccion:"Av. Argentina 1280", telefono:"+56923456789", estado:"pendiente", nivel_alerta:"critica", dias:22, lat:-33.0462, lon:-71.6194, observaciones:"", foto_url:"" },
  { id:"s3", folio:"SOL-2024-0003", nombre:"Ana Jiménez Vera", rut:"14.567.890-1", direccion:"Calle Pedro Montt 456", telefono:"+56934567890", estado:"pendiente", nivel_alerta:"advertencia", dias:15, lat:-33.0465, lon:-71.6200, observaciones:"Junto a local comercial", foto_url:"" },
  { id:"s4", folio:"SOL-2024-0004", nombre:"Roberto Torres Pino", rut:"15.678.901-2", direccion:"Brasil 789", telefono:"+56945678901", estado:"asignada", nivel_alerta:"normal", dias:5, lat:-33.0480, lon:-71.6220, observaciones:"", foto_url:"" },
  { id:"s5", folio:"SOL-2024-0005", nombre:"Isabel Castro López", rut:"16.789.012-3", direccion:"Brasil 810", telefono:"+56956789012", estado:"asignada", nivel_alerta:"normal", dias:5, lat:-33.0483, lon:-71.6218, observaciones:"", foto_url:"" },
  { id:"s6", folio:"SOL-2024-0006", nombre:"Jorge Álvarez Mora", rut:"17.890.123-4", direccion:"Pudeto 234", telefono:"+56967890123", estado:"instalada", nivel_alerta:"normal", dias:2, lat:-33.0440, lon:-71.6240, observaciones:"Confirmado por inspector", foto_url:"" },
  { id:"s7", folio:"SOL-2024-0007", nombre:"Carmen Reyes Fuentes", rut:"18.901.234-5", direccion:"Blanco 567", telefono:"+56978901234", estado:"pendiente", nivel_alerta:"advertencia", dias:12, lat:-33.0470, lon:-71.6185, observaciones:"", foto_url:"" },
  { id:"s8", folio:"SOL-2024-0008", nombre:"Pedro Valenzuela Ríos", rut:"19.012.345-6", direccion:"Esmeralda 890", telefono:"+56989012345", estado:"pendiente", nivel_alerta:"normal", dias:3, lat:-33.0455, lon:-71.6175, observaciones:"", foto_url:"" },
];

const BATEAS_DEMO = [
  { id:"b1", numero:"BC-2024-0001", lat:-33.0478, lon:-71.6219, grupo:"GT-2024-0001", vecinos:2, activa:true },
  { id:"b2", numero:"BC-2024-0002", lat:-33.0442, lon:-71.6238, grupo:"GT-2024-0002", vecinos:1, activa:true },
];

function Badge({ estado, alerta, small }) {
  const cfg = alerta ? ALERTA_CONFIG[alerta] : ESTADO_CONFIG[estado] || ESTADO_CONFIG.pendiente;
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
      {alerta ? alerta : cfg.label}
    </span>
  );
}

function KPICard({ label, value, icon, color, bg, sub }) {
  return (
    <div style={{
      background:COLORS.blanco, border:"1px solid #E0E0E0",
      borderRadius:12, padding:"18px 20px",
      borderLeft:`4px solid ${color}`,
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

function Field({ label, required, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <label style={{ fontSize:13, fontWeight:600, color:"#333" }}>
        {label} {required && <span style={{ color:COLORS.rojo }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  padding:"10px 14px", borderRadius:8,
  border:"1px solid #DDD", fontSize:14,
  outline:"none", background:"#FFF",
  width:"100%", boxSizing:"border-box"
};

function ModalNuevaSolicitud({ onClose, onGuardar }) {
  const [form, setForm] = useState({
    nombre:"", rut:"", direccion:"", telefono:"",
    latitud:"", longitud:"", observaciones:"", foto:null, foto_preview:""
  });
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    set("foto", file);
    const reader = new FileReader();
    reader.onload = (ev) => set("foto_preview", ev.target.result);
    reader.readAsDataURL(file);
  };

  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Requerido";
    if (!form.rut.trim()) e.rut = "Requerido";
    if (!form.direccion.trim()) e.direccion = "Requerido";
    if (!form.latitud || isNaN(parseFloat(form.latitud))) e.latitud = "Ingrese coordenada válida";
    if (!form.longitud || isNaN(parseFloat(form.longitud))) e.longitud = "Ingrese coordenada válida";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    await new Promise(r => setTimeout(r, 800));
    onGuardar({
      nombre: form.nombre,
      rut: form.rut,
      direccion: form.direccion,
      telefono: form.telefono,
      lat: parseFloat(form.latitud),
      lon: parseFloat(form.longitud),
      observaciones: form.observaciones,
      foto_url: form.foto_preview || "",
    });
    setGuardando(false);
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20
    }}>
      <div style={{
        background:"#FFF", borderRadius:16, width:"100%", maxWidth:620,
        maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 20px 60px rgba(0,0,0,0.3)"
      }}>
        <div style={{
          padding:"20px 24px", borderBottom:"1px solid #E0E0E0",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          background:COLORS.azul, borderRadius:"16px 16px 0 0"
        }}>
          <div>
            <h2 style={{ margin:0, color:"#FFF", fontSize:18, fontWeight:700 }}>🗑️ Nueva Solicitud de Batea</h2>
            <p style={{ margin:"2px 0 0", color:"#90CAF9", fontSize:13 }}>Complete todos los campos requeridos</p>
          </div>
          <button onClick={onClose} style={{
            background:"rgba(255,255,255,0.2)", border:"none", color:"#FFF",
            width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18
          }}>×</button>
        </div>

        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:18 }}>

          <div style={{ background:"#F8FAFE", borderRadius:10, padding:16 }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:COLORS.azul }}>👤 Datos del Vecino</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Nombre completo" required>
                <input style={{ ...inputStyle, borderColor: errores.nombre ? COLORS.rojo : "#DDD" }}
                  value={form.nombre} onChange={e => set("nombre", e.target.value)}
                  placeholder="Ej: María González Riquelme" />
                {errores.nombre && <span style={{ fontSize:11, color:COLORS.rojo }}>{errores.nombre}</span>}
              </Field>
              <Field label="RUT" required>
                <input style={{ ...inputStyle, borderColor: errores.rut ? COLORS.rojo : "#DDD" }}
                  value={form.rut} onChange={e => set("rut", e.target.value)}
                  placeholder="Ej: 12.345.678-9" />
                {errores.rut && <span style={{ fontSize:11, color:COLORS.rojo }}>{errores.rut}</span>}
              </Field>
              <Field label="Teléfono">
                <input style={inputStyle}
                  value={form.telefono} onChange={e => set("telefono", e.target.value)}
                  placeholder="Ej: +56912345678" />
              </Field>
              <Field label="Dirección" required>
                <input style={{ ...inputStyle, borderColor: errores.direccion ? COLORS.rojo : "#DDD" }}
                  value={form.direccion} onChange={e => set("direccion", e.target.value)}
                  placeholder="Ej: Av. Argentina 1234" />
                {errores.direccion && <span style={{ fontSize:11, color:COLORS.rojo }}>{errores.direccion}</span>}
              </Field>
            </div>
          </div>

          <div style={{ background:"#F0F7FF", borderRadius:10, padding:16, border:"1px solid #BBDEFB" }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:COLORS.azul }}>📍 Georreferencia</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <Field label="Latitud" required>
                <input style={{ ...inputStyle, fontFamily:"monospace", borderColor: errores.latitud ? COLORS.rojo : "#DDD" }}
                  value={form.latitud} onChange={e => set("latitud", e.target.value)}
                  placeholder="Ej: -33.0458" type="number" step="any" />
                {errores.latitud && <span style={{ fontSize:11, color:COLORS.rojo }}>{errores.latitud}</span>}
              </Field>
              <Field label="Longitud" required>
                <input style={{ ...inputStyle, fontFamily:"monospace", borderColor: errores.longitud ? COLORS.rojo : "#DDD" }}
                  value={form.longitud} onChange={e => set("longitud", e.target.value)}
                  placeholder="Ej: -71.6197" type="number" step="any" />
                {errores.longitud && <span style={{ fontSize:11, color:COLORS.rojo }}>{errores.longitud}</span>}
              </Field>
            </div>
            {form.latitud && form.longitud && !isNaN(parseFloat(form.latitud)) && !isNaN(parseFloat(form.longitud)) && (
              <div style={{ marginTop:10, padding:"8px 12px", background:"#E3F2FD", borderRadius:8, fontSize:12, color:COLORS.azul, fontFamily:"monospace" }}>
                ✅ Coordenadas válidas: {parseFloat(form.latitud).toFixed(6)}, {parseFloat(form.longitud).toFixed(6)}
              </div>
            )}
          </div>

          <div style={{ background:"#F8F8F8", borderRadius:10, padding:16 }}>
            <h3 style={{ margin:"0 0 14px", fontSize:14, fontWeight:700, color:"#555" }}>📷 Fotografía del Sector</h3>
            <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
              <label style={{
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                width:120, height:100, border:"2px dashed #CCC", borderRadius:10,
                cursor:"pointer", background:"#FFF", flexShrink:0
              }}>
                {form.foto_preview ? (
                  <img src={form.foto_preview} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:8 }} />
                ) : (
                  <><span style={{ fontSize:28 }}>📷</span><span style={{ fontSize:11, color:"#888", marginTop:4 }}>Subir foto</span></>
                )}
                <input type="file" accept="image/*" onChange={handleFoto} style={{ display:"none" }} />
              </label>
              <div style={{ fontSize:12, color:"#888", lineHeight:1.6 }}>
                <p style={{ margin:0 }}>Sube una fotografía del sector donde se instalará la batea.</p>
                <p style={{ margin:"6px 0 0" }}>Formatos: JPG, PNG, WEBP</p>
                {form.foto && <p style={{ margin:"6px 0 0", color:COLORS.verde }}>✅ {form.foto.name}</p>}
              </div>
            </div>
          </div>

          <Field label="Observaciones">
            <textarea style={{ ...inputStyle, minHeight:80, resize:"vertical" }}
              value={form.observaciones} onChange={e => set("observaciones", e.target.value)}
              placeholder="Información adicional relevante..." />
          </Field>

          <div style={{ display:"flex", gap:12, justifyContent:"flex-end", paddingTop:8 }}>
            <button onClick={onClose} style={{ padding:"10px 24px", borderRadius:8, border:"1px solid #DDD", background:"#FFF", fontSize:14, cursor:"pointer", fontWeight:500 }}>Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando} style={{
              padding:"10px 28px", borderRadius:8, border:"none",
              background: guardando ? "#888" : COLORS.azul,
              color:"#FFF", fontSize:14, fontWeight:700, cursor: guardando ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", gap:8
            }}>
              {guardando ? "⏳ Guardando..." : "✅ Guardar Solicitud"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ activeView, setActiveView }) {
  const items = [
    { id:"dashboard",   icon:"📊", label:"Dashboard"      },
    { id:"solicitudes", icon:"📋", label:"Solicitudes"    },
    { id:"mapa",        icon:"🗺️", label:"Mapa operacional"},
    { id:"bateas",      icon:"🗑️", label:"Bateas"         },
    { id:"alertas",     icon:"🔔", label:"Alertas"        },
    { id:"reportes",    icon:"📄", label:"Reportes"       },
    { id:"config",      icon:"⚙️", label:"Configuración"  },
  ];
  return (
    <div style={{ width:220, minHeight:"100vh", background:"#0D2137", display:"flex", flexDirection:"column", flexShrink:0 }}>
      <div style={{ padding:"24px 20px 20px", borderBottom:"1px solid #1E3A5F" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, background:COLORS.azulClaro, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🗑️</div>
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
          <div style={{ width:32, height:32, background:COLORS.azulClaro, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#FFF", fontWeight:700 }}>A</div>
          <div>
            <div style={{ color:"#FFF", fontSize:13, fontWeight:600 }}>Administrador</div>
            <div style={{ color:"#7FB3D3", fontSize:11 }}>admin@municipio.cl</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewDashboard({ solicitudes, onAsignarBatea, clustering }) {
  const pendientes = solicitudes.filter(s => s.estado==="pendiente").length;
  const criticas = solicitudes.filter(s => s.nivel_alerta==="critica" && s.estado==="pendiente").length;

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
          background: clustering ? "#888" : COLORS.azul,
          color:"#FFF", border:"none", borderRadius:10,
          padding:"12px 24px", fontSize:15, fontWeight:700,
          cursor: clustering ? "not-allowed" : "pointer",
          display:"flex", alignItems:"center", gap:8,
          boxShadow: clustering ? "none" : "0 4px 12px rgba(21,101,192,0.4)",
        }}>
          {clustering ? <>⏳ Procesando...</> : <>🗑️ ASIGNAR BATEA</>}
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
        <KPICard label="Solicitudes Pendientes" value={pendientes} icon="📋" color={COLORS.azul} bg={COLORS.azulSuave} sub="Esperando agrupación" />
        <KPICard label="Solicitudes Críticas" value={criticas} icon="🔴" color={COLORS.rojo} bg={COLORS.rojoClaro} sub="≥20 días sin respuesta" />
        <KPICard label="Bateas Activas" value={BATEAS_DEMO.length} icon="🗑️" color={COLORS.verde} bg={COLORS.verdeClaro} sub="En operación" />
        <KPICard label="Total Solicitudes" value={solicitudes.length} icon="📂" color="#546E7A" bg="#ECEFF1" />
      </div>
      <div style={{ background:COLORS.blanco, borderRadius:12, border:"1px solid #E0E0E0", overflow:"hidden" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #E0E0E0" }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Solicitudes Recientes</h3>
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
              <tr key={s.id} style={{ background: i%2===0 ? "#FFF" : "#FAFAFA", borderBottom:"1px solid #F0F0F0" }}>
                <td style={{ padding:"10px 16px", fontSize:12, fontFamily:"monospace", color:COLORS.azul, fontWeight:600 }}>{s.folio}</td>
                <td style={{ padding:"10px 16px", fontSize:13, fontWeight:500 }}>{s.nombre}</td>
                <td style={{ padding:"10px 16px", fontSize:12, color:"#666" }}>{s.direccion}</td>
                <td style={{ padding:"10px 16px" }}><Badge estado={s.estado} /></td>
                <td style={{ padding:"10px 16px" }}><Badge alerta={s.nivel_alerta} /></td>
                <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color: s.dias>=20 ? COLORS.rojo : s.dias>=11 ? COLORS.naranja : COLORS.verde }}>{s.dias}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViewSolicitudes({ solicitudes, onNueva }) {
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  const filtradas = solicitudes.filter(s => {
    const matchEstado = filtro==="todos" || s.estado===filtro;
    const matchBusqueda = busqueda==="" ||
      s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.direccion.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.folio.toLowerCase().includes(busqueda.toLowerCase());
    return matchEstado && matchBusqueda;
  });

  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:"#1A2A3A" }}>Gestión de Solicitudes</h1>
        <button onClick={onNueva} style={{
          background:COLORS.azul, color:"#FFF", border:"none", borderRadius:8,
          padding:"10px 18px", fontSize:14, fontWeight:600, cursor:"pointer",
          display:"flex", alignItems:"center", gap:6
        }}>+ Nueva Solicitud</button>
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        <input placeholder="🔍 Buscar por nombre, dirección o folio..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ flex:1, minWidth:250, padding:"10px 14px", borderRadius:8, border:"1px solid #DDD", fontSize:14, outline:"none" }} />
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ padding:"10px 14px", borderRadius:8, border:"1px solid #DDD", fontSize:14, background:"#FFF", cursor:"pointer" }}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADO_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div style={{ background:COLORS.blanco, borderRadius:12, border:"1px solid #E0E0E0", overflow:"hidden" }}>
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
                background: s.nivel_alerta==="critica" ? "#FFFAFA" : i%2===0 ? "#FFF" : "#FAFAFA",
                borderBottom:"1px solid #F0F0F0",
                borderLeft: s.nivel_alerta==="critica" ? `3px solid ${COLORS.rojo}` : "3px solid transparent"
              }}>
                <td style={{ padding:"10px 16px", fontSize:12, fontFamily:"monospace", color:COLORS.azul, fontWeight:600 }}>{s.folio}</td>
                <td style={{ padding:"10px 16px", fontSize:13, fontWeight:500 }}>{s.nombre}</td>
                <td style={{ padding:"10px 16px", fontSize:12, color:"#666", fontFamily:"monospace" }}>{s.rut}</td>
                <td style={{ padding:"10px 16px", fontSize:12, color:"#666" }}>{s.direccion}</td>
                <td style={{ padding:"10px 16px", fontSize:11, color:"#888", fontFamily:"monospace" }}>{s.lat?.toFixed(4)}, {s.lon?.toFixed(4)}</td>
                <td style={{ padding:"10px 16px" }}><Badge estado={s.estado} small /></td>
                <td style={{ padding:"10px 16px" }}><Badge alerta={s.nivel_alerta} small /></td>
                <td style={{ padding:"10px 16px", fontSize:13, fontWeight:700, color: s.dias>=20 ? COLORS.rojo : s.dias>=11 ? COLORS.naranja : COLORS.verde }}>{s.dias}d</td>
                <td style={{ padding:"10px 16px" }}>
                  {s.foto_url ? (
                    <img src={s.foto_url} alt="foto" style={{ width:36, height:36, objectFit:"cover", borderRadius:6, border:"1px solid #DDD" }} />
                  ) : (
                    <span style={{ fontSize:11, color:"#CCC" }}>Sin foto</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding:"12px 20px", borderTop:"1px solid #E0E0E0", fontSize:13, color:"#666" }}>
          Mostrando {filtradas.length} de {solicitudes.length} solicitudes
        </div>
      </div>
    </div>
  );
}

function ViewMapa({ solicitudes }) {
  const center = [-33.0458, -71.6197];
  const iconFor = (s) => {
    const color = s.nivel_alerta==="critica" ? "#C62828" : s.nivel_alerta==="advertencia" ? "#E65100" : "#1565C0";
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
            {solicitudes.map(s => (
              <Circle key={`c-${s.id}`} center={[s.lat, s.lon]} radius={100}
                pathOptions={{ color: s.nivel_alerta==="critica" ? "#C62828" : s.nivel_alerta==="advertencia" ? "#E65100" : "#1565C0", fillOpacity:0.06, weight:1, dashArray:"6 4" }} />
            ))}
          </LayerGroup>
          <LayerGroup>
            {solicitudes.map(s => (
              <Marker key={s.id} position={[s.lat, s.lon]} icon={iconFor(s)}>
                <Popup>
                  <div style={{ minWidth:200, fontFamily:"sans-serif" }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{s.nombre}</div>
                    <div style={{ fontSize:12, color:"#666" }}>{s.direccion}</div>
                    {s.foto_url && <img src={s.foto_url} alt="foto" style={{ width:"100%", borderRadius:6, margin:"6px 0" }} />}
                    <div style={{ display:"flex", gap:6, margin:"6px 0" }}>
                      <Badge estado={s.estado} small />
                      <Badge alerta={s.nivel_alerta} small />
                    </div>
                    <div style={{ fontSize:11, color:"#888" }}>{s.lat?.toFixed(5)}, {s.lon?.toFixed(5)}</div>
                  </div>
                </Popup>
                <Tooltip>{s.nombre}</Tooltip>
              </Marker>
            ))}
          </LayerGroup>
          <LayerGroup>
            {BATEAS_DEMO.map(b => (
              <Marker key={b.id} position={[b.lat, b.lon]} icon={iconBatea}>
                <Popup>
                  <div style={{ fontFamily:"sans-serif" }}>
                    <div style={{ fontWeight:700, color:"#2E7D32" }}>🗑️ {b.numero}</div>
                    <div style={{ fontSize:12 }}>Grupo: {b.grupo} · Vecinos: {b.vecinos}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </MapContainer>
      </div>
    </div>
  );
}

function ViewAlertas({ solicitudes }) {
  const criticas = solicitudes.filter(s => s.nivel_alerta==="critica");
  const advertencias = solicitudes.filter(s => s.nivel_alerta==="advertencia");
  const normales = solicitudes.filter(s => s.nivel_alerta==="normal");

  const Grupo = ({ titulo, items, color }) => (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color }}>{titulo}</h2>
        <span style={{ background:`${color}22`, color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:600 }}>{items.length}</span>
      </div>
      {items.length===0 ? (
        <div style={{ padding:20, textAlign:"center", color:"#999", background:"#FAFAFA", borderRadius:8, border:"1px dashed #DDD" }}>Sin solicitudes en este nivel</div>
      ) : items.map(s => (
        <div key={s.id} style={{ background:"#FFF", border:`1px solid ${color}33`, borderLeft:`4px solid ${color}`, borderRadius:10, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, marginBottom:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{s.nombre}</div>
            <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{s.direccion} · {s.folio}</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:28, fontWeight:700, color }}>{s.dias}</div>
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
        <div style={{ background:COLORS.rojoClaro, border:"1px solid #FFCDD2", borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:800, color:COLORS.rojo }}>{criticas.length}</div>
          <div style={{ fontSize:14, fontWeight:600, color:COLORS.rojo }}>🔴 Críticas</div>
          <div style={{ fontSize:12, color:"#888", marginTop:4 }}>≥20 días pendiente</div>
        </div>
        <div style={{ background:COLORS.naranjaClaro, border:"1px solid #FFE0B2", borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:800, color:COLORS.naranja }}>{advertencias.length}</div>
          <div style={{ fontSize:14, fontWeight:600, color:COLORS.naranja }}>⚠️ Advertencia</div>
          <div style={{ fontSize:12, color:"#888", marginTop:4 }}>11-19 días pendiente</div>
        </div>
        <div style={{ background:COLORS.verdeClaro, border:"1px solid #C8E6C9", borderRadius:12, padding:"16px 20px", textAlign:"center" }}>
          <div style={{ fontSize:36, fontWeight:800, color:COLORS.verde }}>{normales.length}</div>
          <div style={{ fontSize:14, fontWeight:600, color:COLORS.verde }}>✅ Normal</div>
          <div style={{ fontSize:12, color:"#888", marginTop:4 }}>0-10 días pendiente</div>
        </div>
      </div>
      <Grupo titulo="🔴 Críticas — Atención inmediata" items={criticas} color={COLORS.rojo} />
      <Grupo titulo="⚠️ Advertencia" items={advertencias} color={COLORS.naranja} />
      <Grupo titulo="✅ Normal" items={normales} color={COLORS.verde} />
    </div>
  );
}

function ModalClusteringResultado({ resultado, onClose }) {
  if (!resultado) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:"#FFF", borderRadius:16, padding:32, maxWidth:520, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:52, marginBottom:8 }}>✅</div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700 }}>Clustering Completado</h2>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
          {[["Grupos creados",resultado.grupos_creados,COLORS.verde],["Bateas asignadas",resultado.bateas_asignadas,COLORS.azul],["Vecinos agrupados",resultado.solicitudes_agrupadas,"#7B1FA2"],["Bateas evitadas",resultado.grupos_omitidos,COLORS.naranja]].map(([label,value,color]) => (
            <div key={label} style={{ background:"#F8FAFE", borderRadius:10, padding:"14px", textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:700, color }}>{value}</div>
              <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ background:"#E8F5E9", borderRadius:8, padding:"12px 16px", marginBottom:20, fontSize:13, color:"#2E7D32" }}>📄 Se han generado informes PDF automáticamente</div>
        <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:COLORS.azul, color:"#FFF", fontSize:15, fontWeight:700, cursor:"pointer" }}>Aceptar</button>
      </div>
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [solicitudes, setSolicitudes] = useState(SOLICITUDES_INICIAL);
  const [modalNueva, setModalNueva] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [resultadoClustering, setResultadoClustering] = useState(null);

  const handleAsignarBatea = useCallback(async () => {
    setClustering(true);
    await new Promise(r => setTimeout(r, 2800));
    setClustering(false);
    setResultadoClustering({ grupos_creados:2, bateas_asignadas:2, solicitudes_agrupadas:5, grupos_omitidos:0 });
  }, []);

  const handleGuardarSolicitud = (datos) => {
    const nuevo = {
      id: `s${solicitudes.length+1}`,
      folio: `SOL-2025-${String(solicitudes.length+1).padStart(4,"0")}`,
      nombre: datos.nombre,
      rut: datos.rut,
      direccion: datos.direccion,
      telefono: datos.telefono,
      estado: "pendiente",
      nivel_alerta: "normal",
      dias: 0,
      lat: datos.lat,
      lon: datos.lon,
      observaciones: datos.observaciones,
      foto_url: datos.foto_url,
    };
    setSolicitudes(prev => [nuevo, ...prev]);
    setModalNueva(false);
    setActiveView("solicitudes");
  };

  const renderView = () => {
    switch(activeView) {
      case "dashboard":   return <ViewDashboard solicitudes={solicitudes} onAsignarBatea={handleAsignarBatea} clustering={clustering} />;
      case "solicitudes": return <ViewSolicitudes solicitudes={solicitudes} onNueva={() => setModalNueva(true)} />;
      case "mapa":        return <ViewMapa solicitudes={solicitudes} />;
      case "alertas":     return <ViewAlertas solicitudes={solicitudes} />;
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
    <div style={{ display:"flex", minHeight:"100vh", background:COLORS.fondo, fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`* { box-sizing: border-box; } @keyframes spin { to { transform: rotate(360deg); } } .leaflet-container { z-index: 1; }`}</style>
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>
        {renderView()}
      </main>
      {modalNueva && <ModalNuevaSolicitud onClose={() => setModalNueva(false)} onGuardar={handleGuardarSolicitud} />}
      {resultadoClustering && <ModalClusteringResultado resultado={resultadoClustering} onClose={() => setResultadoClustering(null)} />}
    </div>
  );
}
