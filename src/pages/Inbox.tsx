import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Send, 
  User, 
  MapPin, 
  Home, 
  BedDouble, 
  DollarSign, 
  Calendar, 
  Sparkles,
  Bot,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { cn, formatDate } from '@/src/lib/utils';
import { generateAIResponse, extractLeadData } from '@/src/services/gemini';

interface Conversation {
  id: string;
  contactName: string;
  lastMessage: string;
  timestamp: any;
  leadStatus: 'Novo' | 'Qualificando' | 'Qualificado' | 'Em atendimento' | 'Finalizado';
  leadTemperature: 'Frio' | 'Morno' | 'Quente';
  unreadCount?: number;
}

interface Message {
  id: string;
  text: string;
  sender: 'client' | 'agent' | 'ai';
  timestamp: any;
}

interface LeadProfile {
  name?: string;
  region?: string;
  propertyType?: string;
  bedrooms?: string;
  budgetRange?: string;
  paymentType?: string;
  incomeEstimate?: string;
  downPayment?: string;
  purchaseTimeline?: string;
  missingFields?: string[];
}

export default function Inbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [leadProfile, setLeadProfile] = useState<LeadProfile | null>(null);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mock initial data if firestore is empty
  useEffect(() => {
    const q = query(collection(db, 'conversations'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      setConversations(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    const q = query(collection(db, 'conversations', selectedId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    });

    const profileUnsubscribe = onSnapshot(doc(db, 'leadProfiles', selectedId), (doc) => {
      if (doc.exists()) {
        setLeadProfile(doc.data() as LeadProfile);
      }
    });

    return () => {
      unsubscribe();
      profileUnsubscribe();
    };
  }, [selectedId]);

  // Automate AI Response when a client message is received
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'client' && !isGenerating) {
        const timer = setTimeout(() => {
          handleAIResponse();
        }, 1500); // 1.5s delay for natural feel
        return () => clearTimeout(timer);
      }
    }
  }, [messages, isGenerating, selectedId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const simulateIncomingLead = async () => {
    const names = ['João Silva', 'Maria Oliveira', 'Carlos Santos', 'Ana Costa', 'Pedro Rocha'];
    const messages = [
      'Olá, vi um anúncio de um apartamento no centro e gostaria de saber mais.',
      'Oi, estou procurando uma casa com 3 quartos na região sul.',
      'Boa tarde! Qual o valor daquele sobrado que vocês postaram?',
      'Tenho interesse em investir em um imóvel comercial, vocês tem opções?',
      'Gostaria de fazer uma simulação de financiamento para um imóvel de 400 mil.'
    ];
    
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];

    try {
      const convRef = await addDoc(collection(db, 'conversations'), {
        contactName: randomName,
        lastMessage: randomMsg,
        timestamp: serverTimestamp(),
        leadStatus: 'Novo',
        leadTemperature: 'Morno',
        unreadCount: 1
      });

      await addDoc(collection(db, 'conversations', convRef.id, 'messages'), {
        text: randomMsg,
        sender: 'client',
        timestamp: serverTimestamp()
      });

      await setDoc(doc(db, 'leadProfiles', convRef.id), {
        name: randomName,
        missingFields: ['Região', 'Tipo de Imóvel', 'Quartos', 'Orçamento', 'Entrada']
      });

      setSelectedId(convRef.id);
    } catch (error) {
      console.error("Erro ao simular lead:", error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedId) return;

    const text = inputText;
    setInputText('');

    await addDoc(collection(db, 'conversations', selectedId, 'messages'), {
      text,
      sender: 'agent',
      timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, 'conversations', selectedId), {
      lastMessage: text,
      timestamp: serverTimestamp()
    });
  };

  const handleSimulateClientMessage = async () => {
    if (!inputText.trim() || !selectedId) return;

    const text = inputText;
    setInputText('');

    await addDoc(collection(db, 'conversations', selectedId, 'messages'), {
      text,
      sender: 'client',
      timestamp: serverTimestamp()
    });

    await updateDoc(doc(db, 'conversations', selectedId), {
      lastMessage: text,
      timestamp: serverTimestamp()
    });
  };

  const handleAIResponse = async () => {
    if (!selectedId || messages.length === 0) return;
    setIsGenerating(true);
    try {
      const history = messages.map(m => ({
        role: m.sender === 'client' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const systemInstruction = "Você é um assistente de pré-atendimento imobiliário humano, empático e eficiente. Seu objetivo é qualificar o lead naturalmente, coletando informações sobre região, tipo de imóvel, orçamento e entrada. Use termos como 'estimado' e 'sujeito a aprovação bancária'. Nunca garanta aprovação de crédito.";
      
      const aiText = await generateAIResponse(history, systemInstruction);
      
      await addDoc(collection(db, 'conversations', selectedId, 'messages'), {
        text: aiText,
        sender: 'ai',
        timestamp: serverTimestamp()
      });

      // Extract lead data
      const conversationText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
      const extractedData = await extractLeadData(conversationText);
      await updateDoc(doc(db, 'leadProfiles', selectedId), extractedData);

    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedId);

  return (
    <div className="flex h-full">
      {/* Left Panel: Conversations */}
      <div className="w-80 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-white dark:bg-neutral-900">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg">Conversas</h2>
            <button 
              onClick={simulateIncomingLead}
              className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all group"
              title="Simular Mensagem WhatsApp"
            >
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="w-full pl-9 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              className={cn(
                "w-full p-4 flex gap-3 text-left border-b border-neutral-50 dark:border-neutral-800/50 transition-all",
                selectedId === conv.id ? "bg-emerald-50 dark:bg-emerald-900/10" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              )}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center font-bold text-neutral-500">
                  {conv.contactName.charAt(0)}
                </div>
                <div className={cn(
                  "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900",
                  conv.leadTemperature === 'Quente' ? "bg-orange-500" : conv.leadTemperature === 'Morno' ? "bg-yellow-500" : "bg-blue-500"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-sm truncate">{conv.contactName}</h3>
                  <span className="text-[10px] text-neutral-400 uppercase font-medium">
                    {conv.timestamp?.toDate ? formatDate(conv.timestamp.toDate()) : 'Agora'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 truncate mb-2">{conv.lastMessage}</p>
                <div className="flex gap-2">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider",
                    conv.leadStatus === 'Qualificado' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                  )}>
                    {conv.leadStatus}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Center Panel: Chat */}
      <div className="flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950">
        {selectedConv ? (
          <>
            <div className="p-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center font-bold">
                  {selectedConv.contactName.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-sm">{selectedConv.contactName}</h2>
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    AI Ativa
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleAIResponse}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Gerar Resposta AI
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all">
                  <UserCheck className="w-3.5 h-3.5" />
                  Assumir Lead
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    msg.sender === 'client' ? "mr-auto" : "ml-auto items-end"
                  )}
                >
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm shadow-sm",
                    msg.sender === 'client' 
                      ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-tl-none" 
                      : msg.sender === 'ai'
                        ? "bg-emerald-600 text-white rounded-tr-none"
                        : "bg-neutral-800 dark:bg-neutral-700 text-white rounded-tr-none"
                  )}>
                    {msg.sender === 'ai' && (
                      <div className="flex items-center gap-1.5 mb-1 opacity-80 text-[10px] uppercase font-bold tracking-widest">
                        <Bot className="w-3 h-3" />
                        Assistente AI
                      </div>
                    )}
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 px-1">
                    {msg.timestamp?.toDate ? formatDate(msg.timestamp.toDate()) : 'Enviando...'}
                  </span>
                </div>
              ))}
              {isGenerating && (
                <div className="flex flex-col max-w-[80%] ml-auto items-end animate-pulse">
                  <div className="px-4 py-3 bg-emerald-600/50 text-white rounded-2xl rounded-tr-none text-sm">
                    AI está digitando...
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={handleSimulateClientMessage}
                  title="Simular Mensagem do Cliente"
                  className="p-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                >
                  <User className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  title="Enviar como Corretor"
                  className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm">Selecione uma conversa para começar</p>
          </div>
        )}
      </div>

      {/* Right Panel: Lead Profile */}
      <div className="w-80 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-y-auto">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="font-bold text-lg mb-1">Perfil do Lead</h2>
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">Estruturado por AI</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <ProfileItem icon={User} label="Nome" value={leadProfile?.name} />
            <ProfileItem icon={MapPin} label="Região" value={leadProfile?.region} />
            <ProfileItem icon={Home} label="Tipo de Imóvel" value={leadProfile?.propertyType} />
            <ProfileItem icon={BedDouble} label="Quartos" value={leadProfile?.bedrooms} />
            <ProfileItem icon={DollarSign} label="Orçamento" value={leadProfile?.budgetRange} />
            <ProfileItem icon={Calendar} label="Prazo" value={leadProfile?.purchaseTimeline} />
          </div>

          <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Financeiro</h3>
            <div className="space-y-4">
              <ProfileItem label="Renda" value={leadProfile?.incomeEstimate} />
              <ProfileItem label="Entrada" value={leadProfile?.downPayment} />
              <ProfileItem label="Pagamento" value={leadProfile?.paymentType} />
            </div>
          </div>

          {leadProfile?.missingFields && leadProfile.missingFields.length > 0 && (
            <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Campos Faltantes
              </h3>
              <div className="flex flex-wrap gap-2">
                {leadProfile.missingFields.map(field => (
                  <span key={field} className="text-[10px] px-2 py-1 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-md border border-red-100 dark:border-red-900/20">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6">
            <button className="w-full py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">
              Exportar para CRM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileItem({ icon: Icon, label, value }: { icon?: any, label: string, value?: string }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="mt-0.5 p-1.5 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <Icon className="w-3.5 h-3.5 text-neutral-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-0.5">{label}</p>
        <p className={cn(
          "text-sm font-medium truncate",
          value ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-300 dark:text-neutral-700 italic"
        )}>
          {value || 'Não informado'}
        </p>
      </div>
    </div>
  );
}
