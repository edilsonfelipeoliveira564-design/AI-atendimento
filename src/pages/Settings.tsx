import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Users, 
  CreditCard, 
  Settings2, 
  Smartphone, 
  Plus, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Save,
  Trash2,
  Edit2,
  RefreshCw,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { cn } from '@/src/lib/utils';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'users' | 'licenses' | 'ai'>('whatsapp');

  const tabs = [
    { id: 'whatsapp', label: 'Conexão WhatsApp', icon: Smartphone },
    { id: 'users', label: 'Usuários & Cargos', icon: Users },
    { id: 'licenses', label: 'Licenças SaaS', icon: CreditCard },
    { id: 'ai', label: 'Configurações AI', icon: Settings2 },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Configurações do Sistema</h1>
          <p className="text-neutral-500 mt-1">Gerencie conexões, usuários e parâmetros da inteligência artificial.</p>
        </div>

        <div className="flex gap-8">
          {/* Tabs Sidebar */}
          <div className="w-64 shrink-0 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  activeTab === tab.id 
                    ? "bg-white dark:bg-neutral-900 text-emerald-600 shadow-sm border border-neutral-200 dark:border-neutral-800" 
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            {activeTab === 'whatsapp' && <WhatsAppSection />}
            {activeTab === 'users' && <UsersSection />}
            {activeTab === 'licenses' && <LicensesSection />}
            {activeTab === 'ai' && <AIConfigSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface WhatsAppConnection {
  id: string;
  status: 'connected' | 'disconnected' | 'expired';
  label: string;
  connectedAt?: any;
  phoneNumber?: string;
}

interface QRSession {
  id: string;
  status: 'waiting_qr' | 'qr_ready' | 'paired' | 'expired';
  qrPayload: string;
  expiresAt: any;
}

function WhatsAppSection() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [activeSession, setActiveSession] = useState<QRSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isManualAdd, setIsManualAdd] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [manualLabel, setManualLabel] = useState('');

  useEffect(() => {
    if (!user) return;
    
    // Listen to real connections
    const q = query(collection(db, 'whatsappConnections'), where('ownerUserId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConnections(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WhatsAppConnection)));
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user || connections.length > 0) return;
    
    // Seed some example connections for the Admin user to show it working
    if (user.uid === 'admin-bypass-id') {
      const seedConnections = [
        {
          ownerUserId: user.uid,
          status: 'connected',
          label: 'Atendimento Principal',
          connectedAt: serverTimestamp(),
          phoneNumber: '+55 (11) 99876-5432'
        },
        {
          ownerUserId: user.uid,
          status: 'connected',
          label: 'Plantão de Vendas',
          connectedAt: serverTimestamp(),
          phoneNumber: '+55 (11) 91234-5678'
        }
      ];

      seedConnections.forEach(conn => {
        addDoc(collection(db, 'whatsappConnections'), conn);
      });
    }
  }, [user, connections.length]);

  // Timer for QR expiry
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'qr_ready') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const expiry = activeSession.expiresAt instanceof Timestamp 
        ? activeSession.expiresAt.toMillis() 
        : new Date(activeSession.expiresAt).getTime();
      
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0 && activeSession.status !== 'expired') {
        handleExpireSession(activeSession.id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleExpireSession = async (sessionId: string) => {
    await updateDoc(doc(db, 'whatsappConnectionSessions', sessionId), {
      status: 'expired'
    });
    // Auto-refresh logic
    startNewSession();
  };

  const startNewSession = async () => {
    if (!user) return;
    if (connections.length >= 10) {
      alert("Limite de 10 conexões atingido.");
      return;
    }

    setIsManualAdd(false);
    setIsGenerating(true);
    try {
      // 1. Call backend to get real QR payload
      const response = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, label: `Conexão ${connections.length + 1}` })
      });
      const sessionData = await response.json();

      // 2. Create session in Firestore for real-time tracking
      const sessionRef = await addDoc(collection(db, 'whatsappConnectionSessions'), {
        ownerUserId: user.uid,
        status: 'qr_ready',
        qrPayload: sessionData.qrPayload,
        createdAt: serverTimestamp(),
        expiresAt: sessionData.expiresAt,
        label: sessionData.label
      });

      // 3. Listen to this specific session
      const unsubscribe = onSnapshot(doc(db, 'whatsappConnectionSessions', sessionRef.id), (snapshot) => {
        const data = snapshot.data();
        if (data) {
          const session = { id: snapshot.id, ...data } as QRSession;
          setActiveSession(session);

          if (session.status === 'paired') {
            // Create the actual connection
            addDoc(collection(db, 'whatsappConnections'), {
              ownerUserId: user.uid,
              status: 'connected',
              label: data.label,
              connectedAt: serverTimestamp(),
              phoneNumber: '+55 (11) 9' + Math.floor(10000000 + Math.random() * 90000000)
            });
            setActiveSession(null);
            unsubscribe();
          }
        }
      });

    } catch (error) {
      console.error("Erro ao gerar QR:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!manualNumber || !manualLabel) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    try {
      await addDoc(collection(db, 'whatsappConnections'), {
        ownerUserId: user.uid,
        status: 'connected',
        label: manualLabel,
        connectedAt: serverTimestamp(),
        phoneNumber: manualNumber
      });
      setManualNumber('');
      setManualLabel('');
      setIsManualAdd(false);
    } catch (error) {
      console.error("Erro ao adicionar conexão manual:", error);
    }
  };

  const simulatePairing = async () => {
    if (!activeSession) return;
    await fetch(`/api/whatsapp/session/${activeSession.id}/simulate-pair`, { method: 'POST' });
    // The Firestore listener will pick up the change
    await updateDoc(doc(db, 'whatsappConnectionSessions', activeSession.id), {
      status: 'paired'
    });
  };

  const removeConnection = async (id: string) => {
    await deleteDoc(doc(db, 'whatsappConnections', id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="text-xl font-bold mb-1">Gerenciamento de WhatsApp</h3>
            <p className="text-sm text-neutral-500">Conecte até 10 números para automação de pré-atendimento.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setActiveSession(null);
                setIsManualAdd(!isManualAdd);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
            >
              {isManualAdd ? <XCircle className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              {isManualAdd ? 'Cancelar' : 'Adição Manual'}
            </button>
            <button 
              onClick={startNewSession}
              disabled={isGenerating || !!activeSession}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Nova Conexão (QR)
            </button>
          </div>
        </div>

        {isManualAdd && (
          <div className="mb-8 p-8 border-2 border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-3xl">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Adicionar Número Manualmente
            </h4>
            <form onSubmit={handleManualAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Número de WhatsApp</label>
                <input 
                  type="text" 
                  placeholder="+55 (11) 99999-9999"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Identificação (Label)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Vendas Matriz"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button 
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  Salvar Conexão
                </button>
              </div>
            </form>
          </div>
        )}

        {activeSession && (
          <div className="mb-8 p-8 border-2 border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-3xl flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm uppercase tracking-widest">
              <QrCode className="w-4 h-4" />
              {activeSession.status === 'qr_ready' ? 'Escaneie o QR Code' : 
               activeSession.status === 'expired' ? 'QR Code Expirado' : 'Preparando Conexão...'}
            </div>

            <div className="relative p-4 bg-white rounded-2xl shadow-xl mb-6 overflow-hidden">
              {activeSession.status === 'qr_ready' ? (
                <QRCodeSVG value={activeSession.qrPayload} size={200} />
              ) : activeSession.status === 'expired' ? (
                <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                  <AlertTriangle className="w-10 h-10 text-orange-500 mb-2" />
                  <p className="text-xs font-bold text-neutral-500">Expirado</p>
                </div>
              ) : (
                <div className="w-[200px] h-[200px] flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-2" />
                  <p className="text-[10px] text-neutral-400 animate-pulse">Gerando sessão...</p>
                </div>
              )}
              
              {activeSession.status === 'qr_ready' && timeLeft < 10 && timeLeft > 0 && (
                <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-bounce">
                  Expira em {timeLeft}s
                </div>
              )}
            </div>

            <div className="space-y-2">
              {activeSession.status === 'expired' ? (
                <p className="text-sm text-neutral-500">O tempo limite para pareamento foi atingido.</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Abra o WhatsApp {">"} Aparelhos conectados {">"} Conectar um aparelho</p>
                  <p className="text-xs text-neutral-400">O QR Code atualiza automaticamente para sua segurança.</p>
                </>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => setActiveSession(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-700 transition-all"
              >
                Cancelar
              </button>
              
              {activeSession.status === 'expired' ? (
                <button 
                  onClick={startNewSession}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  Gerar Novo QR
                </button>
              ) : (
                <button 
                  onClick={simulatePairing}
                  className="px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-all"
                >
                  Simular Scan (Dev)
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {connections.length === 0 && !activeSession && (
            <div className="py-12 text-center border-2 border-dashed border-neutral-100 dark:border-neutral-800 rounded-3xl">
              <Smartphone className="w-12 h-12 text-neutral-200 dark:text-neutral-700 mx-auto mb-4" />
              <p className="text-sm text-neutral-400">Nenhum número conectado ainda.</p>
            </div>
          )}
          
          {connections.map((conn) => (
            <div key={conn.id} className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-neutral-900 flex items-center justify-center border border-neutral-100 dark:border-neutral-800">
                  <Smartphone className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold">{conn.phoneNumber}</h4>
                  <p className="text-xs text-neutral-500">{conn.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right mr-4">
                  <span className="text-[10px] block text-neutral-400 uppercase font-bold tracking-widest mb-1">Status</span>
                  <span className="text-xs font-bold text-emerald-500 flex items-center gap-1 justify-end">
                    <CheckCircle2 className="w-3 h-3" /> Ativo
                  </span>
                </div>
                <button 
                  onClick={() => removeConnection(conn.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg text-neutral-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersSection() {
  const users = [
    { id: 1, name: 'Alex Admin', email: 'admin@system.local', role: 'super_admin', status: 'active' },
    { id: 2, name: 'Ricardo Silva', email: 'ricardo@imobi.com', role: 'manager', status: 'active' },
    { id: 3, name: 'Juliana Costa', email: 'juliana@imobi.com', role: 'agent', status: 'active' },
    { id: 4, name: 'Marcos Oliveira', email: 'marcos@imobi.com', role: 'agent', status: 'paused' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-bold mb-1">Equipe & Permissões</h3>
            <p className="text-sm text-neutral-500">Gerencie quem tem acesso à plataforma e seus níveis de permissão.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all">
            <Plus className="w-4 h-4" />
            Novo Usuário
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-neutral-100 dark:border-neutral-800">
                <th className="pb-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Usuário</th>
                <th className="pb-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Cargo</th>
                <th className="pb-4 text-xs font-bold text-neutral-400 uppercase tracking-widest">Status</th>
                <th className="pb-4 text-xs font-bold text-neutral-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
              {users.map((user) => (
                <tr key={user.id} className="group">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{user.name}</p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-xs px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md capitalize">
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", user.status === 'active' ? "bg-emerald-500" : "bg-neutral-300")} />
                      <span className="text-xs text-neutral-500 capitalize">{user.status}</span>
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-emerald-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LicensesSection() {
  const licenses = [
    { id: 1, company: 'Imobiliária Central', users: '10/10', expires: '20/12/2026', status: 'active' },
    { id: 2, company: 'Viver Bem Imóveis', users: '05/20', expires: '15/05/2026', status: 'active' },
    { id: 3, company: 'Luxury Homes', users: '02/05', expires: '01/01/2026', status: 'expired' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-bold mb-1">Gestão de Licenças SaaS</h3>
            <p className="text-sm text-neutral-500">Controle as empresas cadastradas e seus limites de uso.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all">
            <Plus className="w-4 h-4" />
            Nova Licença
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {licenses.map((license) => (
            <div key={license.id} className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white dark:bg-neutral-900 flex items-center justify-center border border-neutral-100 dark:border-neutral-800">
                  <Shield className={cn("w-6 h-6", license.status === 'active' ? "text-emerald-600" : "text-neutral-400")} />
                </div>
                <div>
                  <h4 className="font-bold">{license.company}</h4>
                  <div className="flex gap-4 mt-1">
                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {license.users} Usuários
                    </p>
                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Expira em {license.expires}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={cn(
                  "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-widest",
                  license.status === 'active' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  {license.status}
                </span>
                <button className="p-2 hover:bg-white dark:hover:bg-neutral-900 rounded-lg text-neutral-400 transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIConfigSection() {
  const [tone, setTone] = useState('friendly');

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xl font-bold mb-1">Parâmetros da Inteligência Artificial</h3>
          <p className="text-sm text-neutral-500">Ajuste como a AI se comporta durante o pré-atendimento.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all">
          <Save className="w-4 h-4" />
          Salvar Alterações
        </button>
      </div>

      <div className="space-y-8">
        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Tom de Voz</label>
          <div className="grid grid-cols-3 gap-4">
            {['friendly', 'premium', 'direct'].map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all text-left",
                  tone === t 
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/10" 
                    : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                )}
              >
                <p className="font-bold capitalize mb-1">{t === 'friendly' ? 'Amigável' : t === 'premium' ? 'Executivo' : 'Direto'}</p>
                <p className="text-xs text-neutral-500">
                  {t === 'friendly' ? 'Conversa leve e acolhedora.' : t === 'premium' ? 'Linguagem formal e exclusiva.' : 'Focado em dados e rapidez.'}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Taxa de Juros Simulação (%)</label>
            <input 
              type="number" 
              defaultValue="9.5" 
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Prazo Máximo (Meses)</label>
            <input 
              type="number" 
              defaultValue="420" 
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Perguntas de Qualificação</label>
          <div className="space-y-2">
            {[
              "Qual região você tem preferência?",
              "Qual o número de quartos ideal?",
              "Já possui uma reserva para entrada?",
              "Qual sua renda familiar aproximada?"
            ].map((q, i) => (
              <div key={i} className="flex gap-2">
                <input 
                  type="text" 
                  defaultValue={q} 
                  className="flex-1 px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none"
                />
                <button className="p-2 text-neutral-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button className="text-emerald-600 text-xs font-bold uppercase tracking-widest flex items-center gap-1 mt-2">
              <Plus className="w-3 h-3" /> Adicionar Pergunta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
